/**
 * T10.5: Muse Plugin — experimental.chat.system.transform hook
 *
 * 动态上下文注入: 只注入运行时动态信息 (当前时间等)。
 *
 * ⚠️ 评审守则: 不能承载人格! 人格主载体是 AGENTS.md (T12)。
 * 这里只补 AGENTS.md 无法提供的动态信息。
 */

import { lookupInstance, loadInstanceState } from '../../workflow/bridge.mjs'
import { getRegistry } from '../../workflow/registry.mjs'

export function createSystemPrompt() {
  return async (input, output) => {
    try {
      const sessionId = input?.sessionID
      if (sessionId) {
        // 查找当前 session 关联的工作流
        const instanceId = lookupInstance(sessionId)
        if (instanceId) {
          const registry = getRegistry()
          const sm = registry?.getInstance(instanceId)
          
          if (sm) {
            const state = sm.toState()
            const currentNode = sm.getCurrentNode()
            
            // 构建工作流上下文
            const workflowContext = `
[WORKFLOW CONTEXT]
当前工作流: ${sm.workflowId} (${sm.instanceId})
状态: ${state.status}
当前节点: ${state.current_node} (${currentNode?.participant || 'N/A'})
当前目标: ${currentNode?.objective?.slice(0, 100) || 'N/A'}

你的下一步行动: ${getNextActionHint(state, currentNode)}
[END WORKFLOW CONTEXT]
`
            
            output.system.push(workflowContext)
          }
        }
      }

      // output: { system: string[] }
      // 只 append，不覆盖
      const now = new Date()
      const timeStr = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })

      output.system.push(
        `[Muse 动态上下文]\n当前时间: ${timeStr}\n`
      )

      // T15: 注入能力摘要 (如果 registry 可用)
      if (globalThis.__museRegistry) {
        const capSummary = globalThis.__museRegistry.summary()
        output.system.push(`[能力自知] ${capSummary}\n`)
      }
    } catch (e) {
      // 降级: 不影响主流程，但记录以便排查
      // eslint-disable-next-line no-console
      console.warn(`[system-prompt] 动态上下文注入失败 (已降级): ${e?.message || e}`)
    }
  }
}

function getNextActionHint(state, currentNode) {
  // 区分 Planner 和执行者：避免给执行者注入 Planner 视角提示
  const memberName = process.env.MUSE_MEMBER || ''
  const isPlanner = memberName === 'planner'
  const instanceId = state.instance_id || ''

  if (state.status === 'awaiting_review' || !state.handoff) {
    return '等待 Later 审核工作流设计。Later 确认后调用 handoff_to_member。'
  }

  if (state.handoff?.status === 'executing') {
    if (isPlanner) {
      return '等待执行者完成任务。收到通知后用 read_artifact 检查产出。'
    }
    // 执行者视角：必须调 notify_planner
    return [
      '你正在执行工作流任务。完成后 **必须** 调用 notify_planner 汇报：',
      `  notify_planner(instance_id="${instanceId}", status="done", summary="一句话总结")`,
      '  如果阻塞: status="blocked"  如果失败: status="failed"',
      '⚠️ 不调 notify_planner = Planner 永远不知道你完成了。'
    ].join('\n')
  }

  if (state.handoff?.status === 'delivered') {
    return '执行者已完成。用 read_artifact 检查产出，向 Later 展示等待审核。'
  }
  return '用 workflow_status 查看详细状态。'
}
