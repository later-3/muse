/**
 * T39: workflow-gate hook — tool.execute.before 拦截器
 *
 * 用 GateEnforcer 判定工具调用是否允许。
 *
 * T39-1.3 升级：
 * - 删除 loadWorkflowState / rebindByRole（M1/M2 迁移）
 * - 用 lookupInstance 从 session-index 查找工作流实例
 * - registry 仍从 getRegistry() 获取（plugin init 时已加载）
 */

import { GateEnforcer } from '../../workflow/gate-enforcer.mjs'
import { getRegistry } from '../../workflow/registry.mjs'
import { restoreRegistryFromBridge } from '../../workflow/bridge.mjs'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 写 gate 拦截日志到 trace 目录
 */
function gateDebugLog(msg) {
  try {
    const logDir = process.env.MUSE_TRACE_DIR || '/tmp/muse-trace'
    const dir = join(logDir, new Date().toISOString().slice(0, 10))
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'wf-gate-debug.log'), `${new Date().toISOString()} ${msg}\n`)
  } catch { /* ignore */ }
}

export function createWorkflowGate() {
  return async (input) => {
    const { tool: rawTool, args, sessionID } = input || {}
    // Strip MCP server prefix (e.g. "memory-server_workflow_list" → "workflow_list")
    const tool = rawTool?.replace(/^[a-zA-Z0-9]+-[a-zA-Z0-9]+_/, '') || rawTool
    gateDebugLog(`[ENTER] raw=${rawTool} tool=${tool} sid=${sessionID}`)

    if (!tool || !sessionID) return

    // Step 1: 获取 registry（内存优先，session 缺失时增量恢复）
    let registry = getRegistry()
    gateDebugLog(`[STEP1] registry=${registry ? `size=${registry.size}` : 'null'}`)

    if (!registry || registry.size === 0) {
      registry = await restoreRegistryFromBridge()
      gateDebugLog(`[STEP1.restore-full] registry=${registry ? `size=${registry.size}` : 'null'}`)
    }
    if (!registry || registry.size === 0) return  // 无活跃工作流 → 放行

    // Step 2: 查找 session 绑定
    let sm = registry.getBySession(sessionID)
    // session 找不到 → 增量恢复（可能有新 instance 写入 bridge）
    if (!sm) {
      await restoreRegistryFromBridge()
      registry = getRegistry()
      sm = registry?.getBySession(sessionID)
    }
    if (!sm) return  // 仍未绑定 → 放行

    // ── T39-1.4: Handoff 状态下的 gate 拦截 ──
    const { loadInstanceState } = await import('../../workflow/bridge.mjs')
    const state = loadInstanceState(sm.instanceId)
    if (state?.handoff?.targetSession === sessionID) {
      const hStatus = state.handoff.status
      if (['pending', 'acked', 'executing', 'failed'].includes(hStatus)) {
        // handoff 非 delivered 态 → 只放行 workflow_status
        if (tool !== 'workflow_status') {
          const msg = `[工作流拦截] handoff 状态 [${hStatus}]，暂不允许工具调用`
          gateDebugLog(`[HANDOFF-BLOCK] sid=${sessionID} tool=${tool} hStatus=${hStatus}`)
          throw new Error(msg)
        }
        gateDebugLog(`[HANDOFF-ALLOW] sid=${sessionID} tool=workflow_status hStatus=${hStatus}`)
        return  // 放行 workflow_status
      }
      // delivered → 走正常 gate 逻辑
    }

    // Step 3: GateEnforcer 检查
    const participantStatus = registry.getParticipantStatus(sessionID)
    const node = sm.getCurrentNode()
    if (!node) return

    const result = GateEnforcer.check({
      tool,
      args,
      node,
      participantStatus,
      workspaceRoot: registry.workspaceRoot,
    })

    if (!result.allowed) {
      const msg = `[工作流拦截] 节点 "${node.id}" 不允许调用 "${tool}": ${result.reason}`
      gateDebugLog(`[BLOCK] sid=${sessionID} node=${node.id} tool=${tool} reason=${result.reason}`)
      throw new Error(msg)
    } else {
      gateDebugLog(`[ALLOW] sid=${sessionID} node=${node.id} tool=${tool}`)
    }
  }
}
