/**
 * T30: Pulse — 主动性调度引擎
 *
 * 注册触发器，按固定间隔执行回调。
 * 不做频率控制/静音/DND（T32 Anti-Spam 负责）。
 * 不做 cron 表达式（Phase 3C）。
 *
 * 依赖注入:
 *   onTrigger(trigger, state) — 外部回调，由 T31 注册具体动作
 */
import { createLogger } from '../logger.mjs'
import { PulseState } from './pulse-state.mjs'

const log = createLogger('pulse')

/** 调度检查间隔 (ms) */
const CHECK_INTERVAL_MS = 60_000

/** 最大触发器数量 */
const MAX_TRIGGERS = 16

export class Pulse {
  #config
  #state
  #triggers = new Map()
  #checkTimer = null
  #running = false
  #onTrigger

  /**
   * @param {object} options
   * @param {object} options.config - pulse 配置 (enabled, stateDir)
   * @param {string} options.stateDir - PulseState 文件目录
   * @param {Function} options.onTrigger - (trigger, state) => void 触发回调
   */
  constructor({ config, stateDir, onTrigger }) {
    this.#config = config || {}
    this.#state = new PulseState(stateDir)
    this.#onTrigger = onTrigger || (() => {})
  }

  /** 启动调度循环 */
  async start() {
    if (!this.#config.enabled) {
      log.info('Pulse 已禁用 (config.pulse.enabled=false)')
      return
    }

    this.#state.load()
    this.#running = true

    // 启动调度检查循环
    this.#checkTimer = setInterval(() => {
      if (!this.#running) return
      this.#checkTriggers()
    }, CHECK_INTERVAL_MS)
    // unref so tests don't hang
    this.#checkTimer.unref()

    log.info(`Pulse 启动, ${this.#triggers.size} 个触发器`)
  }

  /** 停止所有定时器 + 保存状态 */
  async stop() {
    this.#running = false
    if (this.#checkTimer) {
      clearInterval(this.#checkTimer)
      this.#checkTimer = null
    }
    if (this.#state.snapshot()) {
      this.#state.save()
    }
    log.info('Pulse 停止')
  }

  /** 健康状态 */
  async health() {
    const triggers = []
    for (const [id, t] of this.#triggers) {
      const lastExec = this.#state.get('triggerHistory')?.[id] || null
      const nextExec = lastExec
        ? new Date(new Date(lastExec).getTime() + t.interval).toISOString()
        : 'pending'
      triggers.push({ id, interval: t.interval, action: t.action, lastExec, nextExec })
    }

    return {
      ok: this.#running,
      detail: {
        enabled: this.#config.enabled ?? false,
        running: this.#running,
        triggerCount: this.#triggers.size,
        triggers,
        state: this.#state.snapshot(),
      },
    }
  }

  /** 注册触发器 */
  register(trigger) {
    if (!trigger?.id || !trigger?.interval) {
      throw new Error('触发器必须包含 id 和 interval')
    }
    if (this.#triggers.size >= MAX_TRIGGERS) {
      throw new Error(`触发器数量已达上限 (${MAX_TRIGGERS})`)
    }
    this.#triggers.set(trigger.id, trigger)
    log.info(`注册触发器: ${trigger.id}, 间隔: ${trigger.interval}ms`)
  }

  /** 取消触发器 */
  unregister(triggerId) {
    this.#triggers.delete(triggerId)
    log.info(`取消触发器: ${triggerId}`)
  }

  /** PulseState 只读副本 */
  get state() {
    return this.#state.snapshot()
  }

  /** 直接访问 PulseState (供 T31/T32 使用) */
  get pulseState() {
    return this.#state
  }

  /** manually trigger check (for testing; no-op if not running) */
  tick() {
    if (!this.#running) return
    this.#checkTriggers()
  }

  // --- 内部方法 ---

  /** 检查所有触发器是否该触发 */
  #checkTriggers() {
    const now = Date.now()

    for (const [id, trigger] of this.#triggers) {
      if (this.#shouldFire(id, trigger, now)) {
        log.info(`触发: ${id}`)
        this.#state.recordTrigger(id)
        try {
          this.#onTrigger(trigger, this.#state)
        } catch (e) {
          log.error(`触发器 ${id} 回调失败: ${e.message}`)
        }
      }
    }
  }

  /** 判断触发器是否该触发 */
  #shouldFire(id, trigger, now) {
    const history = this.#state.get('triggerHistory') || {}
    const lastExec = history[id]

    if (!lastExec) return true // 从未执行过

    const elapsed = now - new Date(lastExec).getTime()
    return elapsed >= trigger.interval
  }
}
