/**
 * T39-1.4: Workflow Handoff — 跨 Muse 工作流交接
 *
 * 2-step 协议（v2 — 去掉 LLM ACK，基础设施自动 ACK）：
 *   Step 1 (PREPARE): source 创建 target session → pending
 *                     Plugin hook 检测到 handoff pending → 自动写 acked
 *   Step 2 (EXECUTE): source 发送 handoff prompt → executing → delivered
 *
 * 设计原则：ACK 是机械操作，不需要 LLM 推理。
 * 本地场景：Plugin event hook 写文件 = ACK
 * 跨服务器扩展：HTTP relay / 消息队列 consumer = ACK
 *
 * 状态流转：null → pending → acked → executing → delivered → null
 *                     ↑plugin       ↓
 *                                 failed
 */

import { createLogger } from '../logger.mjs'
import { loadInstanceState, saveInstanceState, indexSession, removeSessionIndex, lookupInstance, appendTrace } from '../workflow/bridge.mjs'
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

// ── 2-step 执行 ──

/**
 * 执行 2-step handoff（基础设施 ACK）
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
  const t0 = Date.now()

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
  appendTrace(instanceId, {
    phase: 'handoff_prepare',
    role: target,
    targetSession: sesId,
    elapsedMs: Date.now() - t0
  })

  // Step 1.5: 等待 target MCP 就绪（不花 LLM token）
  // 防止 MCP 冷启动竞态：确保 notify_planner 等工具在 LLM 推理前可用
  try {
    await client.waitForMcpReady({ timeoutMs: 30_000 })
    appendTrace(instanceId, {
      phase: 'handoff_mcp_ready',
      role: target,
      elapsedMs: Date.now() - t0
    })
  } catch (mcpErr) {
    log.warn('MCP 就绪等待失败，仍尝试发送 handoff', {
      instanceId, target, error: mcpErr.message
    })
    appendTrace(instanceId, {
      phase: 'handoff_mcp_ready',
      role: target,
      status: 'timeout',
      error: mcpErr.message,
      elapsedMs: Date.now() - t0
    })
    // 不阻断 handoff — 超时仍给机会执行（优雅降级）
  }

  // Step 2: EXECUTE — 发送任务 prompt（MCP 工具已就绪）
  // ACK 由 Plugin hook 在 session.created 时自动完成（基础设施层）
  const state2 = loadInstanceState(instanceId)
  state2.handoff.status = 'executing'
  saveInstanceState(instanceId, state2)

  try {
    const prompt = buildHandoffPrompt(sm, nextNode)
    await client.prompt(sesId, prompt)
    log.info('handoff EXECUTE 已发送', { instanceId, target })
    appendTrace(instanceId, {
      phase: 'handoff_execute',
      role: target,
      status: 'sent',
      promptLength: prompt.length,
      elapsedMs: Date.now() - t0
    })
  } catch (err) {
    appendTrace(instanceId, {
      phase: 'handoff_execute',
      role: target,
      status: 'error',
      error: err.message,
      elapsedMs: Date.now() - t0
    })
    
    // HTTP 异常 — 不确定目标是否收到
    const state3 = loadInstanceState(instanceId)
    if (state3?.handoff?.status === 'delivered') {
      log.info('handoff HTTP 异常但目标已确认', { instanceId })
      return
    }
    state3.handoff.status = 'failed'
    state3.handoff.lastError = err.message
    state3.handoff.errorAt = new Date().toISOString()
    saveInstanceState(instanceId, state3)
    log.warn('handoff EXECUTE 失败', { instanceId, error: err.message })
    throw err
  }
}

// ── Plugin Auto-ACK (基础设施层) ──

/**
 * 由 Plugin event hook 调用：检测到 handoff pending → 自动写 acked
 * 不需要 LLM，不需要 MCP 工具，ms 级完成。
 *
 * 跨服务器扩展：替换为 HTTP relay consumer 或 消息队列 ACK。
 *
 * @param {string} instanceId
 * @returns {boolean} 是否成功 ACK
 */
export function autoAckHandoff(instanceId) {
  try {
    const state = loadInstanceState(instanceId)
    if (!state?.handoff || state.handoff.status !== 'pending') return false

    state.handoff.status = 'acked'
    state.handoff.ackedAt = new Date().toISOString()
    state.handoff.ackedBy = 'plugin-auto-ack'
    saveInstanceState(instanceId, state)

    appendTrace(instanceId, {
      phase: 'handoff_auto_ack',
      role: state.handoff.target,
      status: 'acked',
      mechanism: 'plugin-hook',
    })

    log.info('handoff 自动 ACK (Plugin hook)', { instanceId })
    return true
  } catch (e) {
    log.error('autoAckHandoff 失败', { instanceId, error: e.message })
    return false
  }
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
  const artifactName = node.output?.artifact || ''
  return `[WORKFLOW TASK — Planner 分派]
你收到了来自 Planner 的任务分派。立即开始执行，不要等待人类确认。

1. TASK: 节点 "${node.id}" — ${node.objective}
2. EXPECTED OUTCOME: ${artifactName || '完成节点目标'}
3. AVAILABLE TOOLS: ${resolvedTools.join(', ')}
4. MUST DO:\n${(node.instructions || []).map((s, i) => `   ${i + 1}. ${s}`).join('\n')}
5. MUST NOT DO:\n${(node.constraints || []).map(c => `   - ${c}`).join('\n')}
6. CONTEXT:\n   - 工作流: ${sm.workflowId} (instance: ${sm.instanceId})\n   - 工作区: ${process.env.MUSE_ROOT}
7. ⚠️ 完成规则:
   - 不要调用 workflow_transition — Planner 会负责推进工作流
   - 完成所有步骤后，必须调用 notify_planner 工具向 Planner 汇报:
     notify_planner(instance_id="${sm.instanceId}", status="done", summary="你做了什么的一句话总结"${artifactName ? `, artifact="${artifactName}"` : ''})
   - 如果遇到阻塞无法继续:
     notify_planner(instance_id="${sm.instanceId}", status="blocked", summary="阻塞原因")
   - 如果任务失败:
     notify_planner(instance_id="${sm.instanceId}", status="failed", summary="失败原因")
   - notify_planner 是你唯一的汇报方式，不要用其他方式通知 Planner`
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

