/**
 * T37: DevGuard — 开发安全边界
 *
 * 纯函数模块，零外部依赖。
 * 负责: 白名单目录检查、黑名单文件检查、diff 大小限制、git diff 解析。
 *
 * 设计原则: DevGuard 是确定性规则，不是 AI 判断。
 * AI 用规则自检，规则不通过 = 不能合并。
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('dev-guard')

/** 允许修改的目录 (相对于项目根) */
export const ALLOWED_DIRS = ['muse/']

/** 禁止修改的文件 (任何路径下) */
export const BLOCKED_FILES = ['.env', '.env.local', 'opencode.json', 'start.sh', 'package-lock.json']

/** 单次 diff 最大行数 */
export const MAX_DIFF_LINES = 500

export class DevGuard {

  /**
   * 校验开发方案是否在安全范围内
   *
   * @param {object} plan
   * @param {string[]} plan.files - 计划修改的文件列表
   * @param {number} [plan.estimatedLines] - 预计修改行数
   * @returns {{ ok: boolean, reason?: string }}
   */
  static validatePlan(plan) {
    if (!plan?.files || !Array.isArray(plan.files)) {
      return { ok: false, reason: '方案缺少 files 列表' }
    }

    // 检查每个文件是否在白名单目录内
    for (const file of plan.files) {
      if (!DevGuard.isAllowedPath(file)) {
        log.warn(`[guard] ✘ 方案包含禁止修改的文件: ${file}`)
        return { ok: false, reason: `文件 "${file}" 不在允许的目录中 (允许: ${ALLOWED_DIRS.join(', ')})` }
      }
      if (DevGuard.isBlockedFile(file)) {
        log.warn(`[guard] ✘ 方案包含黑名单文件: ${file}`)
        return { ok: false, reason: `文件 "${file}" 在黑名单中，禁止修改` }
      }
    }

    // 检查预计行数
    if (plan.estimatedLines && plan.estimatedLines > MAX_DIFF_LINES) {
      log.warn(`[guard] ✘ 方案预计行数超限: ${plan.estimatedLines} > ${MAX_DIFF_LINES}`)
      return { ok: false, reason: `预计修改 ${plan.estimatedLines} 行，超过限制 ${MAX_DIFF_LINES} 行` }
    }

    log.info(`[guard] ✅ 方案检查通过: ${plan.files.length} 个文件`)
    return { ok: true }
  }

  /**
   * 校验实际 diff 是否在安全范围内
   *
   * @param {string} diffText - `git diff` 的输出
   * @returns {{ ok: boolean, reason?: string, stats: object }}
   */
  static validateDiff(diffText) {
    const stats = DevGuard.parseGitDiff(diffText)

    // 检查每个文件
    for (const file of stats.files) {
      if (!DevGuard.isAllowedPath(file)) {
        log.warn(`[guard] ✘ diff 包含禁止修改的文件: ${file}`)
        return { ok: false, reason: `文件 "${file}" 不在允许的目录中`, stats }
      }
      if (DevGuard.isBlockedFile(file)) {
        log.warn(`[guard] ✘ diff 包含黑名单文件: ${file}`)
        return { ok: false, reason: `文件 "${file}" 在黑名单中，禁止修改`, stats }
      }
    }

    // 检查总行数
    const totalLines = stats.linesAdded + stats.linesRemoved
    if (totalLines > MAX_DIFF_LINES) {
      log.warn(`[guard] ✘ diff 行数超限: ${totalLines} > ${MAX_DIFF_LINES}`)
      return { ok: false, reason: `diff 共 ${totalLines} 行 (加${stats.linesAdded}/删${stats.linesRemoved})，超过限制 ${MAX_DIFF_LINES} 行`, stats }
    }

    log.info(`[guard] ✅ diff 检查通过: ${stats.files.length} 个文件, +${stats.linesAdded}/-${stats.linesRemoved}`)
    return { ok: true, stats }
  }

  /**
   * 解析 git diff 输出
   *
   * @param {string} text - `git diff --stat` 或 `git diff` 的输出
   * @returns {{ files: string[], linesAdded: number, linesRemoved: number }}
   */
  static parseGitDiff(text) {
    if (!text || typeof text !== 'string') {
      return { files: [], linesAdded: 0, linesRemoved: 0 }
    }

    const files = new Set()
    let linesAdded = 0
    let linesRemoved = 0

    for (const line of text.split('\n')) {
      // diff --git a/path b/path
      const diffMatch = line.match(/^diff --git a\/(.+) b\//)
      if (diffMatch) {
        files.add(diffMatch[1])
        continue
      }

      // +line (added, but not +++ header)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        linesAdded++
        continue
      }

      // -line (removed, but not --- header)
      if (line.startsWith('-') && !line.startsWith('---')) {
        linesRemoved++
      }
    }

    return { files: [...files], linesAdded, linesRemoved }
  }

  /**
   * 检查文件路径是否在允许的目录内
   * @param {string} filePath
   * @returns {boolean}
   */
  static isAllowedPath(filePath) {
    const normalized = filePath.replace(/^\//, '') // 去掉开头的 /
    return ALLOWED_DIRS.some(dir => normalized.startsWith(dir))
  }

  /**
   * 检查文件是否在黑名单中
   * @param {string} filePath
   * @returns {boolean}
   */
  static isBlockedFile(filePath) {
    const basename = filePath.split('/').pop()
    return BLOCKED_FILES.includes(basename)
  }
}
