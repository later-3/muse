/**
 * T39-1.3: WorkflowBridge — Family 级 per-instance 工作流状态桥接
 *
 * 升级：从 member-local 单文件 → family 共享 per-instance 目录 + session-index
 *
 * 路径布局：
 *   families/{family}/workflow/
 *   ├── session-index.json        ← sessionId → instanceId 映射
 *   └── instances/{instanceId}/
 *       ├── state.json            ← 工作流实例状态
 *       └── artifacts/            ← 共享产物
 *
 * 设计要点：
 * - session-index 支持 rebuildIndex() 从 state.json 重建
 * - 原子写入（唯一 tmpFile + rename）
 * - 跨 muse 共享：所有 member 读写同一 family workflow 目录
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync, readdirSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createLogger } from '../logger.mjs'

const log = createLogger('wf-bridge')

// ── 路径 ──

/**
 * 获取 family workflow 根目录
 * @param {string} [workflowRoot] - 测试用目录覆盖
 * @returns {string|null}
 */
export function getWorkflowRoot(workflowRoot) {
  if (workflowRoot) return workflowRoot
  const home = process.env.MUSE_HOME
  const family = process.env.MUSE_FAMILY
  if (!home || !family) return null
  return join(home, family, 'workflow')
}

/**
 * 获取 session-index.json 路径
 */
export function getSessionIndexPath(workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) return null
  return join(root, 'session-index.json')
}

/**
 * 获取实例目录
 */
export function getInstanceDir(instanceId, workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) return null
  return join(root, 'instances', instanceId)
}

/**
 * 获取实例 state.json 路径
 */
export function getStatePath(instanceId, workflowRoot) {
  const dir = getInstanceDir(instanceId, workflowRoot)
  if (!dir) return null
  return join(dir, 'state.json')
}

/**
 * 获取实例 artifact 目录
 */
export function getArtifactDir(instanceId, workflowRoot) {
  const dir = getInstanceDir(instanceId, workflowRoot)
  if (!dir) return null
  return join(dir, 'artifacts')
}

/**
 * 获取实例 artifact 文件路径
 */
export function getArtifactPath(instanceId, name, workflowRoot) {
  const dir = getArtifactDir(instanceId, workflowRoot)
  if (!dir) return null
  return join(dir, name)
}

/**
 * 获取 family 工作流定义目录
 */
export function getDefinitionsDir(workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) return null
  return join(root, 'definitions')
}

// ── Trace 日志 ──

/**
 * 往实例 trace.jsonl 追加一条记录
 * @param {string} instanceId
 * @param {object} entry - { tool, args, result, elapsedMs, ... }
 * @param {string} [workflowRoot]
 */
export function appendTrace(instanceId, entry, workflowRoot) {
  const dir = getInstanceDir(instanceId, workflowRoot)
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  })
  try {
    appendFileSync(join(dir, 'trace.jsonl'), line + '\n')
  } catch (e) {
    log.warn('trace 写入失败', { instanceId, error: e.message })
  }
}

/**
 * 归档已完成的工作流实例
 * instances/{id}/ → archive/{YYYY-MM}/{id}/
 */
export function archiveInstance(instanceId, workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) return null

  const srcDir = join(root, 'instances', instanceId)
  if (!existsSync(srcDir)) return null

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const archiveDir = join(root, 'archive', month)
  mkdirSync(archiveDir, { recursive: true })

  const destDir = join(archiveDir, instanceId)
  renameSync(srcDir, destDir)
  log.info('workflow 实例已归档', { instanceId, from: srcDir, to: destDir })
  return destDir
}

// ── 原子写入 ──

function atomicWriteJSON(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true })
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`
  const tmpPath = `${filePath}.tmp.${suffix}`
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmpPath, filePath)
  } catch (e) {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
    throw e
  }
}

// ── Session Index ──

/**
 * 读取 session-index
 * @param {string} [workflowRoot]
 * @returns {Record<string, string>} sessionId → instanceId
 */
export function readSessionIndex(workflowRoot) {
  const indexPath = getSessionIndexPath(workflowRoot)
  if (!indexPath || !existsSync(indexPath)) return {}
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8'))
  } catch {
    return {}
  }
}

/**
 * 索引 session → instance
 */
export function indexSession(sessionId, instanceId, workflowRoot) {
  const indexPath = getSessionIndexPath(workflowRoot)
  if (!indexPath) {
    log.warn('无法索引 session: MUSE_HOME/MUSE_FAMILY 未设置')
    return
  }
  const index = readSessionIndex(workflowRoot)
  index[sessionId] = instanceId
  atomicWriteJSON(indexPath, index)
  log.info('session 已索引', { sessionId: sessionId.slice(-8), instanceId })
}

/**
 * 查找 session 对应的 instanceId
 */
export function lookupInstance(sessionId, workflowRoot) {
  const index = readSessionIndex(workflowRoot)
  return index[sessionId] || null
}

/**
 * 删除 session 索引
 */
export function removeSessionIndex(sessionId, workflowRoot) {
  const indexPath = getSessionIndexPath(workflowRoot)
  if (!indexPath) return
  const index = readSessionIndex(workflowRoot)
  delete index[sessionId]
  atomicWriteJSON(indexPath, index)
}

/**
 * 从 instances 目录下所有 state.json 重建 session-index
 * 用于崩溃恢复：session-index.json 丢失时可完全重建
 */
export function rebuildIndex(workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) {
    log.warn('rebuildIndex: MUSE_HOME/MUSE_FAMILY 未设置')
    return {}
  }

  const instancesDir = join(root, 'instances')
  if (!existsSync(instancesDir)) return {}

  const index = {}
  let count = 0

  for (const instanceId of readdirSync(instancesDir)) {
    const statePath = join(instancesDir, instanceId, 'state.json')
    if (!existsSync(statePath)) continue
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf-8'))
      // 从 bindings 提取所有 sessionId → instanceId
      // bindings 统一为 [{role, sessionId}] 数组
      if (Array.isArray(state.bindings)) {
        for (const b of state.bindings) {
          if (b.sessionId) {
            index[b.sessionId] = instanceId
            count++
          }
        }
      }
      // handoff 中的 targetSession 也索引
      if (state.handoff?.targetSession) {
        index[state.handoff.targetSession] = instanceId
        count++
      }
    } catch (e) {
      log.warn('rebuildIndex: 读取 state.json 失败', { instanceId, error: e.message })
    }
  }

  const indexPath = getSessionIndexPath(workflowRoot)
  if (indexPath) {
    atomicWriteJSON(indexPath, index)
    log.info('session-index 已重建', { count, instances: readdirSync(instancesDir).length })
  }

  return index
}

// ── Per-Instance State ──

/**
 * 保存实例状态
 */
export function saveInstanceState(instanceId, state, workflowRoot) {
  const statePath = getStatePath(instanceId, workflowRoot)
  if (!statePath) {
    log.warn('无法保存实例状态: MUSE_HOME/MUSE_FAMILY 未设置')
    return false
  }
  try {
    atomicWriteJSON(statePath, { ...state, savedAt: new Date().toISOString() })
    log.info('实例状态已保存', { instanceId })
    return true
  } catch (e) {
    log.error('保存实例状态失败', { instanceId, error: e.message })
    return false
  }
}

/**
 * 加载实例状态
 */
export function loadInstanceState(instanceId, workflowRoot) {
  const statePath = getStatePath(instanceId, workflowRoot)
  if (!statePath || !existsSync(statePath)) return null
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8'))
  } catch (e) {
    log.warn('加载实例状态失败', { instanceId, error: e.message })
    return null
  }
}

// ── 跨进程恢复：从 state.json 恢复所有实例到内存 registry ──

/**
 * 从所有 instances 的 state.json 恢复 registry（跨进程恢复核心）
 *
 * 恢复链路：
 *   遍历 instances 目录 → loadInstanceState → loadWorkflowFromFile
 *   → StateMachine.fromState(definition, smState) → registry.register(sm, bindings)
 *
 * 关键特性：
 * - 恢复所有实例，不只是第一个
 * - 用 StateMachine.fromState 保留 current_node/artifacts/history
 * - bindings 统一为 [{role, sessionId}] 数组
 *
 * @param {string} [workflowRoot] - 测试用目录覆盖
 * @returns {Promise<object|null>} registry 或 null
 */
export async function restoreAllFromBridge(workflowRoot) {
  const root = getWorkflowRoot(workflowRoot)
  if (!root) return null
  const instancesDir = join(root, 'instances')
  if (!existsSync(instancesDir)) return null

  const dirs = readdirSync(instancesDir)
  if (dirs.length === 0) return null

  let registry = null
  let restoredCount = 0

  try {
    const { loadWorkflowFromFile } = await import('./definition.mjs')
    const { StateMachine } = await import('./state-machine.mjs')
    const { WorkflowRegistry, getRegistry, setRegistry } = await import('./registry.mjs')

    // 复用已有 registry 或创建新的
    registry = getRegistry()
    if (!registry) {
      registry = new WorkflowRegistry({
        workspaceRoot: process.env.MUSE_ROOT || process.cwd(),
      })
      setRegistry(registry)
    }

    for (const dir of dirs) {
      const state = loadInstanceState(dir, workflowRoot)
      if (!state?.workflowPath || !state?.smState) {
        log.warn('restoreAllFromBridge: 跳过（缺 workflowPath 或 smState）', { instanceId: dir })
        continue
      }

      // 如果 registry 里已有这个实例，仍然刷新 bindings（handoff 可能新增了 session）
      if (registry.getInstance(dir)) {
        const bindings = state.bindings || []
        for (const { role, sessionId, placeholder } of bindings) {
          if (!registry.getBySession(sessionId)) {
            registry.bindSession(dir, sessionId, role)
            log.info('bindings 增量同步', { sessionId, instanceId: dir, role })
          }
        }
        continue
      }

      try {
        const definition = await loadWorkflowFromFile(state.workflowPath)
        const sm = StateMachine.fromState(definition, state.smState)
        const bindings = state.bindings || []
        registry.register(sm, bindings)
        restoredCount++
        log.info('实例已恢复', {
          instanceId: dir,
          workflow: state.workflowId,
          currentNode: state.smState.current_node,
        })
      } catch (e) {
        log.warn('恢复实例失败', { instanceId: dir, error: e.message })
      }
    }
  } catch (e) {
    log.error('restoreAllFromBridge 失败', { error: e.message })
    return null
  }

  if (restoredCount > 0) {
    log.info('registry 批量恢复完成', { restoredCount, registrySize: registry.size })
  }
  return restoredCount > 0 ? registry : null
}

// 向后兼容别名（gate/prompt/tools 调用的入口）
export const restoreRegistryFromBridge = restoreAllFromBridge
