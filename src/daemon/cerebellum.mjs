/**
 * T08-1 小脑 (Cerebellum)
 *
 * 独立守护进程，职责：心跳监控 + 进程管理 + 会话 GC + 诊断可观测性。
 * 不导入 Engine 类，用轻量 fetch 避免循环依赖。
 *
 * 实现口径: context.md + 评审结论
 *   - 健康探针优先 /global/health，降级 /provider (BUG-004)
 *   - health() 返回丰富诊断信息 (一等产物)
 *   - 仅 T08-1 守护，不含 T08-2 自我成长
 */
import { spawn } from 'node:child_process'
import { createLogger } from '../logger.mjs'

const log = createLogger('cerebellum')

// --- Constants ---

/** 心跳历史记录最大条数 */
const MAX_HEARTBEAT_HISTORY = 10

/** 会话最大存活时间 (ms) — 超过则清理 */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** 会话 GC 执行间隔 (ms) — 每小时 */
const SESSION_GC_INTERVAL_MS = 3600_000

/** spawn 等待大脑就绪的最大时间 (ms) */
const SPAWN_TIMEOUT_MS = 15_000

/** spawn 等待轮询间隔 (ms) */
const SPAWN_POLL_MS = 500

/** 重启前等待旧进程清理 (ms) */
const RESTART_CLEANUP_MS = 2000

/** 健康检查 / API 请求超时 (ms) */
const FETCH_TIMEOUT_MS = 3000

/** 会话 API 请求超时 (ms) */
const SESSION_FETCH_TIMEOUT_MS = 5000

// --- Cerebellum Class ---

export class Cerebellum {
  #config
  #cortexProcess = null
  #heartbeatTimer = null
  #sessionGCTimer = null
  #consecutiveFailures = 0
  #running = false

  // --- 诊断可观测性 (一等产物) ---
  #lastRestartTime = null
  #lastFailureReason = null
  #heartbeatHistory = []     // 最近 MAX_HEARTBEAT_HISTORY 次心跳 {ok, time}
  #lastGCResult = null       // 最近一次 session GC 结果

  constructor(config) {
    this.#config = config
  }

  // --- 生命周期 (T01 接口: start/stop/health) ---

  async start() {
    log.info('🧠 小脑启动中...')

    try {
      // 1. 尝试连接已有的大脑
      if (await this.#cortexHealthCheck()) {
        log.info('检测到已运行的大脑 (opencode serve)，进入监控模式')
      } else {
        // 2. 没有运行中的大脑 → 拉起一个
        await this.#spawnCortex()
      }

      // 3. 启动心跳监控
      this.#startHeartbeat()

      // 4. 启动会话清理
      this.#startSessionGC()

      // 全部成功后才标记为运行中
      this.#running = true
      log.info('🧠 小脑已就绪，守护大脑中')
    } catch (err) {
      // 启动失败 → 确保状态回滚
      this.#running = false
      this.#lastFailureReason = `start failed: ${err.message}`
      if (this.#heartbeatTimer) { clearInterval(this.#heartbeatTimer); this.#heartbeatTimer = null }
      if (this.#sessionGCTimer) { clearInterval(this.#sessionGCTimer); this.#sessionGCTimer = null }
      // 杀掉残留的大脑进程，防止 node 进程无法退出
      if (this.#cortexProcess) {
        this.#cortexProcess.kill('SIGTERM')
        this.#cortexProcess = null
      }
      log.error(`小脑启动失败: ${err.message}`)
      throw err
    }
  }

  async stop() {
    log.info('小脑关闭中...')
    this.#running = false

    // 停止定时器
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer)
      this.#heartbeatTimer = null
    }
    if (this.#sessionGCTimer) {
      clearInterval(this.#sessionGCTimer)
      this.#sessionGCTimer = null
    }

    // 优雅关闭大脑 (只关闭我们自己启动的)
    if (this.#cortexProcess) {
      log.info('终止大脑进程...')
      this.#cortexProcess.kill('SIGTERM')
      this.#cortexProcess = null
    }

    log.info('小脑已关闭')
  }

  async health() {
    const cortexOk = await this.#cortexHealthCheck()
    return {
      ok: this.#running,
      detail: {
        cerebellum: this.#running ? 'running' : 'stopped',
        cortex: cortexOk ? 'healthy' : 'unreachable',
        consecutiveFailures: this.#consecutiveFailures,
        ownsCortex: this.#cortexProcess !== null,
        lastRestartTime: this.#lastRestartTime,
        lastFailureReason: this.#lastFailureReason,
        heartbeatHistory: [...this.#heartbeatHistory],
        lastGCResult: this.#lastGCResult,
      },
    }
  }

  // --- 心跳监控 ---

  #startHeartbeat() {
    const intervalMs = this.#config.daemon.heartbeatIntervalMs
    const maxFailures = this.#config.daemon.maxFailures

    this.#heartbeatTimer = setInterval(async () => {
      if (!this.#running) return

      const ok = await this.#cortexHealthCheck()

      // 记录心跳历史
      this.#heartbeatHistory.push({ ok, time: new Date().toISOString() })
      if (this.#heartbeatHistory.length > MAX_HEARTBEAT_HISTORY) {
        this.#heartbeatHistory.shift()
      }

      if (ok) {
        if (this.#consecutiveFailures > 0) {
          log.info(`大脑恢复健康 (之前连续失败 ${this.#consecutiveFailures} 次)`)
        }
        this.#consecutiveFailures = 0
        return
      }

      this.#consecutiveFailures++
      this.#lastFailureReason = `heartbeat failed (${this.#consecutiveFailures}/${maxFailures})`
      log.warn(`大脑健康检查失败 (${this.#consecutiveFailures}/${maxFailures})`)

      if (this.#consecutiveFailures >= maxFailures) {
        log.error(`大脑连续 ${maxFailures} 次无响应，执行重启`)
        this.#consecutiveFailures = 0
        await this.#restartCortex()
      }
    }, intervalMs)
  }

  // --- 进程管理 ---

  async #spawnCortex() {
    const port = this.#config.engine.port
    const workspace = this.#config.engine.workspace

    log.info(`拉起大脑: opencode serve --port ${port}`)

    this.#cortexProcess = spawn('opencode', ['serve', '--port', String(port)], {
      cwd: workspace,
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: false,  // 小脑死了大脑也停 (双保险)
    })

    // 收集 stderr 用于诊断
    let stderrBuffer = ''
    this.#cortexProcess.stderr.on('data', chunk => {
      if (stderrBuffer.length < 2048) stderrBuffer += chunk.toString()
    })

    this.#cortexProcess.on('exit', (code, signal) => {
      log.warn(`大脑进程退出: code=${code} signal=${signal}`)
      this.#cortexProcess = null
      // 不在这里重启，等心跳检测触发
    })

    this.#cortexProcess.on('error', err => {
      log.error(`大脑进程错误: ${err.message}`)
      this.#lastFailureReason = `spawn error: ${err.message}`
    })

    // 等待大脑就绪
    const spawnTimeoutMs = this.#config.daemon.spawnTimeoutMs ?? SPAWN_TIMEOUT_MS
    const maxAttempts = Math.ceil(spawnTimeoutMs / SPAWN_POLL_MS)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, SPAWN_POLL_MS))
      if (await this.#cortexHealthCheck()) {
        log.info('大脑已就绪')
        return
      }
    }

    this.#lastFailureReason = `spawn timeout (${spawnTimeoutMs}ms)`
    throw new Error(
      `大脑启动超时 (${spawnTimeoutMs / 1000}s)\nstderr: ${stderrBuffer.slice(0, 500)}`,
    )
  }

  async #restartCortex() {
    // 1. 杀掉旧进程
    if (this.#cortexProcess) {
      this.#cortexProcess.kill('SIGTERM')
      this.#cortexProcess = null
      await new Promise(r => setTimeout(r, RESTART_CLEANUP_MS))
    }

    // 2. 拉起新进程
    try {
      await this.#spawnCortex()
      this.#lastRestartTime = new Date().toISOString()
      log.info('✅ 大脑重启成功')
    } catch (err) {
      this.#lastFailureReason = `restart failed: ${err.message}`
      log.error(`大脑重启失败: ${err.message}`)
      // 下次心跳会继续尝试
    }
  }

  // --- 会话清理 ---

  #startSessionGC() {
    const gcIntervalMs = this.#config.daemon.sessionGCIntervalMs ?? SESSION_GC_INTERVAL_MS
    this.#sessionGCTimer = setInterval(() => {
      this.runSessionGC()
    }, gcIntervalMs)
  }

  /**
   * 公开方法: 执行一次会话清理。
   * 设为公开以支持测试直接调用 (不依赖定时器)。
   */
  async runSessionGC() {
    try {
      await this.#cleanupSessions()
    } catch (err) {
      log.warn(`会话清理失败: ${err.message}`)
      this.#lastGCResult = { ok: false, error: err.message, time: new Date().toISOString() }
    }
  }

  /**
   * 清理超过 24h 的僵尸 session。
   * 注意: 用 GET /session 获取全量列表，不用 /session/status (BUG-011: 它不含 idle session)
   */
  async #cleanupSessions() {
    const baseUrl = `${this.#config.engine.host}:${this.#config.engine.port}`
    const headers = {
      'Content-Type': 'application/json',
      'x-opencode-directory': this.#config.engine.workspace,
    }

    const res = await fetch(`${baseUrl}/session`, {
      headers,
      signal: AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      this.#lastGCResult = { ok: false, error: `GET /session ${res.status}`, time: new Date().toISOString() }
      return
    }

    const sessions = await res.json()
    const now = Date.now()
    let cleaned = 0

    for (const session of sessions) {
      const updatedAt = new Date(session.updatedAt || session.createdAt).getTime()
      if (now - updatedAt > SESSION_MAX_AGE_MS) {
        try {
          const delRes = await fetch(`${baseUrl}/session/${session.id}`, {
            method: 'DELETE',
            headers,
            signal: AbortSignal.timeout(SESSION_FETCH_TIMEOUT_MS),
          })
          if (delRes.ok) {
            cleaned++
          } else {
            log.debug(`session ${session.id} 删除返回 ${delRes.status}`)
          }
        } catch {
          // 单个 session 删除失败不影响其他
        }
      }
    }

    this.#lastGCResult = { ok: true, cleaned, total: sessions.length, time: new Date().toISOString() }

    if (cleaned > 0) {
      log.info(`清理了 ${cleaned} 个僵尸 session (共 ${sessions.length} 个)`)
    }
  }

  // --- 内部工具 ---

  /**
   * 大脑健康检查 — 双端点策略 (BUG-004)
   * 优先 /global/health (无需 workspace header)
   * 降级 /provider (需 workspace header)
   */
  async #cortexHealthCheck() {
    try {
      const baseUrl = `${this.#config.engine.host}:${this.#config.engine.port}`

      // 优先: /global/health
      const res = await fetch(`${baseUrl}/global/health`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (res.ok) return true

      // 降级: /provider
      const res2 = await fetch(`${baseUrl}/provider`, {
        headers: { 'x-opencode-directory': this.#config.engine.workspace },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      return res2.ok
    } catch {
      return false
    }
  }
}

// --- Standalone Entry Point ---

// 当直接 `node daemon/cerebellum.mjs` 运行时启动小脑
const isMain = process.argv[1]?.endsWith('cerebellum.mjs')

if (isMain) {
  const { config } = await import('../config.mjs')

  log.info('═══════════════════════════════════════')
  log.info('🧠 小脑 (Cerebellum) 独立启动')
  log.info(`   大脑地址: ${config.engine.host}:${config.engine.port}`)
  log.info(`   心跳间隔: ${config.daemon.heartbeatIntervalMs}ms`)
  log.info(`   最大失败: ${config.daemon.maxFailures} 次`)
  log.info('═══════════════════════════════════════')

  const cerebellum = new Cerebellum(config)

  try {
    await cerebellum.start()
    log.info('小脑已就绪，按 Ctrl+C 停止')

    // 优雅关闭
    const shutdown = async (signal) => {
      log.info(`收到 ${signal}，正在关闭小脑...`)
      await cerebellum.stop()
      process.exit(0)
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    log.error(`小脑启动失败: ${err.message}`)
    process.exit(1)
  }
}
