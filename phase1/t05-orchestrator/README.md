# T05 编排层 — 技术方案

> 串联 Identity → Memory → Engine 的完整处理流程
>
> 实现意图路由 + 记忆注入 + 模型选择 + 响应后处理
>
> T05 是 Phase 1 的核心粘合层，T06/T07 依赖它对外提供统一入口

---

## 1. 需求目标

### 1.1 核心目标

- 为上层适配器（T06 Telegram、T07 Web）提供**唯一的对话入口** `handleMessage(text, context?)`
- 在每次对话中自动完成：身份注入、记忆检索、prompt 组装、引擎调用、响应后处理
- 实现基于意图的**双模型路由**：轻量任务 → defaultModel，复杂任务 → heavyModel
- 异步完成记忆回写：情景记忆存储 + 语义记忆提取
- 当 Memory/Identity 不可用时**优雅降级**，不阻塞核心对话能力

### 1.2 非目标（Phase 1 不做）

- ❌ 多轮 tool-use 编排（依赖 OpenCode 自身 agent 能力）
- ❌ 自定义 function calling / MCP 调用（Phase 2）
- ❌ 对话历史的流式压缩（Phase 2 context compaction）
- ❌ 多 agent 分发调度（Phase 4 Agent Family）
- ❌ 摘要回填（Phase 2 用 small model 异步生成）

---

## 2. 架构位置

```
           T06 Telegram           T07 Web
                │                    │
                └──────┬─────────────┘
                       │ handleMessage(text, ctx)
               ┌───────▼────────┐
               │                │
               │  Orchestrator  │  ← 本模块 (无状态粘合层)
               │                │
               └───┬────┬───┬──┘
                   │    │   │
          ┌────────┘    │   └────────┐
          ▼             ▼            ▼
     ┌─────────┐  ┌──────────┐  ┌────────┐
     │Identity │  │  Memory  │  │ Engine │
     │  (T02)  │  │  (T04)   │  │ (T03)  │
     └─────────┘  └──────────┘  └────────┘
```

**职责边界**：
- Orchestrator **不持有**任何模块的生命周期（start/stop 由上层 index.mjs 管理）
- Orchestrator **只调用**三个模块的公开 API，不访问私有字段
- Orchestrator **是 T06/T07 的唯一依赖**，适配器层不直接调用 Identity/Memory/Engine
- Orchestrator **在依赖模块异常时降级**，而不是整条链路崩溃

> **关于 Prompt 注入的现实边界**：当前 Engine 的 `sendAndWait(sid, text, opts)` 发送给 OpenCode 的是 `parts: [{ type: 'text', text }]`，这意味着 identity prompt + 记忆上下文 + 用户消息是**拼接成一段纯文本**发送的，不是模型原生的 system role 注入。这是 Phase 1 的现实折中 — 人格约束效果会弱于真正的 system message 通道，Phase 2 可通过 OpenCode 的 system prompt 注入能力提升。

---

## 3. 核心流程

### 3.1 主流程: handleMessage

```
handleMessage(text, context?)
  │
  ├── [0] 输入校验
  │     └── text 非空字符串，否则抛 Error
  │
  ├── [1] 意图分类 → 选择模型
  │     └── classifyIntent(text) → 'light' | 'heavy'
  │     └── light → config.engine.defaultModel
  │         heavy → config.engine.heavyModel
  │
  ├── [2] Session 管理
  │     └── 复用 context.sessionId 或创建新 session
  │
  ├── [3] 构建 enriched prompt (带降级保护)
  │     ├── identity.buildSystemPrompt()  → 失败时用默认 persona
  │     ├── memory.searchMemories(kws)    → 失败时返回空
  │     └── memory.getRecentSummaries(3)  → 失败时返回空
  │
  ├── [4] 发送引擎 (核心依赖，不降级)
  │     └── engine.sendAndWait(sid, prompt, { model })
  │
  └── [5] 异步后处理 (分步容错)
        ├── try: memory.addEpisode(sid, 'user', text)
        ├── try: memory.addEpisode(sid, 'assistant', reply)
        └── try: extractAndSavePreferences(text)
```

> **误分类的最坏后果**：意图分类不准只会导致模型选择偏差（轻量模型处理复杂任务），回复质量可能下降，但不会导致流程失败或系统错误。

### 3.2 降级策略

| 依赖模块 | 失败行为 | 降级策略 |
|---------|---------|---------|
| **Engine** | 核心依赖 | **不降级**，直接向上抛错 |
| **Identity** | `buildSystemPrompt()` 抛错 | 降级为最小默认 persona：`"你是 Muse，一个友善的 AI 助手"` |
| **Memory** (语义检索) | `searchMemories()` 抛错 | 降级为空数组，记录日志 |
| **Memory** (情景摘要) | `getRecentSummaries()` 抛错 | 降级为空数组，记录日志 |
| **Memory** (后处理写入) | `addEpisode()` 抛错 | 记录日志，继续执行后续步骤 |
| **Memory** (偏好提取) | `setMemory()` 抛错 | 记录日志，不影响返回 |

### 3.3 意图分类策略 (Phase 1 MVP)

Phase 1 采用**规则 + 关键词**的轻量分类，不引入额外 LLM 调用：

```javascript
const HEAVY_PATTERNS = [
  // 代码相关
  /写(?:一个)?(?:代码|函数|脚本|程序|类|组件)/,
  /(?:帮我|请|给我).*(?:实现|开发|编写|重构|调试|debug)/i,
  // 分析相关
  /(?:分析|解释|对比|评估|设计|规划|方案)/,
  /(?:为什么|怎么(?:做|实现|解决)|如何)/,
  // 长文本生成
  /写(?:一篇)?(?:文章|文档|报告|方案|总结)/,
  // 明确的复杂任务
  /(?:帮我|请|给我).*(?:一[个份]|完整)/,
]

const HEAVY_TEXT_THRESHOLD = 200

function classifyIntent(text) {
  if (text.length > HEAVY_TEXT_THRESHOLD) return 'heavy'  // 长消息通常是复杂任务
  if (HEAVY_PATTERNS.some(p => p.test(text))) return 'heavy'
  return 'light'
}
```

### 3.4 中文关键词提取策略

Phase 1 采用**偏好词表 + N-gram 滑窗**双轨策略，适配中文无空格环境：

```javascript
/** 偏好类高频词 — 用于从中文文本中抽取可能的记忆 key */
const PREFERENCE_TERMS = [
  '喜欢', '偏好', '习惯', '讨厌', '不喜欢',
  '常用', '编辑器', '语言', '框架', '工具',
  '名字', '昵称', '风格',
]

/**
 * 中文友好的关键词提取 (Phase 1)
 *
 * 策略:
 *   1. 先按空格/标点分段
 *   2. 对每段用 2-4 字 N-gram 滑窗生成候选词
 *   3. 优先提取包含偏好词表的候选词
 *   4. 兜底取最长段的前几个 N-gram
 *
 * @returns {string[]} 最多 3 个关键词
 */
function extractKeywords(text) {
  // 按标点和空白分段
  const segments = text
    .replace(/[，。！？、；：""''（）《》\[\]{}.,!?;:'"()\-\s]+/g, '|')
    .split('|')
    .filter(s => s.length >= 2)

  // 生成 N-gram 候选词
  const candidates = []
  for (const seg of segments) {
    for (let n = 2; n <= Math.min(4, seg.length); n++) {
      for (let i = 0; i <= seg.length - n; i++) {
        candidates.push(seg.slice(i, i + n))
      }
    }
  }

  // 优先级 1: 匹配偏好词表的候选词
  const preferenceHits = candidates.filter(c =>
    PREFERENCE_TERMS.some(t => c.includes(t))
  )
  if (preferenceHits.length > 0) return [...new Set(preferenceHits)].slice(0, 3)

  // 优先级 2: 取较长的段作为关键词
  const longSegments = segments
    .filter(s => s.length >= 2 && s.length <= 8)
    .slice(0, 3)
  if (longSegments.length > 0) return longSegments

  // 兜底: 取前 3 个 2-gram
  return [...new Set(candidates)].slice(0, 3)
}
```

### 3.5 语义记忆检索 — 多关键词合并

Phase 1 对 T04 `searchMemories()` 串行调用多个关键词后去重：

```javascript
async #searchSemanticMemories(keywords) {
  if (keywords.length === 0) return []

  const seen = new Set()
  const results = []

  // 串行查前 3 个关键词，合并去重
  for (const kw of keywords.slice(0, 3)) {
    try {
      const hits = this.#memory.searchMemories(kw)
      for (const hit of hits) {
        if (!seen.has(hit.id)) {
          seen.add(hit.id)
          results.push(hit)
        }
      }
    } catch (e) {
      log.warn(`语义检索失败 (keyword=${kw}):`, e.message)
    }
  }

  return results.slice(0, 10)  // 最多返回 10 条
}
```

### 3.6 记忆注入模板

```
{identity.buildSystemPrompt() 或 默认 persona}

## 你对用户的了解
{semanticMemories → 格式化为 key: value 列表，最多 10 条}

## 最近的对话摘要
{recentSummaries → 格式化为时间 + 内容，最多 10 条}

{用户原始消息}
```

> **注意**：这是拼接式纯文本 prompt，不是模型级的 system/user 分层输入。Phase 2 可通过 OpenCode 的 system prompt 配置能力提升注入稳定性。

**Token 预算估算**：
| 部分 | 估算 tokens |
|------|------------|
| System Prompt / 默认 persona | ~500 |
| 语义记忆 (top 10) | ~200 |
| 情景摘要 (3天) | ~500 |
| 用户消息 | ~100-2000 |
| **总计** | **~1300-3200** |

### 3.7 Session 管理策略

```javascript
async #resolveSession(context) {
  if (context?.sessionId) return context.sessionId
  const session = await this.#engine.createSession()
  return session.id
}
```

**设计决策**：Session 的创建由 Orchestrator、清理由 T08 小脑负责。

---

## 4. 核心实现

### 4.1 core/orchestrator.mjs

```javascript
import { createLogger } from '../logger.mjs'

const log = createLogger('orchestrator')

// --- Constants ---

const DEFAULT_PERSONA = '你是 Muse，一个友善的 AI 助手。请用简洁、自然的语言回答用户问题。'

const HEAVY_TEXT_THRESHOLD = 200

const HEAVY_PATTERNS = [
  /写(?:一个)?(?:代码|函数|脚本|程序|类|组件)/,
  /(?:帮我|请|给我).*(?:实现|开发|编写|重构|调试|debug)/i,
  /(?:分析|解释|对比|评估|设计|规划|方案)/,
  /(?:为什么|怎么(?:做|实现|解决)|如何)/,
  /写(?:一篇)?(?:文章|文档|报告|方案|总结)/,
  /(?:帮我|请|给我).*(?:一[个份]|完整)/,
]

const PREFERENCE_TERMS = [
  '喜欢', '偏好', '习惯', '讨厌', '不喜欢',
  '常用', '编辑器', '语言', '框架', '工具',
  '名字', '昵称', '风格',
]

/** 偏好提取规则 — 值截断到 MAX_PREF_LENGTH */
const MAX_PREF_LENGTH = 20

const PREFERENCE_PATTERNS = [
  { regex: /我(?:叫|是|名字是)\s*([^\s，。！？,!?.]{1,20})/,  key: 'user_name',  category: 'preference' },
  { regex: /我喜欢(?:用|使用)?\s*([^\s，。！？,!?.]{1,20})/, key: 'user_likes', category: 'preference' },
  { regex: /我(?:偏好|习惯)\s*([^\s，。！？,!?.]{1,20})/,    key: 'user_habit', category: 'preference' },
  { regex: /(?:我的)?(?:编程)?语言[是:]?\s*([^\s，。！？,!?.]{1,20})/, key: 'user_lang', category: 'preference' },
]

// --- Exported Helper Functions ---

export function classifyIntent(text) {
  if (text.length > HEAVY_TEXT_THRESHOLD) return 'heavy'
  if (HEAVY_PATTERNS.some(p => p.test(text))) return 'heavy'
  return 'light'
}

export function extractKeywords(text) {
  const segments = text
    .replace(/[，。！？、；：""''（）《》\[\]{}.,!?;:'"()\-\s]+/g, '|')
    .split('|')
    .filter(s => s.length >= 2)

  const candidates = []
  for (const seg of segments) {
    for (let n = 2; n <= Math.min(4, seg.length); n++) {
      for (let i = 0; i <= seg.length - n; i++) {
        candidates.push(seg.slice(i, i + n))
      }
    }
  }

  // 优先: 匹配偏好词表
  const preferenceHits = candidates.filter(c =>
    PREFERENCE_TERMS.some(t => c.includes(t))
  )
  if (preferenceHits.length > 0) return [...new Set(preferenceHits)].slice(0, 3)

  // 次选: 较长段
  const longSegments = segments
    .filter(s => s.length >= 2 && s.length <= 8)
    .slice(0, 3)
  if (longSegments.length > 0) return longSegments

  // 兜底: 前 3 个 2-gram
  return [...new Set(candidates)].slice(0, 3)
}

// --- Orchestrator Class ---

export class Orchestrator {
  #config
  #identity
  #memory
  #engine

  constructor({ config, identity, memory, engine }) {
    this.#config = config
    this.#identity = identity
    this.#memory = memory
    this.#engine = engine
  }

  /**
   * 主入口 — 所有适配器通过此方法发送消息
   *
   * @param {string} text - 用户消息 (非空字符串)
   * @param {object} [context] - 可选上下文
   * @param {string} [context.sessionId] - 指定 session
   * @param {string} [context.source] - 来源: 'telegram' | 'web' | 'cli'
   * @returns {Promise<{text: string, sessionId: string, model: string, intent: string}>}
   */
  async handleMessage(text, context = {}) {
    // [0] 输入校验
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('handleMessage: text 不能为空')
    }

    // [1] 意图分类 → 模型选择
    const intent = classifyIntent(text)
    const modelConfig = intent === 'heavy'
      ? this.#config.engine.heavyModel
      : this.#config.engine.defaultModel
    const modelId = `${modelConfig.providerID}/${modelConfig.modelID}`

    log.info(`[${context.source || '?'}] 意图=${intent} 模型=${modelId}`)

    // [2] Session 管理
    const sessionId = await this.#resolveSession(context)

    // [3] 构建 enriched prompt (带降级保护)
    const enrichedPrompt = await this.#buildPrompt(text)

    // [4] 发送引擎 (核心依赖，不降级)
    const result = await this.#engine.sendAndWait(sessionId, enrichedPrompt, {
      model: modelId,
    })

    // [5] 异步后处理 (分步容错，不阻塞返回)
    this.#postProcess(sessionId, text, result.text).catch(e =>
      log.error('后处理异常:', e.message)
    )

    return {
      text: result.text,
      sessionId,
      model: modelId,
      intent,
    }
  }

  /** 聚合所有子模块的健康状态 */
  async health() {
    const [identityHealth, memoryHealth, engineHealth] = await Promise.all([
      this.#identity.health(),
      this.#memory.health(),
      this.#engine.health(),
    ])
    const ok = identityHealth.ok && memoryHealth.ok && engineHealth.ok
    return {
      ok,
      detail: {
        identity: identityHealth,
        memory: memoryHealth,
        engine: engineHealth,
      },
    }
  }

  // --- 私有方法 ---

  async #resolveSession(context) {
    if (context.sessionId) return context.sessionId
    const session = await this.#engine.createSession()
    return session.id
  }

  /** 构建 enriched prompt，Identity / Memory 失败时降级 */
  async #buildPrompt(userText) {
    // [a] System prompt (降级: 使用默认 persona)
    let systemPrompt
    try {
      systemPrompt = this.#identity.buildSystemPrompt()
    } catch (e) {
      log.warn('Identity 不可用，使用默认 persona:', e.message)
      systemPrompt = DEFAULT_PERSONA
    }

    // [b] 语义记忆 (降级: 空数组)
    const keywords = extractKeywords(userText)
    const semanticHits = await this.#searchSemanticMemories(keywords)
    const semanticBlock = this.#formatSemanticMemories(semanticHits)

    // [c] 情景摘要 (降级: 空数组)
    let summaries = []
    try {
      summaries = this.#memory.getRecentSummaries(3)
    } catch (e) {
      log.warn('情景摘要检索失败:', e.message)
    }
    const episodicBlock = this.#formatSummaries(summaries)

    // [d] 组装
    const parts = [systemPrompt]
    if (semanticBlock) parts.push(semanticBlock)
    if (episodicBlock) parts.push(episodicBlock)
    parts.push(userText)

    return parts.join('\n\n')
  }

  /** 多关键词串行搜索 + 去重，单次失败不影响其他 */
  async #searchSemanticMemories(keywords) {
    if (keywords.length === 0) return []

    const seen = new Set()
    const results = []

    for (const kw of keywords.slice(0, 3)) {
      try {
        const hits = this.#memory.searchMemories(kw)
        for (const hit of hits) {
          if (!seen.has(hit.id)) {
            seen.add(hit.id)
            results.push(hit)
          }
        }
      } catch (e) {
        log.warn(`语义检索失败 (kw=${kw}):`, e.message)
      }
    }

    return results.slice(0, 10)
  }

  #formatSemanticMemories(memories) {
    if (memories.length === 0) return ''
    const items = memories.slice(0, 10).map(m => `- ${m.key}: ${m.value}`)
    return `## 你对用户的了解\n${items.join('\n')}`
  }

  #formatSummaries(summaries) {
    if (summaries.length === 0) return ''
    const items = summaries.slice(0, 10).map(s =>
      `- [${s.created_at}] ${s.summary}`
    )
    return `## 最近的对话摘要\n${items.join('\n')}`
  }

  /** 分步容错后处理: 每步独立 try/catch */
  async #postProcess(sessionId, userText, replyText) {
    // [a] 存用户消息
    try {
      this.#memory.addEpisode(sessionId, 'user', userText)
    } catch (e) {
      log.error('存储用户消息失败:', e.message)
    }

    // [b] 存助手回复
    try {
      this.#memory.addEpisode(sessionId, 'assistant', replyText)
    } catch (e) {
      log.error('存储助手回复失败:', e.message)
    }

    // [c] 提取偏好
    try {
      this.#extractPreferences(userText)
    } catch (e) {
      log.error('偏好提取失败:', e.message)
    }

    log.info(`后处理完成: session=${sessionId}`)
  }

  /** 用正则提取用户偏好，值截断到 MAX_PREF_LENGTH 防止贪心匹配 */
  #extractPreferences(text) {
    for (const { regex, key, category } of PREFERENCE_PATTERNS) {
      const match = text.match(regex)
      if (match) {
        const value = match[1].slice(0, MAX_PREF_LENGTH)
        this.#memory.setMemory(key, value, category, 'auto')
        log.info(`提取偏好: ${key}=${value}`)
      }
    }
  }
}
```

### 4.2 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 无生命周期 | 不实现 start/stop | Orchestrator 是无状态粘合层，直接依赖注入子模块 |
| 构造函数注入 | `{ config, identity, memory, engine }` | 便于测试 mock，和 T02/T03/T04 解耦 |
| 降级策略 | Identity/Memory try/catch | Engine 是核心依赖不降级，其他模块失败不应阻塞对话 |
| classifyIntent 导出 | 顶层具名函数 | 独立于类，便于单元测试和未来替换 |
| extractKeywords 导出 | 顶层具名函数 | 独立测试中文分词效果 |
| 多关键词搜索 | 串行查 3 个 + 去重 | Phase 1 不改 T04 SQL，通过应用层合并 |
| N-gram 滑窗 | 2-4 字候选词 | 适配中文无空格分词，比 `split(/\s+/)` 有效得多 |
| 后处理分步容错 | 每步独立 try/catch | 一步失败不影响其他步骤 |
| 偏好值截断 | `[^\s，。]{1,20}` + slice | 防止中文无空格时贪心匹配整段 |
| Session 不清理 | 由 T08 小脑负责 | 职责分离 |
| 拼接式 prompt | 纯文本 join | Phase 1 现实折中，Phase 2 可升级 system role |

---

## 5. 与上游模块的接口约定

| 上游模块 | 调用的方法 | 用途 | 失败处理 |
|---------|-----------|------|---------|
| **Identity** (T02) | `buildSystemPrompt()` | 生成 system prompt | 降级为 DEFAULT_PERSONA |
| **Identity** (T02) | `health()` | 聚合健康检查 | — |
| **Memory** (T04) | `searchMemories(keyword)` | 检索语义记忆 (多次串行) | 降级为空数组 |
| **Memory** (T04) | `getRecentSummaries(days)` | 获取情景摘要 | 降级为空数组 |
| **Memory** (T04) | `addEpisode(sid, role, content)` | 存储对话记录 | 记录日志，继续 |
| **Memory** (T04) | `setMemory(key, value, cat, src)` | 写入偏好 | 记录日志，继续 |
| **Memory** (T04) | `health()` | 聚合健康检查 | — |
| **Engine** (T03) | `createSession()` | 新建 session | 不降级，直接抛错 |
| **Engine** (T03) | `sendAndWait(sid, text, opts)` | 发送消息并等待 | 不降级，直接抛错 |
| **Engine** (T03) | `health()` | 聚合健康检查 | — |
| **Config** (T01) | `engine.defaultModel` / `heavyModel` | 读取模型配置 | — |

---

## 6. 下游消费者接口

### 6.1 返回值结构

```typescript
interface HandleMessageResult {
  text: string       // 助手回复文本
  sessionId: string  // 使用的 session ID
  model: string      // 使用的模型 (provider/model 格式)
  intent: string     // 意图分类: 'light' | 'heavy'
}
```

### 6.2 T06 Telegram / T07 Web 调用示例

```javascript
const result = await orchestrator.handleMessage('帮我写一个函数', {
  sessionId: 'user-123-session',
  source: 'telegram',
})
// result.text → 助手回复
// result.model → 'anthropic/claude-sonnet-4-20250514' (heavy)
```

---

## 7. 测试方案

### 7.1 测试策略

Orchestrator 依赖三个模块，测试时**全部 mock**：

```javascript
function createMockIdentity(opts = {}) {
  return {
    buildSystemPrompt: opts.throwOnPrompt
      ? () => { throw new Error('Identity not loaded') }
      : () => '你是一个AI助手',
    data: { identity: { name: '小缪' } },
    health: async () => ({ ok: true, detail: '小缪' }),
  }
}

function createMockMemory(opts = {}) {
  const episodes = []
  const semantics = new Map()
  return {
    searchMemories: opts.throwOnSearch
      ? () => { throw new Error('Memory not started') }
      : (kw) => [...semantics.values()].filter(m => m.key.includes(kw) || m.value.includes(kw)),
    getRecentSummaries: opts.throwOnSummaries
      ? () => { throw new Error('Memory not started') }
      : () => [],
    addEpisode: opts.throwOnAdd
      ? () => { throw new Error('Memory not started') }
      : (sid, role, content) => { episodes.push({ sid, role, content }); return episodes.length },
    setMemory: (k, v, cat, src) => semantics.set(k, { key: k, value: v, category: cat, source: src }),
    health: async () => ({ ok: true, detail: { semanticCount: 0, episodicCount: 0 } }),
    _episodes: episodes,
    _semantics: semantics,
  }
}

function createMockEngine(reply = '你好！') {
  let sessionCounter = 0
  return {
    createSession: async () => ({ id: `mock-session-${++sessionCounter}` }),
    sendAndWait: async (sid, text, opts) => ({ text: reply, message: {}, sessionId: sid }),
    health: async () => ({ ok: true, detail: 'mock' }),
  }
}
```

### 7.2 测试矩阵

| # | 测试项 | 描述 | 类型 |
|---|--------|------|------|
| 1 | handleMessage 基本流程 | 发送消息 → 返回回复 + sessionId + model + intent | 主路径 |
| 2 | handleMessage 使用指定 sessionId | context.sessionId 透传 → 不创建新 session | 主路径 |
| 3 | handleMessage 自动创建 session | 不传 sessionId → 创建新 session | 主路径 |
| 4 | handleMessage 空文本应抛错 | `""` / `"  "` / `null` → 抛 Error | 输入校验 |
| 5 | classifyIntent 轻量意图 | "你好" → light | 意图分类 |
| 6 | classifyIntent 重型意图 — 代码 | "帮我写一个函数" → heavy | 意图分类 |
| 7 | classifyIntent 重型意图 — 分析 | "分析这段代码为什么出错" → heavy | 意图分类 |
| 8 | classifyIntent 重型意图 — 长文本 | 201字消息 → heavy | 意图分类 |
| 9 | classifyIntent 边界 — 200字 | 恰好200字 → light | 意图分类 |
| 10 | 模型路由 — light → defaultModel | 轻量意图使用 defaultModel | 模型选择 |
| 11 | 模型路由 — heavy → heavyModel | 重型意图使用 heavyModel | 模型选择 |
| 12 | extractKeywords 中文连续文本 | "我喜欢用VSCode" → 包含"喜欢" | 关键词 |
| 13 | extractKeywords 有空格文本 | "JavaScript 函数" → 正确拆分 | 关键词 |
| 14 | extractKeywords 短文本 | "hi" → 空或短词 | 关键词 |
| 15 | prompt 组装 — 包含 system prompt | enrichedPrompt 第一段是 system prompt | Prompt |
| 16 | prompt 组装 — 包含语义记忆 | 有匹配 → prompt 含"你对用户的了解" | Prompt |
| 17 | prompt 组装 — 无语义记忆 | 无匹配 → prompt 中没有记忆段 | Prompt |
| 18 | prompt 组装 — 包含情景摘要 | 有摘要 → prompt 含"最近的对话摘要" | Prompt |
| 19 | prompt 组装 — Identity 失败降级 | buildSystemPrompt 抛错 → 使用默认 persona | 降级 |
| 20 | prompt 组装 — Memory 搜索失败降级 | searchMemories 抛错 → 空记忆，不崩溃 | 降级 |
| 21 | prompt 组装 — Memory 摘要失败降级 | getRecentSummaries 抛错 → 空摘要，不崩溃 | 降级 |
| 22 | 后处理 — 存储情景记忆 | 调用后 mock memory 中有 user + assistant | 后处理 |
| 23 | 后处理 — 提取偏好 "我叫" | "我叫张三" → setMemory('user_name', '张三') | 后处理 |
| 24 | 后处理 — 偏好值截断 | "我喜欢用一个非常好的超级无敌编辑器" → 值截断到 20 字 | 后处理 |
| 25 | 后处理 — 无偏好不写入 | "你好" → 不调用 setMemory | 后处理 |
| 26 | 后处理 — addEpisode 失败不影响后续 | user 存储失败 → assistant 仍尝试存储 | 分步容错 |
| 27 | 后处理 — 整体失败不阻塞返回 | 后处理抛错 → handleMessage 仍返回 | 健壮性 |
| 28 | health 聚合 — 全 ok | 三模块都 ok → ok:true | 健康检查 |
| 29 | health 聚合 — 部分故障 | engine ok:false → 整体 ok:false | 健康检查 |
| 30 | 多关键词搜索合并去重 | 3个关键词分别命中 → 结果去重 | 搜索 |

---

## 8. 风险与决策记录

| 风险 | 应对 |
|------|------|
| 意图分类不准 | 最坏后果是回复质量下降，不是流程失败 |
| 中文 N-gram 噪声多 | 偏好词表优先匹配，兜底才用 N-gram |
| 拼接式 prompt 效果弱 | Phase 1 折中，Phase 2 升级 system role |
| 后处理异步失败 | 分步 catch + log，不阻塞返回 |
| prompt 超长 | 当前预算 ~3K tokens，远低于 200K limit |
| Engine 超时 | sendAndWait 自带 120s 超时，Orchestrator 透传 |
| Session 泄漏 | T08 小脑负责清理，职责分离 |
| 偏好提取误触发 | 正则保守 + 值截断到 20 字 + upsert 容错 |
| **长 session 上下文膨胀** | Phase 1 已知限制：每轮重复注入 persona + 记忆，长 session 会累积冗余。Phase 2 需做分层上下文策略（persona 低频注入、记忆按需召回） |
| **session 被 T08 清理后适配器仍持有旧 ID** | `#resolveSession` 已加 session 失效自动重建兜底；Phase 2 需设计 T05/T08 session 协同策略 |

---

## 9. 完成定义 (DoD)

- [ ] `muse/core/orchestrator.mjs` Orchestrator 类完整实现
- [ ] `classifyIntent()` 和 `extractKeywords()` 独立导出并可单元测试
- [ ] `handleMessage(text, context?)` 主入口实现 + 输入校验
- [ ] 意图分类: light/heavy 双模型路由（正则语法正确）
- [ ] 中文关键词提取: N-gram + 偏好词表双轨策略
- [ ] 多关键词串行搜索 + 去重
- [ ] prompt 组装: system prompt + 语义记忆 + 情景摘要 + 用户消息（拼接式）
- [ ] 降级策略: Identity/Memory 失败 → 空记忆/默认 persona
- [ ] 后处理: 分步容错（每步独立 try/catch）
- [ ] 偏好提取: 正则匹配 + 值截断到 20 字
- [ ] `health()` 聚合三模块健康状态
- [ ] 构造函数依赖注入 (config, identity, memory, engine)
- [ ] 30 项单元测试通过 (全 mock，不依赖外部服务)
- [ ] git commit
