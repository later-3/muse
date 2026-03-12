# T11: Memory MCP — 记忆工具化

## 背景

### 现状 (Phase 1)

Orchestrator 手动管理记忆:

```
用户: "我叫 Later"
       ↓
Orchestrator.#buildPrompt():
  1. extractKeywords("我叫 Later") → ["Later"]
  2. memory.searchMemories("Later") → 手动查 SQLite
  3. 拼进 prompt: "## 你对用户的了解\n- user_name: Later"
       ↓
Orchestrator.#postProcess():
  4. 正则 /我(?:叫|是)\\s*(.+)/ → 提取 "Later"
  5. memory.setMemory("user_name", "Later") → 手动存 SQLite
```

问题:
- **AI 不参与记忆决策** — 是代码正则在决定"存什么、不存什么"
- **每轮机械注入** — 不管 AI 需不需要，都把记忆塞进 prompt
- **关键词提取质量差** — N-gram + 偏好词表，漏检/误检都多
- **上下文膨胀** — 随记忆增多，每轮拼接越来越长

### 目标 (Phase 2)

```
用户: "我叫 Later"
       ↓
OpenCode serve (AI):
  1. AI 读到消息，自主判断 "用户告诉了我名字"
  2. AI 调用 MCP 工具: set_memory({ key: "user_name", value: "Later" })
       ↓
Memory MCP Server:
  3. 收到 MCP 调用 → SQLite 写入
  4. 返回: { key: "user_name", old_value: null, new_value: "Later" }

第二天:
  AI 开始新对话 → 自主调用 search_memory({ query: "用户" })
  → 拿到 user_name=Later → "Later，早上好～"
```

核心变化: **AI 自己决定什么时候存、什么时候取、存什么、取什么。**

---

## 技术方案

### 架构

```
┌─────────────┐    MCP (stdio)    ┌──────────────────┐
│ OpenCode    │ ←───────────────→ │ Memory MCP Server │
│ serve       │  search_memory    │ (node muse/mcp/   │
│ (AI 大脑)   │  set_memory       │   memory.mjs)    │
│             │  get_user_profile │                    │
│             │  get_episodes     │    ┌──────────┐   │
│             │  add_episode      │    │ SQLite   │   │
└─────────────┘                   │    │ memory.db│   │
                                  │    └──────────┘   │
                                  └──────────────────┘
```

### MCP Server 实现

新建 `muse/mcp/memory.mjs`:
- 使用 `@modelcontextprotocol/sdk` (MCP 官方 SDK)
- stdio 传输 (OpenCode 默认方式)
- 复用现有 `Memory` 类 (better-sqlite3)

### MCP 工具定义 (5 个)

| 工具 | 功能 | 参数 | 返回 |
|------|------|------|------|
| `search_memory` | 搜索记忆 | `query: string`, `type?: "semantic"\|"episodic"\|"all"` | 匹配列表 |
| `set_memory` | 存储/更新记忆 | `key: string`, `value: string`, `category?: string` | 新旧值 |
| `get_user_profile` | 获取用户画像 | 无 | 全部语义记忆聚合 |
| `get_recent_episodes` | 最近对话摘要 | `days?: number` | 情景列表 |
| `add_episode` | 记录对话摘要 | `summary: string`, `tags?: string[]` | episode_id |

### 工具语义 (给 AI 看的 description)

```
search_memory:
  搜索用户相关的记忆。
  当需要回忆用户偏好、习惯、个人信息或历史事件时调用。
  返回按相关度排序的记忆列表。

set_memory:
  存储用户的新信息。
  当用户透露偏好、习惯、个人信息时主动调用。
  同 key 自动覆盖旧值 (upsert)。

get_user_profile:
  获取用户完整画像。
  在对话开始或需要全面了解用户时调用。

get_recent_episodes:
  获取最近的对话摘要。
  在需要回顾历史对话、了解之前聊过什么时调用。

add_episode:
  记录本次对话的关键信息。
  每次有意义的对话结束时调用。
```

### opencode.json 注册

```json
{
  "mcp": {
    "memory-server": {
      "type": "stdio",
      "command": "node",
      "args": ["muse/mcp/memory.mjs"],
      "env": {
        "MEMORY_DB_PATH": "./muse/data/memory.db"
      }
    }
  }
}
```

### 降级方案

| 场景 | 行为 |
|------|------|
| MCP Server 启动失败 | Orchestrator 直接查 SQLite (Phase 1 方式) |
| MCP 调用超时 | AI 继续对话但不使用记忆 |
| SQLite 损坏 | MCP 返回错误，AI 告知用户 |

### Memory 表结构变更

现有两表不变。新增 3 个字段预留 (Phase 3-4 用):

```sql
ALTER TABLE semantic_memory ADD COLUMN meta TEXT DEFAULT '{}';
-- meta 存: { capability: true, goal: true, gap: true } 等标记

-- 后续 Phase 3 新表:
-- CREATE TABLE capability_gaps (...)
-- CREATE TABLE goals (...)
```

Phase 2 只加 meta 字段，不加新表。

### 与 Orchestrator 的关系

T11 完成后，Orchestrator 中以下逻辑将被 T13 删除:

| Orchestrator 代码 | 行数 | 替代方式 |
|-------------------|------|---------|
| `extractKeywords()` | 58-89 | AI 自主搜索 |
| `PREFERENCE_PATTERNS` + `#extractPreferences()` | 93-98, 331-339 | AI 自主 set_memory |
| `#searchSemanticMemories()` | 267-288 | AI 自主 search_memory |
| `#formatSemanticMemories()` | 290-294 | AI 直接看 MCP 返回 |
| `#formatSummaries()` | 296-302 | AI 自主 get_episodes |

约 80+ 行代码将被删除/简化。

---

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `muse/mcp/memory.mjs` | **[新建]** | MCP Server 主文件 |
| `muse/mcp/memory.test.mjs` | **[新建]** | 单元测试 |
| `opencode.json` | **[修改]** | 添加 mcp.memory-server |
| `muse/core/memory.mjs` | **[修改]** | 加 meta 字段 + schema 迁移 |
| `package.json` | **[修改]** | 加 @modelcontextprotocol/sdk 依赖 |

Orchestrator 的修改归 T13，T11 不动 Orchestrator。

---

## 测试方案

### 单元测试

| 测试 | 验证 |
|------|------|
| MCP Server 启动/关闭 | 进程正常启退 |
| search_memory 空库 | 返回空数组不报错 |
| set_memory → search_memory | 写入后能搜到 |
| set_memory 同 key 覆盖 | upsert 正确 |
| get_user_profile 空库 | 返回空画像 |
| get_recent_episodes 无数据 | 返回空数组 |
| add_episode | 写入成功返回 id |
| 参数校验 | 缺必填参数返回明确错误 |
| 大量数据搜索 | 100+ 条记忆时性能可接受 |

### 集成测试

| 测试 | 验证 |
|------|------|
| OpenCode + MCP 联调 | 创建 session → AI 能看到 memory 工具 |
| set_memory 端到端 | 发 "我叫 Later" → 查 SQLite 有 user_name=Later |
| search_memory 端到端 | 存入记忆 → 新 session → AI 自主搜索并引用 |
| 降级 | kill MCP → Orchestrator fallback 直接查 SQLite |

### 行为验证

| # | 标准 | 方法 |
|---|------|------|
| 1 | AI **自主调** set_memory (非正则) | 查 MCP 调用日志 |
| 2 | AI **主动调** search_memory (非每轮注入) | 新 session 无硬编码注入 |
| 3 | 同时运行旧 Orchestrator + 新 MCP | 不冲突，都能用 |

---

## 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| AI 不主动调记忆工具 | 中 | 通过 AGENTS.md / Skill 指导 AI 使用 |
| MCP SDK 与 OpenCode 版本不兼容 | 低 | 先查 OpenCode 依赖的 MCP SDK 版本 |
| SQLite 并发: MCP Server + Orchestrator 同时读写 | 中 | WAL 模式 + busy_timeout 已配置 |
| MCP stdio 启动慢 | 低 | OpenCode 会缓存 MCP 连接 |
