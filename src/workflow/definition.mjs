/**
 * WorkflowDefinition — 工作流定义解析与校验
 *
 * 职责：
 * - 解析 workflow.json 为内存数据结构
 * - 校验格式合法性（节点类型、transition 目标、参与者引用）
 * - 提供只读访问接口
 */

import { readFile } from 'node:fs/promises'
import { createLogger } from '../logger.mjs'

const log = createLogger('workflow-def')

// ── 常量 ──

export const NODE_TYPES = new Set(['action', 'gate', 'handoff', 'decision', 'terminal'])

export const ACTOR_TYPES = new Set(['agent', 'user', 'admin', 'system'])

export const BASH_POLICIES = new Set(['deny', 'read_only', 'test_build', 'scoped_write', 'full'])

// ── 校验错误 ──

export class WorkflowValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'WorkflowValidationError'
    this.errors = errors
  }
}

// ── 定义类 ──

export class WorkflowDefinition {
  #raw

  constructor(raw) {
    this.#raw = Object.freeze(raw)
  }

  get id()           { return this.#raw.id }
  get name()         { return this.#raw.name }
  get version()      { return this.#raw.version }
  get initial()      { return this.#raw.initial }
  get participants() { return this.#raw.participants }

  getNode(nodeId) {
    return this.#raw.nodes[nodeId] || null
  }

  getInitialNode() {
    return this.getNode(this.initial)
  }

  listNodeIds() {
    return Object.keys(this.#raw.nodes)
  }

  listNodes() {
    return Object.entries(this.#raw.nodes).map(([id, node]) => ({ id, ...node }))
  }

  toJSON() {
    return this.#raw
  }
}

// ── 加载 + 校验 ──

/**
 * 从文件路径加载工作流定义
 * @param {string} filePath - workflow.json 路径
 * @returns {Promise<WorkflowDefinition>}
 */
export async function loadWorkflowFromFile(filePath) {
  log.info('加载工作流定义', filePath)
  const content = await readFile(filePath, 'utf-8')
  const raw = JSON.parse(content)
  return parseWorkflow(raw)
}

/**
 * 从 JSON 对象解析工作流定义（核心入口）
 * @param {object} raw
 * @returns {WorkflowDefinition}
 * @throws {WorkflowValidationError}
 */
export function parseWorkflow(raw) {
  const errors = validateWorkflow(raw)
  if (errors.length > 0) {
    const msg = `工作流定义校验失败 (${errors.length} 个错误):\n${errors.map(e => `  - ${e}`).join('\n')}`
    log.error(msg)
    throw new WorkflowValidationError(msg, errors)
  }

  // 给每个节点注入 id 字段（方便运行时使用）
  const normalized = { ...raw }
  normalized.nodes = {}
  for (const [id, node] of Object.entries(raw.nodes)) {
    normalized.nodes[id] = { ...node, id }
  }

  log.info(`工作流 "${raw.id}" 解析成功`, {
    nodes: Object.keys(raw.nodes).length,
    participants: (raw.participants || []).length,
  })
  return new WorkflowDefinition(normalized)
}

// ── 校验逻辑 ──

function validateWorkflow(raw) {
  const errors = []

  // 顶层必填字段
  if (!raw.id || typeof raw.id !== 'string') {
    errors.push('缺少 "id" 字段或类型不对')
  }
  if (!raw.initial || typeof raw.initial !== 'string') {
    errors.push('缺少 "initial" 字段或类型不对')
  }
  if (!raw.nodes || typeof raw.nodes !== 'object' || Array.isArray(raw.nodes)) {
    errors.push('缺少 "nodes" 字段或类型不对')
    return errors  // nodes 不存在，后续校验无意义
  }

  const nodeIds = new Set(Object.keys(raw.nodes))

  // initial 指向存在的节点
  if (raw.initial && !nodeIds.has(raw.initial)) {
    errors.push(`"initial" 指向不存在的节点 "${raw.initial}"`)
  }

  // 校验 participants
  const participantRoles = new Set()
  if (raw.participants) {
    if (!Array.isArray(raw.participants)) {
      errors.push('"participants" 应为数组')
    } else {
      for (const p of raw.participants) {
        if (!p.role || typeof p.role !== 'string') {
          errors.push('participant 缺少 "role" 字段')
        } else {
          participantRoles.add(p.role)
        }
      }
    }
  }

  // 校验每个节点
  for (const [nodeId, node] of Object.entries(raw.nodes)) {
    const prefix = `节点 "${nodeId}"`

    // type
    if (!node.type) {
      errors.push(`${prefix}: 缺少 "type" 字段`)
    } else if (!NODE_TYPES.has(node.type)) {
      errors.push(`${prefix}: 未知节点类型 "${node.type}"`)
    }

    // participant（非 terminal 节点必须有）
    if (node.type !== 'terminal' && node.participant) {
      if (participantRoles.size > 0 && !participantRoles.has(node.participant)) {
        errors.push(`${prefix}: participant "${node.participant}" 未在 participants 中声明`)
      }
    }

    // objective（非 terminal 节点建议有，但不强制）

    // capabilities
    if (node.capabilities && !Array.isArray(node.capabilities)) {
      errors.push(`${prefix}: "capabilities" 应为数组`)
    }

    // bash_policy
    if (node.bash_policy && !BASH_POLICIES.has(node.bash_policy)) {
      errors.push(`${prefix}: 未知 bash_policy "${node.bash_policy}"`)
    }

    // transitions
    if (node.transitions) {
      if (typeof node.transitions !== 'object' || Array.isArray(node.transitions)) {
        errors.push(`${prefix}: "transitions" 应为对象`)
      } else {
        for (const [event, transition] of Object.entries(node.transitions)) {
          const tPrefix = `${prefix} transition "${event}"`

          if (!transition.target) {
            errors.push(`${tPrefix}: 缺少 "target"`)
          } else if (!nodeIds.has(transition.target)) {
            errors.push(`${tPrefix}: target "${transition.target}" 指向不存在的节点`)
          }

          if (transition.actor && !ACTOR_TYPES.has(transition.actor)) {
            errors.push(`${tPrefix}: 未知 actor "${transition.actor}"`)
          }
        }
      }
    }

    // terminal 节点不应有 transitions
    if (node.type === 'terminal' && node.transitions && Object.keys(node.transitions).length > 0) {
      errors.push(`${prefix}: terminal 节点不应有 transitions`)
    }

    // file_scope
    if (node.file_scope) {
      if (node.file_scope.allowed_paths && !Array.isArray(node.file_scope.allowed_paths)) {
        errors.push(`${prefix}: file_scope.allowed_paths 应为数组`)
      }
      if (node.file_scope.blocked_paths && !Array.isArray(node.file_scope.blocked_paths)) {
        errors.push(`${prefix}: file_scope.blocked_paths 应为数组`)
      }
    }

    // output
    if (node.output) {
      if (!node.output.artifact || typeof node.output.artifact !== 'string') {
        errors.push(`${prefix}: output.artifact 应为非空字符串`)
      }
    }
  }

  return errors
}
