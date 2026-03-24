/**
 * T39-1.4: Workflow Handoff — 跨 Muse 工作流交接
 *
 * 3-step ACK 协议：
 *   Step 1 (PREPARE): source 创建 target session → pending
 *   Step 2 (BIND+ACK): target prompt hook 写回 → acked
 *   Step 3 (EXECUTE): source 发送 handoff prompt → executing → delivered
 *
 * 状态流转：null → pending → acked → executing → delivered → null
 *                                ↓         ↓
 *                              failed    failed
 */

import { createLogger } from '../logger.mjs'
import { loadInstanceState, saveInstanceState, indexSession, removeSessionIndex, lookupInstance } from '../workflow/bridge.mjs'
import { getRegistry } from '../workflow/registry.mjs'
import { resolveCapabilities } from '../workflow/gate-enforcer.mjs'

const log = createLogger('wf-handoff')

// ── Handoff 错误 ──

export class HandoffError extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'HandoffError'
    this.code = code
  }
}

// ── 3-step 执行 ──

/**
 * 执行完整 3-step handoff
 *
 * @param {object} opts
 * @param {import('../workflow/state-machine.mjs').StateMachine} opts.sm
 * @param {object} opts.nextNode - 目标节点定义
 * @param {string} opts.instanceId
 * @param {string} opts.sourceRole - 发起方角色
 * @param {import('../family/member-client.mjs').MemberClient} opts.client
 */
export async function executeHandoff({ sm, nextNode, instanceId, sourceRole, client }) {
  const target = nextNode.participant

  // Step 1: PREPARE — 创建 target session + 写 pending
  const sesId = await client.createSession()
  const state = loadInstanceState(instanceId)
  state.bindings.push({ role: target, sessionId: sesId })
  state.handoff = {
    status: 'pending',
    source: sourceRole,
    target,
    targetSession: sesId,
    createdAt: new Date().toISOString(),
  }
  saveInstanceState(instanceId, state)
  indexSession(sesId, instanceId)

  // 内存 registry 同步
  const registry = getRegistry()
  if (registry) {
    registry.bindSession(instanceId, sesId, target)
  }

  log.info('handoff PREPARE', { instanceId, target, sesId })

  // Step 2: BIND + ACK — 发送绑定 prompt，等待 target hook 写 acked
  await client.prompt(sesId, '═══ WORKFLOW BIND: 绑定确认中 ═══')
  await waitForAck(instanceId, 30000)

  // Step 3: EXECUTE — 发送 handoff prompt（投递确认）
  const state2 = loadInstanceState(instanceId)
  state2.handoff.status = 'executing'
  saveInstanceState(instanceId, state2)

  try {
    const prompt = buildHandoffPrompt(sm, nextNode)
    await client.prompt(sesId, prompt)
    log.info('handoff EXECUTE 已发送', { instanceId, target })
  } catch (err) {
    // HTTP 异常 — 不确定目标是否收到
    // ★ 不把 executing 改成 failed（避免与 target 写 delivered 竞争）
    const state3 = loadInstanceState(instanceId)
    if (state3?.handoff?.status === 'delivered') {
      log.info('handoff HTTP 异常但目标已确认', { instanceId })
      return
    }
    state3.handoff.lastError = err.message
    state3.handoff.errorAt = new Date().toISOString()
    saveInstanceState(instanceId, state3)
    log.warn('handoff EXECUTE HTTP 异常，保持 executing', { instanceId, error: err.message })
    throw err
  }
}

// ── ACK 轮询 ──

/**
 * 轮询等待 target hook 将 handoff.status 写成 acked
 */
async function waitForAck(instanceId, timeoutMs = 30000) {
  const start = Date.now()
  const interval = 500

  while (Date.now() - start < timeoutMs) {
    const state = loadInstanceState(instanceId)
    if (state?.handoff?.status === 'acked') return
    if (state?.handoff?.status === 'failed') {
      throw new HandoffError('ACK_FAILED', 'target 端 ACK 失败')
    }
    await new Promise(r => setTimeout(r, interval))
  }

  // 超时 → 写 failed
  const state = loadInstanceState(instanceId)
  if (state?.handoff?.status === 'pending') {
    state.handoff.status = 'failed'
    state.handoff.lastError = 'ACK timeout'
    state.handoff.errorAt = new Date().toISOString()
    saveInstanceState(instanceId, state)
  }
  throw new HandoffError('ACK_TIMEOUT', `ACK 超时 (${timeoutMs}ms)`)
}

// ── Retry / Cancel ──

/**
 * 重试 handoff（failed / executing+force）
 */
export async function retryHandoff(instanceId, client, { force = false } = {}) {
  const state = loadInstanceState(instanceId)
  if (!state?.handoff) throw new HandoffError('NO_HANDOFF', '无 handoff')

  if (state.handoff.status === 'delivered') {
    return { alreadyDelivered: true, message: '目标已确认接收，无需重试' }
  }

  if (state.handoff.status === 'executing') {
    if (!force) {
      return {
        error: 'AMBIGUOUS_STATE',
        message: 'handoff 处于 executing 态，目标可能已收到。如确认要重试，使用 force=true。',
      }
    }
    log.warn('用户强制重试 executing 态', { instanceId })
  }

  if (!['failed', 'executing'].includes(state.handoff.status)) {
    throw new HandoffError('INVALID_STATUS', `当前 handoff 状态 ${state.handoff.status} 不可重试`)
  }

  // 回收旧 session（文件 + 内存）
  const oldSession = state.handoff.targetSession
  if (oldSession) {
    removeSessionIndex(oldSession)
    const registry = getRegistry()
    if (registry) registry.unbindSession(oldSession)
  }

  state.bindings = state.bindings.filter(b => b.role !== state.handoff.target)
  state.handoff.status = 'pending'
  state.handoff.targetSession = null
  state.handoff.lastError = null
  state.handoff.errorAt = null
  saveInstanceState(instanceId, state)

  log.info('handoff retry 已回收旧 session', { instanceId, oldSession })
  return { retryReady: true, target: state.handoff.target }
}

/**
 * 取消 handoff（完整回收）
 */
export function cancelHandoff(instanceId) {
  const state = loadInstanceState(instanceId)
  if (!state?.handoff) throw new HandoffError('NO_HANDOFF', '无 handoff')

  // 回收旧 session（文件 + 内存）
  const oldSession = state.handoff.targetSession
  if (oldSession) {
    removeSessionIndex(oldSession)
    const registry = getRegistry()
    if (registry) registry.unbindSession(oldSession)
  }

  state.bindings = state.bindings.filter(b => b.role !== state.handoff.target)
  state.handoff = null
  saveInstanceState(instanceId, state)

  log.info('handoff 已取消', { instanceId, oldSession })
  return { cancelled: true }
}

// ── Handoff Prompt 构造 ──

export function buildHandoffPrompt(sm, node) {
  const resolvedTools = [...resolveCapabilities(node.capabilities || [])]
  return `[WORKFLOW TASK — Planner 分派]
你收到了来自 Planner 的任务分派。立即开始执行，不要等待人类确认。

1. TASK: 节点 "${node.id}" — ${node.objective}
2. EXPECTED OUTCOME: ${node.output?.artifact || '完成节点目标'}
3. AVAILABLE TOOLS: ${resolvedTools.join(', ')}
4. MUST DO:\n${(node.instructions || []).map((s, i) => `   ${i + 1}. ${s}`).join('\n')}
5. MUST NOT DO:\n${(node.constraints || []).map(c => `   - ${c}`).join('\n')}
6. CONTEXT:\n   - 工作流: ${sm.workflowId} (instance: ${sm.instanceId})\n   - 工作区: ${process.env.MUSE_ROOT}
7. ⚠️ 完成规则:
   - 完成所有步骤后，明确汇报你的产出（文件路径、artifact 名）
   - 不要调用 workflow_transition — Planner 会负责推进工作流
   - 你只需要执行任务并汇报结果`
}

// ── 安全网：确保节点执行到完成 ──

/**
 * 等待 target session 完成，如果节点没完成就再催一次
 * ★ 由 Planner 的 handoff 后续流程调用
 */
export async function ensureNodeCompletion(client, sessionId, instanceId, node) {
  // wait_for_user 节点需要人类输入，不催
  if (node.wait_for_user) return

  try {
    await client.pollUntilDone(sessionId)
  } catch {
    log.warn('ensureNodeCompletion: pollUntilDone 超时', { instanceId })
    return
  }

  const state = loadInstanceState(instanceId)
  if (!state) return

  // Planner 已推进 → 节点完成
  if (state.smState.current_node !== node.id) {
    log.info('ensureNodeCompletion: 节点已完成', { instanceId, node: node.id })
    return
  }

  // 还在当前节点 → 催一次
  log.info('ensureNodeCompletion: 节点未完成，发送 continue prompt', { instanceId, node: node.id })
  try {
    await client.prompt(sessionId,
      `[WORKFLOW CONTINUE] 你还没有完成节点 "${node.id}" 的任务。` +
      `请立即完成剩余步骤并汇报你的产出。Planner 会负责推进工作流。`)
    await client.pollUntilDone(sessionId)
  } catch {
    log.warn('ensureNodeCompletion: continue prompt 超时', { instanceId })
  }
}

