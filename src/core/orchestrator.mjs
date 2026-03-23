import { createLogger } from '../logger.mjs'
import { extractToolCalls, classifyRoute } from '../capability/router.mjs'

const log = createLogger('orchestrator')

// --- Orchestrator Class (T13: 瘦身后) ---
//
// Phase 2 瘦身: 删除 wrapper 认知层
//   - 删: classifyIntent / extractKeywords / PREFERENCE_PATTERNS / #buildPrompt / #postProcess
//   - 留: 消息转发 + session 管理 + health + 错误处理
//   - 原因: T11 MCP (记忆) + T12 AGENTS.md (人格) + T10.5 Hook (审计) 已原生化

export class Orchestrator {
  #config
  #identity
  #engine
  #executionLog
  #mcpServerNames

  constructor({ config, identity, engine, executionLog, mcpServerNames }) {
    this.#config = config
    this.#identity = identity
    this.#engine = engine
    this.#executionLog = executionLog || null
    this.#mcpServerNames = mcpServerNames || []
  }

  /**
   * 主入口 — 所有适配器通过此方法发送消息
   *
   * T13 后此方法只做: 输入校验 → session → engine 转发 → 返回
   * 不再做: 意图分类、模型选择、记忆注入、后处理
   *
   * @param {string} text - 用户消息 (非空字符串)
   * @param {object} [context] - 可选上下文
   * @param {string} [context.sessionId] - 指定 session
   * @param {string} [context.source] - 来源: 'telegram' | 'web' | 'cli'
   * @param {number} [context.timeoutMs] - 超时毫秒
   * @returns {Promise<{text: string, sessionId: string}>}
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

    // [1] Session 管理
    const sessionId = await this.#resolveSession(context)
    log.info(`[pipeline] ① session=${sessionId} (${context.sessionId ? '复用' : '新建'})`)

    // [2] 直接转发 — 不注入任何额外内容
    //     人格由 AGENTS.md 原生注入 (T12)
    //     记忆由 AI 自主调 MCP (T11)
    //     审计由 Hook 自动观察 (T10.5)
    log.info(`[pipeline] ② 调用 Engine.sendAndWait ...`)
    const engineOpts = {}
    if (context.timeoutMs) engineOpts.timeoutMs = context.timeoutMs

    let result
    try {
      result = await this.#engine.sendAndWait(sessionId, text, engineOpts)
    } catch (e) {
      // session 可能已被小脑清理，尝试新建 session 重试一次
      if (context.sessionId && this.#isSessionError(e)) {
        log.warn(`[pipeline] session ${sessionId} 可能已失效，新建 session 重试`)
        const newSession = await this.#engine.createSession()
        result = await this.#engine.sendAndWait(newSession.id, text, engineOpts)
        const elapsed = Date.now() - ts
        log.info(`[pipeline] ✅ 完成 (重试) ${elapsed}ms reply_len=${result.text.length}`)
        return { text: result.text, sessionId: newSession.id }
      }
      log.error(`[pipeline] ✖ Engine 失败: ${e.message}`)
      throw e
    }

    const elapsed = Date.now() - ts
    log.info(`[pipeline] ✅ 完成 source=${source} ${elapsed}ms reply_len=${result.text.length}`)

    // T17: trace — 从 session messages 提取工具调用，分类，写 ExecutionLog
    this.#recordExecution(result, elapsed)

    return { text: result.text, sessionId }
  }

  /** 聚合子模块的健康状态 */
  async health() {
    const [identityHealth, engineHealth] = await Promise.all([
      this.#identity.health(),
      this.#engine.health(),
    ])
    const ok = identityHealth.ok && engineHealth.ok
    return {
      ok,
      detail: {
        identity: identityHealth,
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

  /**
   * T17: 从 engine 返回的 messages 中提取工具调用信息
   * 并记录到 ExecutionLog
   */
  #recordExecution(result, elapsed) {
    if (!this.#executionLog) return
    try {
      const tools = extractToolCalls(result.messages || [])
      const routes = tools.map(t => classifyRoute(t, this.#mcpServerNames))
      const uniqueRoutes = [...new Set(routes)]

      this.#executionLog.record({
        sessionId: result.sessionId,
        tools,
        routes: uniqueRoutes,
        success: true,
        elapsed,
      })
    } catch (e) {
      // 降级: trace 提取失败不影响主链
      log.warn(`[pipeline] trace 提取失败 (已降级): ${e.message}`)
    }
  }
}
