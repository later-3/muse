import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../logger.mjs'
import { selfCheck } from '../daemon/self-check.mjs'

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
      // T34: Health Insight
      if (path === '/api/health/insight' && method === 'GET') {
        return this.#handleHealthInsight(req, res)
      }
      // T35: Goals (read-only display)
      if (path === '/api/goals' && method === 'GET') {
        return this.#handleGoals(req, res, url)
      }
      // T36: Threads (read-only display)
      if (path === '/api/threads' && method === 'GET') {
        return this.#handleThreads(req, res, url)
      }
      // T37: Dev Tasks (read-only display)
      if (path === '/api/dev-tasks' && method === 'GET') {
        return this.#handleDevTasks(req, res, url)
      }
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
      if (path === '/api/capabilities' && method === 'GET') {
        return this.#handleCapabilities(req, res)
      }
      if (path === '/api/gaps' && method === 'GET') {
        return this.#handleGaps(req, res, url)
      }
      if (path === '/api/executions' && method === 'GET') {
        return this.#handleExecutions(req, res, url)
      }
      if (path === '/api/selfcheck' && method === 'GET') {
        return this.#handleSelfCheck(req, res)
      }
      // T22: Boundaries API
      if (path === '/api/boundaries' && method === 'GET') {
        return this.#handleGetBoundaries(req, res)
      }
      if (path === '/api/boundaries' && method === 'PUT') {
        return this.#handleUpdateBoundaries(req, res)
      }
      // T23: Timeline API
      if (path === '/api/timeline' && method === 'GET') {
        return this.#handleTimeline(req, res, url)
      }
      // T32: Pulse Anti-Spam API
      if (path === '/api/pulse/status' && method === 'GET') {
        return this.#handlePulseStatus(req, res)
      }
      if (path === '/api/pulse/config' && method === 'PUT') {
        return this.#handlePulseConfig(req, res)
      }

      // --- Static: SPA ---
      if (path === '/' || path === '/index.html') {
        return this.#serveStatic(res, 'index.html')
      }

      // --- Static: CSS/JS ---
      if (path.match(/^\/(style\.css|app\.js)$/)) {
        return this.#serveStatic(res, path.slice(1))
      }

      // --- 404 ---
      this.#json(res, 404, { ok: false, error: 'Not Found' })
    } catch (err) {
      log.error(`[web] ✖ ${method} ${path}: ${err.message}`)
      this.#json(res, 500, { ok: false, error: err.message })
    }
  }

  // --- API Handlers ---

  // T34: Health Insight
  // T35: Goals (read-only display)
  // T36: Threads (read-only display)
  #handleThreads(_req, res, url) {
    const { threads } = this.#modules
    if (!threads) {
      return this.#json(res, 503, { ok: false, error: 'threads not available' })
    }
    const category = url.searchParams.get('category')
    const list = threads.list({
      category: category || undefined,
    })
    this.#json(res, 200, {
      ok: true,
      data: { threads: list, count: list.length },
    })
  }

  // T37: Dev Tasks (read-only display)
  #handleDevTasks(_req, res, url) {
    const { devStore } = this.#modules
    if (!devStore) {
      return this.#json(res, 503, { ok: false, error: 'dev module not available' })
    }
    const status = url.searchParams.get('status')
    const list = devStore.list({ status: status || undefined })
    this.#json(res, 200, {
      ok: true,
      data: { tasks: list, count: list.length },
    })
  }

  #handleGoals(_req, res, url) {
    const { goals } = this.#modules
    if (!goals) {
      return this.#json(res, 503, { ok: false, error: 'goals not available' })
    }
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const list = goals.list({
      status: status || undefined,
      category: category || undefined,
    })
    const active = goals.getActive()
    const overdue = goals.getOverdue()
    this.#json(res, 200, {
      ok: true,
      data: {
        goals: list,
        counts: { total: list.length, active: active.length, overdue: overdue.length },
      },
    })
  }

  async #handleHealthInsight(_req, res) {
    const { healthInsight } = this.#modules
    if (!healthInsight) {
      return this.#json(res, 503, { ok: false, error: 'healthInsight not available' })
    }
    const latest = healthInsight.getLatest()
    this.#json(res, 200, { ok: true, data: { latest } })
  }

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
    // T22: Strip boundaries from identity updates — use PUT /api/boundaries instead
    delete patch.boundaries
    const { identity } = this.#modules
    await identity.update(patch)

    // T12 P1: Web 改身份 → 重新生成 AGENTS.md 人格区块
    try {
      const projectRoot = this.#config.engine?.workspace || process.cwd()
      await identity.mergePersonaToAgentsMd(projectRoot)
      log.info('[identity] AGENTS.md 人格区块已同步更新')
    } catch (e) {
      // 降级: identity.json 已更新，AGENTS.md 合并失败不阻塞响应
      log.warn(`[identity] AGENTS.md 合并失败 (已降级): ${e.message}`)
    }

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

  async #handleCapabilities(_req, res) {
    const { registry } = this.#modules
    if (!registry) {
      return this.#json(res, 503, { ok: false, error: 'Registry not available' })
    }
    this.#json(res, 200, { ok: true, data: registry.list() })
  }

  async #handleGaps(_req, res, url) {
    const { gapJournal } = this.#modules
    if (!gapJournal) {
      return this.#json(res, 503, { ok: false, error: 'GapJournal not available' })
    }
    const type = url.searchParams.get('type')
    const source = url.searchParams.get('source')
    const data = {
      entries: gapJournal.list({ type, source }),
      stats: gapJournal.stats(),
    }
    this.#json(res, 200, { ok: true, data })
  }

  async #handleExecutions(_req, res, url) {
    const { executionLog } = this.#modules
    if (!executionLog) {
      return this.#json(res, 503, { ok: false, error: 'ExecutionLog not available' })
    }
    const route = url.searchParams.get('route')
    const data = {
      entries: executionLog.list({ route }),
      stats: executionLog.stats(),
    }
    this.#json(res, 200, { ok: true, data })
  }

  // --- Phase 2.5: Self Check ---

  async #handleSelfCheck(_req, res) {
    try {
      const report = await selfCheck(this.#modules)
      this.#json(res, 200, { ok: true, data: report })
    } catch (err) {
      this.#json(res, 500, { ok: false, error: `自检失败: ${err.message}` })
    }
  }

  // --- T22: Boundaries ---

  async #handleGetBoundaries(_req, res) {
    const { identity } = this.#modules
    if (!identity) {
      return this.#json(res, 503, { ok: false, error: 'Identity not available' })
    }
    const boundaries = identity.getBoundaries()
    this.#json(res, 200, { ok: true, data: boundaries })
  }

  async #handleUpdateBoundaries(req, res) {
    const { identity } = this.#modules
    if (!identity) {
      return this.#json(res, 503, { ok: false, error: 'Identity not available' })
    }
    try {
      const body = JSON.parse(await readBody(req))
      if (!body.never_do && !body.always_do) {
        return this.#json(res, 400, { ok: false, error: 'Request must contain never_do or always_do' })
      }
      identity.saveBoundaries(body)
      this.#json(res, 200, { ok: true, message: 'boundaries.json updated' })
    } catch (err) {
      this.#json(res, 400, { ok: false, error: err.message })
    }
  }

  // --- T23: Timeline ---

  async #handleTimeline(_req, res, url) {
    const { executionLog } = this.#modules
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)

    const items = []

    // Source 1: ExecutionLog entries
    if (executionLog) {
      const entries = executionLog.list()
      for (const e of entries) {
        const routeStr = e.routes?.length > 0 ? e.routes.join('+') : 'unknown'
        items.push({
          time: e.timestamp,
          type: 'chat',
          summary: `${e.success ? '💬' : '❌'} 对话 (${routeStr})`,
          routes: e.routes || [],
          tools: e.tools || [],
          success: e.success,
        })
      }
    }

    // Source 2: Latest selfCheck
    try {
      const report = await selfCheck(this.#modules)
      if (report) {
        const allOk = report.system && Object.values(report.system).every(v => v?.status === '🟢')
        items.push({
          time: report.timestamp || new Date().toISOString(),
          type: 'health',
          summary: allOk ? '🟢 自检通过' : '🟡 自检有异常',
          status: allOk ? 'ok' : 'warning',
        })
      }
    } catch {
      // selfCheck failed, skip
    }

    // Sort by time DESC, limit
    items.sort((a, b) => new Date(b.time) - new Date(a.time))
    const limited = items.slice(0, limit)

    const stats = {
      totalChats: items.filter(i => i.type === 'chat').length,
      totalChecks: items.filter(i => i.type === 'health').length,
      successRate: (() => {
        const chats = items.filter(i => i.type === 'chat')
        if (chats.length === 0) return 100
        return Math.round(chats.filter(c => c.success).length / chats.length * 100)
      })(),
    }

    this.#json(res, 200, { ok: true, data: { items: limited, stats } })
  }

  // --- Static File ---

  static #mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' }

  async #serveStatic(res, filename) {
    try {
      const content = await readFile(join(__dirname, filename), 'utf-8')
      const ext = '.' + filename.split('.').pop()
      const mime = WebServer.#mimeTypes[ext] || 'text/plain'
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` })
      res.end(content)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`${filename} not found`)
    }
  }

  // --- T32: Pulse Anti-Spam API ---

  #handlePulseStatus(req, res) {
    const pulse = this.#modules.pulse
    if (!pulse) {
      return this.#json(res, 200, { ok: false, error: 'Pulse not available' })
    }

    const state = pulse.state || {}
    const health = pulse.health()
    this.#json(res, 200, {
      ok: true,
      data: {
        running: health.detail?.running ?? false,
        triggerCount: health.detail?.triggerCount ?? 0,
        dnd: state.dnd ?? false,
        frequency: state.frequency ?? 'normal',
        unresponsedCount: state.unresponsedCount ?? 0,
        lastProactiveAt: state.lastProactiveAt ?? null,
        knownChatIds: state.knownChatIds?.length ?? 0,
      },
    })
  }

  async #handlePulseConfig(req, res) {
    const pulse = this.#modules.pulse
    if (!pulse) {
      return this.#json(res, 200, { ok: false, error: 'Pulse not available' })
    }

    try {
      const body = JSON.parse(await readBody(req))

      // Only allow updating PulseState fields: dnd, frequency
      const state = pulse.pulseState
      if (body.dnd !== undefined) {
        state.set('dnd', !!body.dnd)
      }
      if (body.frequency && ['normal', 'reduced', 'minimal'].includes(body.frequency)) {
        state.set('frequency', body.frequency)
      }

      this.#json(res, 200, { ok: true, data: pulse.state })
    } catch (e) {
      log.warn(`[web] PUT /api/pulse/config 失败: ${e.message}`)
      this.#json(res, 400, { ok: false, error: e.message })
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
