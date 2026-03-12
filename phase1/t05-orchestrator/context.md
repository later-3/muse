# T05 编排层 — 评审上下文

> 本文档为评审 agent 提供 T05 所需的全部上下文，避免审核时需要额外查阅其他文件。

---

## 1. 项目背景

Muse 助手采用 **大脑/小脑** 双进程架构，**大脑** = OpenCode serve（推理、对话），**小脑** = 独立守护进程（监控、重启、清理）。

T05 编排层（Orchestrator）是 Phase 1 的**核心粘合层**，位于 T06 Telegram / T07 Web 与 T02 Identity / T03 Engine / T04 Memory 之间，负责完整的对话处理流程。

**核心原则**：不改 OpenCode 源码，通过 Plugin / Hook / MCP / Skill 扩展。

---

## 2. Prompt 注入的现实边界

当前 Engine 的 `sendAndWait(sid, text, opts)` 最终发送给 OpenCode 的是：

```js
{ parts: [{ type: 'text', text }] }
```

这意味着 T05 的 system prompt + 记忆上下文 + 用户消息是**拼接成一段纯文本**发送的，不是模型原生的 system role 注入。这是 Phase 1 的现实折中：
- 人格约束效果会弱于真正的 system message 通道
- Phase 2 可通过 OpenCode 的 system prompt 配置能力提升

---

## 3. T05 上游依赖 — 已完成的模块接口

### 3.1 T01 Config (`muse/config.mjs`)

```javascript
export const config = {
  engine: {
    host: 'http://127.0.0.1',
    port: 4096,
    workspace: process.cwd(),
    defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    heavyModel:   { providerID: 'anthropic', modelID: 'claude-sonnet-4-20250514' },
  },
  memory: {
    dbPath: './muse/data/memory.db',
    maxEpisodicDays: 90,
  },
  identity: {
    path: './muse/data/identity.json',
  },
}
```

### 3.2 T02 Identity (`muse/core/identity.mjs`)

```javascript
class Identity {
  async start()
  async stop()
  async health()         // → { ok: boolean, detail: string }
  get data               // → 身份数据只读副本 (structuredClone)
  resolveTraitLabels()   // → string[] 性格标签
  buildSystemPrompt()    // → string 4层结构化 system prompt (~500 tokens)
  reloadFromDisk()       // → boolean
}
```

**T05 注意**：
- `buildSystemPrompt()` 在 Identity 未加载时会抛错
- T05 必须 try/catch，降级为 `DEFAULT_PERSONA`

### 3.3 T03 Engine (`muse/core/engine.mjs`)

```javascript
class Engine {
  async start()
  async stop()
  async health()              // → { ok, detail, ownsProcess }
  async createSession()       // POST /session → { id }
  async listSessions()        // GET /session
  async getSession(sessionId) // GET /session/:id
  async deleteSession(sessionId)
  async sendAndWait(sessionId, text, opts)
    // opts: { model?, timeoutMs=120000, pollIntervalMs=1000 }
    // 返回: { text, message, sessionId }
  async sendMessageAsync(sessionId, text, model?)
  async sendMessage(sessionId, text, model?)
  subscribeEvents(onEvent)    // SSE 事件流
  async abort(sessionId)
}
```

**T05 注意**：
- `sendAndWait()` 是核心依赖，失败时 T05 **不降级**，直接向上抛错
- `model` 参数格式: `"provider/model"` 字符串
- 引擎自带 120s 超时 + 重试逻辑

### 3.4 T04 Memory (`muse/core/memory.mjs`)

```javascript
class Memory {
  async start()
  async stop()
  async health()

  // 语义记忆 (KV)
  setMemory(key, value, category?, source?)  // upsert
  getMemory(key)              // → row | null
  deleteMemory(key)           // → boolean
  listMemories(category?)     // → row[]
  searchMemories(keyword)     // → row[]  (key + value LIKE 单关键词)

  // 情景记忆
  addEpisode(sessionId, role, content, summary?)   // → lastInsertRowid
  updateEpisodeSummary(episodeId, summary)          // → boolean
  getRecentEpisodes(days?)
  getSessionEpisodes(sessionId)
  searchEpisodes(keyword, limit?)
  getRecentSummaries(days?)   // → row[] (消息级摘要)
  getEpisodicStats()
}
```

**T05 注意**：
- `searchMemories()` 只支持**单关键词 LIKE**，T05 需要串行调用多次并去重
- `role` 必须是 `'user'` 或 `'assistant'`（CHECK 约束）
- 所有方法在 `stop()` 后调用抛 `'Memory not started — call start() first'`
- T05 必须对 Memory 调用做 try/catch 降级

---

## 4. T05 降级策略

| 依赖模块 | 失败行为 | T05 降级策略 |
|---------|---------|-------------|
| Engine | 核心依赖 | **不降级**，直接抛错 |
| Identity | buildSystemPrompt() 抛错 | 使用默认 persona |
| Memory (检索) | searchMemories/getRecentSummaries 抛错 | 空数组，记录日志 |
| Memory (写入) | addEpisode/setMemory 抛错 | 记录日志，继续后续步骤 |

---

## 5. T05 下游消费者

### 5.1 T06 Telegram 适配器

- 调用 `orchestrator.handleMessage(text, { sessionId, source: 'telegram' })`
- 需要 `result.text` 作为回复内容

### 5.2 T07 Web 驾驶舱

- 调用 `orchestrator.handleMessage(text, { sessionId, source: 'web' })`
- 调用 `orchestrator.health()` 用于状态展示

---

## 6. 代码风格参考

### 统一的日志方式

```javascript
import { createLogger } from '../logger.mjs'
const log = createLogger('orchestrator')
```

### 统一的构造函数注入

```javascript
// T02: class Identity { constructor(config) }
// T03: class Engine { constructor(config) }
// T04: class Memory { constructor(config, agentId?) }
// T05: class Orchestrator { constructor({ config, identity, memory, engine }) }
```

### 统一的测试模式

- `node:test` + `node:assert`
- `describe/it` 分组
- `beforeEach/afterEach` 做隔离

---

## 7. Phase 1 验收标准（与 T05 相关）

1. ✅ 手机 Telegram 发消息 → 收到**有人格的**回复（T05: 身份 prompt 注入，拼接式）
2. ✅ 第二天继续聊 → 她**记得昨天的内容**（T05: 情景摘要 + 语义记忆注入）
3. ✅ 问复杂问题 → **自动切换到更强模型**（T05: 意图路由）

---

## 8. Phase 1 与 Phase 2 边界

| 能力 | Phase 1 (T05) | Phase 2 (未来) |
|------|--------------|----------------|
| 意图分类 | 规则 + 关键词 | small model 快速分类 |
| 记忆检索 | N-gram + LIKE 多关键词串行 | 向量检索 + embedding |
| 偏好提取 | 正则匹配 + 值截断 | LLM 智能提取 |
| 摘要生成 | 预留接口，不生成 | small model 异步摘要 |
| Prompt 注入 | 拼接式纯文本 | system role 原生注入 |
| Session 策略 | 单 session 或适配器指定 | context compaction |
| 降级策略 | Identity/Memory try/catch | 更细粒度的健康监控 |
| 多 agent | 单 agent (muse) | Agent Family 分发 |
