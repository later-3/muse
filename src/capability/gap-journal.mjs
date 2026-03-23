/**
 * T16: Capability Gap Journal — 缺口管理
 *
 * 记录 Muse 遇到但无法处理的情况。
 * Phase 2: 内存存储。Phase 3: 持久化到 SQLite。
 *
 * 设计原则: 只记录事实 + 通知，不决定怎么填补缺口。
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('gap-journal')

/** 最大内存条目数 (防止内存泄漏) */
const MAX_ENTRIES = 500

export class GapJournal {
  /** @type {Array<object>} */
  #entries = []
  #registry

  /**
   * @param {object} [deps]
   * @param {import('./registry.mjs').CapabilityRegistry} [deps.registry] - 可选 Registry (用于丰富 Gap 上下文)
   */
  constructor({ registry } = {}) {
    this.#registry = registry || null
  }

  /**
   * 记录一个能力缺口
   *
   * @param {object} gap
   * @param {string} gap.type - 输入类型 (如 'audio', 'video')
   * @param {string} gap.source - 来源 (如 'telegram')
   * @param {string} [gap.userId] - 用户 ID
   * @param {string} [gap.reason] - 缺口原因 (如 'unsupported', 'missing_capability')
   * @param {string} [gap.detail] - 额外描述
   * @returns {object} 创建的 GapEntry
   */
  record(gap) {
    if (!gap?.type) throw new Error('GapEntry must have a type')

    // 查 Registry 丰富上下文
    let registryInfo = null
    if (this.#registry) {
      const senseId = `${gap.source}_${gap.type}`
      const sense = this.#registry.querySense(senseId)
      if (sense) {
        registryInfo = { senseId, status: sense.status }
      }
    }

    const entry = {
      id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: gap.type,
      source: gap.source || 'unknown',
      userId: gap.userId || null,
      reason: gap.reason || 'unsupported',
      detail: gap.detail || null,
      registryInfo,
      timestamp: new Date().toISOString(),
    }

    this.#entries.push(entry)

    // 防止内存泄漏
    if (this.#entries.length > MAX_ENTRIES) {
      this.#entries = this.#entries.slice(-MAX_ENTRIES)
    }

    log.info(`[gap] 📋 记录缺口: type=${entry.type} source=${entry.source} reason=${entry.reason}`)
    if (registryInfo) {
      log.info(`[gap]   registry: ${registryInfo.senseId} → ${registryInfo.status}`)
    }

    return entry
  }

  /**
   * 获取所有缺口记录
   * @param {object} [filter]
   * @param {string} [filter.type] - 按类型筛选
   * @param {string} [filter.source] - 按来源筛选
   * @returns {object[]}
   */
  list(filter = {}) {
    let result = [...this.#entries]
    if (filter.type) result = result.filter(e => e.type === filter.type)
    if (filter.source) result = result.filter(e => e.source === filter.source)
    return result
  }

  /**
   * 统计摘要
   * @returns {{ total: number, byType: object, bySource: object }}
   */
  stats() {
    const byType = {}
    const bySource = {}
    for (const e of this.#entries) {
      byType[e.type] = (byType[e.type] || 0) + 1
      bySource[e.source] = (bySource[e.source] || 0) + 1
    }
    return { total: this.#entries.length, byType, bySource }
  }

  /**
   * 一行摘要 (给 AI 或 Web 用)
   * @returns {string}
   */
  summary() {
    const s = this.stats()
    if (s.total === 0) return '暂无能力缺口记录'
    const types = Object.entries(s.byType).map(([k, v]) => `${k}(${v})`).join(' ')
    return `能力缺口: ${s.total} 条 — ${types}`
  }
}

export { MAX_ENTRIES }
