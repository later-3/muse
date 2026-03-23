/**
 * T33: HealthHistory — selfCheck history storage + trend detection
 *
 * Stores selfCheck reports to pulse/health-history/ as JSON files.
 * Detects continuous degradation trends.
 * Auto-cleans old files beyond maxFiles limit.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('health-history')

const MAX_FILES = 100

export class HealthHistory {
  #dir

  constructor(historyDir) {
    this.#dir = historyDir
  }

  /**
   * Save a selfCheck report to disk
   * @param {object} report — selfCheck() return value
   */
  save(report) {
    if (!report?.timestamp) {
      log.warn('报告缺少 timestamp，跳过保存')
      return null
    }

    if (!existsSync(this.#dir)) {
      mkdirSync(this.#dir, { recursive: true })
    }

    // Sanitize timestamp for filename: 2026-03-15T01:00:00.000Z → 2026-03-15T01-00-00
    const safeName = report.timestamp.replace(/[:.]/g, '-').replace(/Z$/, '')
    const filename = `health-${safeName}.json`
    const filepath = join(this.#dir, filename)

    writeFileSync(filepath, JSON.stringify(report, null, 2) + '\n')
    log.info(`保存体检报告: ${filename} overall=${report.overall}`)

    this.cleanup()
    return filename
  }

  /**
   * List recent reports (newest first)
   * @param {number} limit
   */
  list(limit = 10) {
    if (!existsSync(this.#dir)) return []

    const files = readdirSync(this.#dir)
      .filter(f => f.startsWith('health-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)

    return files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(this.#dir, f), 'utf-8'))
        return { filename: f, ...data }
      } catch {
        log.warn(`读取报告失败: ${f}`)
        return { filename: f, overall: '⚫', error: true }
      }
    })
  }

  /**
   * Detect continuous degradation trend
   * @returns {{ degraded: boolean, count: number, reports: string[] }}
   */
  detectTrend() {
    const recent = this.list(3)
    if (recent.length < 2) return { degraded: false, count: 0, reports: [] }

    let count = 0
    const degradedReports = []
    for (const r of recent) {
      if (r.overall !== '🟢') {
        count++
        degradedReports.push(r.filename)
      } else {
        break // Stop at first green
      }
    }

    const degraded = count >= 2
    if (degraded) {
      // 提取最新一次报告的异常模块详情
      const latest = recent[0]
      const reasons = this.#extractFailReasons(latest)
      const reasonStr = reasons.length > 0 ? `: ${reasons.join(', ')}` : ''
      log.warn(`连续 ${count} 次体检异常${reasonStr}`)
    }

    return { degraded, count, reports: degradedReports }
  }

  /**
   * 从体检报告中提取所有异常模块及原因
   * @param {object} report
   * @returns {string[]} e.g. ['web=🔴(未运行)', 'routing=🔴(unknown 50%)']
   */
  #extractFailReasons(report) {
    const reasons = []
    if (report?.system) {
      for (const [name, check] of Object.entries(report.system)) {
        if (check?.status && check.status !== '🟢') {
          reasons.push(`${name}=${check.status}(${check.detail || '?'})`)
        }
      }
    }
    if (report?.selfModel) {
      for (const [name, check] of Object.entries(report.selfModel)) {
        if (check?.status && check.status !== '🟢') {
          reasons.push(`${name}=${check.status}(${check.detail || '?'})`)
        }
      }
    }
    return reasons
  }

  /**
   * Clean up old files beyond limit
   */
  cleanup(maxFiles = MAX_FILES) {
    if (!existsSync(this.#dir)) return

    const files = readdirSync(this.#dir)
      .filter(f => f.startsWith('health-') && f.endsWith('.json'))
      .sort()

    if (files.length <= maxFiles) return

    const toDelete = files.slice(0, files.length - maxFiles)
    for (const f of toDelete) {
      try {
        unlinkSync(join(this.#dir, f))
      } catch (e) {
        log.warn(`删除旧报告失败: ${f} ${e.message}`)
      }
    }
    log.info(`清理旧报告: 删除 ${toDelete.length} 个文件`)
  }
}
