/**
 * T37: DevSession — Git Worktree 生命周期管理
 *
 * 每个开发任务在独立的 git worktree 中执行，不碰主工作区。
 * 安全: 不 stash, 不 reset, 不碰用户未提交的文件。
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { rm, access, readdir } from 'node:fs/promises'
import { createLogger } from '../logger.mjs'

const log = createLogger('dev-session')
const execFileAsync = promisify(execFile)

/** worktree 默认存放目录 (相对于项目根) */
const WORKTREE_BASE = '.dev-worktrees'

export class DevSession {
  #projectRoot
  #taskId
  #worktreePath
  #branch

  /**
   * @param {object} opts
   * @param {string} opts.projectRoot - 项目根目录
   * @param {string} opts.taskId - 任务 ID
   * @param {string} opts.worktreePath - worktree 绝对路径
   * @param {string} opts.branch - 分支名
   */
  constructor({ projectRoot, taskId, worktreePath, branch }) {
    this.#projectRoot = projectRoot
    this.#taskId = taskId
    this.#worktreePath = worktreePath
    this.#branch = branch
  }

  get worktreePath() { return this.#worktreePath }
  get branch() { return this.#branch }
  get taskId() { return this.#taskId }

  /**
   * 创建新的开发 session
   *
   * @param {string} projectRoot - 项目根目录
   * @param {string} taskId - 任务 ID (用于命名 worktree 和 branch)
   * @returns {Promise<DevSession>}
   */
  static async create(projectRoot, taskId) {
    const branch = `dev/${taskId}`
    const worktreePath = join(projectRoot, WORKTREE_BASE, taskId)

    log.info(`[session] ▶ 创建 worktree: ${worktreePath} (branch: ${branch})`)

    // 检查并清理已存在的 worktree
    const exists = await DevSession._pathExists(worktreePath)
    if (exists) {
      log.info(`[session] ⚠ 检测到残留 worktree，正在清理: ${worktreePath}`)
      await DevSession._cleanupWorktree(projectRoot, worktreePath, branch)
    }

    try {
      // 创建 worktree + 新分支
      await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', branch], {
        cwd: projectRoot,
        timeout: 30_000,
      })

      log.info(`[session] ✅ worktree 创建成功: ${worktreePath}`)

      return new DevSession({ projectRoot, taskId, worktreePath, branch })
    } catch (err) {
      log.error(`[session] ✖ worktree 创建失败: ${err.message}`)
      throw new Error(`DevSession 创建失败: ${err.message}`)
    }
  }

  /**
   * 检查路径是否存在
   * @param {string} path - 路径
   * @returns {Promise<boolean>}
   */
  static async _pathExists(path) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 清理 worktree（静态辅助方法）
   * @param {string} projectRoot - 项目根目录
   * @param {string} worktreePath - worktree 路径
   * @param {string} branch - 分支名
   */
  static async _cleanupWorktree(projectRoot, worktreePath, branch) {
    log.info(`[session] ▶ 尝试移除 git worktree: ${worktreePath}`)

    try {
      await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: projectRoot,
        timeout: 15_000,
      })
      log.info(`[session] ✅ git worktree remove 成功: ${worktreePath}`)
    } catch (err) {
      log.warn(`[session] ⚠ git worktree remove 失败: ${err.message}，尝试手动删除`)

      // 降级处理：手动删除目录
      try {
        await rm(worktreePath, { recursive: true, force: true })
        log.info(`[session] ✅ 手动删除目录成功: ${worktreePath}`)
      } catch (rmErr) {
        log.error(`[session] ✖ 手动删除目录失败: ${rmErr.message}`)
        // 降级记录，不阻止后续操作
      }
    }

    // 尝试删除分支
    log.info(`[session] ▶ 尝试删除分支: ${branch}`)
    try {
      await execFileAsync('git', ['branch', '-D', branch], {
        cwd: projectRoot,
        timeout: 15_000,
      })
      log.info(`[session] ✅ 分支删除成功: ${branch}`)
    } catch (err) {
      log.warn(`[session] ⚠ 删除分支失败 (可能已不存在): ${err.message}`)
      // 降级记录，不阻止后续操作
    }
  }

  /**
   * 列出孤立的 worktree 目录（不在 git worktree list 中）
   * @param {string} projectRoot - 项目根目录
   * @returns {Promise<string[]>} 孤立目录路径数组
   */
  static async listOrphanWorktrees(projectRoot) {
    log.info(`[session] ▶ 扫描孤立 worktree 目录`)

    const worktreeBasePath = join(projectRoot, WORKTREE_BASE)

    try {
      // 获取 git 管理的所有 worktree 路径
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: projectRoot,
        timeout: 15_000,
      })

      const managedPaths = new Set()
      for (const line of stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          managedPaths.add(line.slice(9).trim())
        }
      }

      log.info(`[session] ℹ 发现 ${managedPaths.size} 个 git 管理的 worktree`)

      // 扫描 .dev-worktrees/ 目录
      let entries = []
      try {
        entries = await readdir(worktreeBasePath, { withFileTypes: true })
      } catch (err) {
        if (err.code === 'ENOENT') {
          log.info(`[session] ℹ worktree 基础目录不存在: ${worktreeBasePath}`)
          return []
        }
        throw err
      }

      const orphans = []
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = join(worktreeBasePath, entry.name)
          if (!managedPaths.has(dirPath)) {
            orphans.push(dirPath)
            log.info(`[session] ⚠ 发现孤立目录: ${dirPath}`)
          }
        }
      }

      log.info(`[session] ✅ 扫描完成，发现 ${orphans.length} 个孤立 worktree`)
      return orphans
    } catch (err) {
      log.error(`[session] ✖ 扫描孤立 worktree 失败: ${err.message}`)
      return []
    }
  }

  /**
   * 获取 worktree 中的 git diff (相对于主分支)
   * @returns {Promise<string>} diff 文本
   */
  async getDiff() {
    try {
      const { stdout } = await execFileAsync('git', ['diff', 'HEAD'], {
        cwd: this.#worktreePath,
        timeout: 15_000,
        maxBuffer: 1024 * 1024, // 1MB
      })
      return stdout
    } catch (err) {
      log.error(`[session] ✖ 获取 diff 失败: ${err.message}`)
      throw new Error(`获取 diff 失败: ${err.message}`)
    }
  }

  /**
   * 在 worktree 内运行测试
   * @param {string} [testPattern] - 测试文件模式
   * @returns {Promise<{ ok: boolean, output: string, exitCode: number }>}
   */
  async runTests(testPattern) {
    const args = ['--test']
    if (testPattern) args.push(testPattern)

    log.info(`[session] ▶ 运行测试: node ${args.join(' ')} (cwd: ${this.#worktreePath}/muse)`)

    try {
      const { stdout, stderr } = await execFileAsync('node', args, {
        cwd: join(this.#worktreePath, 'muse'),
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      })

      const output = stdout + (stderr || '')
      log.info(`[session] ✅ 测试通过`)
      return { ok: true, output, exitCode: 0 }
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '')
      const exitCode = err.code || 1

      log.warn(`[session] ✘ 测试失败 (exit: ${exitCode})`)
      return { ok: false, output, exitCode }
    }
  }

  /**
   * 合并 worktree 到主分支并清理
   * @returns {Promise<void>}
   */
  async merge() {
    log.info(`[session] ▶ 合并 branch: ${this.#branch}`)

    try {
      // 在主工作区合并
      await execFileAsync('git', ['merge', this.#branch, '--no-ff', '-m', `feat(t37): merge ${this.#taskId}`], {
        cwd: this.#projectRoot,
        timeout: 30_000,
      })

      log.info(`[session] ✅ 合并成功`)
      await this.cleanup()
    } catch (err) {
      log.error(`[session] ✖ 合并失败: ${err.message}`)
      throw new Error(`合并失败: ${err.message}`)
    }
  }

  /**
   * 清理 worktree 和分支
   * @returns {Promise<void>}
   */
  async cleanup() {
    log.info(`[session] ▶ 开始清理 worktree: ${this.#worktreePath}`)

    try {
      // 删除 worktree
      log.info(`[session] ▶ 执行: git worktree remove ${this.#worktreePath} --force`)
      try {
        await execFileAsync('git', ['worktree', 'remove', this.#worktreePath, '--force'], {
          cwd: this.#projectRoot,
          timeout: 15_000,
        })
        log.info(`[session] ✅ git worktree remove 成功`)
      } catch (err) {
        log.warn(`[session] ⚠ git worktree remove 失败: ${err.message}`)
      }

      // 确保目录被删除
      log.info(`[session] ▶ 确保目录删除: ${this.#worktreePath}`)
      try {
        await rm(this.#worktreePath, { recursive: true, force: true })
        log.info(`[session] ✅ 目录删除成功`)
      } catch (err) {
        log.warn(`[session] ⚠ 目录删除失败: ${err.message}`)
      }

      // 删除分支
      log.info(`[session] ▶ 执行: git branch -D ${this.#branch}`)
      try {
        await execFileAsync('git', ['branch', '-D', this.#branch], {
          cwd: this.#projectRoot,
          timeout: 15_000,
        })
        log.info(`[session] ✅ 分支删除成功: ${this.#branch}`)
      } catch (err) {
        log.warn(`[session] ⚠ 删除分支失败 (可能已不存在): ${err.message}`)
      }

      log.info(`[session] ✅ 清理流程完成`)
    } catch (err) {
      log.error(`[session] ✖ 清理过程出错: ${err.message}`)
      // 清理失败不抛错，只记录
    }
  }

  /**
   * 检查 worktree 是否存在
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await access(this.#worktreePath)
      return true
    } catch {
      return false
    }
  }
}

export { WORKTREE_BASE }
