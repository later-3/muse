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
import { initWorkflow, initWorkflowFromJSON } from '../workflow/loader.mjs'
import { saveInstanceState, loadInstanceState, getArtifactDir, indexSession, appendTrace, archiveInstance, saveInstanceDefinition, lookupInstance } from '../workflow/bridge.mjs'
import { executeHandoff } from '../family/handoff.mjs'
import { MemberClient } from '../family/member-client.mjs'
import { parseWorkflow } from '../workflow/definition.mjs'
import { StateMachine } from '../workflow/state-machine.mjs'

const log = createLogger('planner-tools')

// ── Tool Definitions ──

export const PLANNER_TOOLS = [
  {
    name: 'workflow_status',
    description: '查看当前工作流状态。不提供 instance_id 时，自动查询当前 session 关联的工作流。用于不确定当前状态时主动查询。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID（可选，不提供则查询当前 session 关联的实例）'
        }
      }
    }
  },
  {
    name: 'workflow_create',
    description: '创建 driver=planner 的工作流实例。AI 生成工作流定义 JSON，或使用预定义的工作流。',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: '工作流 ID 或工作流定义文件路径（与 workflow_json 二选一）',
        },
        workflow_json: {
          type: 'string',
          description: '工作流定义 JSON 字符串（与 workflow_id 二选一）。Planner 可动态生成工作流定义传入此参数。',
        },
        task_id: {
          type: 'string',
          description: '任务 ID（可选，默认自动生成）',
        },
      },
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

  {
    name: 'workflow_update',
    description: '修改工作流设计。用于 Later 审核工作流后提出修改意见时。只能修改尚未开始执行的工作流。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID'
        },
        updates: {
          type: 'object',
          description: '要修改的部分',
          properties: {
            name: { type: 'string', description: '工作流名称' },
            description: { type: 'string', description: '工作流描述' },
            nodes: { type: 'object', description: '节点定义' },
            participants: { type: 'array', description: '参与者列表' },
            initial: { type: 'string', description: '初始节点' }
          }
        },
        reason: {
          type: 'string',
          description: '修改原因（Later 的反馈）'
        }
      },
      required: ['instance_id', 'updates']
    }
  },
]

// ── Helper ──

function textResult(text) {
  return { content: [{ type: 'text', text }] }
}

// ── Handlers ──

export async function handleWorkflowCreate(sessionId, args) {
  const { workflow_id, workflow_json, task_id } = args || {}
  if (!workflow_id && !workflow_json) return textResult('缺少 workflow_id 或 workflow_json 参数（二选一）')
  const t0 = Date.now()

  try {
    let raw
    let workflowPath = null

    if (workflow_json) {
      // ── 路径 A: Planner 动态传入 JSON 字符串 ──
      try {
        raw = typeof workflow_json === 'string' ? JSON.parse(workflow_json) : workflow_json
      } catch (parseErr) {
        return textResult(`⛔ workflow_json 不是合法 JSON: ${parseErr.message}`)
      }
      log.info('workflow_create 使用动态 JSON', { id: raw.id })
    } else {
      // ── 路径 B: 从文件路径加载（保留现有逻辑）──
      workflowPath = workflow_id
      if (!isAbsolute(workflowPath)) {
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
        if (!isAbsolute(workflowPath)) {
          const root = process.env.MUSE_ROOT || process.cwd()
          workflowPath = resolve(root, workflowPath)
        }
      }
      raw = JSON.parse(await readFile(workflowPath, 'utf-8'))
    }

    // 校验 driver=planner
    if (raw.driver !== 'planner') {
      return textResult('⛔ 此工作流不是 planner 驱动（driver !== "planner"）')
    }

    // 4. 创建 bindings — 所有 participant 先建 placeholder
    const bindings = (raw.participants || []).map(p => ({
      role: p.role,
      sessionId: `${sessionId}_${p.role}`,
      placeholder: true,
    }))

    // 5. 调用 initWorkflow（动态 JSON 用 initWorkflowFromJSON，文件用 initWorkflow）
    const taskId = task_id || `planner-${Date.now()}`
    const workspaceRoot = process.env.MUSE_ROOT || process.cwd()
    let sm
    if (workflow_json) {
      const result = initWorkflowFromJSON({ definition: raw, taskId, workspaceRoot, bindings })
      sm = result.sm
    } else {
      const result = await initWorkflow({ workflowPath, taskId, workspaceRoot, bindings })
      sm = result.sm
    }

    // 6. 持久化（plannerSession 记录 Planner 的 session，供 notify_planner 回调用）
    saveInstanceState(sm.instanceId, {
      workflowPath: workflowPath || `dynamic:${raw.id}`,
      workflowId: sm.workflowId,
      instanceId: sm.instanceId,
      taskId: sm.taskId,
      plannerSession: sessionId,
      bindings,
      smState: sm.toState(),
    })

    // 6.5. 保存动态工作流定义（如果是 AI 生成的）
    if (workflow_json) {
      saveInstanceDefinition(sm.instanceId, raw)
    }

    // 6.6. 自动绑定 session → instance
    indexSession(sessionId, sm.instanceId)
    log.info('session 已绑定到工作流实例', { sessionId: sessionId.slice(-8), instanceId: sm.instanceId })

    // 7. trace
    appendTrace(sm.instanceId, {
      tool: 'workflow_create',
      args: {
        workflow_id: raw.id,
        workflow_json_length: workflow_json?.length || null,
        workflow_path: workflowPath,
        task_id: taskId,
        driver: raw.driver,
        participants: (raw.participants || []).map(p => p.role),
        nodes: Object.keys(raw.nodes || {})
      },
      result: 'success',
      instanceId: sm.instanceId,
      initialNode: sm.getCurrentNode()?.id,
      elapsedMs: Date.now() - t0,
    })

    // 8. 返回
    const participantList = (raw.participants || []).map(p => p.role).join(', ')
    const nodeList = Object.keys(raw.nodes || {}).join(' → ')

    return textResult(JSON.stringify({
      success: true,
      instance_id: sm.instanceId,
      status: 'awaiting_review',
      workflow: raw.name || raw.id,
      driver: 'planner',
      current_node: sm.getCurrentNode()?.id,
      participants: (raw.participants || []).map(p => p.role),
      nodes: Object.keys(raw.nodes || {}),

      // Agent First: 明确下一步行动
      next_steps: {
        now: '向 Later 展示工作流设计，等待审核确认',
        on_confirm: `handoff_to_member(instance_id="${sm.instanceId}", role="${raw.participants?.[0]?.role || 'xxx'}")`,
        on_revise: `询问具体问题 → workflow_update(instance_id="${sm.instanceId}", updates={...})`,
        on_cancel: `workflow_admin_transition(instance_id="${sm.instanceId}", event="cancel")`
      },

      hint: `✅ 工作流已创建！

📍 实例 ID: ${sm.instanceId}
📊 状态: 等待用户审核

【工作流概览】
- 名称: ${raw.name || raw.id}
- 参与者: ${participantList}
- 节点流程: ${nodeList}

【下一步】
1. 向 Later 展示上述工作流设计
2. 询问："请确认工作流设计，确认后开始执行"
3. 等待 Later 回复：
   - 说"执行/确认" → 调用 ${`handoff_to_member(instance_id="${sm.instanceId}", ...)`}
   - 说"有问题" → 询问具体问题 → 调用 workflow_update
   - 说"取消" → 调用 workflow_admin_transition(cancel)

⚠️ 记住实例 ID "${sm.instanceId}"，后续操作都用这个 ID
⛔ Later 说"执行"时，不要重新创建工作流，用已有的 instance_id`,
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

  const t0 = Date.now()
  try {
    const result = sm.transition(event, 'admin', meta)

    // 4. 持久化
    const state = loadInstanceState(instance_id)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(instance_id, state)
    }

    // 5. trace
    appendTrace(instance_id, {
      tool: 'workflow_admin_transition',
      args: {
        event,
        on_behalf_of,
        evidence_length: evidence?.length || 0,
        reason_length: reason?.length || 0
      },
      result: 'success',
      from: result.from,
      to: result.to,
      newStatus: sm.status,
      elapsedMs: Date.now() - t0,
    })

    // 6. 归档：工作流完成时自动归档
    if (sm.status === 'completed') {
      try {
        archiveInstance(instance_id)
        log.info('工作流已完成并归档', { instance_id })
      } catch (archiveErr) {
        log.warn('归档失败（不影响 transition）', { instance_id, error: archiveErr.message })
      }
    }

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      meta,
    }, null, 2))
  } catch (e) {
    appendTrace(instance_id, {
      tool: 'workflow_admin_transition',
      args: {
        event,
        on_behalf_of,
        evidence_length: evidence?.length || 0,
        reason_length: reason?.length || 0
      },
      result: 'error',
      error: e.message,
      elapsedMs: Date.now() - t0,
    })
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

  const t0 = Date.now()
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

    appendTrace(instance_id, {
      tool: 'workflow_rollback',
      args: {
        target_node,
        reason_length: reason?.length || 0
      },
      result: 'success',
      from: result.from,
      to: result.to,
      elapsedMs: Date.now() - t0,
    })

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      reason,
    }, null, 2))
  } catch (e) {
    appendTrace(instance_id, {
      tool: 'workflow_rollback',
      args: { target_node, reason_length: reason?.length || 0 },
      result: 'error',
      error: e.message,
      elapsedMs: Date.now() - t0,
    })
    return textResult(`rollback 失败: ${e.message}`)
  }
}

export async function handleWorkflowUpdate(sessionId, args) {
  const { instance_id, updates, reason } = args || {}
  if (!instance_id || !updates) {
    return textResult('缺少必要参数: instance_id, updates')
  }
  
  // 1. 加载实例
  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) {
    return textResult(`实例 ${instance_id} 不存在`)
  }
  
  // 2. 检查状态（只能修改尚未执行的工作流）
  if (sm.status !== 'awaiting_review' && sm.status !== 'created') {
    return textResult(`⛔ 工作流状态为 "${sm.status}"，只能修改 "awaiting_review" 状态的工作流`)
  }
  
  // 3. 应用更新
  const definition = sm.definition
  const newDefinition = {
    ...definition,
    ...updates,
    nodes: updates.nodes ? { ...definition.nodes, ...updates.nodes } : definition.nodes,
    participants: updates.participants || definition.participants,
    initial: updates.initial || definition.initial
  }
  
  // 4. 重新创建 StateMachine
  const newSm = new StateMachine(newDefinition, {
    instanceId: sm.instanceId,
    taskId: sm.taskId,
    driver: 'planner'
  })
  
  // 5. 更新注册表和持久化
  registry.register(newSm)
  
  const state = loadInstanceState(instance_id)
  if (state) {
    state.workflowPath = `dynamic:${newDefinition.id}`
    state.smState = newSm.toState()
    saveInstanceState(instance_id, state)
  }
  
  // 6. 更新 definition.json
  saveInstanceDefinition(instance_id, newDefinition)
  
  // 7. trace
  appendTrace(instance_id, {
    tool: 'workflow_update',
    args: {
      reason: reason?.slice(0, 200),
      updated_fields: Object.keys(updates)
    },
    result: 'success',
    elapsedMs: 0
  })
  
  return textResult(JSON.stringify({
    success: true,
    instance_id,
    message: '工作流设计已更新',
    updated_fields: Object.keys(updates),
    reason,
    hint: `✅ 工作流已更新，请重新向 Later 展示修改后的设计，等待确认`
  }, null, 2))
}

export async function handleWorkflowStatus(sessionId, args) {
  const { instance_id } = args || {}
  
  // 1. 确定要查询的 instance_id
  let targetInstanceId = instance_id
  
  if (!targetInstanceId) {
    // 从 session-index 查找当前 session 关联的实例
    targetInstanceId = lookupInstance(sessionId)
    if (!targetInstanceId) {
      return textResult(JSON.stringify({
        status: 'no_active_workflow',
        message: '当前 session 没有关联的工作流实例',
        suggestion: '如果需要创建工作流，请描述任务目标'
      }, null, 2))
    }
  }
  
  // 2. 获取实例状态
  const registry = getRegistry()
  const sm = registry?.getInstance(targetInstanceId)
  
  if (!sm) {
    // 尝试从 state.json 加载
    const state = loadInstanceState(targetInstanceId)
    if (!state) {
      return textResult(`工作流实例 ${targetInstanceId} 不存在`)
    }
    
    // 返回持久化状态
    return textResult(JSON.stringify({
      instance_id: targetInstanceId,
      status: state.smState?.status || 'unknown',
      current_node: state.smState?.current_node,
      workflow_id: state.workflowId,
      note: '实例不在内存中，从持久化状态加载'
    }, null, 2))
  }
  
  // 3. 返回完整状态
  const state = sm.toState()
  const currentNode = sm.getCurrentNode()
  
  // 判断当前应该做什么
  let yourRole = ''
  let decisionHelp = {}
  
  if (state.status === 'awaiting_review' || !state.handoff) {
    yourRole = '等待 Later 审核工作流设计，确认后调用 handoff_to_member'
    decisionHelp = {
      '执行/开始/确认': `handoff_to_member(instance_id="${targetInstanceId}", role="${currentNode?.participant || 'xxx'}")`,
      '有问题/修改': '询问具体问题，然后调用 workflow_update',
      '取消': `workflow_admin_transition(instance_id="${targetInstanceId}", event="cancel")`
    }
  } else if (state.handoff?.status === 'executing' || state.handoff?.status === 'delivered') {
    yourRole = '等待执行者完成任务并汇报'
    decisionHelp = {
      '收到执行者汇报': '用 read_artifact 检查产出，向 Later 展示',
      'Later 说通过': `workflow_admin_transition(instance_id="${targetInstanceId}", event="done")`,
      'Later 说有问题': `workflow_rollback → 重新 handoff_to_member`
    }
  }
  
  return textResult(JSON.stringify({
    instance_id: targetInstanceId,
    workflow_id: sm.workflowId,
    status: state.status,
    current_node: state.current_node,
    current_participant: currentNode?.participant,
    
    // Agent First: 告诉模型当前应该做什么
    your_role: yourRole,
    decision_help: decisionHelp,
    
    // 节点进度
    nodes: sm.definition.listNodes().map(node => ({
      id: node.id,
      type: node.type,
      participant: node.participant,
      objective: node.objective?.slice(0, 50) + '...',
      status: state.current_node === node.id ? 'current' :
              state.history.some(h => h.to === node.id) ? 'completed' : 'pending'
    })),
    
    history: state.history,
    bindings: state.bindings
  }, null, 2))
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

  const t0 = Date.now()
  try {
    // 1. 从 family registry 查找目标成员（对齐 triggerHandoff 模式）
    const { findByRole } = await import('../family/registry.mjs')
    const member = findByRole(role)
    if (!member) {
      return textResult(`角色 "${role}" 不在线（未在 family registry 中注册）`)
    }
    const targetDir = member.directory || process.env.MUSE_ROOT
    console.log('[DEBUG] MemberClient init:', { member, targetDir, MUSE_ROOT: process.env.MUSE_ROOT })
    const client = new MemberClient(member.engine, targetDir)

    // 2. 调用 executeHandoff（3-step ACK 协议）
    await executeHandoff({
      sm,
      nextNode: currentNode,
      instanceId: instance_id,
      sourceRole: 'planner',
      client,
    })

    // 3. 丰富 bindings — 记录 member name + engine 以便跨成员关联
    const state = loadInstanceState(instance_id)
    if (state) {
      const binding = state.bindings.find(b => b.role === role && !b.placeholder)
      if (binding) {
        binding.memberName = member.name
        binding.engine = member.engine
      }
      saveInstanceState(instance_id, state)
    }

    appendTrace(instance_id, {
      tool: 'handoff_to_member',
      args: {
        role,
        node: currentNode.id,
        instructions_length: instructions?.length || 0
      },
      result: 'success',
      targetMember: member.name,
      targetEngine: member.engine,
      targetSession: state?.bindings?.find(b => b.role === role)?.sessionId,
      elapsedMs: Date.now() - t0,
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
    appendTrace(instance_id, {
      tool: 'handoff_to_member',
      args: { role },
      result: 'error',
      error: e.message,
      elapsedMs: Date.now() - t0,
    })
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
    appendTrace(instance_id, {
      tool: 'read_artifact',
      args: { name, name_length: name.length },
      result: 'success',
      size: content.length,
    })
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

