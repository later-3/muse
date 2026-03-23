/**
 * T39: Workflow MCP Tools — 工作流操作工具
 *
 * 6 个 MCP 工具：
 *   workflow_list            — 列出当前 member 可用的工作流
 *   workflow_init            — 初始化工作流（从文件加载）
 *   workflow_load            — 加载已保存的工作流状态
 *   workflow_status          — 查询当前工作流状态
 *   workflow_transition      — 触发状态流转（仅 agent actor）
 *   workflow_emit_artifact   — 产出声明过的产物
 *   workflow_retry_handoff   — 重试失败的 handoff
 *   workflow_cancel_handoff  — 取消 handoff
 */

import { getRegistry, setRegistry } from '../workflow/registry.mjs'
import { createLogger } from '../logger.mjs'
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { initWorkflow } from '../workflow/loader.mjs'
import { saveInstanceState, loadInstanceState, indexSession, getArtifactDir, restoreRegistryFromBridge, lookupInstance } from '../workflow/bridge.mjs'
import { retryHandoff, cancelHandoff } from '../family/handoff.mjs'

const log = createLogger('wf-tools')

// ── Tool Definitions ──

export const WORKFLOW_TOOLS = [
  {
    name: 'workflow_list',
    description: '列出当前可用的工作流。扫描 member 的 workflows/ 目录，返回所有可用工作流的概要信息。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workflow_init',
    description: '初始化一个工作流。传入工作流 ID（从 workflow_list 获取），创建实例并进入第一个节点。初始化后你应该向用户描述第一个节点的目标、步骤、约束，并询问用户需要的输入。',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: '工作流 ID（如 "code-review-wf"）或工作流定义文件路径',
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'workflow_load',
    description: '加载已保存的工作流状态。从 workflow-state.json 恢复工作流实例。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workflow_status',
    description: '查询当前工作流状态。返回当前节点、目标、步骤、约束、可用 transition、产物状态。进入工作流后，你应该先调用此工具了解当前节点的完整信息。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workflow_transition',
    description: '触发工作流状态流转。只能触发 actor="agent" 的 transition。在得到用户确认后调用此工具推进到下一个节点。',
    inputSchema: {
      type: 'object',
      properties: {
        event: {
          type: 'string',
          description: 'transition 事件名（如 "submit_review", "done"）',
        },
      },
      required: ['event'],
    },
  },
  {
    name: 'workflow_emit_artifact',
    description: '写入当前节点声明的产物文件。只能写入节点 output.artifact 中声明的文件名。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '产物文件名（必须与节点 output.artifact 一致）',
        },
        content: {
          type: 'string',
          description: '产物内容（JSON 字符串）',
        },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'workflow_reset',
    description: '退出当前工作流，清除工作流状态。用于取消正在进行的工作流或重新开始。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workflow_retry_handoff',
    description: '重试失败的工作流交接。如果 handoff 处于 executing（不确定态），需要 force=true。',
    inputSchema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: '是否强制重试 executing 态的 handoff（默认 false）',
        },
      },
    },
  },
  {
    name: 'workflow_cancel_handoff',
    description: '取消当前工作流交接。完整回收 session-index、bindings、registry、handoff 状态。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// ── T39-1.3: Registry 获取（内存优先，session 缺失时增量恢复） ──

/**
 * 确保 registry 可用，且包含 sessionId 对应的实例
 *
 * 策略：
 * 1. registry 为空 → 全量恢复
 * 2. registry 非空但 session 找不到 → 增量恢复（可能有新实例写入 bridge）
 * 3. registry 非空且 session 存在 → 直接返回
 */
async function ensureRegistry(sessionId) {
  let registry = getRegistry()

  // 内存完全为空 → 全量恢复
  if (!registry || registry.size === 0) {
    registry = await restoreRegistryFromBridge()
    return registry
  }

  // 内存有数据，但指定 session 找不到 → 增量恢复
  if (sessionId && !registry.getBySession(sessionId)) {
    await restoreRegistryFromBridge()
    registry = getRegistry()
  }

  return registry
}

/**
 * 获取 session 绑定的状态机
 */
function getSessionSM(registry, sessionId) {
  return registry?.getBySession(sessionId) || null
}

// ── Tool Handlers ──

/**
 * 列出当前 member 可用的工作流
 */
export function handleWorkflowList() {
  const memberDir = process.env.MUSE_MEMBER_DIR
  if (!memberDir) return textResult('MUSE_MEMBER_DIR 未设置')

  // 扫两个目录：member 私有 workflows/ + family 共享 definitions/
  const dirs = [join(memberDir, 'workflows')]

  const home = process.env.MUSE_HOME
  const family = process.env.MUSE_FAMILY
  if (home && family) {
    dirs.push(join(home, family, 'workflow', 'definitions'))
  }

  const workflows = []
  const seen = new Set()

  for (const wfDir of dirs) {
    let files
    try {
      files = readdirSync(wfDir).filter(f => f.endsWith('.json'))
    } catch { continue }

    for (const f of files) {
      try {
        const raw = JSON.parse(readFileSync(join(wfDir, f), 'utf-8'))
        if (seen.has(raw.id)) continue
        seen.add(raw.id)
        workflows.push({
          id: raw.id,
          name: raw.name || raw.id,
          description: raw.description || '',
          participants: (raw.participants || []).map(p => p.role),
          nodes: Object.keys(raw.nodes || {}),
          file: f,
          source: wfDir.includes('definitions') ? 'family' : 'member',
        })
      } catch { /* skip invalid */ }
    }
  }

  log.info('workflow_list', { count: workflows.length })
  return textResult(JSON.stringify({ workflows }, null, 2))
}

/**
 * 初始化工作流（支持 workflow_id 或路径）
 */
export async function handleWorkflowInit(sessionId, args, workspaceRoot) {
  const { workflow_id, workflow_path, task_id } = args || {}
  const idOrPath = workflow_id || workflow_path
  if (!idOrPath) return textResult('缺少 workflow_id 参数')

  // 解析工作流文件路径
  let fullPath
  const memberDir = process.env.MUSE_MEMBER_DIR
  if (memberDir) {
    // 先从 member 的 workflows/ 目录查找
    const wfDir = join(memberDir, 'workflows')
    const byId = join(wfDir, `${idOrPath}.json`)
    const byFile = join(wfDir, idOrPath)
    try {
      readFileSync(byId)
      fullPath = byId
    } catch {
      try {
        readFileSync(byFile)
        fullPath = byFile
      } catch { /* fallback */ }
    }
  }
  if (!fullPath) {
    const root = workspaceRoot || process.env.MUSE_ROOT || process.cwd()
    fullPath = isAbsolute(idOrPath) ? idOrPath : resolve(root, idOrPath)
  }

  const taskId = task_id || `wf-${Date.now()}`

  try {
    const raw = JSON.parse(await readFile(fullPath, 'utf-8'))
    // 调用者角色 = 初始节点的 participant（raw.nodes 是 {id: nodeObj}，raw.initial 是初始节点 id）
    const initialNode = raw.nodes?.[raw.initial] || Object.values(raw.nodes || {})[0]
    const callerRole = initialNode?.participant || raw.participants?.[0]?.role
    const bindings = (raw.participants || []).map(p => ({
      role: p.role,
      // 调用者角色：绑定真实 sessionId；其他角色：占位 session
      sessionId: p.role === callerRole ? sessionId : `${sessionId}_${p.role}`,
      // 非调用者角色标记为占位 — handoff 时需创建真实 session
      ...(p.role !== callerRole ? { placeholder: true } : {}),
    }))

    const { sm, registry } = await initWorkflow({
      workflowPath: fullPath,
      taskId,
      workspaceRoot: workspaceRoot || process.env.MUSE_ROOT || process.cwd(),
      bindings,
    })

    // T39-1.3: 持久化 instance state + session-index
    // smState = 完整状态机状态（current_node/artifacts/history 等）
    saveInstanceState(sm.instanceId, {
      workflowPath: fullPath,
      workflowId: sm.workflowId,
      instanceId: sm.instanceId,
      taskId: sm.taskId,
      bindings,                    // [{role, sessionId}] — 和 Registry.register 一致
      smState: sm.toState(),       // 完整 SM 内部状态，恢复时用 StateMachine.fromState
    })
    // 索引所有绑定的 session
    for (const b of bindings) {
      if (b.sessionId) indexSession(b.sessionId, sm.instanceId)
    }

    const node = sm.getCurrentNode()
    log.info('workflow_init', { sessionId, workflow: raw.id, instance: sm.instanceId })

    return textResult(JSON.stringify({
      success: true,
      workflow: raw.name || raw.id,
      instance: sm.instanceId,
      task_id: taskId,
      current_node: {
        id: node?.id,
        type: node?.type,
        objective: node?.objective,
        participant: node?.participant,
        instructions: node?.instructions || [],
        constraints: node?.constraints || [],
        exit_criteria: node?.exit_criteria || {},
      },
      participants: (raw.participants || []).map(p => p.role),
      bindings,
      status: sm.status,
      hint: '请向用户描述当前节点的目标、步骤和约束，并询问用户需要的输入信息。',
    }, null, 2))
  } catch (e) {
    log.error('workflow_init 失败', { sessionId, error: e.message })
    return textResult(`初始化失败: ${e.message}`)
  }
}

export async function handleWorkflowLoad(sessionId) {
  const registry = await ensureRegistry(sessionId)
  if (registry && registry.size > 0) {
    const sm = getSessionSM(registry, sessionId)
    if (sm) {
      const node = sm.getCurrentNode()
      return textResult(JSON.stringify({
        already_loaded: true,
        workflow: sm.workflowId,
        instance: sm.instanceId,
        current_node: node?.id,
      }, null, 2))
    }
  }

  // T39-1.3: 工作流实例状态不再从单文件加载
  return textResult('当前 session 未绑定工作流。请先用 workflow_init 初始化。')
}

export async function handleWorkflowStatus(sessionId) {
  const registry = await ensureRegistry(sessionId)
  if (!registry) return textResult('工作流引擎未初始化')

  const sm = getSessionSM(registry, sessionId)
  if (!sm) return textResult('当前 session 未绑定工作流')

  const node = sm.getCurrentNode()
  const status = registry.getParticipantStatus(sessionId)
  const role = registry.getRoleBySession(sessionId)
  const exitCheck = sm.checkExitCriteria()

  const info = {
    workflow: sm.workflowId,
    instance: sm.instanceId,
    task: sm.taskId,
    status: sm.status,
    current_node: {
      id: node?.id,
      type: node?.type,
      objective: node?.objective,
      participant: node?.participant,
    },
    your_role: role,
    participant_status: status,
    exit_criteria: exitCheck,
    available_transitions: node?.transitions
      ? Object.entries(node.transitions)
          .filter(([_, t]) => t.actor === 'agent')
          .map(([event, t]) => ({ event, target: t.target }))
      : [],
    artifacts: Object.keys(sm.toState().artifacts),
  }

  log.info('workflow_status', { sessionId, node: node?.id })
  return textResult(JSON.stringify(info, null, 2))
}

export async function handleWorkflowTransition(sessionId, args) {
  const registry = await ensureRegistry(sessionId)
  if (!registry) return textResult('工作流引擎未初始化')

  const sm = getSessionSM(registry, sessionId)
  if (!sm) return textResult('当前 session 未绑定工作流')

  const { event } = args || {}
  if (!event) return textResult('缺少 event 参数')

  try {
    // ★ Post-check：transition 前验证当前节点的 output artifact 存在（仅生产环境）
    const currentNode = sm.getCurrentNode()
    const outputArt = currentNode?.output?.artifact
    if (outputArt && currentNode.output.required && process.env.MUSE_MEMBER) {
      const { existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const home = process.env.MUSE_HOME
      const family = process.env.MUSE_FAMILY
      if (home && family) {
        const artPath = join(home, family, 'workflow', 'instances', sm.instanceId, 'artifacts', outputArt)
        if (!existsSync(artPath)) {
          return textResult(`⛔ 无法流转：产出物 "${outputArt}" 不存在。\n路径: ${artPath}\n请先用 workflow_emit_artifact 写入后再调用 workflow_transition。`)
        }
      }
    }

    const currentRole = registry.getRoleBySession(sessionId)
    const result = sm.transition(event, 'agent')
    log.info('workflow_transition', { sessionId, ...result })

    // T39-1.3: transition 后持久化 smState
    const state = loadInstanceState(sm.instanceId)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(sm.instanceId, state)
    }

    // T39-1.4: 检测跨 participant handoff
    // placeholder session（workflow_init 预绑定） → 需要 handoff 创建真实 session
    // 真实 session（E2E 或已完成 handoff） → 本地多角色，跳过 handoff
    const newNode = sm.getCurrentNode()
    const targetRole = newNode?.participant
    const needsHandoff = targetRole
      && targetRole !== currentRole
      && registry.isPlaceholder(sm.instanceId, targetRole)

    if (needsHandoff) {
      log.info('workflow_transition → handoff 检测', {
        sessionId, from: result.from, to: result.to,
        currentRole, targetRole,
      })

      try {
        const handoffResult = await triggerHandoff(sm, newNode, currentRole)
        return textResult(JSON.stringify({
          success: true,
          from: result.from,
          to: result.to,
          event: result.event,
          new_status: sm.status,
          handoff: {
            triggered: true,
            target: newNode.participant,
            ...handoffResult,
          },
        }, null, 2))
      } catch (handoffErr) {
        // ★ handoff 触发失败 — 写入 failed 状态，让 retry/cancel 有锚点
        const failState = loadInstanceState(sm.instanceId) || {}
        failState.handoff = {
          status: 'failed',
          source: currentRole,
          target: newNode.participant,
          targetSession: null,
          lastError: handoffErr.message,
          errorAt: new Date().toISOString(),
          createdAt: failState.handoff?.createdAt || new Date().toISOString(),
        }
        saveInstanceState(sm.instanceId, failState)
        log.warn('handoff 触发失败，已写 failed', { sessionId, error: handoffErr.message })

        return textResult(JSON.stringify({
          success: false,
          handoff_failed: true,
          from: result.from,
          to: result.to,
          event: result.event,
          new_status: sm.status,
          handoff: {
            status: 'failed',
            target: newNode.participant,
            error: handoffErr.message,
            recoverable: true,
            hint: '使用 workflow_retry_handoff 重试或 workflow_cancel_handoff 取消',
          },
        }, null, 2))
      }
    }

    // 工作流到达终点 → 通知用户 + 归档
    if (sm.status === 'completed') {
      import('../workflow/notify.mjs').then(m =>
        m.notifyWorkflowCompleted({
          instanceId: sm.instanceId,
          workflowId: sm.workflowId,
          history: sm.toState().history,
        })
      ).catch(() => {})

      // 异步归档到 archive/{YYYY-MM}/
      import('../workflow/bridge.mjs').then(m =>
        m.archiveInstance(sm.instanceId)
      ).catch(() => {})
    }

    return textResult(JSON.stringify({
      success: true,
      from: result.from,
      to: result.to,
      event: result.event,
      new_status: sm.status,
    }, null, 2))
  } catch (e) {
    log.warn('workflow_transition 失败', { sessionId, event, error: e.message })
    return textResult(`流转失败: ${e.message}`)
  }
}

/**
 * 触发跨 muse handoff（transition 后调用）
 */
async function triggerHandoff(sm, targetNode, sourceRole) {
  const { findByRole } = await import('../family/registry.mjs')
  const { MemberClient } = await import('../family/member-client.mjs')
  const { executeHandoff, ensureNodeCompletion } = await import('../family/handoff.mjs')
  const { loadInstanceState } = await import('../workflow/bridge.mjs')

  const target = targetNode.participant
  const member = findByRole(target)
  if (!member) {
    throw new Error(`目标角色 "${target}" 不在线`)
  }

  const client = new MemberClient(member.engine, process.env.MUSE_ROOT)
  await executeHandoff({
    sm,
    nextNode: targetNode,
    instanceId: sm.instanceId,
    sourceRole,
    client,
  })

  // 安全网：确保 target 完成节点任务（仅生产环境）
  // 测试环境 mock server 会在 assertion 后关闭，poll 定时器会导致进程挂起
  if (process.env.MUSE_MEMBER) {
    const state = loadInstanceState(sm.instanceId)
    const targetSession = state?.handoff?.targetSession
    if (targetSession) {
      ensureNodeCompletion(client, targetSession, sm.instanceId, targetNode)
        .catch(err => log.warn('ensureNodeCompletion 异常', { error: err.message }))
    }
  }

  return { status: 'executing', targetMember: member.name }
}

export async function handleWorkflowEmitArtifact(sessionId, args, artifactDir) {
  const registry = await ensureRegistry(sessionId)
  if (!registry) return textResult('工作流引擎未初始化')

  const sm = getSessionSM(registry, sessionId)
  if (!sm) return textResult('当前 session 未绑定工作流')

  const { name, content } = args || {}
  if (!name || !content) return textResult('缺少 name 或 content 参数')

  const node = sm.getCurrentNode()
  if (!node?.output?.artifact) {
    return textResult(`当前节点 "${node?.id}" 未声明产物输出`)
  }
  if (node.output.artifact !== name) {
    return textResult(`产物名 "${name}" 与节点声明的 "${node.output.artifact}" 不匹配`)
  }

  // M8: artifact 路径迁移到 family 共享目录
  const dir = artifactDir || getArtifactDir(sm.instanceId)
  if (!dir) return textResult('无法确定 artifact 目录（MUSE_HOME/MUSE_FAMILY 未设置）')
  const filePath = join(dir, name)
  try {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
    sm.registerArtifact(name, filePath)
    log.info('artifact 写入', { sessionId, name, path: filePath })
    return textResult(JSON.stringify({
      success: true,
      artifact: name,
      path: filePath,
    }, null, 2))
  } catch (e) {
    return textResult(`写入失败: ${e.message}`)
  }
}

export async function handleWorkflowReset() {
  const registry = getRegistry()
  const had = registry && registry.size > 0

  // 清除全局 registry
  setRegistry(null)

  // T39-1.3: per-instance 状态不删除（保留历史），只清 registry 引用

  log.info('workflow_reset', { had })
  return textResult(JSON.stringify({
    success: true,
    message: had ? '工作流已退出，状态已清除。' : '当前没有运行中的工作流。',
  }, null, 2))
}

// ── T39-1.4: Handoff MCP Handlers ──

export async function handleWorkflowRetryHandoff(sessionId, args) {
  const registry = await ensureRegistry(sessionId)
  if (!registry) return textResult('工作流引擎未初始化')

  const sm = getSessionSM(registry, sessionId)
  if (!sm) return textResult('当前 session 未绑定工作流')

  try {
    const cleanupResult = await retryHandoff(sm.instanceId, null, { force: args?.force })

    // 非 retryReady → 直接返回（已 delivered / AMBIGUOUS_STATE）
    if (!cleanupResult.retryReady) {
      log.info('workflow_retry_handoff', { sessionId, ...cleanupResult })
      return textResult(JSON.stringify(cleanupResult, null, 2))
    }

    // retryReady → 重新执行 3-step handoff
    const targetNode = sm.getCurrentNode()
    if (!targetNode) return textResult('当前节点不存在，无法重试')

    try {
      const handoffResult = await triggerHandoff(sm, targetNode, registry.getRoleBySession(sessionId))
      log.info('workflow_retry_handoff 重试完成', { sessionId, target: cleanupResult.target, ...handoffResult })
      return textResult(JSON.stringify({
        retried: true,
        target: cleanupResult.target,
        ...handoffResult,
      }, null, 2))
    } catch (retryErr) {
      // ★ triggerHandoff 失败 — 回写 failed，不留在 pending+targetSession=null
      const failState = loadInstanceState(sm.instanceId)
      if (failState?.handoff) {
        failState.handoff.status = 'failed'
        failState.handoff.lastError = retryErr.message
        failState.handoff.errorAt = new Date().toISOString()
        saveInstanceState(sm.instanceId, failState)
      }
      log.warn('workflow_retry_handoff 失败，已回写 failed', { sessionId, error: retryErr.message })
      return textResult(`重试失败: ${retryErr.message}`)
    }
  } catch (e) {
    log.warn('workflow_retry_handoff 失败', { sessionId, error: e.message })
    return textResult(`重试失败: ${e.message}`)
  }
}

export async function handleWorkflowCancelHandoff(sessionId) {
  const registry = await ensureRegistry(sessionId)
  if (!registry) return textResult('工作流引擎未初始化')

  const sm = getSessionSM(registry, sessionId)
  if (!sm) return textResult('当前 session 未绑定工作流')

  try {
    const result = cancelHandoff(sm.instanceId)
    log.info('workflow_cancel_handoff', { sessionId, ...result })
    return textResult(JSON.stringify(result, null, 2))
  } catch (e) {
    log.warn('workflow_cancel_handoff 失败', { sessionId, error: e.message })
    return textResult(`取消失败: ${e.message}`)
  }
}

function textResult(text) {
  return { content: [{ type: 'text', text }] }
}
