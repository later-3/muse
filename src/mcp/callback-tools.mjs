/**
 * Callback Tools — 执行角色回调 Planner 的 MCP 工具
 *
 * 工具:
 *   notify_planner — 任务完成后主动通知 Planner
 *
 * 场景:
 *   PUA/Arch/Coder/Reviewer 完成节点任务后
 *   → 调用 notify_planner(instance_id, status, summary)
 *   → 工具通过 HTTP 向 Planner 的 session 注入回调消息
 *   → Planner 收到消息后检查产出并推进工作流
 */

import { createLogger } from '../logger.mjs'
import { loadInstanceState } from '../workflow/bridge.mjs'
import { findByRole } from '../family/registry.mjs'
import { MemberClient } from '../family/member-client.mjs'

const log = createLogger('callback-tools')

// ── Tool Definitions ──

export const CALLBACK_TOOLS = [
  {
    name: 'notify_planner',
    description: '任务完成后主动通知 Planner。执行角色（pua/arch/coder/reviewer）完成节点任务后必须调用此工具。',
    inputSchema: {
      type: 'object',
      properties: {
        instance_id: {
          type: 'string',
          description: '工作流实例 ID（从任务 prompt 的 CONTEXT 中获取）',
        },
        status: {
          type: 'string',
          enum: ['done', 'blocked', 'failed'],
          description: '完成状态: done=完成, blocked=遇到阻塞, failed=失败',
        },
        summary: {
          type: 'string',
          description: '一句话总结你做了什么',
        },
        artifact: {
          type: 'string',
          description: '产出文件名（如 task-brief.md）',
        },
      },
      required: ['instance_id', 'status', 'summary'],
    },
  },
]

// ── Handler ──

function textResult(text) {
  return { content: [{ type: 'text', text }] }
}

export async function handleNotifyPlanner(sessionId, args) {
  const { instance_id, status, summary, artifact } = args || {}
  if (!instance_id || !status || !summary) {
    return textResult('缺少必要参数: instance_id, status, summary')
  }

  const t0 = Date.now()

  try {
    // 1. 读取工作流状态 → 获取 plannerSession
    const state = loadInstanceState(instance_id)
    if (!state) {
      return textResult(`工作流实例 ${instance_id} 不存在`)
    }

    const plannerSession = state.plannerSession
    if (!plannerSession) {
      return textResult('⚠️ 工作流状态中无 plannerSession 记录，无法回调 Planner')
    }

    // 2. 获取当前节点信息
    const currentNode = state.smState?.current_node || 'unknown'

    // 3. 从 registry 找到 Planner 的 engine URL
    const planner = findByRole('planner')
    if (!planner) {
      return textResult('⚠️ Planner 不在线（未在 family registry 中注册）')
    }

    // 4. 构造回调消息
    const callbackMessage = [
      `[CALLBACK] 节点任务回调`,
      ``,
      `📋 工作流: ${state.workflowId} (instance: ${instance_id})`,
      `📌 节点: ${currentNode}`,
      `📊 状态: ${status}`,
      `📝 摘要: ${summary}`,
      artifact ? `📎 产出: ${artifact}` : '',
      ``,
      `请检查产出并决定下一步：`,
      `- 用 read_artifact 检查产出文件是否存在`,
      `- 通过则用 workflow_admin_transition 推进`,
      `- 不通过则用 handoff_to_member 重新分派`,
    ].filter(Boolean).join('\n')

    // 5. 通过 HTTP 向 Planner 的 session 发送回调消息
    const client = new MemberClient(planner.engine, process.env.MUSE_ROOT)
    await client.prompt(plannerSession, callbackMessage)

    log.info('notify_planner 回调成功', {
      instance_id,
      currentNode,
      status,
      plannerEngine: planner.engine,
      plannerSession,
      elapsedMs: Date.now() - t0,
    })

    return textResult(JSON.stringify({
      success: true,
      message: `已通知 Planner (${planner.name})`,
      instance_id,
      node: currentNode,
      status,
    }, null, 2))
  } catch (e) {
    log.error('notify_planner 失败', { instance_id, error: e.message })
    return textResult(`回调 Planner 失败: ${e.message}`)
  }
}
