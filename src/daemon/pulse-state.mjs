/**
 * T30: PulseState — Pulse state persistence
 *
 * Stores Pulse runtime state to pulse/state.json under FAMILY_HOME member dir.
 * Includes chatId, unresponsed count, trigger history, etc.
 *
 * Safety: missing file -> create default, corrupted -> warn + fallback, atomic write
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('pulse-state')

const DEFAULT_STATE = {
  knownChatIds: [],
  lastProactiveAt: null,
  unresponsedCount: 0,
  lastUserReplyAt: null,
  dnd: false,
  frequency: 'normal',
  triggerHistory: {},
}

export class PulseState {
  #dir
  #path
  #data

  /**
   * @param {string} stateDir - pulse/ 目录路径
   */
  constructor(stateDir) {
    this.#dir = stateDir
    this.#path = join(stateDir, 'state.json')
    this.#data = { ...DEFAULT_STATE, triggerHistory: {} }  // 默认值防空指针 (Pulse 禁用时 load() 不会被调用)
  }

  /** 从磁盘加载状态，损坏时回退默认 */
  load() {
    if (!existsSync(this.#dir)) {
      mkdirSync(this.#dir, { recursive: true })
    }

    if (!existsSync(this.#path)) {
      log.info('state.json 不存在，创建默认状态')
      this.#data = { ...DEFAULT_STATE, triggerHistory: {} }
      this.save()
      return this.#data
    }

    try {
      this.#data = JSON.parse(readFileSync(this.#path, 'utf-8'))
      log.info('状态已加载')
    } catch (e) {
      log.warn(`state.json 损坏, 回退默认值: ${e.message}`)
      this.#data = { ...DEFAULT_STATE, triggerHistory: {} }
      this.save()
    }

    return this.#data
  }

  /** 原子写入状态到磁盘 */
  save() {
    mkdirSync(this.#dir, { recursive: true })  // Pulse 禁用时 load() 未调用, 目录可能不存在
    const tmpPath = this.#path + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(this.#data, null, 2) + '\n', 'utf-8')
    renameSync(tmpPath, this.#path)
  }

  /** 获取字段值 */
  get(key) {
    return this.#data?.[key]
  }

  /** 合并更新 + 立即保存 */
  update(patch) {
    Object.assign(this.#data, patch)
    this.save()
  }

  /** 添加 chatId (去重) */
  addChatId(id) {
    if (!this.#data.knownChatIds.includes(id)) {
      this.#data.knownChatIds.push(id)
      this.save()
      log.info(`chatId 已采集: ${id}`)
    }
  }

  /** 主动消息未被回复 → 计数 +1 */
  incrementUnresponsed() {
    this.#data.unresponsedCount++
    this.#data.lastProactiveAt = new Date().toISOString()
    this.save()
  }

  /** 用户回复了 → 计数归零 */
  resetUnresponsed() {
    this.#data.unresponsedCount = 0
    this.#data.lastUserReplyAt = new Date().toISOString()
    this.save()
  }

  /** 记录触发器执行时间 */
  recordTrigger(triggerId) {
    this.#data.triggerHistory[triggerId] = new Date().toISOString()
    this.save()
  }

  /** 只读副本 */
  snapshot() {
    return structuredClone(this.#data)
  }
}
