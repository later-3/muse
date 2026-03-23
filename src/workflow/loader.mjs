/**
 * T39: WorkflowLoader — 工作流启动加载器
 *
 * 职责：
 * - 从指定路径加载工作流定义 JSON
 * - 创建 StateMachine 实例
 * - 创建 WorkflowRegistry + 绑定 session
 * - 设置全局 registry（供 hooks / MCP tools 使用）
 *
 * 使用方式：
 *   在 plugin 初始化或主入口中调用 initWorkflow()
 *   或者由 MCP tool (workflow_init) 动态触发
 */

import { loadWorkflowFromFile, parseWorkflow } from './definition.mjs'
import { StateMachine } from './state-machine.mjs'
import { WorkflowRegistry, setRegistry, getRegistry } from './registry.mjs'
import { createLogger } from '../logger.mjs'

const log = createLogger('wf-loader')

/**
 * 从文件初始化工作流
 *
 * @param {object} opts
 * @param {string} opts.workflowPath - 工作流定义 JSON 文件路径
 * @param {string} opts.taskId - 任务 ID
 * @param {string} opts.workspaceRoot - 工作区根目录
 * @param {Array<{role: string, sessionId: string}>} opts.bindings - session 绑定
 * @returns {{ sm: StateMachine, registry: WorkflowRegistry }}
 */
export async function initWorkflow({ workflowPath, taskId, workspaceRoot, bindings }) {
  log.info('初始化工作流', { workflowPath, taskId })

  // 1. 加载定义
  const def = await loadWorkflowFromFile(workflowPath)

  // 2. 创建状态机
  const sm = new StateMachine(def, { taskId })

  // 3. 创建 registry（如果已存在，追加）
  let registry = getRegistry()
  if (!registry) {
    registry = new WorkflowRegistry({ workspaceRoot })
    setRegistry(registry)
  }

  // 4. 注册实例 + 绑 session
  registry.register(sm, bindings)

  log.info('工作流初始化完成', {
    workflow: def.id,
    instance: sm.instanceId,
    sessions: bindings.length,
    nodes: def.listNodeIds(),
  })

  return { sm, registry }
}

/**
 * 从 JSON 对象初始化工作流（不需要文件）
 */
export function initWorkflowFromJSON({ definition, taskId, workspaceRoot, bindings }) {
  const def = parseWorkflow(definition)
  const sm = new StateMachine(def, { taskId })

  let registry = getRegistry()
  if (!registry) {
    registry = new WorkflowRegistry({ workspaceRoot })
    setRegistry(registry)
  }

  registry.register(sm, bindings)

  log.info('工作流初始化完成 (JSON)', {
    workflow: def.id,
    instance: sm.instanceId,
    sessions: bindings.length,
  })

  return { sm, registry }
}

/**
 * 关闭当前工作流实例
 */
export function shutdownWorkflow(instanceId) {
  const registry = getRegistry()
  if (!registry) return

  const sm = registry.getInstance(instanceId)
  if (sm && sm.status === 'running') {
    sm.abort('shutdown')
  }
  registry.unregister(instanceId)
  log.info('工作流已关闭', { instanceId })
}
