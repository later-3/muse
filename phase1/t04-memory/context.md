# T04 记忆层 — 评审上下文

> 本文档为评审 agent 提供必要的上下文，帮助理解 T04 在整个 Muse 助手中的位置和约束。

---

## 1. 项目背景

Muse 是一个基于 OpenCode 的终身 AI 助手，采用 **大脑/小脑** 双进程架构：
- **大脑 (Cortex)**: OpenCode serve 进程，负责推理和对话
- **小脑 (Cerebellum)**: 独立守护进程，负责监控、重启、清理

### 核心原则
- **不改 OpenCode 源码**，通过 Plugin/Hook/MCP/Skill 扩展
- 所有模块遵循 `start()/stop()/health()` 生命周期接口
- 所有数据表预留 `agent_id` 字段，为 Phase 4 多 Agent 家庭做准备

---

## 2. 已完成的模块 (T01-T03)

### T01 脚手架
- **config.mjs**: 配置管理，Memory 相关配置为 `config.memory.dbPath` 和 `config.memory.maxEpisodicDays`
- **logger.mjs**: `createLogger(module)` 结构化日志
- **package.json**: better-sqlite3 已作为依赖

### T02 身份系统 (identity.mjs)
- Identity 类实现了 `start()/stop()/health()` 生命周期
- 使用 `structuredClone()` 保护内部状态不被外部修改
- 从文件加载时如果不存在则自动创建默认配置
- 文件变更时自动 reload，失败时回退到 last-known-good

### T03 引擎层 (engine.mjs)
- Engine 类封装了 OpenCode REST API
- 提供 session 管理: `createSession()`, `listSessions()`, `getSession()`, `deleteSession()`
- 提供消息收发: `sendAndWait()`, `sendMessageAsync()`
- 所有 HTTP 请求包含重试逻辑（可重试/不可重试分类）

---

## 3. T04 记忆层在架构中的位置

```
adapters / web / daemon (上层)
         ↓
    orchestrator   ← T05 编排层是 Memory 的主要消费者
         ↓
  engine / memory / identity (下层，本层)
```

**Memory 对外输出的核心接口**：

- **给 T05 编排层**:
  - `searchMemories(keyword)` — 检索相关语义记忆
  - `getRecentSummaries(days)` — 最近 N 天情景摘要
  - `addEpisode(sid, role, content)` — 存对话记录
  - `setMemory(key, value)` — 存提取的偏好

- **给 T07 Web 驾驶舱**:
  - `listMemories()` — 列出所有语义记忆
  - `searchEpisodes(keyword)` — 搜索对话记录
  - `getEpisodicStats()` — 统计面板用

- **给 T08 小脑**:
  - WAL 模式保证并发安全（小脑侧的定时清理不阻塞主进程写入）

---

## 4. 技术约束

| 约束 | 说明 |
|------|------|
| **运行时** | Node.js >= 20 (ESM) |
| **数据库** | better-sqlite3 (同步 API, C++ binding) |
| **测试** | `node:test` + `node:assert/strict` (零依赖) |
| **文件结构** | 代码 `muse/core/memory.mjs`, 测试 `muse/core/memory.test.mjs` |
| **数据目录** | `muse/data/memory.db` (gitignore) |
| **并发** | WAL 模式，读写分离; 主进程写，小脑可并发读 |
| **存量代码约定** | 构造函数接收 config, 私有字段用 `#`, 日志用 `createLogger('memory')` |

---

## 5. 关键源码参考

评审 agent 应该参考以下文件理解已有模式：

| 文件 | 参考点 |
|------|--------|
| `muse/config.mjs` | `config.memory.*` 配置结构 |
| `muse/core/identity.mjs` | 生命周期 pattern, 防御性编程 (structuredClone, last-known-good) |
| `muse/core/identity.test.mjs` | 测试模式: 临时目录 + beforeEach + stop 清理 |
| `muse/core/engine.mjs` | Session CRUD API (工作记忆代理) |
| `phase1/README.md` | 大脑/小脑架构, 4 层记忆定义, agent_id 预留 |
| `assistant-prep/muse-vision.md` | 愿景: 记忆仪表盘, 主动回忆, 家庭共享记忆 |

---

## 6. Phase 1 vs Phase 2 边界

| 能力 | Phase 1 (本次) | Phase 2 (后续) |
|------|---------------|---------------|
| 语义检索 | LIKE 模糊匹配 | sqlite-vec 向量索引 |
| Token 计数 | 字符数/4 估算 | tiktoken 精确计数 |
| 摘要生成 | 预留字段，手动/null | LLM 自动生成 |
| 记忆维护 | 手动清理 | 小脑定时 hygiene + 压缩 |
| 时间衰减 | 无 (直接过滤) | 检索时加权衰减 |
| 偏好提取 | T05 简单规则 | LLM 自动提取 |
