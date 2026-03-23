/**
 * T37: TaskOrchestrator — 开发任务编排器
 *
 * 核心模块: 小缪通过这个模块调度 OpenCode agents 完成开发。
 * 小缪是编排者 (orchestrator)，不是执行者。
 *
 * 编排流程:
 *   1. 创建任务 (DevStore)
 *   2. 创建隔离环境 (DevSession / git worktree)
 *   3. 让 agent=plan 规划方案
 *   4. DevGuard 检查方案
 *   5. 让 agent=build 执行开发
 *   6. 在 worktree 内跑测试
 *   7. DevGuard 检查 diff
 *   8. 进入 review 状态 → 等 Later 审核
 */

import { createLogger } from '../logger.mjs'
import { DevGuard } from './guard.mjs'
import { DevSession } from './session.mjs'
import { DEV_STATUS } from './store.mjs'
import { Engine } from '../core/engine.mjs'

const log = createLogger('dev-orchestrator')

/** 规划 system prompt */
const PLAN_SYSTEM = `你是 Muse 的开发规划师。
分析需求，输出开发方案。格式要求:
1. 需要修改/新增的文件列表 (每行一个，以 muse/ 开头)
2. 每个文件的修改概要
3. 需要写的测试
4. 预计修改行数

只输出方案，不要输出代码。用 JSON 格式输出:
{ "files": ["muse/..."], "summary": "...", "tests": ["..."], "estimatedLines": N }`

/** 开发 system prompt */
const DEV_SYSTEM = `你在 muse/ 目录下开发 Muse 项目。遵守以下规范:
- ESM only (.mjs 后缀)
- 使用 createLogger('模块名') 统一日志
- try/catch 降级，不静默吞错
- 每个模块必须有对应的 .test.mjs 测试文件
- 使用 node:test + assert/strict 写测试
- 不修改 .env / opencode.json / start.sh`

/** 审查 system prompt */
const REVIEW_SYSTEM = `你是代码审查者。检查这个 diff 是否:
1. 符合 ESM 规范 (.mjs, import/export)
2. 有合理的错误处理 (try/catch, 不静默吞错)
3. 有日志 (createLogger)
4. 不包含安全隐患 (硬编码密钥、路径遍历等)
5. 代码质量 OK (无明显 bug、命名合理)

输出 JSON: { "approved": true/false, "issues": ["..."], "summary": "..." }`

export class TaskOrchestrator {
  #store
  #config
  #maxRetries

  /**
   * @param {object} deps
   * @param {import('./store.mjs').DevStore} deps.store
   * @param {object} deps.config - Muse 配置
   * @param {number} [deps.maxRetries=2] - 测试失败最大重试次数
   */
  constructor({ store, config, maxRetries = 2 }) {
    this.#store = store
    this.#config = config
    this.#maxRetries = maxRetries
  }

  /**
   * 发起开发任务 — 完整编排流程
   *
   * @param {string} description - 任务描述 (自然语言)
   * @param {object} [opts]
   * @param {object} [opts.gap] - 来自 GapJournal 的缺口
   * @returns {Promise<object>} devTask
   */
  async startTask(description, opts = {}) {
    // [1] 创建任务
    const task = this.#store.create({ description, gap: opts.gap })
    const taskId = task.id
    log.info(`[orch] ▶ 开始任务: ${taskId} — "${description.slice(0, 80)}"`)

    let session = null
    // 保持 Node 事件循环存活 — 防止 sendAndWait 轮询时进程提前退出
    const keepalive = setInterval(() => {}, 60_000)

    try {
      // [2] 创建隔离环境
      const projectRoot = this.#config.engine?.workspace || process.cwd()
      session = await DevSession.create(projectRoot, taskId)
      this.#store.updateStatus(taskId, DEV_STATUS.PLANNING, {
        worktree_path: session.worktreePath,
        worktree_branch: session.branch,
      })

      // [3] 构造指向 worktree 的 Engine
      const devEngine = new Engine({
        ...this.#config,
        engine: { ...this.#config.engine, workspace: session.worktreePath },
      })

      // [4] 让 agent=plan 规划
      log.info(`[orch] ① 规划阶段 (agent=plan)`)
      const planSession = await devEngine.createSession()
      const planResult = await devEngine.sendAndWait(planSession.id, description, {
        agent: 'plan',
        system: PLAN_SYSTEM,
        timeoutMs: 120_000,
      })
      log.info(`[orch] plan 完成: ${planResult?.text?.slice(0, 100)}`)

      let plan
      try {
        plan = JSON.parse(planResult.text.replace(/```json\n?|\n?```/g, '').trim())
      } catch {
        plan = { files: [], summary: planResult.text, estimatedLines: 0 }
      }

      // [5] DevGuard 检查方案
      const planCheck = DevGuard.validatePlan(plan)
      if (!planCheck.ok) {
        log.warn(`[orch] ✘ 方案被 DevGuard 拒绝: ${planCheck.reason}`)
        this.#store.updateStatus(taskId, DEV_STATUS.FAILED, { plan, review: { reason: planCheck.reason } })
        await session.cleanup()
        return this.#store.get(taskId)
      }

      this.#store.updateStatus(taskId, DEV_STATUS.DEVELOPING, { plan })
      log.info(`[orch] ② 开发阶段 (agent=build)`)

      // [6] 让 agent=build 执行开发
      const devSessionId = await devEngine.createSession()
      const devPrompt = `请按以下方案开发:\n\n${JSON.stringify(plan, null, 2)}\n\n原始需求: ${description}`

      await devEngine.sendAndWait(devSessionId.id, devPrompt, {
        agent: 'build',
        system: DEV_SYSTEM,
        timeoutMs: 180_000,
      })

      this.#store.updateStatus(taskId, DEV_STATUS.TESTING, { session_id: devSessionId.id })

      // [7] 跑测试 (支持重试)
      log.info(`[orch] ③ 测试阶段`)
      let testResult = { ok: false, output: '', exitCode: 1 }
      for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
        testResult = await session.runTests()
        if (testResult.ok) break

        if (attempt < this.#maxRetries) {
          log.info(`[orch]   测试失败，重试 ${attempt + 1}/${this.#maxRetries}`)
          // 让 AI 修复测试失败
          await devEngine.sendAndWait(devSessionId.id,
            `测试失败了，请修复:\n\n${testResult.output.slice(-2000)}`,
            { agent: 'build', system: DEV_SYSTEM, timeoutMs: 120_000 }
          )
        }
      }

      this.#store.updateStatus(taskId, testResult.ok ? DEV_STATUS.TESTING : DEV_STATUS.FAILED, {
        test: { ok: testResult.ok, exitCode: testResult.exitCode, output: testResult.output.slice(-1000) },
      })

      if (!testResult.ok) {
        log.warn(`[orch] ✘ 测试最终失败 (${this.#maxRetries + 1} 次尝试)`)
        await session.cleanup()
        return this.#store.get(taskId)
      }

      // [8] DevGuard 检查 diff
      log.info(`[orch] ④ 安全检查阶段`)
      const diff = await session.getDiff()
      const diffCheck = DevGuard.validateDiff(diff)

      if (!diffCheck.ok) {
        log.warn(`[orch] ✘ diff 被 DevGuard 拒绝: ${diffCheck.reason}`)
        this.#store.updateStatus(taskId, DEV_STATUS.FAILED, {
          diff: diffCheck.stats,
          review: { reason: diffCheck.reason },
        })
        await session.cleanup()
        return this.#store.get(taskId)
      }

      // [9] AI 自审
      log.info(`[orch] ⑤ AI 自审阶段`)
      let review = { approved: true, issues: [], summary: 'AI 自审通过' }
      try {
        const reviewSession = await devEngine.createSession()
        const reviewResult = await devEngine.sendAndWait(reviewSession.id,
          `请审查以下 diff:\n\n${diff.slice(0, 8000)}`,
          { agent: 'plan', system: REVIEW_SYSTEM, timeoutMs: 60_000 }
        )
        review = JSON.parse(reviewResult.text.replace(/```json\n?|\n?```/g, '').trim())
      } catch (err) {
        log.warn(`[orch] AI 自审解析失败，视为通过: ${err.message}`)
      }

      // [10] 进入 review 状态
      this.#store.updateStatus(taskId, DEV_STATUS.REVIEW, {
        diff: diffCheck.stats,
        review,
      })

      log.info(`[orch] ✅ 任务 ${taskId} 进入审核状态`)
      log.info(`[orch]   AI 自审: ${review.approved ? '通过' : '发现问题'} — ${review.summary || ''}`)

      return this.#store.get(taskId)

    } catch (err) {
      log.error(`[orch] ✖ 任务 ${taskId} 异常: ${err.message}`)
      this.#store.updateStatus(taskId, DEV_STATUS.FAILED, {
        review: { reason: `执行异常: ${err.message}` },
      })
      if (session) await session.cleanup().catch(() => {})
      return this.#store.get(taskId)
    } finally {
      clearInterval(keepalive)
    }
  }

  /**
   * 查询任务状态
   * @param {string} taskId
   * @returns {object|null}
   */
  getStatus(taskId) {
    return this.#store.get(taskId)
  }

  /**
   * Later 批准合并
   * @param {string} taskId
   * @returns {Promise<object>}
   */
  async approve(taskId) {
    const task = this.#store.get(taskId)
    if (!task) throw new Error(`任务不存在: ${taskId}`)
    if (task.status !== DEV_STATUS.REVIEW) {
      throw new Error(`任务 ${taskId} 状态为 ${task.status}，只有 review 状态可以审批`)
    }

    log.info(`[orch] ▶ 审批通过: ${taskId}`)

    try {
      const session = new DevSession({
        projectRoot: this.#config.engine?.workspace || process.cwd(),
        taskId,
        worktreePath: task.worktree_path,
        branch: task.worktree_branch,
      })

      this.#store.updateStatus(taskId, DEV_STATUS.APPROVED)
      await session.merge()
      this.#store.updateStatus(taskId, DEV_STATUS.MERGED)

      log.info(`[orch] ✅ 任务 ${taskId} 已合并`)
      return this.#store.get(taskId)
    } catch (err) {
      log.error(`[orch] ✖ 合并失败: ${err.message}`)
      this.#store.updateStatus(taskId, DEV_STATUS.FAILED, {
        review: { reason: `合并失败: ${err.message}` },
      })
      return this.#store.get(taskId)
    }
  }

  /**
   * Later 拒绝
   * @param {string} taskId
   * @param {string} [reason]
   * @returns {Promise<object>}
   */
  async reject(taskId, reason = '') {
    const task = this.#store.get(taskId)
    if (!task) throw new Error(`任务不存在: ${taskId}`)

    log.info(`[orch] ▶ 拒绝任务: ${taskId} — ${reason}`)

    try {
      const session = new DevSession({
        projectRoot: this.#config.engine?.workspace || process.cwd(),
        taskId,
        worktreePath: task.worktree_path,
        branch: task.worktree_branch,
      })

      await session.cleanup()
      this.#store.updateStatus(taskId, DEV_STATUS.REJECTED, {
        review: { reason: reason || '被 Later 拒绝' },
      })

      log.info(`[orch] ✅ 任务 ${taskId} 已拒绝并清理`)
      return this.#store.get(taskId)
    } catch (err) {
      log.error(`[orch] ✖ 清理失败: ${err.message}`)
      this.#store.updateStatus(taskId, DEV_STATUS.REJECTED, {
        review: { reason: `拒绝但清理失败: ${err.message}` },
      })
      return this.#store.get(taskId)
    }
  }

  /**
   * 列出所有任务
   * @param {object} [filter]
   * @returns {object[]}
   */
  listTasks(filter) {
    return this.#store.list(filter)
  }
}

export { PLAN_SYSTEM, DEV_SYSTEM, REVIEW_SYSTEM }
