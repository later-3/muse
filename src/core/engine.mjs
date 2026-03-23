import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('engine')

/** HTTP 状态码中可重试的 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

/**
 * 标准化 model 参数为 OpenCode 要求的嵌套对象格式
 * 接受: 'google/gemini-2.5-flash' 或 { providerID: 'google', modelID: 'gemini-2.5-flash' }
 * 输出: { providerID: 'google', modelID: 'gemini-2.5-flash' }
 */
export function normalizeModel(model) {
  if (!model) return undefined
  if (typeof model === 'object' && model.providerID && model.modelID) return model
  if (typeof model === 'string' && model.includes('/')) {
    const [providerID, ...rest] = model.split('/')
    return { providerID, modelID: rest.join('/') }
  }
  return undefined
}

export class Engine {
  #config
  #process = null
  #ownsProcess = false
  #baseUrl = ''
  #headers = {}
  #ready = false

  constructor(config) {
    this.#config = config
    this.#baseUrl = `${config.engine.host}:${config.engine.port}`
    this.#headers = {
      'Content-Type': 'application/json',
      'x-opencode-directory': config.engine.workspace,
    }
  }

  // --- Lifecycle ---

  async start() {
    if (await this.#healthCheck()) {
      log.info('已检测到运行中的 OpenCode serve (attach 模式)')
      this.#ownsProcess = false
      this.#ready = true
      return
    }
    await this.#spawn()
    this.#ownsProcess = true
    this.#ready = true
    log.info(`OpenCode serve 已就绪: ${this.#baseUrl}`)
  }

  async stop() {
    if (this.#ownsProcess && this.#process) {
      log.info('终止 Muse 启动的 OpenCode serve 进程')
      this.#process.kill('SIGTERM')
      this.#process = null
    } else {
      log.info('OpenCode serve 为外部实例，不终止')
    }
    this.#ownsProcess = false
    this.#ready = false
  }

  async health() {
    const ok = await this.#healthCheck()
    return {
      ok,
      detail: ok ? `running at ${this.#baseUrl}` : 'unreachable',
      ownsProcess: this.#ownsProcess,
    }
  }

  // --- Session Management ---

  async createSession() {
    return this.#request('POST', '/session', {})
  }

  async listSessions() {
    return this.#request('GET', '/session')
  }

  async getSession(sessionId) {
    return this.#request('GET', `/session/${sessionId}`)
  }

  async deleteSession(sessionId) {
    return this.#request('DELETE', `/session/${sessionId}`)
  }

  // --- Messaging ---

  /**
   * 构建消息 payload (共享逻辑)
   * @param {string} text - 用户消息
   * @param {object} [opts] - 选项
   * @param {string|object} [opts.model] - 模型 (字符串或嵌套对象)
   * @param {string} [opts.system] - system prompt 注入
   * @param {string} [opts.agent] - OpenCode agent (build/plan/explore)
   */
  #buildPayload(text, opts = {}) {
    const payload = { parts: [{ type: 'text', text }] }
    const model = normalizeModel(opts.model)
    if (model) payload.model = model
    if (opts.system) payload.system = opts.system
    if (opts.agent) payload.agent = opts.agent
    return payload
  }

  /** 异步发送消息（主路径，推荐） */
  async sendMessageAsync(sessionId, text, opts = {}) {
    const payload = this.#buildPayload(text, opts)
    return this.#request('POST', `/session/${sessionId}/prompt_async`, payload)
  }

  /** 同步发送消息（仅调试/短任务用） */
  async sendMessage(sessionId, text, opts = {}) {
    const payload = this.#buildPayload(text, opts)
    return this.#request('POST', `/session/${sessionId}/message`, payload, { timeoutMs: 120_000 })
  }

  /**
   * 高层 helper — 发送消息并等待助手回复
   * prompt_async → 轮询 session status → 获取消息 → 返回结果
   */
  async sendAndWait(sessionId, text, opts = {}) {
    const { timeoutMs = 120_000, pollIntervalMs = 1000, ...sendOpts } = opts
    const traceId = `${sessionId.slice(-8)}-${Date.now() % 100000}`

    log.info(`[trace:${traceId}] ▶ sendAndWait 开始: session=${sessionId}`)
    log.info(`[trace:${traceId}]   text="${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`)
    if (sendOpts.model) log.info(`[trace:${traceId}]   model=${JSON.stringify(sendOpts.model)}`)

    // Step 1: 发送异步消息
    await this.sendMessageAsync(sessionId, text, sendOpts)
    log.info(`[trace:${traceId}] ✓ prompt_async 已接受 (204)`)

    // Step 2: 轮询状态
    // OpenCode 状态生命周期 (来自 session/status.ts):
    //   - busy: 正在处理
    //   - idle: 处理完成 → 但 idle 时会从 status map 中 **删除**
    //   - 所以批量 /session/status 只包含 busy/retry 的 session
    //   - session 不在 map 中 = idle (已完成)
    //   - 但刚发完 prompt 还没开始时也不在 map 中
    //   - 策略: 等到看到 "busy" 至少一次，之后 "unknown" = "idle"
    const deadline = Date.now() + timeoutMs
    let pollCount = 0
    let seenBusy = false

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs))
      pollCount++

      // 获取 session 状态
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

      // 关键逻辑: 已经见过 busy → 现在 unknown → 说明处理完成 (idle 被删除了)
      const isComplete = (status === 'idle' || status === 'completed')
        || (seenBusy && status === 'unknown')

      if (pollCount <= 3 || pollCount % 5 === 0 || isComplete) {
        log.info(`[trace:${traceId}] ⏳ poll #${pollCount}: status=${status} seenBusy=${seenBusy}${isComplete ? ' → COMPLETE' : ''}`)
      }

      if (isComplete) {
        log.info(`[trace:${traceId}] ✓ 处理完成，获取消息...`)

        const messages = await this.getMessages(sessionId)
        const msgList = Array.isArray(messages) ? messages : []
        log.info(`[trace:${traceId}]   消息总数=${msgList.length}`)

        // OpenCode 消息格式: [{info:{role,id,...}, parts:[{type,text,...}]}]
        const lastAssistant = [...msgList].reverse().find(m =>
          (m.info?.role || m.role) === 'assistant'
        )

        if (lastAssistant) {
          const reply = extractText(lastAssistant)

          // 空响应检测：model 返回了 assistant 消息但 parts 为空
          if (!reply && lastAssistant.parts?.length === 0) {
            log.warn(`[trace:${traceId}] ⚠ model 返回空 parts (0 text)，可能是模型兼容性问题`)
            log.warn(`[trace:${traceId}]   assistant info: ${JSON.stringify(lastAssistant.info || {})}`)

            // 重试一次：在同一 session 重发
            if (!opts._retried) {
              log.info(`[trace:${traceId}] 🔄 空响应重试 (1/1)...`)
              return this.sendAndWait(sessionId, text, { ...opts, _retried: true })
            }

            // 重试后仍然空 → 返回错误提示而不是空字符串
            log.error(`[trace:${traceId}] ✖ 重试后仍为空响应，返回错误提示`)
            return {
              message: lastAssistant,
              text: '⚠️ 模型返回了空响应，请重新发送消息或联系管理员检查模型配置。',
              sessionId,
              messages: msgList,
            }
          }

          log.info(`[trace:${traceId}] ✅ 收到回复: "${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}"`)
          return {
            message: lastAssistant,
            text: reply,
            sessionId,
            messages: msgList,  // T17: 完整消息列表供 trace 提取
          }
        }

        if (seenBusy) {
          // 已经 busy 过但没消息 → 可能出错了，检查 OpenCode 日志
          log.warn(`[trace:${traceId}] ⚠ 处理完成但无 assistant 消息，可能 OpenCode 内部出错`)
          log.warn(`[trace:${traceId}]   检查 OpenCode 日志: ~/.local/share/opencode/log/`)
          // 再等几秒看看
          if (pollCount > 5) {
            throw new Error(`OpenCode 处理完成但无回复。检查 OpenCode 日志。[trace:${traceId}]`)
          }
        }
      }
    }

    log.error(`[trace:${traceId}] ✖ 超时 (${timeoutMs}ms, ${pollCount} polls, seenBusy=${seenBusy})`)
    throw new Error(`sendAndWait 超时: session ${sessionId} 在 ${timeoutMs}ms 内未返回结果 [trace:${traceId}]`)
  }

  async getMessages(sessionId) {
    return this.#request('GET', `/session/${sessionId}/message`)
  }

  async abort(sessionId) {
    return this.#request('POST', `/session/${sessionId}/abort`)
  }

  // --- SSE Event Stream ---

  /**
   * 订阅 SSE 事件流
   * 标准分帧: 空行分隔事件帧，支持多行 data 拼接
   */
  subscribeEvents(onEvent) {
    const controller = new AbortController()
    const url = `${this.#baseUrl}/event`

    const run = async () => {
      const res = await fetch(url, {
        headers: this.#headers,
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`SSE 连接失败: HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let dataLines = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() // 保留不完整行

        for (const line of lines) {
          if (line === '') {
            // 空行 = 帧结束
            if (dataLines.length > 0) {
              const payload = dataLines.join('\n')
              dataLines = []
              try {
                onEvent(JSON.parse(payload))
              } catch { /* 非 JSON 跳过 */ }
            }
          } else if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6))
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5))
          }
          // 忽略 event:, id:, 注释行 (:开头)
        }
      }
    }

    run().catch(err => {
      if (err.name !== 'AbortError') log.error('SSE 连接断开:', err.message)
    })

    return { cancel: () => controller.abort() }
  }

  // --- Internal ---

  async #spawn() {
    log.info('启动 opencode serve ...')
    let stderrBuffer = ''

    // opencode serve 不支持 --model 参数，模型由 opencode.json 配置
    const expectedModel = this.#resolveModel()
    if (expectedModel) log.info(`  期望模型: ${expectedModel} (由 opencode.json 配置)`)

    this.#process = spawn('opencode', ['serve', '--port', String(this.#config.engine.port)], {
      cwd: this.#config.engine.workspace,
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: true,
    })

    // 收集 stderr（最多 2KB 诊断）
    this.#process.stderr.on('data', chunk => {
      if (stderrBuffer.length < 2048) stderrBuffer += chunk.toString()
    })

    // 监听启动失败
    const earlyExitPromise = new Promise((_, reject) => {
      this.#process.on('error', err => {
        reject(new Error(`opencode 启动失败: ${err.message} (${err.code || 'unknown'})`))
      })
      this.#process.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          reject(new Error(
            `opencode 异常退出: code=${code} signal=${signal}\nstderr: ${stderrBuffer.slice(0, 500)}`
          ))
        }
      })
    })

    this.#process.unref()

    // 等待就绪（最多 15s），同时监听早退
    for (let i = 0; i < 30; i++) {
      const raceResult = await Promise.race([
        new Promise(r => setTimeout(r, 500)),
        earlyExitPromise.catch(err => err),
      ])
      if (raceResult instanceof Error) throw raceResult
      if (await this.#healthCheck()) return
    }
    throw new Error(`opencode serve 启动超时 (15s)\nstderr: ${stderrBuffer.slice(0, 500)}`)
  }

  async #healthCheck() {
    try {
      // 优先用 /global/health (无需 workspace header)
      const res = await fetch(`${this.#baseUrl}/global/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return true
      // 降级: 尝试 /provider (旧版兼容)
      const res2 = await fetch(`${this.#baseUrl}/provider`, {
        headers: this.#headers,
        signal: AbortSignal.timeout(3000),
      })
      return res2.ok
    } catch {
      return false
    }
  }

  /**
   * 通用请求: 超时 + 分类重试
   * 可重试: 网络错误 / 超时 / 408 / 429 / 5xx
   * 不可重试: 400 / 401 / 403 / 404
   */
  async #request(method, path, body = undefined, opts = {}) {
    const { timeoutMs = 30_000, retries = 2 } = opts
    const url = `${this.#baseUrl}${path}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const fetchOpts = {
          method,
          headers: this.#headers,
          signal: AbortSignal.timeout(timeoutMs),
        }
        if (body !== undefined) fetchOpts.body = JSON.stringify(body)

        const res = await fetch(url, fetchOpts)

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
          err.status = res.status
          err.method = method
          err.path = path

          if (!RETRYABLE_STATUS.has(res.status)) throw err

          if (attempt < retries) {
            log.warn(`可恢复错误 (${attempt + 1}/${retries + 1}): ${method} ${path} → ${res.status}`)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }

        // 204 No Content 或空 body (prompt_async 就是这样返回的)
        const contentLength = res.headers.get('content-length')
        if (res.status === 204 || contentLength === '0') {
          return { ok: true }
        }

        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const text = await res.text()
          return text ? JSON.parse(text) : { ok: true }
        }
        return await res.text()

      } catch (err) {
        if (!err.status && attempt < retries && err.name !== 'AbortError') {
          log.warn(`网络错误 (${attempt + 1}/${retries + 1}): ${method} ${path} - ${err.message}`)
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw err
      }
    }
  }

  /**
   * 从 opencode.json 或环境变量解析模型 ID
   * 优先级: OPENCODE_MODEL env > opencode.json model 字段
   * @returns {string|undefined} provider/model 格式的模型 ID
   */
  #resolveModel() {
    // 环境变量优先 (方便在 .env 中覆盖)
    if (process.env.OPENCODE_MODEL) return process.env.OPENCODE_MODEL

    // 读 workspace 下的 opencode.json
    try {
      const configPath = join(this.#config.engine.workspace, 'opencode.json')
      const raw = readFileSync(configPath, 'utf-8')
      const cfg = JSON.parse(raw)
      if (cfg.model) return cfg.model
    } catch {
      // opencode.json 不存在或解析失败，降级
    }
    return undefined
  }
}

/** 从 assistant 消息中提取纯文本 */
export function extractText(message) {
  return (message.parts || [])
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('')
}
