import { createLogger } from '../logger.mjs'

const log = createLogger('orchestrator')

// --- Constants ---

/** Identity 不可用时的兜底 persona */
const DEFAULT_PERSONA = '你是 Muse，一个友善的 AI 助手。请用简洁、自然的语言回答用户问题。'

/** 长文本阈值：超过此长度的消息视为 heavy 意图 */
const HEAVY_TEXT_THRESHOLD = 200

/** 偏好提取时值的最大长度 */
const MAX_PREF_LENGTH = 20

// --- Intent Classification ---

const HEAVY_PATTERNS = [
  /写(?:一个)?(?:代码|函数|脚本|程序|类|组件)/,
  /(?:帮我|请|给我).*(?:实现|开发|编写|重构|调试|debug)/i,
  /(?:分析|解释|对比|评估|设计|规划|方案)/,
  /(?:为什么|怎么(?:做|实现|解决)|如何)/,
  /写(?:一篇)?(?:文章|文档|报告|方案|总结)/,
  /(?:帮我|请|给我).*(?:一[个份]|完整)/,
]

/**
 * 意图分类: 规则 + 关键词
 * 误分类最坏后果是模型选择偏差（质量下降），不是流程失败
 */
export function classifyIntent(text) {
  if (text.length > HEAVY_TEXT_THRESHOLD) return 'heavy'
  if (HEAVY_PATTERNS.some(p => p.test(text))) return 'heavy'
  return 'light'
}

// --- Keyword Extraction ---

/** 偏好类高频词 — 用于从中文文本中优先抽取记忆相关关键词 */
const PREFERENCE_TERMS = [
  '喜欢', '偏好', '习惯', '讨厌', '不喜欢',
  '常用', '编辑器', '语言', '框架', '工具',
  '名字', '昵称', '风格',
]

/**
 * 中文友好的关键词提取 (Phase 1)
 *
 * 策略:
 *   1. 按标点/空白分段
 *   2. 对每段用 2-4 字 N-gram 滑窗生成候选词
 *   3. 优先提取包含偏好词表的候选词
 *   4. 兜底取较长段或前几个 N-gram
 *
 * @param {string} text
 * @returns {string[]} 最多 3 个关键词
 */
export function extractKeywords(text) {
  // 按标点和空白分段
  const segments = text
    .replace(/[，。！？、；：""''（）《》[\]{}.,!?;:'"()\-\s]+/g, '|')
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
    PREFERENCE_TERMS.some(t => c.includes(t)),
  )
  if (preferenceHits.length > 0) return [...new Set(preferenceHits)].slice(0, 3)

  // 优先级 2: 取较长的段（2-8 字）
  const longSegments = segments
    .filter(s => s.length >= 2 && s.length <= 8)
    .slice(0, 3)
  if (longSegments.length > 0) return longSegments

  // 兜底: 取前 3 个去重 N-gram
  return [...new Set(candidates)].slice(0, 3)
}

// --- Preference Extraction ---

const PREFERENCE_PATTERNS = [
  { regex: /我(?:叫|是|名字是)\s*([^\s，。！？,!?.]{1,20})/, key: 'user_name', category: 'preference' },
  { regex: /我喜欢(?:用|使用)?\s*([^\s，。！？,!?.]{1,20})/, key: 'user_likes', category: 'preference' },
  { regex: /我(?:偏好|习惯)\s*([^\s，。！？,!?.]{1,20})/, key: 'user_habit', category: 'preference' },
  { regex: /(?:我的)?(?:编程)?语言[是:]\s*([^\s，。！？,!?.]{1,20})/, key: 'user_lang', category: 'preference' },
]

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
    const ts = Date.now()
    const source = context.source || '?'

    // [0] 输入校验
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('handleMessage: text 不能为空')
    }

    log.info(`[pipeline] ▶ 收到消息 source=${source} len=${text.length}`)
    log.info(`[pipeline]   text="${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`)

    // [1] 意图分类 → 模型选择
    const intent = classifyIntent(text)
    const modelConfig = intent === 'heavy'
      ? this.#config.engine.heavyModel
      : this.#config.engine.defaultModel
    const modelDisplay = `${modelConfig.providerID}/${modelConfig.modelID}`

    log.info(`[pipeline] ① 意图=${intent} 模型=${modelDisplay}`)

    // [2] Session 管理
    const sessionId = await this.#resolveSession(context)
    log.info(`[pipeline] ② session=${sessionId} (${context.sessionId ? '复用' : '新建'})`)

    // [3] 构建 enriched prompt (带降级保护)
    const enrichedPrompt = this.#buildPrompt(text)
    log.info(`[pipeline] ③ prompt 已构建 (${enrichedPrompt.length} chars)`)

    // [4] 发送引擎 (核心依赖，不降级; session 失效时自动重建)
    log.info(`[pipeline] ④ 调用 Engine.sendAndWait ...`)
    const engineOpts = { model: modelConfig }
    if (context.timeoutMs) engineOpts.timeoutMs = context.timeoutMs
    let result
    try {
      result = await this.#engine.sendAndWait(sessionId, enrichedPrompt, engineOpts)
    } catch (e) {
      // session 可能已被 T08 小脑清理，尝试新建 session 重试一次
      if (context.sessionId && this.#isSessionError(e)) {
        log.warn(`[pipeline] session ${sessionId} 可能已失效，新建 session 重试`)
        const newSession = await this.#engine.createSession()
        result = await this.#engine.sendAndWait(newSession.id, enrichedPrompt, {
          model: modelConfig,
        })
        const elapsed = Date.now() - ts
        log.info(`[pipeline] ✅ 完成 (重试) ${elapsed}ms reply_len=${result.text.length}`)
        return {
          text: result.text,
          sessionId: newSession.id,
          model: modelDisplay,
          intent,
        }
      }
      log.error(`[pipeline] ✖ Engine 失败: ${e.message}`)
      throw e  // 非 session 错误，直接抛出
    }

    const elapsed = Date.now() - ts
    log.info(`[pipeline] ⑤ Engine 返回: ${elapsed}ms reply_len=${result.text.length}`)
    log.info(`[pipeline]   reply="${result.text.slice(0, 100)}${result.text.length > 100 ? '...' : ''}"`)

    // [5] 异步后处理 (分步容错，不阻塞返回)
    this.#postProcess(sessionId, text, result.text).catch(e =>
      log.error('[pipeline] 后处理异常:', e.message),
    )

    log.info(`[pipeline] ✅ 完成 source=${source} ${elapsed}ms`)

    return {
      text: result.text,
      sessionId,
      model: modelDisplay,
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

  /** 判断错误是否与 session 失效相关 (404 / not found 等) */
  #isSessionError(error) {
    const msg = (error.message || '').toLowerCase()
    return msg.includes('404') || msg.includes('not found') || msg.includes('session')
  }

  /** 构建 enriched prompt，Identity / Memory 失败时降级 */
  #buildPrompt(userText) {
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
    const semanticHits = this.#searchSemanticMemories(keywords)
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
  #searchSemanticMemories(keywords) {
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
      `- [${s.created_at}] ${s.summary}`,
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

export { DEFAULT_PERSONA, HEAVY_TEXT_THRESHOLD, MAX_PREF_LENGTH, PREFERENCE_PATTERNS }
