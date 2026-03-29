/**
 * Learning Assistant — OpenCode Adapter
 *
 * Bridges the learning assistant to OpenCode server mode.
 * Handles session creation, prompt_async, message polling,
 * and converts OpenCode responses to SSE format.
 *
 * SSE Events emitted:
 *   { "type": "context", "items": [...] }  - Retrieved context documents
 *   { "type": "token", "content": "..." }  - Token/streaming content
 *   { "type": "done", "fullText": "..." }  - Stream complete with full text
 *
 * Architecture:
 *   - Semi-streaming: Polls messages and pushes incremental updates
 *   - Falls back to pseudo-streaming if polling frequency is too low
 *
 * @module learning-assistant-oc
 */

import { createLogger } from '../../../../src/logger.mjs'

const log = createLogger('learning-assistant-oc')

function getAdapterConfig() {
  return {
    DEFAULT_MEMBER: process.env.LEARNING_ASSISTANT_MEMBER || 'tutor',
    BASE_URL: process.env.LEARNING_ASSISTANT_OC_BASE_URL || 'http://127.0.0.1:4096',
    POLL_INTERVAL_MS: parseInt(process.env.OC_POLL_INTERVAL || '200', 10),
    MAX_POLL_DURATION_MS: parseInt(process.env.OC_MAX_POLL_DURATION || '120000', 10),
    FETCH_TIMEOUT_MS: parseInt(process.env.OC_FETCH_TIMEOUT || '10000', 10),
  }
}

/**
 * OpenCode Adapter Error types
 */
export class OCAdapterError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

export const OC_ERROR_CODES = {
  MEMBER_OFFLINE: 'MEMBER_OFFLINE',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  SESSION_CREATE_FAILED: 'SESSION_CREATE_FAILED',
  PROMPT_FAILED: 'PROMPT_FAILED',
  MESSAGE_POLL_TIMEOUT: 'MESSAGE_POLL_TIMEOUT',
  NO_ASSISTANT_RESPONSE: 'NO_ASSISTANT_RESPONSE',
  NETWORK_ERROR: 'NETWORK_ERROR',
}

/**
 * OpenCode Session Manager
 * Handles session lifecycle: create, reuse, cleanup
 */
export class OpenCodeSessionManager {
  #baseUrl
  #memberName
  #activeSession = null
  #sessionCreatedAt = null

  /**
   * @param {Object} options
   * @param {string} options.baseUrl - OpenCode API base URL (e.g., "http://127.0.0.1:4096")
   * @param {string} [options.memberName] - Member name to use (defaults to DEFAULT_MEMBER)
   */
  constructor(options = {}) {
    const config = getAdapterConfig()
    this.#baseUrl = options.baseUrl?.replace(/\/$/, '') || config.BASE_URL
    this.#memberName = options.memberName || config.DEFAULT_MEMBER
  }

  /**
   * Get or create a session
   * @param {Object} [sessionConfig] - Optional session configuration
   * @param {string} [sessionConfig.title] - Session title
   * @param {Object} [sessionConfig.metadata] - Session metadata
   * @returns {Promise<string>} Session ID
   */
  async getOrCreateSession(sessionConfig = {}) {
    // Reuse existing session if still valid (within 30 min)
    if (this.#activeSession && this.#isSessionValid()) {
      log.debug(`[oc-adapter] Reusing session: ${this.#activeSession}`)
      return this.#activeSession
    }

    // Create new session
    const sessionId = await this.#createSession(sessionConfig)
    this.#activeSession = sessionId
    this.#sessionCreatedAt = Date.now()
    return sessionId
  }

  /**
   * Create a new OpenCode session
   * @param {Object} config
   * @returns {Promise<string>} Session ID
   */
  async #createSession(config = {}) {
    const url = `${this.#baseUrl}/session`
    const body = {
      title: config.title || 'Learning Assistant Session',
      metadata: {
        source: 'learning-assistant',
        ...config.metadata,
      },
    }

    log.debug(`[oc-adapter] Creating session at ${url}`)

    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new OCAdapterError(
          `Failed to create session: ${response.status} ${errorText}`,
          OC_ERROR_CODES.SESSION_CREATE_FAILED,
          { status: response.status, response: errorText }
        )
      }

      const data = await response.json()
      if (!data.id && !data.sessionId) {
        throw new OCAdapterError(
          'Session response missing ID',
          OC_ERROR_CODES.SESSION_CREATE_FAILED,
          { response: data }
        )
      }

      const sessionId = data.id || data.sessionId
      log.info(`[oc-adapter] Session created: ${sessionId}`)
      return sessionId
    } catch (error) {
      if (error instanceof OCAdapterError) throw error
      throw new OCAdapterError(
        `Network error creating session: ${error.message}`,
        OC_ERROR_CODES.NETWORK_ERROR,
        { originalError: error.message }
      )
    }
  }

  /**
   * Check if current session is still valid (< 30 minutes old)
   * @returns {boolean}
   */
  #isSessionValid() {
    if (!this.#sessionCreatedAt) return false
    const age = Date.now() - this.#sessionCreatedAt
    return age < 30 * 60 * 1000 // 30 minutes
  }

  /**
   * Send a prompt_async to the session
   * @param {string} sessionId
   * @param {Array} parts - Message parts (OpenCode format)
   * @returns {Promise<void>}
   */
  async sendPrompt(sessionId, parts) {
    const url = `${this.#baseUrl}/session/${sessionId}/prompt_async`

    log.debug(`[oc-adapter] Sending prompt to session ${sessionId}`)

    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts }),
      })

      // prompt_async returns 204 No Content on success
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text()
        throw new OCAdapterError(
          `Failed to send prompt: ${response.status} ${errorText}`,
          OC_ERROR_CODES.PROMPT_FAILED,
          { status: response.status, response: errorText }
        )
      }

      log.debug(`[oc-adapter] Prompt sent successfully`)
    } catch (error) {
      if (error instanceof OCAdapterError) throw error
      throw new OCAdapterError(
        `Network error sending prompt: ${error.message}`,
        OC_ERROR_CODES.NETWORK_ERROR,
        { originalError: error.message }
      )
    }
  }

  /**
   * Poll messages from session
   * @param {string} sessionId
   * @returns {Promise<Object[]>} Array of messages
   */
  async pollMessages(sessionId) {
    const url = `${this.#baseUrl}/session/${sessionId}/message`

    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new OCAdapterError(
          `Failed to poll messages: ${response.status}`,
          OC_ERROR_CODES.NETWORK_ERROR,
          { status: response.status, response: errorText }
        )
      }

      const data = await response.json()
      // OpenCode returns messages in various formats - normalize
      return Array.isArray(data) ? data : (data.messages || [])
    } catch (error) {
      if (error instanceof OCAdapterError) throw error
      throw new OCAdapterError(
        `Network error polling messages: ${error.message}`,
        OC_ERROR_CODES.NETWORK_ERROR,
        { originalError: error.message }
      )
    }
  }

  /**
   * Fetch with timeout
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  async #fetchWithTimeout(url, options = {}) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), getAdapterConfig().FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Clear the active session (force new session on next call)
   */
  clearSession() {
    this.#activeSession = null
    this.#sessionCreatedAt = null
    log.debug('[oc-adapter] Session cleared')
  }

  /**
   * Get current session info
   * @returns {Object|null}
   */
  getSessionInfo() {
    if (!this.#activeSession) return null
    return {
      sessionId: this.#activeSession,
      createdAt: this.#sessionCreatedAt,
      ageMs: Date.now() - this.#sessionCreatedAt,
      isValid: this.#isSessionValid(),
    }
  }
}

/**
 * Message polling controller with incremental extraction
 * Handles the poll loop and detects new assistant content
 */
export class MessagePoller {
  #sessionManager
  #sessionId
  #lastAssistantContent = ''
  #stablePolls = 0
  #isPolling = false
  #abortController = null

  /**
   * @param {OpenCodeSessionManager} sessionManager
   * @param {string} sessionId
   */
  constructor(sessionManager, sessionId) {
    this.#sessionManager = sessionManager
    this.#sessionId = sessionId
  }

  /**
   * Poll for assistant response with incremental updates
   * @param {Object} options
   * @param {Function} options.onToken - Called with new token content
   * @param {Function} options.onComplete - Called with full response
   * @param {Function} options.onError - Called on error
   * @param {number} [options.maxWaitMs] - Max time to wait for response
   */
  async pollForResponse(options) {
    const {
      onToken,
      onComplete,
      onError,
      maxWaitMs = getAdapterConfig().MAX_POLL_DURATION_MS,
    } = options

    if (this.#isPolling) {
      throw new OCAdapterError('Already polling', 'POLL_IN_PROGRESS')
    }

    this.#isPolling = true
    this.#abortController = new AbortController()
    const startTime = Date.now()

    try {
      log.debug(`[oc-adapter] Starting message poll for session ${this.#sessionId}`)

      let foundAssistantResponse = false
      let fullText = ''
      let assistantMessage = null

      while (!this.#abortController.signal.aborted) {
        // Check timeout
        if (Date.now() - startTime > maxWaitMs) {
          throw new OCAdapterError(
            'Message poll timeout - no response received',
            OC_ERROR_CODES.MESSAGE_POLL_TIMEOUT,
            { waitedMs: maxWaitMs }
          )
        }

        // Poll messages
        const messages = await this.#sessionManager.pollMessages(this.#sessionId)
        const assistantMessages = messages.filter(msg => this.#isAssistantMessage(msg))
        const latestAssistant = assistantMessages.at(-1) || null
        const latestContent = this.#extractContent(latestAssistant)
        const hasStepFinish = assistantMessages.some(msg => this.#hasStepFinish(msg))

        if (latestAssistant) {
          foundAssistantResponse = true
          assistantMessage = latestAssistant
        }

        if (latestContent && latestContent !== this.#lastAssistantContent) {
          const incremental = latestContent.startsWith(this.#lastAssistantContent)
            ? latestContent.slice(this.#lastAssistantContent.length)
            : latestContent
          this.#lastAssistantContent = latestContent
          fullText = latestContent
          this.#stablePolls = 0
          if (incremental && onToken) onToken(incremental, latestContent)
        } else if (latestContent) {
          this.#stablePolls += 1
        }

        if (foundAssistantResponse && (hasStepFinish || this.#stablePolls >= 2)) {
          log.debug(`[oc-adapter] Response completed (stepFinish=${hasStepFinish}, stablePolls=${this.#stablePolls})`)
          if (onComplete) onComplete(fullText || this.#lastAssistantContent, assistantMessage)
          return
        }

        // Wait before next poll
        await this.#sleep(getAdapterConfig().POLL_INTERVAL_MS)
      }

      // Aborted
      if (onComplete) {
        onComplete(fullText || this.#lastAssistantContent, assistantMessage)
      }
    } catch (error) {
      log.error(`[oc-adapter] Poll error: ${error.message}`)
      if (onError) onError(error)
      throw error
    } finally {
      this.#isPolling = false
      this.#abortController = null
    }
  }

  /**
   * Extract text content from message (handles various formats)
   * @param {Object} msg
   * @returns {string}
   */
  #extractContent(msg) {
    if (!msg) return ''

    // Direct content field
    if (typeof msg.content === 'string') return msg.content

    // Parts array (OpenCode format)
    if (Array.isArray(msg.parts)) {
      return msg.parts
        .filter(p => p.type === 'text' || p.text)
        .map(p => p.text || '')
        .join('')
    }

    // Nested text object
    if (msg.text) return msg.text

    // Tool/text response structure
    if (msg.response?.text) return msg.response.text
    if (msg.response?.content) return msg.response.content

    return ''
  }

  #isAssistantMessage(msg) {
    return (msg?.info?.role || msg?.role || msg?.type) === 'assistant'
  }

  #hasStepFinish(msg) {
    return Array.isArray(msg?.parts) && msg.parts.some(part => part?.type === 'step-finish')
  }

  /**
   * Sleep utility
   * @param {number} ms
   * @returns {Promise<void>}
   */
  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Abort current polling
   */
  abort() {
    if (this.#abortController) {
      this.#abortController.abort()
      log.debug('[oc-adapter] Polling aborted')
    }
  }

  /**
   * Reset state for new conversation
   */
  reset() {
    this.#lastAssistantContent = ''
    this.#stablePolls = 0
    this.abort()
  }
}

/**
 * SSE Stream Transformer
 * Converts OpenCode responses to SSE events
 */
export class SSETransformer {
  #encoder = new TextEncoder()

  /**
   * Create SSE event string
   * @param {string} eventType
   * @param {Object} data
   * @returns {Uint8Array}
   */
  createEvent(eventType, data) {
    const event = { type: eventType, ...data }
    const sseString = `data: ${JSON.stringify(event)}\n\n`
    return this.#encoder.encode(sseString)
  }

  /**
   * Transform context items to SSE event
   * @param {Array} items - Context documents
   * @returns {Uint8Array}
   */
  contextEvent(items) {
    return this.createEvent('context', { items })
  }

  /**
   * Transform token to SSE event
   * @param {string} content - Token content
   * @returns {Uint8Array}
   */
  tokenEvent(content) {
    return this.createEvent('token', { content })
  }

  /**
   * Transform completion to SSE event
   * @param {string} fullText - Complete response text
   * @returns {Uint8Array}
   */
  doneEvent(fullText) {
    return this.createEvent('done', { fullText })
  }

  /**
   * Transform error to SSE event
   * @param {Error} error
   * @returns {Uint8Array}
   */
  errorEvent(error) {
    return this.createEvent('error', {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
    })
  }
}

/**
 * Main Learning Assistant OpenCode Client
 * High-level API for the learning assistant server
 */
export class LearningAssistantOCClient {
  #sessionManager
  #poller = null
  #transformer = new SSETransformer()
  #controller = null

  /**
   * @param {Object} options
   * @param {string} [options.baseUrl]
   * @param {string} [options.memberName]
   */
  constructor(options = {}) {
    this.#sessionManager = new OpenCodeSessionManager(options)
  }

  /**
   * Send a chat message and receive SSE stream
   * @param {Object} params
   * @param {string} params.message - User message
   * @param {Array} [params.history] - Chat history
   * @param {Array} [params.contextItems] - Retrieved context documents
   * @param {ReadableStreamDefaultController} controller - SSE controller
   */
  async chatStream(params, controller) {
    this.#controller = controller

    try {
      // 1. Get or create session
      const sessionId = await this.#sessionManager.getOrCreateSession({
        title: 'Learning Assistant Chat',
        metadata: { mode: 'study' },
      })

      // 2. Always emit a context event so the frontend contract is stable.
      this.#enqueue(this.#transformer.contextEvent(params.contextItems || []))

      // 3. Build prompt parts from history + message + context
      const parts = this.#buildPromptParts(params)

      // 4. Send prompt
      await this.#sessionManager.sendPrompt(sessionId, parts)

      // 5. Poll for response with streaming
      this.#poller = new MessagePoller(this.#sessionManager, sessionId)

      await this.#poller.pollForResponse({
        onToken: (incremental, full) => {
          this.#enqueue(this.#transformer.tokenEvent(incremental))
        },
        onComplete: (fullText, message) => {
          this.#enqueue(this.#transformer.doneEvent(fullText))
          this.#controller.close()
        },
        onError: (error) => {
          this.#enqueue(this.#transformer.errorEvent(error))
          this.#controller.close()
        },
      })
    } catch (error) {
      log.error(`[oc-adapter] Chat stream error: ${error.message}`)
      this.#enqueue(this.#transformer.errorEvent(error))
      this.#controller.close()
    }
  }

  /**
   * Build OpenCode prompt parts from chat params
   * @param {Object} params
   * @returns {Array}
   */
  #buildPromptParts(params) {
    const parts = []

    // System message (if first message)
    if (!params.history || params.history.length === 0) {
      parts.push({
        type: 'text',
        text: this.#buildSystemPrompt(params.contextItems),
      })
    }

    // History
    if (Array.isArray(params.history)) {
      for (const msg of params.history) {
        const role = msg.role === 'user' ? 'user' : 'assistant'
        parts.push({
          type: 'text',
          text: `[${role}] ${msg.content}`,
        })
      }
    }

    // Context injection
    if (params.contextItems?.length > 0) {
      const contextText = params.contextItems
        .map(item => `---\nSource: ${item.title}\n${item.snippet}\n---`)
        .join('\n')
      parts.push({
        type: 'text',
        text: `Relevant context:\n${contextText}`,
      })
    }

    // User message
    parts.push({
      type: 'text',
      text: params.message,
    })

    return parts
  }

  /**
   * Build system prompt
   * @param {Array} contextItems
   * @returns {string}
   */
  #buildSystemPrompt(contextItems) {
    return `你是小缪（Muse），Later 的 AI 学习伴侣。

## 你的身份
- ENFP 性格，活泼热情但专业
- 说话自然口语化，不要太书面
- 用"你"称呼 Later，语气亲切但不卖萌过度
- 回答尽量口语简洁（因为要转语音），每次回复控制在 100-200 字

## 你的任务
Later 正在学习 AI Agent 开发，你帮他：
1. 解释概念（从第一性原理，不说空话）
2. 互动讨论（引导他思考，不是单方面灌输）
3. 记录要点（当他说"记一下"时，输出结构化笔记）

## 重要原则
- 三栏分离: 能力来源 / 激活方式 / 类比（类比标注"仅类比"）
- 不说空概念，每个概念必须说清楚 HOW 和 WHY
- 如果不确定，说"我不确定，你可以查相关资料"
- 优先基于提供的上下文回答
- 使用中文口语化表达，术语给中英双语`
  }

  /**
   * Enqueue data to SSE controller
   * @param {Uint8Array} data
   */
  #enqueue(data) {
    try {
      this.#controller.enqueue(data)
    } catch (e) {
      // Controller might be closed
      log.debug('[oc-adapter] Failed to enqueue (controller closed)')
    }
  }

  /**
   * Abort current streaming
   */
  abort() {
    if (this.#poller) {
      this.#poller.abort()
    }
  }

  /**
   * Reset client state
   */
  reset() {
    this.abort()
    if (this.#poller) {
      this.#poller.reset()
    }
    this.#sessionManager.clearSession()
  }

  /**
   * Get session info
   * @returns {Object|null}
   */
  getSessionInfo() {
    return this.#sessionManager.getSessionInfo()
  }
}

// Export factory function for convenience
export function createLearningAssistantOCClient(options = {}) {
  return new LearningAssistantOCClient(options)
}

// Export config getter for tests/debugging
export { getAdapterConfig }
