/**
 * StateMachine — 工作流状态机
 *
 * 职责：
 * - 管理当前节点状态
 * - 执行 transition（含 actor 校验）
 * - 检查 exit_criteria（产物条件）
 * - 记录状态流转历史
 * - 持久化 / 恢复
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('workflow-sm')

// ── 错误类型 ──

export class TransitionError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'TransitionError'
    this.details = details
  }
}

// ── 状态机 ──

export class StateMachine {
  #definition
  #state
  #listeners = []

  /**
   * @param {import('./definition.mjs').WorkflowDefinition} definition
   * @param {object} opts
   * @param {string} opts.taskId
   * @param {string} [opts.instanceId]
   */
  constructor(definition, { taskId, instanceId } = {}) {
    this.#definition = definition
    this.#state = {
      workflow_id: definition.id,
      instance_id: instanceId || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      current_node: definition.initial,
      task_id: taskId || 'unknown',
      status: 'running',
      history: [
        {
          from: null,
          to: definition.initial,
          event: 'start',
          actor: 'system',
          ts: Date.now(),
        },
      ],
      artifacts: {},
    }
    log.info('状态机创建', {
      instance: this.#state.instance_id,
      workflow: definition.id,
      initial: definition.initial,
    })
  }

  // ── Getters ──

  get instanceId() { return this.#state.instance_id }
  get workflowId() { return this.#state.workflow_id }
  get taskId()     { return this.#state.task_id }
  get status()     { return this.#state.status }
  get history()    { return [...this.#state.history] }

  get currentNodeId() { return this.#state.current_node }

  getCurrentNode() {
    return this.#definition.getNode(this.#state.current_node)
  }

  get definition() { return this.#definition }

  // ── Transition ──

  /**
   * 执行状态流转
   * @param {string} event - transition 事件名
   * @param {string} actor - 触发者身份（agent/user/admin/system）
   * @param {object} [meta] - 可选的审计元数据，会写入 history
   * @param {string} [meta.on_behalf_of] - 实际决策者（user/planner）
   * @param {string} [meta.evidence] - 决策证据
   * @returns {{ from: string, to: string, event: string }}
   * @throws {TransitionError}
   */
  transition(event, actor, meta) {
    const node = this.getCurrentNode()

    if (this.#state.status !== 'running') {
      throw new TransitionError(
        `工作流已 ${this.#state.status}，不能 transition`,
        { status: this.#state.status },
      )
    }

    if (!node.transitions || !node.transitions[event]) {
      throw new TransitionError(
        `节点 "${node.id}" 没有 transition "${event}"`,
        { node: node.id, event, available: Object.keys(node.transitions || {}) },
      )
    }

    const transitionDef = node.transitions[event]

    // Actor 校验（admin 可覆盖）
    if (transitionDef.actor && transitionDef.actor !== actor && actor !== 'admin') {
      throw new TransitionError(
        `Transition "${event}" 需要 ${transitionDef.actor} 触发，当前 actor 是 ${actor}`,
        { node: node.id, event, required: transitionDef.actor, actual: actor },
      )
    }

    // 执行流转
    const from = node.id
    const to = transitionDef.target
    const targetNode = this.#definition.getNode(to)

    this.#state.current_node = to
    this.#state.history.push({ from, to, event, actor, ts: Date.now(), ...(meta ? { meta } : {}) })

    log.info('状态流转', { instance: this.instanceId, from, to, event, actor })

    // 如果目标是 terminal，标记完成
    if (targetNode && targetNode.type === 'terminal') {
      this.#state.status = 'completed'
      log.info('工作流完成', { instance: this.instanceId })
    }

    // decision 节点自动路由
    if (targetNode && targetNode.type === 'decision') {
      const decisionResult = this.#resolveDecision(targetNode)
      if (decisionResult) {
        return decisionResult
      }
    }

    const result = { from, to, event }
    this.#fireListeners(result)
    return result
  }

  /**
   * 注册 transition 回调
   * @param {function({from, to, event, status})} fn
   */
  onTransition(fn) {
    this.#listeners.push(fn)
  }

  #fireListeners(result) {
    for (const fn of this.#listeners) {
      try {
        fn({ ...result, status: this.#state.status, instanceId: this.instanceId, workflowId: this.workflowId })
      } catch (e) {
        log.warn('transition listener 错误', { error: e.message })
      }
    }
  }

  // ── Decision 节点自动路由 ──

  #resolveDecision(node) {
    if (!node.transitions) return null

    for (const [event, transition] of Object.entries(node.transitions)) {
      if (event === 'default') continue  // default 最后处理

      // 检查 condition
      if (transition.condition) {
        const satisfied = this.#evaluateCondition(transition.condition)
        if (satisfied) {
          log.info('decision 条件命中', { node: node.id, event, target: transition.target })
          return this.transition(event, 'system')
        }
      }
    }

    // fallback to default
    if (node.transitions.default) {
      log.info('decision 走默认路径', { node: node.id, target: node.transitions.default.target })
      return this.transition('default', 'system')
    }

    log.warn('decision 无匹配路径', { node: node.id })
    return null
  }

  #evaluateCondition(condition) {
    // condition 格式: { type: 'artifact_exists', artifact: 'name' }
    //              或: { type: 'status_is', status: 'X' }
    //              或: { type: 'always' }
    if (!condition || !condition.type) return false

    switch (condition.type) {
      case 'artifact_exists':
        return this.hasArtifact(condition.artifact)
      case 'artifact_missing':
        return !this.hasArtifact(condition.artifact)
      case 'status_is':
        return this.#state.status === condition.status
      case 'always':
        return true
      default:
        log.warn('未知 condition 类型', { type: condition.type })
        return false
    }
  }

  // ── Artifact 管理 ──

  registerArtifact(name, path) {
    this.#state.artifacts[name] = { path, ts: Date.now() }
    log.info('产物注册', { instance: this.instanceId, artifact: name, path })
  }

  hasArtifact(name) {
    return name in this.#state.artifacts
  }

  getArtifact(name) {
    return this.#state.artifacts[name] || null
  }

  // ── Exit Criteria 检查 ──

  /**
   * 检查当前节点的 exit_criteria 是否满足
   * @returns {{ satisfied: boolean, missing: string[] }}
   */
  checkExitCriteria() {
    const node = this.getCurrentNode()
    const missing = []

    if (!node.exit_criteria) return { satisfied: true, missing }

    // 检查 artifacts
    if (node.exit_criteria.artifacts) {
      for (const art of node.exit_criteria.artifacts) {
        if (!this.hasArtifact(art)) {
          missing.push(`产物 "${art}" 未产出`)
        }
      }
    }

    // actor 类型留给 transition 的 actor 校验
    return { satisfied: missing.length === 0, missing }
  }

  // ── 暂停 / 恢复 ──

  pause() {
    if (this.#state.status === 'running') {
      this.#state.status = 'paused'
      log.info('工作流暂停', { instance: this.instanceId, node: this.currentNodeId })
    }
  }

  resume() {
    if (this.#state.status === 'paused') {
      this.#state.status = 'running'
      log.info('工作流恢复', { instance: this.instanceId, node: this.currentNodeId })
    }
  }

  /**
   * 回退到之前访问过的节点
   * @param {string} targetNodeId - 目标节点 ID（必须在 history 中出现过）
   * @param {string} actor - 触发者（必须是 'system' 或 'admin'）
   * @param {string} reason - 回退原因
   * @param {object} [meta] - 可选审计元数据
   * @returns {{ from: string, to: string }}
   * @throws {TransitionError}
   */
  rollback(targetNodeId, actor, reason, meta) {
    // 1. 状态校验
    if (this.#state.status !== 'running' && this.#state.status !== 'paused') {
      throw new TransitionError(
        `工作流已 ${this.#state.status}，不能 rollback`,
        { status: this.#state.status },
      )
    }

    // 2. targetNodeId 必须在 history 中出现过
    const visited = new Set()
    for (const h of this.#state.history) {
      if (h.to) visited.add(h.to)
      if (h.from) visited.add(h.from)
    }
    if (!visited.has(targetNodeId)) {
      throw new TransitionError(
        `不能回退到未访问过的节点 "${targetNodeId}"`,
        { targetNodeId, visited: [...visited] },
      )
    }

    // 3. 目标节点必须存在于定义中
    const targetNode = this.#definition.getNode(targetNodeId)
    if (!targetNode) {
      throw new TransitionError(
        `目标节点 "${targetNodeId}" 不存在`,
        { targetNodeId },
      )
    }

    // 4. actor 只能是 system 或 admin
    if (!['system', 'admin'].includes(actor)) {
      throw new TransitionError(
        `rollback 只能由 system 或 admin 触发，当前: ${actor}`,
        { actor },
      )
    }

    // 5. 执行回退
    const from = this.#state.current_node
    this.#state.current_node = targetNodeId
    this.#state.history.push({
      from,
      to: targetNodeId,
      event: 'rollback',
      actor,
      reason,
      ts: Date.now(),
      ...(meta ? { meta } : {}),
    })

    // 6. 恢复状态
    if (this.#state.status === 'paused') {
      this.#state.status = 'running'
    }

    log.info('工作流回退', { instance: this.instanceId, from, to: targetNodeId, reason })

    // 7. 触发 listener（与 transition() 一致的可观测性）
    const result = { from, to: targetNodeId, event: 'rollback' }
    this.#fireListeners(result)
    return result
  }

  abort(reason = '') {
    this.#state.status = 'aborted'
    this.#state.history.push({
      from: this.currentNodeId,
      to: null,
      event: 'abort',
      actor: 'system',
      ts: Date.now(),
      reason,
    })
    log.warn('工作流终止', { instance: this.instanceId, reason })
  }

  // ── 持久化 ──

  toState() {
    return JSON.parse(JSON.stringify(this.#state))
  }

  /**
   * 从持久化状态恢复
   * @param {import('./definition.mjs').WorkflowDefinition} definition
   * @param {object} state
   * @returns {StateMachine}
   */
  static fromState(definition, state) {
    const sm = new StateMachine(definition, {
      taskId: state.task_id,
      instanceId: state.instance_id,
    })
    // 覆盖自动生成的初始状态
    sm.#state = { ...state }
    log.info('状态机恢复', {
      instance: state.instance_id,
      node: state.current_node,
      status: state.status,
    })
    return sm
  }
}
