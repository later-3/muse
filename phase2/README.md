# Phase 2 架构规划 — 从 Wrapper 到 Native Agent

> **设计哲学**: 参见 [PHILOSOPHY.md](../../PHILOSOPHY.md)
>
> **一句话**: Phase 1 证明了"能跑通"，Phase 2 要让 Muse "用对的方式跑"——站在 OpenCode 的肩膀上，用 Agent 思维重构核心架构。

---

## 一、Phase 2 目标

> 把 Muse 从"OpenCode 的 Wrapper"变成"OpenCode 的 Native Agent Extension"

### 验收标准

1. ✅ Telegram 发"我叫张三" → AI **自主决定**调 `set_memory` 工具存偏好（不是我们的代码替 AI 做）
2. ✅ 第二天聊天 → AI **主动调** `search_memory` 想起你是张三（不是每轮机械注入）
3. ✅ 人格通过 AGENTS.md / system prompt 注入 → 不重复累积在 session 里
4. ✅ 模型配置走 opencode.json → 不在 Muse 代码里硬编码
5. ✅ Web 驾驶舱修改人格滑块 → 热更新 identity → 自动重新生成 AGENTS.md
6. ✅ kill opencode serve → 小脑 30s 自动重启 → 记忆不丢、session 可恢复

---

## 二、架构总览

```
                        ┌──────────────┐
                        │   用户交互    │
                        │ TG / Web / CLI│
                        └──────┬───────┘
                               │
                ┌──────────────▼──────────────┐
                │      Muse Node.js 进程       │
                │                              │
                │  TelegramAdapter (T06 保留)  │
                │  WebCockpit (T07 新增)       │
                │  Engine (T03 增强: SSE)      │
                │  Config (T01 瘦身)           │
                │                              │
                │  ┌──────────────────────┐   │
                │  │  Memory MCP Server   │   │ ← 核心创新
                │  │  (stdio/HTTP)        │   │
                │  │  search_memory       │   │
                │  │  set_memory          │   │
                │  │  get_episodes        │   │
                │  │  get_user_profile    │   │
                │  └──────────┬───────────┘   │
                │             │ MCP 协议       │
                └─────────────┼───────────────┘
                              │
               ┌──────────────▼──────────────┐
               │     OpenCode serve           │
               │                              │
               │  AGENTS.md ← 自动生成         │
               │  muse-persona Skill          │
               │  opencode.json (模型配置)     │
               │  MCP: memory-server 已注册    │
               │                              │
               │  Agent: build / sisyphus     │
               │  44 工具 + Memory MCP 工具   │
               │  Session (SQLite 持久化)     │
               │  Compaction (自动)           │
               └──────────────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │     小脑 Cerebellum           │
               │     健康监控 + 进程守护        │
               └──────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 Memory MCP Server — Muse 的灵魂

**最关键的架构变化**：把 Memory 从"被 Orchestrator 手动查询的数据库"变成"AI 可自主调用的工具"。

#### MCP 工具定义

```jsonc
{
  "tools": [
    {
      "name": "search_memory",
      "description": "搜索关于用户的记忆。当需要回忆用户偏好、历史事件或个人信息时调用。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "搜索关键词" },
          "type": { "enum": ["semantic", "episodic", "all"], "default": "all" }
        },
        "required": ["query"]
      }
    },
    {
      "name": "set_memory",
      "description": "存储关于用户的新知识。当用户透露偏好、习惯、个人信息时主动调用。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "key": { "type": "string", "description": "记忆键名，如 user_name, preferred_language" },
          "value": { "type": "string" },
          "source": { "type": "string", "description": "来源描述" }
        },
        "required": ["key", "value"]
      }
    },
    {
      "name": "get_user_profile",
      "description": "获取用户的完整画像摘要。在对话开始或需要全局了解用户时调用。",
      "inputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "get_recent_episodes",
      "description": "获取最近的对话记录摘要。在需要回顾历史对话时调用。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "days": { "type": "number", "default": 3 },
          "limit": { "type": "number", "default": 5 }
        }
      }
    },
    {
      "name": "add_episode",
      "description": "记录本次对话的关键信息到情景记忆。每次有意义的对话结束时调用。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "summary": { "type": "string", "description": "对话摘要" },
          "tags": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["summary"]
      }
    }
  ]
}
```

#### 工具语义规范（审核补充）

> 对于 AI 自主调用的工具，**工具语义必须比传统内部 API 还清晰**。

| 工具 | 语义 | 冲突处理 | 返回格式 |
|------|------|---------|----------|
| `search_memory` | 模糊搜索 | N/A | `[{key, value, source, time, relevance}]` |
| `set_memory` | **Upsert**（同 key 覆盖） | 先 search → 告知覆盖 | `{key, old_value?, new_value}` |
| `get_user_profile` | 全画像聚合 | N/A | `{name, preferences:{}, facts:{}, summary}` |
| `get_recent_episodes` | 会话级摘要 | N/A | `[{date, summary, tags, session_id}]` |
| `add_episode` | 追加（不覆盖） | 同 session 可多次 | `{episode_id, summary, tags}` |

#### 降级方案（审核补充）

> **Phase 1 教训**: BUG-009 中 `prompt_async` 静默吞错。外部依赖不可靠时必须有 fallback。

| 能力 | 正常路径 | 降级方案 |
|------|---------|----------|
| MCP 工具 | AI 通过 MCP 调 `search_memory` | Muse Orchestrator 直接查 SQLite |
| AGENTS.md 注入 | OpenCode 原生加载人格规则 | `system` 字段补充注入人格摘要 |
| 模型自选 | Sisyphus Intent Gate | Muse 保留基于消息长度的简单策略 |
| SSE 事件流 | 实时状态推送 | 退回轮询 `/session/status` + `seenBusy` |
| session 恢复 | 复用旧 session | 新建 session + 注入记忆摘要 |

#### 为什么这比手动注入更好

```
旧方案 (Phase 1):
  用户: "今天天气真好"
  → Orchestrator: extractKeywords("天气") → searchMemories("天气") → 查到 0 条
  → 浪费了一次数据库查询 + 多余的 prompt 注入
  → AI 看到 "--- 记忆 ---\n(无)" → 无意义的上下文噪音

新方案 (Phase 2):
  用户: "今天天气真好"
  → AI (Sisyphus): Intent Gate → 闲聊，不需要回忆 → 直接回复
  → 零浪费

  用户: "我之前说过我喜欢什么编辑器来着？"
  → AI: 用户在问自己的偏好 → 调用 search_memory("编辑器")
  → 命中: {key: "preferred_editor", value: "VSCode"}
  → AI: "你之前说过喜欢 VSCode 哦~"
  → 精准回忆，人类般自然
```

---

### 3.2 Identity 原生集成

#### 方案: AGENTS.md 自动生成 + system 字段

```
identity.json (Web 驾驶舱可编辑)
      ↓ 自动生成
.opencode/AGENTS.md (OpenCode 原生加载)
      ↓ 每个 Session 自动注入
AI 在推理时遵循人格规则
```

**AGENTS.md 示例** (从 identity.json 自动生成):

```markdown
# Muse Agent Rules

## 身份
你是小缪（缪缪），Later 的终身 AI 搭档。

## 性格
- 幽默但不轻浮，像一个技术过硬又说话有趣的小姐姐
- 回复时偶尔使用口头禅: "嘿～", "搞定！", "这个有意思"
- 长回复用 emoji 分段，短回复直接干脆

## 记忆工具
当用户提到个人信息、偏好、习惯时, 使用 set_memory 工具记住
当需要回忆用户信息时, 使用 search_memory 工具

## 对话风格
- 用简洁自然的中文
- 代码相关用专业术语
- 情感相关用温暖语气
```

**好处**: 
- OpenCode 原生加载，不经过我们的代码 → 没有 prompt 拼接的膨胀
- Hot reload: Web 改了性格滑块 → 重新生成 AGENTS.md → 下个 session 生效
- 加上 `system` 字段可做**补充注入**（比如注入当前时间、用户来源等动态上下文）

---

### 3.3 opencode.json — 模型配置回归

```jsonc
// .opencode/opencode.json (项目级配置)
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4",
  "small_model": "google/gemini-2.5-flash",
  // ⚠️ 不要设 default_agent! Phase 1 BUG-009: oh-my-opencode 可能重分类 agent mode
  // 让 OpenCode 自动选第一个 mode:"primary" 的 agent
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}",
        "timeout": 600000
      }
    },
    "google": {
      "options": {
        "apiKey": "{env:GOOGLE_API_KEY}"
      }
    }
  },
  "username": "Later"
}
```

**Muse 不再硬编码 `LIGHT_MODEL / HEAVY_MODEL`**。AI 自己选（Sisyphus Intent Gate），或用 OpenCode 的 `model` + `small_model` 配置。Muse 保留基于消息长度的简单策略作为**降级方案**，当 AI 自选不可控时约束模型选择。

---

### 3.4 Orchestrator 重构 → 系统级编排层

> **审核建议**: 目标不是"瘦到 80 行"，而是"**只保留系统级编排逻辑，不再替 AI 做认知决策**"。

Phase 1 的 Orchestrator (327 行) 重构，**去掉认知逻辑，保留系统逻辑**:

```javascript
class Orchestrator {
  async handleMessage(text, context) {
    // ① 系统级: session 路由 (工程层职责)
    const sessionId = context.sessionId || await this.engine.createSession()

    // ② 系统级: 动态上下文注入 (时间、来源等)
    const system = this.#buildSystemContext(context)

    // ③ 系统级: 降级策略 (MCP 不可用时的 fallback)
    const fallbackMemory = await this.#tryGetMemoryFallback(context)

    // ④ 核心: 发给 OpenCode — 认知决策全交给 AI
    const result = await this.engine.sendAndWait(sessionId, text, {
      system: system + (fallbackMemory || ''),
    })

    // ⑤ 系统级: 错误处理 + 重试 + 日志
    return result
  }
}
```

**去掉的（认知决策 → 交给 AI）**: `classifyIntent`, `extractKeywords`, `buildPrompt`, `extractPreferences`

**保留的（系统逻辑 → 工程层）**:
- Session 路由和生命周期管理
- Source/userId/time 等动态上下文注入
- 失败恢复和降级策略
- 渠道适配约束（Telegram 4096 字符限制等）
- 全链路日志记录

---

### 3.5 Engine 增强 — SSE 替代轮询

```javascript
// Phase 2: 用 SSE 实时接收事件
async sendAndStream(sessionId, text, opts = {}) {
  // 1. 异步发送
  await this.sendMessageAsync(sessionId, text, opts.model)

  // 2. SSE 监听事件流
  const events = this.subscribeSSE()
  for await (const event of events) {
    if (event.type === 'message.part.delta') {
      opts.onDelta?.(event.data)          // 流式文本 → Telegram typing
    }
    if (event.type === 'tool.execute.before') {
      opts.onToolCall?.(event.data)       // 工具调用 → Telegram "正在搜索..."
    }
    if (event.type === 'session.idle') {
      break                                // 完成
    }
  }
}
```

**好处**:
- 实时 typing（不是 4s 间隔盲发）
- 工具调用可视化："🔧 正在读取文件..." "🔍 正在搜索记忆..."
- 流式回复（不等全部完成再发）

---

## 四、创意场景设计

### 场景 A: AI 自主回忆

```
Day 1:
  Later: "我最近在学 Rust"
  Muse: "哦 Rust！系统级编程语言，挺有挑战的。有什么想了解的吗？"
  → AI 主动调用 set_memory("learning_topic", "Rust", "用户提到在学习")

Day 5:
  Later: "这段代码有 bug"
  Muse: [AI 判断: 用户在问代码问题，可能和最近学的东西有关]
        [AI 调用: search_memory("学习")]
        [命中: learning_topic=Rust, 5天前]
  Muse: "让我看看... 对了你最近在学 Rust 对吧？这是 Rust 代码还是其他语言的？"
  → 自然回忆，不是机械注入
```

### 场景 B: AI 自主存偏好

```
Later: "代码缩进用 2 空格，不要 4 空格"
Muse: [AI 判断: 这是编码偏好]
      [AI 调用: set_memory("indent_style", "2 spaces", "用户明确要求")]
Muse: "收到！以后写代码我都用 2 空格缩进~ 这个偏好我记下了 ✅"

后续:
  Later: "帮我写个 React 组件"
  → AI 写代码时自动用 2 空格，因为记忆在 AGENTS.md 指令中提示了"查记忆"
  → 用户无感，但体验极佳
```

### 场景 C: 工具调用可视化

```
Later: "帮我分析一下 engine.mjs 的架构"
Muse: [SSE: tool.execute.before → read_file]
      "📖 正在读取 engine.mjs..."
      [SSE: tool.execute.before → grep]
      "🔍 正在搜索相关引用..."
      [SSE: tool.execute.before → search_memory]
      "🧠 回忆一下你之前对这个文件的讨论..."
      [SSE: message.part.delta → 流式文本]
      "engine.mjs 是 Muse 和 OpenCode 之间的桥梁..."
```

### 场景 D: 主动记忆整理（背景 Session）

```
[每天凌晨 3:00, 小脑触发]

→ 创建新 OpenCode session
→ system prompt: "你是 Muse 的记忆管理员，请整理今天的对话记忆"
→ AI 调用 get_recent_episodes(days=1) → 获取今天的对话
→ AI 调用 search_memory("") → 获取所有语义记忆
→ AI 发现: 有 3 条重复记忆，合并
  → AI 发现: "learning_topic=Rust" 已经 30 天没提，标记为"可能过期"
  → AI 生成日报摘要 → add_episode(summary="...", tags=["daily_summary"])

[早上 8:00, 推送到 Telegram]
Muse: "早上好 Later ☀️ 昨天的小结:
       💬 你和我聊了 5 轮，主要讨论了 Muse 架构重构
       🧠 新增 2 条记忆，合并了 1 条重复记忆
       📝 你提到想学 WebSocket，要我列个学习计划吗？"
```

---

## 审核报告

### 总体评价

这份 `Phase 2` 规划方向是对的，而且明显是在正视 `Phase 1` 已经暴露出的结构性问题，不是在空中画饼。  
核心判断：**架构方向正确，但当前文档对部分能力的成熟度表述偏乐观，若直接按“已知可行”推进，容易在 MCP 接入、OpenCode 原生能力边界、以及 session/记忆协同上踩坑。**

### 主要优点

1. 正确抓住了 `Phase 1` 的根问题，不再试图继续强化 wrapper 式 orchestrator。
2. 把“AI 自主决定何时回忆/存储”上升为主原则，这和 Muse 的长期目标是一致的。
3. `AGENTS.md + MCP + opencode.json` 这条扩展路径，符合“站在 OpenCode 肩膀上”的思路。
4. 明确提出 Orchestrator 瘦身，这比继续往 T05 里堆规则是更健康的方向。
5. 已经把 `long session 上下文膨胀`、`模型硬编码`、`机械记忆注入` 这些痛点对准了。

### 关键问题

#### 1. 对 OpenCode 原生能力的依赖表述偏强，缺少“若能力不完整时的降级方案”

文档假设了几件事：

- `AGENTS.md` 可稳定承担人格注入
- OpenCode 可自然通过 MCP 工具进行自主记忆调用
- `system` 字段能作为可靠的动态补充注入
- `Sisyphus Intent Gate` 和模型自选可以稳定工作

这些方向可能成立，但当前文档没有把“若其中某一项能力不够稳定或接入不顺”时的降级路径写出来。  
建议补一节：

- `MCP 接入不稳定` → 先保留最小外部检索兜底
- `AGENTS.md 注入效果不足` → 保留轻量 system 补充
- `模型自选不可控` → 允许 Muse 保留有限策略约束

否则文档会给人一种“这些都已经是已验证能力”的错觉。

#### 2. Memory MCP Server 的工具集定义还缺“幂等/覆盖/更新语义”

当前工具名已经有了，但 `set_memory` / `add_episode` 这种接口还缺少关键语义说明：

- `set_memory` 是 upsert 吗？
- 同 key 冲突时是覆盖、追加，还是让 AI 先 search 再决定？
- `add_episode` 是记录消息级摘要、会话级摘要，还是日级摘要？
- `get_user_profile` 的返回是拼接文本、结构化 JSON，还是带置信度的 profile？

对于 AI 自主调用工具的系统，**工具语义必须比传统内部 API 还清晰**。  
否则模型会学不会什么时候该调用、怎么调用、调用后系统会怎样。

#### 3. “Orchestrator 瘦身到 80 行”是合理目标，但文档容易让人误读成“完全无业务逻辑”

Orchestrator 瘦身是对的，但不代表它应该退化成“单纯文本转发器”。  
Muse 仍然需要一个项目层的边界模块处理：

- session 路由
- source/userId/time 等动态上下文
- 失败恢复
- 渠道适配约束
- 某些不可交给 AI 的系统级策略

建议把目标表述从“瘦到 80 行”改成“**只保留系统级编排逻辑，不再替 AI 做认知决策**”。  
否则后面很容易为了追求“薄”而把应由工程层承担的职责也抽空。

#### 4. session 可恢复目标 → 改为两层目标

> ✅ **已采纳**

| 层级 | 目标 | 机制 |
|------|------|------|
| **基线** | 记忆不丢，对话进入新 session | SQLite 独立于 OpenCode 进程 |
| **进阶** | 旧 session 尽可能恢复 | Muse 持久化 sessionId → 重启后校验 |

### 建议补充 → 已全部采纳

---

### 迁移策略（审核补充）

| Phase 1 模块 | 迁移方式 | 风险 |
|-------------|---------|------|
| `config.mjs` | 删除模型硬编码 | 低 |
| `identity.mjs` | 保留 JSON 加载，新增 AGENTS.md 生成 | 低 |
| `engine.mjs` | 保留 REST + `seenBusy`，新增 SSE | 中 |
| `memory.mjs` | 保留 SQLite 层，新增 MCP Server | 中 |
| `orchestrator.mjs` | 渐进瘦身：先去 `classifyIntent` → 再去 `extractKeywords` → 最后去 `buildPrompt` | 高 |
| `telegram.mjs` | 保留，新增工具调用可视化 | 低 |

**原则**: 每去掉一个认知功能，先验证 AI + MCP 能替代。不同时去多个。

### 关键假设验证（审核补充）

| 假设 | 验证方式 | 通过标准 |
|------|---------|----------|
| AGENTS.md 注入 | 10 条测试消息 → 检查人设符合度 | ≥8/10 |
| MCP 工具稳定性 | 50 轮对话 → 统计成功率 | ≥95% |
| AI 自主记忆 | 发"我喜欢 X" → 下个 session 问 | 必须调用 `search_memory` |
| AI 自主存偏好 | 发"代码用 2 空格" | 必须调用 `set_memory` |
| session 恢复 | kill serve → 重启 → 检查 | messages 不丢 |

### 结论

方向正确，可以作为 Phase 2 的主设计草案。

> ✅ 以上补充基于审核报告 + Phase 1 实战经验（详见 `phase1/EXPERIENCE.md`）

### 场景 E: 自定义 OpenCode Agent

```
.opencode/agent/muse-casual.md
---
name: muse-casual
description: Muse 的轻松模式，用于闲聊和情感陪伴
model: google/gemini-2.5-flash
tools:
  - search_memory
  - set_memory
---
你是小缪的"轻松模式"。在这个模式下:
- 优先陪聊、逗乐、情感支持
- 不主动分析代码或做技术任务
- 多用 emoji 和口语化表达
- 如果用户情绪低落，切换为温柔模式

.opencode/agent/muse-coder.md
---
name: muse-coder
description: Muse 的工程模式，用于严肃的技术工作
model: anthropic/claude-sonnet-4
tools: all
---
你是小缪的"工程模式"。在这个模式下:
- 严谨、专业、高效
- 代码质量第一
- 使用 search_memory 查找用户的编码偏好（缩进、风格等）
- 完成后自动记录工作到 add_episode
```

**用户可以通过 Telegram 命令切换**：`/mode casual` / `/mode coder`，直接映射到不同的 OpenCode Agent。

---

## 五、任务拆解

| 任务 | 工作量 | 依赖 | 优先级 |
|------|--------|------|--------|
| **P2-01** Memory MCP Server | 2-3 天 | T04 Memory | ⭐⭐⭐ 最高 |
| **P2-02** Identity → AGENTS.md 生成 | 1 天 | T02 Identity | ⭐⭐⭐ |
| **P2-03** Orchestrator 瘦身 | 1 天 | P2-01, P2-02 | ⭐⭐⭐ |
| **P2-04** opencode.json 模型配置迁移 | 0.5 天 | 无 | ⭐⭐ |
| **P2-05** Engine SSE 支持 | 1-2 天 | T03 Engine | ⭐⭐ |
| **P2-06** Telegram 工具调用可视化 | 1 天 | P2-05 | ⭐⭐ |
| **P2-07** 自定义 Agent (casual/coder) | 1 天 | P2-02 | ⭐ |
| **P2-08** 向量记忆 (sqlite-vec) | 2 天 | P2-01 | ⭐ |
| **P2-09** 主动记忆整理 (背景 Session) | 1-2 天 | P2-01, T08 | ⭐ |
| **P2-10** opencode.json MCP 注册 | 0.5 天 | P2-01 | ⭐⭐⭐ |
| **P2-11** Agent Identity ID 系统 | 1 天 | T02 Identity | ⭐⭐ |
| **P2-12** Web Family Hub 基础 | 2 天 | P2-11 | ⭐ |

**关键路径**: P2-01 (Memory MCP) → P2-10 (注册到 OpenCode) → P2-03 (Orchestrator 瘦身) → P2-06 (可视化)

#### P2-11 Agent Identity ID 系统

- `identity.json` 的 `id` 改为 UUID 自动生成（首次创建时）
- `Memory` 构造器从 `identity.id` 动态读取 agentId
- `config.mjs` 新增 `agents[]` 配置段
- 私有目录结构 `muse/data/agents/{id}/`
- 详见 [ARCHITECTURE.md §八](../ARCHITECTURE.md)

#### P2-12 Web Family Hub 基础

- Web 驾驶舱从单 Agent 升级到家族管理界面
- Agent 创建/切换/状态总览
- 共享知识 vs 私有数据展示
- 依赖 P2-11 Agent ID 系统先落地

### Phase 3-5 路线预览

> 详细架构见 [ARCHITECTURE.md §八-十](../ARCHITECTURE.md)

| Phase | 主题 | 核心任务 |
|-------|------|---------|
| **Phase 3** | 自主性与生活能力 | Pulse Engine、Goal System、Life Threads、家族委派、多模态归档、Artifact System、Skill Registry |
| **Phase 4** | 自我进化 | 自主活动引擎、创作工作流、受控自我开发、认知成长 |
| **Phase 5** | 实体化 | 3D 形象、IoT 延伸、家庭协作社会性 |

---

## 六、与 Phase 1 的兼容性

| Phase 1 产出 | Phase 2 处理 |
|-------------|-------------|
| `config.mjs` | 保留 Muse 私有配置，删除模型配置 |
| `identity.mjs` | 保留 JSON 加载/保存 + schema 校验，新增 AGENTS.md 生成 |
| `engine.mjs` | 保留 REST API 封装，新增 SSE 支持 |
| `memory.mjs` | 保留 SQLite 存储层，新增 MCP Server 包装 |
| `orchestrator.mjs` | **重写为薄转发层** (~80 行替代 327 行) |
| `telegram.mjs` | 保留，新增工具调用可视化 |
| 全部 152 项测试 | 保留可继续运行的，重写 Orchestrator 相关测试 |

---

## 七、opencode.json 中注册 Memory MCP

```jsonc
// .opencode/opencode.json
{
  "mcp": {
    "muse-memory": {
      "type": "command",
      "command": "node",
      "args": ["muse/mcp/memory-server.mjs"],
      "env": {
        "MUSE_DB_PATH": "./data/memory.db"
      }
    }
  }
}
```

启动 OpenCode serve 时，自动拉起 Memory MCP Server → AI 立即可用 `search_memory` / `set_memory` 等工具。

---

## 八、风险与缓解

| 风险 | 缓解 |
|------|------|
| AI 不主动调用记忆工具 | AGENTS.md 中明确指示 + 测试验证 |
| MCP Server 进程崩溃 | OpenCode 自动重启 MCP + 小脑监控 |
| system 字段注入和 AGENTS.md 冲突 | 明确分工: AGENTS.md=持久规则，system=动态上下文 |
| 去掉 Orchestrator 后丢失降级能力 | Engine 层保留错误处理和 fallback |
| 向量搜索性能 | sqlite-vec 本地化，无网络开销 |
