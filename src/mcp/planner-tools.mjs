/**
 * T42-4: Planner MCP Tools — Planner 专属工具集
 *
 * 6 个 MCP 工具：
 *   workflow_create          — 创建 driver=planner 的工作流实例
 *   workflow_admin_transition — admin 身份推进（含 user gate 保护）
 *   workflow_inspect         — 全局视图（所有节点 + history）
 *   workflow_rollback        — 回退到已访问过的节点
 *   handoff_to_member        — 向指定成员发送任务指令
 *   read_artifact            — 读取工作流产出物
 */

import { getRegistry } from '../workflow/registry.mjs'
import { createLogger } from '../logger.mjs'
import { readFile } from 'node:fs/promises'
import { join, resolve, isAbsolute } from 'node:path'
import { initWorkflow } from '../workflow/loader.mjs'
import { saveInstanceState, loadInstanceState, getArtifactDir, indexSession } from '../workflow/bridge.mjs'
import { executeHandoff } from '../family/handoff.mjs'
import { MemberClient } from '../family/member-client.mjs'
import { parseWorkflow } from '../workflow/definition.mjs'
import { StateMachine } from '../workflow/state-machine.mjs'

const log = createLogger('planner-tools')

// ── Tool Definitions ──

export const PLANNER_TOOLS = [
  {
    name: 'workflow_create',
    description: '创建一个 Planner 驱动的工作流实例。传入工作流定义 JSON，Planner 统一管理实例生命周期。',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: '工作流 ID 或工作流定义文件路径',
        },
        task_id: {
          type: 'string',
          description: '任务 ID（可选，默认自动生成）',
        },
      },
      required: ['workflow_id'],
    },
  },
  {
    name: 'workflow_admin_transition',
    description: '以 admin 身份推进工作流。Planner 专用。如果越过 actor=user 的 transition，必须提供 on_behalf_of 和 evidence。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID',
        },
        event: {
          type: 'string',
          description: 'transition 事件名',
        },
        reason: {
          type: 'string',
          description: '推进原因（写入 history.meta）',
        },
        on_behalf_of: {
          type: 'string',
          description: "代表谁操作（'planner' 或 'user'）。越过 actor=user 的 transition 时必须为 'user'。",
        },
        evidence: {
          type: 'string',
          description: '用户原始确认消息（on_behalf_of=user 时必填）',
        },
      },
      required: ['instance_id', 'event'],
    },
  },
  {
    name: 'workflow_inspect',
    description: '查看工作流全貌。返回所有节点状态、history、产物清单。Planner 用于全局监控。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID',
        },
      },
      required: ['instance_id'],
    },
  },
  {
    name: 'workflow_rollback',
    description: '将工作流回退到指定节点。只能回退到已经访问过的节点。回退原因写入 history。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID',
        },
        target_node: {
          type: 'string',
          description: '目标节点 ID（必须是已访问过的节点）',
        },
        reason: {
          type: 'string',
          description: '回退原因',
        },
      },
      required: ['instance_id', 'target_node', 'reason'],
    },
  },
  {
    name: 'handoff_to_member',
    description: '向指定 Muse 成员分派当前节点的工作任务。Planner 将节点目标、步骤、约束组装成 prompt 发送给目标成员。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID',
        },
        role: {
          type: 'string',
          description: "目标角色（如 'pua', 'coder', 'arch'）",
        },
        instructions: {
          type: 'string',
          description: 'Planner 附加指令（本期保留字段但不生效，后续版本支持注入 extraPrompt）',
        },
      },
      required: ['instance_id', 'role'],
    },
  },
  {
    name: 'read_artifact',
    description: '读取工作流产出物文件内容。用于 Planner 检查执行者的产出质量。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID',
        },
        name: {
          type: 'string',
          description: '产出物文件名',
        },
      },
      required: ['instance_id', 'name'],
    },
  },
]

// ── Helper ──

function textResult(text) {
  return { content: [{ type: 'text', text }] }
}

// ── Handlers ──

export async function handleWorkflowCreate(sessionId, args) {
  const { workflow_id, task_id } = args || {}
  if (!workflow_id) return textResult('缺少 workflow_id 参数')

  try {
    // 1. 解析工作流路径（对齐 handleWorkflowInit 策略）
    let workflowPath = workflow_id
    if (!isAbsolute(workflowPath)) {
      // 先从 workflow/definitions/ 目录查找
      const home = process.env.MUSE_HOME
      const family = process.env.MUSE_FAMILY
      if (home && family) {
        const defDir = join(home, family, 'workflow', 'definitions')
        const byId = join(defDir, `${workflow_id}.json`)
        const byFile = join(defDir, workflow_id)
        try {
          const { readFileSync } = await import('node:fs')
          readFileSync(byId)
          workflowPath = byId
        } catch {
          try {
            const { readFileSync } = await import('node:fs')
            readFileSync(byFile)
            workflowPath = byFile
          } catch { /* fallback */ }
        }
      }
      // fallback：相对于 MUSE_ROOT 解析
      if (!isAbsolute(workflowPath)) {
        const root = process.env.MUSE_ROOT || process.cwd()
        workflowPath = resolve(root, workflowPath)
      }
    }

    // 2. 加载工作流定义
    const raw = JSON.parse(await readFile(workflowPath, 'utf-8'))

    // 3. 校验 driver=planner
    if (raw.driver !== 'planner') {
      return textResult('⛔ 此工作流不是 planner 驱动（driver !== "planner"）')
    }

    // 4. 创建 bindings — 所有 participant 先建 placeholder
    const bindings = (raw.participants || []).map(p => ({
      role: p.role,
      sessionId: `${sessionId}_${p.role}`,
      placeholder: true,
    }))

    // 5. 调用 initWorkflow
    const { sm } = await initWorkflow({
      workflowPath,
      taskId: task_id || `planner-${Date.now()}`,
      workspaceRoot: process.env.MUSE_ROOT || process.cwd(),
      bindings,
    })

    // 6. 持久化
    saveInstanceState(sm.instanceId, {
      workflowPath,
      workflowId: sm.workflowId,
      instanceId: sm.instanceId,
      taskId: sm.taskId,
      bindings,
      smState: sm.toState(),
    })

    // 7. 返回
    return textResult(JSON.stringify({
      success: true,
      instance_id: sm.instanceId,
      workflow: raw.name || raw.id,
      driver: 'planner',
      current_node: sm.getCurrentNode()?.id,
      participants: (raw.participants || []).map(p => p.role),
      hint: '实例已创建。用 handoff_to_member 向执行者分派任务。',
    }, null, 2))
  } catch (e) {
    log.error('workflow_create 失败', { error: e.message })
    return textResult(`创建失败: ${e.message}`)
  }
}

export async function handleWorkflowAdminTransition(sessionId, args) {
  const { instance_id, event, reason, on_behalf_of, evidence } = args || {}
  if (!instance_id || !event) return textResult('缺少必要参数')

  // 1. 获取实例
  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  // 2. User Gate 保护
  const currentNode = sm.getCurrentNode()
  const transitionDef = currentNode?.transitions?.[event]
  if (!transitionDef) return textResult(`事件 "${event}" 不存在`)

  if (transitionDef.actor === 'user') {
    // 必须提供 on_behalf_of=user + evidence
    if (on_behalf_of !== 'user') {
      return textResult('⛔ 此 transition 的 actor 是 user，必须 on_behalf_of="user"')
    }
    if (!evidence || evidence.trim().length === 0) {
      return textResult('⛔ 越过 user gate 必须提供 evidence（用户原始确认消息）')
    }
  }

  // 3. 执行 transition（admin 身份 + meta）
  const meta = {
    on_behalf_of: on_behalf_of || 'planner',
    reason: reason || '',
    ...(evidence ? { evidence } : {}),
  }

  try {
    const result = sm.transition(event, 'admin', meta)

    // 4. 持久化
    const state = loadInstanceState(instance_id)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(instance_id, state)
    }

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      meta,
    }, null, 2))
  } catch (e) {
    return textResult(`transition 失败: ${e.message}`)
  }
}

export async function handleWorkflowInspect(sessionId, args) {
  const { instance_id } = args || {}
  if (!instance_id) return textResult('缺少 instance_id')

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  const state = sm.toState()

  return textResult(JSON.stringify({
    workflow: sm.workflowId,
    instance: sm.instanceId,
    task: sm.taskId,
    driver: sm.definition?.driver || 'self',
    status: sm.status,
    current_node: state.current_node,
    nodes: sm.definition.listNodes().map(node => ({
      id: node.id,
      type: node.type,
      participant: node.participant,
      objective: node.objective,
      is_current: node.id === state.current_node,
      visited: state.history.some(h => h.to === node.id),
    })),
    history: state.history,
    artifacts: state.artifacts,
  }, null, 2))
}

export async function handleWorkflowRollback(sessionId, args) {
  const { instance_id, target_node, reason } = args || {}
  if (!instance_id || !target_node || !reason) {
    return textResult('缺少必要参数')
  }

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  try {
    const result = sm.rollback(target_node, 'admin', reason, {
      on_behalf_of: 'planner',
    })

    // 持久化
    const state = loadInstanceState(instance_id)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(instance_id, state)
    }

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      reason,
    }, null, 2))
  } catch (e) {
    return textResult(`rollback 失败: ${e.message}`)
  }
}

export async function handleHandoffToMember(sessionId, args) {
  const { instance_id, role, instructions } = args || {}
  if (!instance_id || !role) return textResult('缺少必要参数')

  // 记录 instructions 参数（本期保留但不生效）
  if (instructions) {
    log.info('handoff_to_member 收到 instructions（本期保留不生效）', { instance_id, role, instructions })
  }

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  const currentNode = sm.getCurrentNode()
  if (!currentNode) return textResult('工作流已结束')

  // 验证 role 是否是当前节点的 participant
  if (currentNode.participant !== role) {
    return textResult(`当前节点 "${currentNode.id}" 的参与者是 "${currentNode.participant}"，不是 "${role}"`)
  }

  try {
    // 1. 从 family registry 查找目标成员（对齐 triggerHandoff 模式）
    const { findByRole } = await import('../family/registry.mjs')
    const member = findByRole(role)
    if (!member) {
      return textResult(`角色 "${role}" 不在线（未在 family registry 中注册）`)
    }
    const client = new MemberClient(member.engine, process.env.MUSE_ROOT)

    // 2. 调用 executeHandoff（3-step ACK 协议）
    await executeHandoff({
      sm,
      nextNode: currentNode,
      instanceId: instance_id,
      sourceRole: 'planner',
      client,
    })

    return textResult(JSON.stringify({
      success: true,
      target_role: role,
      target_member: member.name,
      node: currentNode.id,
      handoff_status: 'triggered',
      hint: '已向成员发送任务。用 workflow_inspect 跟踪进度。',
    }, null, 2))
  } catch (e) {
    return textResult(`handoff 失败: ${e.message}`)
  }
}

export async function handleReadArtifact(sessionId, args) {
  const { instance_id, name } = args || {}
  if (!instance_id || !name) return textResult('缺少必要参数')

  // 路径安全检查：不允许 ../ 和绝对路径
  if (name.includes('..') || name.startsWith('/')) {
    return textResult('⛔ 非法文件名')
  }

  const artDir = getArtifactDir(instance_id)
  if (!artDir) return textResult('无法获取 artifact 目录')

  const filePath = join(artDir, name)
  try {
    const content = await readFile(filePath, 'utf-8')
    return textResult(JSON.stringify({
      name,
      instance_id,
      content,
      size: content.length,
    }, null, 2))
  } catch (e) {
    return textResult(`读取失败: ${e.message}`)
  }
}
