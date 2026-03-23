/**
 * T39-1.2: MemberClient
 *
 * 跨 muse HTTP 通信客户端 — 封装 OpenCode REST API。
 *
 * 对齐 engine.mjs 契约：
 * - POST /session → createSession
 * - POST /session/:id/prompt_async → prompt (204 No Content)
 * - GET /session/status → pollUntilDone (seenBusy 语义)
 * - GET /session/:id/message → fetchLastReply
 * - GET /global/health → ping (降级 /provider)
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('member-client')

export class MemberClient {
  #baseUrl
  #workingDir

  /**
   * @param {string} engineUrl - 目标 muse 的 engine URL，如 "http://127.0.0.1:4101"
   * @param {string} [workingDir] - 目标 muse 的工作目录（x-opencode-directory header）
   */
  constructor(engineUrl, workingDir) {
    this.#baseUrl = engineUrl.replace(/\/$/, '')
    this.#workingDir = workingDir || process.cwd()
  }

  /**
   * 创建新 session
   * @returns {Promise<string>} sessionId
   */
  async createSession() {
    const data = await this.#request('POST', '/session', {})
    const sessionId = data?.id
    if (!sessionId) {
      throw new Error('createSession 返回无效数据：缺少 id')
    }
    log.info('session 已创建', { sessionId, target: this.#baseUrl })
    return sessionId
  }

  /**
   * 异步发送消息（prompt_async 返回 204）
   * @param {string} sessionId
   * @param {string} text
   */
  async prompt(sessionId, text) {
    await this.#request('POST', `/session/${sessionId}/prompt_async`, {
      parts: [{ type: 'text', text }],
    })
    log.info('prompt 已发送', { sessionId, textLen: text.length })
  }

  /**
   * 轮询 session 直到处理完成
   *
   * 语义（对齐 engine.mjs:144-176）：
   * - GET /session/status 返回全部活跃 session 的状态 map
   * - busy/retry → 标记 seenBusy
   * - idle/completed → 完成
   * - unknown（不在 map 中）:
   *   - seenBusy=true → 完成（idle 后从 status map 删除）
   *   - seenBusy=false → 还没开始，继续等
   *
   * @param {string} sessionId
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs=120000]
   * @param {number} [opts.pollIntervalMs=1000]
   */
  async pollUntilDone(sessionId, opts = {}) {
    const { timeoutMs = 120_000, pollIntervalMs = 1000 } = opts
    const traceId = `${sessionId.slice(-8)}-${Date.now() % 100000}`
    const deadline = Date.now() + timeoutMs
    let pollCount = 0
    let seenBusy = false

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs))
      pollCount++

      let status = 'unknown'
      try {
        const allStatus = await this.#request('GET', '/session/status')
        const raw = allStatus?.[sessionId]
        status = typeof raw === 'object' ? (raw?.type || 'unknown') : (raw || 'unknown')
      } catch {
        status = 'unknown'
      }

      if (status === 'busy' || status === 'retry') {
        seenBusy = true
      }

      const isComplete = (status === 'idle' || status === 'completed')
        || (seenBusy && status === 'unknown')

      if (pollCount <= 3 || pollCount % 5 === 0 || isComplete) {
        log.info(`[trace:${traceId}] poll #${pollCount}: status=${status} seenBusy=${seenBusy}${isComplete ? ' → COMPLETE' : ''}`)
      }

      if (isComplete) return
    }

    log.error(`[trace:${traceId}] 轮询超时`, { sessionId, timeoutMs, pollCount, seenBusy })
    throw new Error(`pollUntilDone 超时: session ${sessionId} 在 ${timeoutMs}ms 内未完成 (polls=${pollCount}, seenBusy=${seenBusy})`)
  }

  /**
   * 获取 session 最后一条 assistant 回复
   * @param {string} sessionId
   * @returns {Promise<string>} 回复文本
   */
  async fetchLastReply(sessionId) {
    const messages = await this.#request('GET', `/session/${sessionId}/message`)
    const msgList = Array.isArray(messages) ? messages : []

    const lastAssistant = [...msgList].reverse().find(m =>
      (m.info?.role || m.role) === 'assistant'
    )

    if (!lastAssistant) {
      log.warn('未找到 assistant 回复', { sessionId, messageCount: msgList.length })
      return ''
    }

    // 提取文本：parts 数组中 type=text 的拼接
    const text = (lastAssistant.parts || [])
      .filter(p => p.type === 'text')
      .map(p => p.text || '')
      .join('')

    return text
  }

  /**
   * 完整流程：prompt → poll → fetchLastReply
   * @param {string} sessionId
   * @param {string} text
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs=120000]
   * @param {number} [opts.pollIntervalMs=1000]
   * @returns {Promise<string>} 回复文本
   */
  async sendAndWait(sessionId, text, opts = {}) {
    await this.prompt(sessionId, text)
    await this.pollUntilDone(sessionId, opts)
    return this.fetchLastReply(sessionId)
  }

  /**
   * 健康检查：优先 /global/health，降级 /provider
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const res = await fetch(`${this.#baseUrl}/global/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return true
    } catch { /* fall through */ }

    try {
      const res = await fetch(`${this.#baseUrl}/provider`, {
        headers: this.#buildHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // --- Internal ---

  #buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-opencode-directory': this.#workingDir,
    }
  }

  /**
   * 通用 HTTP 请求
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @returns {Promise<any>}
   */
  async #request(method, path, body) {
    const url = `${this.#baseUrl}${path}`
    const fetchOpts = {
      method,
      headers: this.#buildHeaders(),
      signal: AbortSignal.timeout(30_000),
    }
    if (body !== undefined) {
      fetchOpts.body = JSON.stringify(body)
    }

    let res
    try {
      res = await fetch(url, fetchOpts)
    } catch (e) {
      log.error('HTTP 请求失败', { method, path, target: this.#baseUrl, error: e.message })
      throw new Error(`MemberClient ${method} ${path} 失败: ${e.message}`)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const err = new Error(`MemberClient HTTP ${res.status}: ${method} ${path} — ${errText.slice(0, 200)}`)
      err.status = res.status
      log.error('HTTP 响应错误', { method, path, status: res.status, body: errText.slice(0, 100) })
      throw err
    }

    // 204 No Content (prompt_async)
    if (res.status === 204) {
      return { ok: true }
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const text = await res.text()
      return text ? JSON.parse(text) : null
    }

    return await res.text()
  }
}
