/**
 * T37: Dev MCP Tools — 开发任务管理工具定义与处理
 *
 * 独立模块，导出 TOOL 定义和 handler 函数。
 * 由 memory.mjs 统一注册到 MCP server。
 *
 * 4 个工具:
 *   start_dev_task  — 发起开发任务 (小缪调用)
 *   dev_status      — 查询任务状态
 *   approve_dev     — Later 批准合并
 *   reject_dev      — Later 拒绝
 */

// --- Tool Definitions ---

export const DEV_TOOLS = [
  {
    name: 'start_dev_task',
    description: '发起一个开发任务。你作为编排者发起任务后，系统会自动创建隔离的 git worktree，调用 OpenCode agent 完成开发，运行测试，检查安全规则。任务完成后进入 review 状态等待 Later 审核。\n\n用法: 当你识别到一个功能缺口或收到开发请求时，用自然语言描述需求。',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '任务描述 (自然语言，尽可能详细: 做什么、在哪个模块、预期效果)',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'dev_status',
    description: '查询开发任务状态。可查单个任务或列出所有任务。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '任务 ID。不填则列出所有任务。',
        },
        status: {
          type: 'string',
          enum: ['planning', 'developing', 'testing', 'review', 'approved', 'rejected', 'merged', 'failed'],
          description: '按状态过滤 (仅列表模式)',
        },
      },
    },
  },
  {
    name: 'approve_dev',
    description: '批准一个 review 状态的开发任务，将 worktree 合并到主分支。只有 Later 可以操作。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'reject_dev',
    description: '拒绝一个开发任务，清理 worktree 和分支。Later 拒绝时使用。',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
        reason: { type: 'string', description: '拒绝原因' },
      },
      required: ['taskId'],
    },
  },
]

// --- Tool Handlers ---

/**
 * @param {import('../dev/orchestrator.mjs').TaskOrchestrator} orchestrator
 * @param {object} args
 */
export async function handleStartDevTask(orchestrator, args) {
  if (!args?.description) {
    return errorResult('description 参数必填')
  }

  try {
    const task = await orchestrator.startTask(args.description)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          taskId: task.id,
          status: task.status,
          description: task.description,
          plan: task.plan,
          test: task.test,
          review: task.review,
        }, null, 2),
      }],
    }
  } catch (e) {
    return errorResult(`任务执行失败: ${e.message}`)
  }
}

/**
 * @param {import('../dev/orchestrator.mjs').TaskOrchestrator} orchestrator
 * @param {object} args
 */
export function handleDevStatus(orchestrator, args) {
  try {
    if (args?.taskId) {
      const task = orchestrator.getStatus(args.taskId)
      if (!task) return errorResult(`任务不存在: ${args.taskId}`)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(task, null, 2),
        }],
      }
    }

    // 列表模式
    const tasks = orchestrator.listTasks({ status: args?.status })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: tasks.length,
          tasks: tasks.map(t => ({
            id: t.id,
            status: t.status,
            description: t.description?.slice(0, 80),
            created_at: t.created_at,
          })),
        }, null, 2),
      }],
    }
  } catch (e) {
    return errorResult(`查询失败: ${e.message}`)
  }
}

/**
 * @param {import('../dev/orchestrator.mjs').TaskOrchestrator} orchestrator
 * @param {object} args
 */
export async function handleApproveDev(orchestrator, args) {
  if (!args?.taskId) return errorResult('taskId 参数必填')

  try {
    const task = await orchestrator.approve(args.taskId)
    return {
      content: [{
        type: 'text',
        text: `✅ 任务 ${args.taskId} 已合并 (状态: ${task.status})`,
      }],
    }
  } catch (e) {
    return errorResult(`审批失败: ${e.message}`)
  }
}

/**
 * @param {import('../dev/orchestrator.mjs').TaskOrchestrator} orchestrator
 * @param {object} args
 */
export async function handleRejectDev(orchestrator, args) {
  if (!args?.taskId) return errorResult('taskId 参数必填')

  try {
    const task = await orchestrator.reject(args.taskId, args.reason || '')
    return {
      content: [{
        type: 'text',
        text: `❌ 任务 ${args.taskId} 已拒绝 (原因: ${args.reason || '无'})`,
      }],
    }
  } catch (e) {
    return errorResult(`拒绝失败: ${e.message}`)
  }
}

/** 标准错误响应 */
function errorResult(msg) {
  return {
    content: [{ type: 'text', text: `Error: ${msg}` }],
    isError: true,
  }
}
