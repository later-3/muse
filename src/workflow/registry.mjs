/**
 * WorkflowRegistry — 工作流实例注册中心
 *
 * 职责：
 * - session_id → WorkflowInstance(StateMachine) 映射
 * - participant role → session_id 映射
 * - 查询当前 session 的节点、参与者状态
 * - 提供给 hooks 的全局单例
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('workflow-reg')

export class WorkflowRegistry {
  #instances = new Map()        // instanceId → StateMachine
  #sessionMap = new Map()       // sessionId → { instanceId, role }
  #workspaceRoot = null

  constructor({ workspaceRoot } = {}) {
    this.#workspaceRoot = workspaceRoot
  }

  get workspaceRoot() { return this.#workspaceRoot }

  // ── 实例管理 ──

  /**
   * 注册工作流实例并绑定 session
   * @param {import('./state-machine.mjs').StateMachine} sm
   * @param {object[]} bindings - [{ role, sessionId }]
   */
  register(sm, bindings = []) {
    this.#instances.set(sm.instanceId, sm)
    for (const { role, sessionId, placeholder } of bindings) {
      this.#sessionMap.set(sessionId, {
        instanceId: sm.instanceId,
        role,
        ...(placeholder ? { placeholder: true } : {}),
      })
      log.info('session 绑定', { sessionId, instanceId: sm.instanceId, role, placeholder: !!placeholder })
    }
    log.info('实例注册', { instanceId: sm.instanceId, workflow: sm.workflowId })
  }

  /**
   * 绑定额外 session（handoff 场景）
   */
  bindSession(instanceId, sessionId, role) {
    if (!this.#instances.has(instanceId)) {
      throw new Error(`实例 ${instanceId} 不存在`)
    }
    this.#sessionMap.set(sessionId, { instanceId, role })
    log.info('session 追加绑定', { sessionId, instanceId, role })
  }

  /**
   * 移除实例及其所有 session 绑定
   */
  unregister(instanceId) {
    this.#instances.delete(instanceId)
    for (const [sid, binding] of this.#sessionMap) {
      if (binding.instanceId === instanceId) {
        this.#sessionMap.delete(sid)
      }
    }
    log.info('实例注销', { instanceId })
  }

  // ── 查询 ──

  /**
   * 根据 sessionId 获取状态机
   * @returns {import('./state-machine.mjs').StateMachine | null}
   */
  getBySession(sessionId) {
    const binding = this.#sessionMap.get(sessionId)
    if (!binding) return null
    return this.#instances.get(binding.instanceId) || null
  }

  /**
   * 获取 session 绑定的角色
   */
  getRoleBySession(sessionId) {
    return this.#sessionMap.get(sessionId)?.role || null
  }

  /**
   * 判定 session 的参与者状态
   * @returns {'active' | 'frozen' | 'unbound'}
   */
  getParticipantStatus(sessionId) {
    const sm = this.getBySession(sessionId)
    if (!sm) return 'unbound'

    const role = this.getRoleBySession(sessionId)
    const node = sm.getCurrentNode()
    if (node && node.participant === role) return 'active'
    return 'frozen'
  }

  /**
   * 检查实例是否已有指定 role 的 session 绑定
   * @param {string} instanceId
   * @param {string} role
   * @returns {boolean}
   */
  hasRole(instanceId, role) {
    for (const [, binding] of this.#sessionMap) {
      if (binding.instanceId === instanceId && binding.role === role) return true
    }
    return false
  }

  /**
   * 检查实例某 role 的 session 是否为占位（placeholder）
   * @param {string} instanceId
   * @param {string} role
   * @returns {boolean} true = 占位 session / 无绑定，false = 真实 session
   */
  isPlaceholder(instanceId, role) {
    for (const [, binding] of this.#sessionMap) {
      if (binding.instanceId === instanceId && binding.role === role) {
        return !!binding.placeholder
      }
    }
    return true  // 无绑定也视为需要 handoff
  }

  /**
   * 获取实例
   */
  getInstance(instanceId) {
    return this.#instances.get(instanceId) || null
  }

  /**
   * 列出所有活跃实例
   */
  listInstances() {
    return [...this.#instances.values()].map(sm => ({
      instanceId: sm.instanceId,
      workflowId: sm.workflowId,
      taskId: sm.taskId,
      status: sm.status,
      currentNode: sm.currentNodeId,
    }))
  }

  // ── Handoff 解绑/重绑 ──

  /**
   * 解绑单个 session（cancel handoff 时调用）
   * @param {string} sessionId
   * @returns {boolean} 是否成功解绑
   */
  unbindSession(sessionId) {
    const had = this.#sessionMap.has(sessionId)
    this.#sessionMap.delete(sessionId)
    if (had) log.info('session 解绑', { sessionId })
    return had
  }

  /**
   * 按 role 替换绑定的 session（retry handoff 时调用）
   * 解除该 role 旧 session，绑定新 session
   * @param {string} instanceId
   * @param {string} role
   * @param {string} newSessionId
   * @returns {string|null} 被替换的旧 sessionId，未找到返回 null
   */
  replaceRoleSession(instanceId, role, newSessionId) {
    let oldSessionId = null
    for (const [sid, binding] of this.#sessionMap) {
      if (binding.instanceId === instanceId && binding.role === role) {
        oldSessionId = sid
        this.#sessionMap.delete(sid)
        break
      }
    }
    this.#sessionMap.set(newSessionId, { instanceId, role })
    log.info('session 替换', { oldSessionId, newSessionId, instanceId, role })
    return oldSessionId
  }

  /**
   * @deprecated 历史接口，T39-1.4 后由 replaceRoleSession 替代
   * 按角色自动重新绑定 session（替换虚拟 session 为真实 session）
   * @param {string} role - 参与者角色名
   * @param {string} newSessionId - 新的真实 session ID
   * @returns {boolean} 是否成功绑定
   */
  rebindByRole(role, newSessionId) {
    for (const [sid, binding] of this.#sessionMap) {
      if (binding.role === role && sid !== newSessionId) {
        this.#sessionMap.delete(sid)
        this.#sessionMap.set(newSessionId, { instanceId: binding.instanceId, role })
        log.info('session 自动重绑定', { oldSession: sid, newSession: newSessionId, role, instanceId: binding.instanceId })
        return true
      }
    }
    return false
  }

  get size() { return this.#instances.size }
}

// ── 全局单例 ──

let globalRegistry = null

/**
 * 获取全局 registry（plugin hooks 使用）
 */
export function getRegistry() {
  return globalRegistry
}

/**
 * 设置全局 registry（启动时调用）
 */
export function setRegistry(registry) {
  globalRegistry = registry
  log.info('全局 registry 已设置')
}
