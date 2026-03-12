import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../logger.mjs'

const log = createLogger('web')
const __dirname = dirname(fileURLToPath(import.meta.url))

// --- WebServer ---

export class WebServer {
  #server
  #config
  #modules
  #startTime
  #running = false

  /**
   * @param {object} config
   * @param {object} modules - { identity, memory, engine, orchestrator }
   */
  constructor(config, modules) {
    this.#config = config
    this.#modules = modules
    this.#startTime = Date.now()
  }

  // --- Lifecycle ---

  async start() {
    const { host, port } = this.#config.web
    this.#server = createServer((req, res) => this.#handleRequest(req, res))

    return new Promise((resolve, reject) => {
      this.#server.on('error', reject)
      this.#server.listen(port, host, () => {
        this.#running = true
        log.info(`Web 驾驶舱已启动: http://${host}:${port}`)
        resolve()
      })
    })
  }

  async stop() {
    if (!this.#server) return
    return new Promise((resolve) => {
      this.#server.close(() => {
        this.#running = false
        log.info('Web 驾驶舱已停止')
        resolve()
      })
    })
  }

  async health() {
    return {
      ok: this.#running,
      detail: {
        port: this.#config.web.port,
        uptime: Math.floor((Date.now() - this.#startTime) / 1000),
      },
    }
  }

  // --- Request Router ---

  async #handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const path = url.pathname
    const method = req.method

    // CORS headers (local dev)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      // --- API Routes ---
      if (path === '/api/health' && method === 'GET') {
        return this.#handleHealth(req, res)
      }
      if (path === '/api/status' && method === 'GET') {
        return this.#handleStatus(req, res)
      }
      if (path === '/api/identity' && method === 'GET') {
        return this.#handleGetIdentity(req, res)
      }
      if (path === '/api/identity' && method === 'PUT') {
        return this.#handleUpdateIdentity(req, res)
      }
      if (path === '/api/memory/semantic' && method === 'GET') {
        return this.#handleSemanticMemory(req, res, url)
      }
      if (path === '/api/memory/episodic' && method === 'GET') {
        return this.#handleEpisodicMemory(req, res, url)
      }
      if (path === '/api/chat' && method === 'POST') {
        return this.#handleChat(req, res)
      }
      if (path === '/api/chat/history' && method === 'GET') {
        return this.#handleChatHistory(req, res, url)
      }
      if (path === '/api/system/restart-brain' && method === 'POST') {
        return this.#handleRestartBrain(req, res)
      }
      if (path === '/api/system/test' && method === 'POST') {
        return this.#handleTestConnection(req, res)
      }
      if (path === '/api/system/logs' && method === 'GET') {
        return this.#handleSystemLogs(req, res, url)
      }

      // --- Static: SPA ---
      if (path === '/' || path === '/index.html') {
        return this.#serveSPA(req, res)
      }

      // --- 404 ---
      this.#json(res, 404, { ok: false, error: 'Not Found' })
    } catch (err) {
      log.error(`[web] ✖ ${method} ${path}: ${err.message}`)
      this.#json(res, 500, { ok: false, error: err.message })
    }
  }

  // --- API Handlers ---

  async #handleHealth(_req, res) {
    const { identity, memory, engine, cerebellum } = this.#modules
    const [ih, mh, eh] = await Promise.all([
      identity.health(),
      memory.health(),
      engine.health(),
    ])
    const data = { identity: ih, memory: mh, engine: eh, web: await this.health() }
    let allOk = ih.ok && mh.ok && eh.ok

    // 如果注入了 cerebellum，聚合其诊断数据
    if (cerebellum) {
      const ch = await cerebellum.health()
      data.cerebellum = ch
      // cerebellum 不健康不影响整体 ok (它是独立守护)
    }

    this.#json(res, 200, { ok: allOk, data })
  }

  async #handleStatus(_req, res) {
    const { memory } = this.#modules
    const stats = memory.getEpisodicStats?.() ?? {}
    this.#json(res, 200, {
      ok: true,
      data: {
        uptime: Math.floor((Date.now() - this.#startTime) / 1000),
        memory: stats,
      },
    })
  }

  async #handleGetIdentity(_req, res) {
    const { identity } = this.#modules
    this.#json(res, 200, { ok: true, data: identity.data })
  }

  async #handleUpdateIdentity(req, res) {
    const body = await readBody(req)
    const patch = JSON.parse(body)
    const { identity } = this.#modules
    await identity.update(patch)
    this.#json(res, 200, { ok: true, data: identity.data })
  }

  async #handleSemanticMemory(_req, res, url) {
    const q = url.searchParams.get('q')
    const { memory } = this.#modules
    const results = q
      ? memory.searchMemories(q)
      : memory.listMemories()
    this.#json(res, 200, { ok: true, data: results })
  }

  async #handleEpisodicMemory(_req, res, url) {
    const days = parseInt(url.searchParams.get('days') || '7', 10)
    const q = url.searchParams.get('q')
    const { memory } = this.#modules
    const results = q
      ? memory.searchEpisodes(q)
      : memory.getRecentEpisodes(days)
    this.#json(res, 200, { ok: true, data: results })
  }

  async #handleChat(req, res) {
    const body = await readBody(req)
    const { text } = JSON.parse(body)
    if (!text?.trim()) {
      return this.#json(res, 400, { ok: false, error: '消息不能为空' })
    }
    const { orchestrator } = this.#modules
    const result = await orchestrator.handleMessage(text, { source: 'web' })
    this.#json(res, 200, { ok: true, data: result })
  }

  async #handleRestartBrain(_req, res) {
    const { engine } = this.#modules
    log.warn('[web] 用户请求重启大脑')
    try {
      await engine.stop()
      await engine.start()
      this.#json(res, 200, { ok: true, data: { message: '大脑已重启' } })
    } catch (err) {
      this.#json(res, 500, { ok: false, error: `重启失败: ${err.message}` })
    }
  }

  async #handleTestConnection(_req, res) {
    const { engine } = this.#modules
    try {
      const health = await engine.health()
      this.#json(res, 200, { ok: true, data: health })
    } catch (err) {
      this.#json(res, 500, { ok: false, error: `连接测试失败: ${err.message}` })
    }
  }

  async #handleChatHistory(_req, res, url) {
    const n = parseInt(url.searchParams.get('n') || '20', 10)
    const { memory } = this.#modules
    const episodes = memory.getRecentEpisodes?.(7) ?? []
    // 只返回最近 n 条
    this.#json(res, 200, { ok: true, data: episodes.slice(0, n) })
  }

  async #handleSystemLogs(_req, res, url) {
    const lines = parseInt(url.searchParams.get('lines') || '50', 10)
    // 日志目前无持久化，返回 Web 模块自身状态作为占位
    const { identity, memory, engine } = this.#modules
    const logEntries = []
    try {
      logEntries.push(`[web] uptime: ${Math.floor((Date.now() - this.#startTime) / 1000)}s`)
      const eh = await engine.health()
      logEntries.push(`[engine] ok: ${eh.ok}, detail: ${JSON.stringify(eh.detail)}`)
      const mh = await memory.health()
      logEntries.push(`[memory] ok: ${mh.ok}, detail: ${JSON.stringify(mh.detail)}`)
      const ih = await identity.health()
      logEntries.push(`[identity] ok: ${ih.ok}, detail: ${JSON.stringify(ih.detail)}`)
    } catch (e) {
      logEntries.push(`[error] ${e.message}`)
    }
    this.#json(res, 200, { ok: true, data: logEntries.slice(0, lines) })
  }

  // --- Static File ---

  async #serveSPA(_req, res) {
    try {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('index.html not found')
    }
  }

  // --- Helpers ---

  #json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  }
}

// --- Utilities ---

/** Read request body as string */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}
