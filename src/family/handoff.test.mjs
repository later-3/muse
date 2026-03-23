/**
 * T39-1.4: Handoff Tests
 *
 * 覆盖：
 * - handoff 状态机（pending → acked → executing → delivered）
 * - retry（failed → pending / executing+force → pending / AMBIGUOUS_STATE）
 * - cancel（完整回收 session-index + bindings + registry）
 * - registry unbindSession / replaceRoleSession
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { retryHandoff, cancelHandoff, HandoffError, buildHandoffPrompt } from '../family/handoff.mjs'
import { saveInstanceState, loadInstanceState, indexSession, removeSessionIndex, lookupInstance, rebuildIndex } from '../workflow/bridge.mjs'
import { WorkflowRegistry } from '../workflow/registry.mjs'
import { setRegistry, getRegistry } from '../workflow/registry.mjs'

let tmpDir
let instanceId

beforeEach(() => {
  tmpDir = join(tmpdir(), `handoff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpDir, { recursive: true })
  instanceId = 'inst-handoff-1'

  // 设置环境变量让 bridge 使用 tmpDir
  process.env.MUSE_HOME = tmpDir
  process.env.MUSE_FAMILY = 'test-family'

  // 创建 registry 和实例
  const registry = new WorkflowRegistry({ workspaceRoot: tmpDir })
  setRegistry(registry)
})

afterEach(() => {
  setRegistry(null)
  delete process.env.MUSE_HOME
  delete process.env.MUSE_FAMILY
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
})

// ── Registry 新 API 测试 ──

describe('WorkflowRegistry — handoff API', () => {
  it('unbindSession 解绑后 getBySession 返回 null', () => {
    const registry = getRegistry()
    // 模拟一个 SM
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [{ role: 'arch', sessionId: 'ses_111' }])

    assert.ok(registry.getBySession('ses_111'))
    registry.unbindSession('ses_111')
    assert.equal(registry.getBySession('ses_111'), null)
  })

  it('replaceRoleSession 替换后旧 session 失效', () => {
    const registry = getRegistry()
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [{ role: 'arch', sessionId: 'ses_old' }])

    const oldSid = registry.replaceRoleSession('inst-1', 'arch', 'ses_new')
    assert.equal(oldSid, 'ses_old')
    assert.equal(registry.getBySession('ses_old'), null)
    assert.ok(registry.getBySession('ses_new'))
    assert.equal(registry.getRoleBySession('ses_new'), 'arch')
  })

  it('replaceRoleSession 无旧绑定时仍绑新 session', () => {
    const registry = getRegistry()
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [])

    const oldSid = registry.replaceRoleSession('inst-1', 'new_role', 'ses_brand_new')
    assert.equal(oldSid, null)
    assert.ok(registry.getBySession('ses_brand_new'))
  })
})

// ── Retry 测试 ──

describe('retryHandoff', () => {
  it('failed → 回收旧 session + 返回 retryReady', async () => {
    // 构造 failed handoff state
    const state = {
      workflowId: 'wf-1',
      instanceId,
      bindings: [
        { role: 'pua', sessionId: 'ses_source' },
        { role: 'arch', sessionId: 'ses_target' },
      ],
      handoff: {
        status: 'failed',
        source: 'pua',
        target: 'arch',
        targetSession: 'ses_target',
        lastError: 'ACK timeout',
      },
    }
    saveInstanceState(instanceId, state)
    indexSession('ses_target', instanceId)

    // registry 中绑定 target session
    const registry = getRegistry()
    const fakeSM = { instanceId, workflowId: 'wf-1', taskId: 't1' }
    registry.register(fakeSM, [
      { role: 'pua', sessionId: 'ses_source' },
      { role: 'arch', sessionId: 'ses_target' },
    ])

    const result = await retryHandoff(instanceId, null, { force: false })

    assert.ok(result.retryReady)
    assert.equal(result.target, 'arch')

    // 旧 session 从 registry 解绑
    assert.equal(registry.getBySession('ses_target'), null)
    // source session 仍在
    assert.ok(registry.getBySession('ses_source'))

    // bindings 中 arch 已移除
    const updated = loadInstanceState(instanceId)
    assert.equal(updated.bindings.length, 1)
    assert.equal(updated.bindings[0].role, 'pua')
    assert.equal(updated.handoff.status, 'pending')
    assert.equal(updated.handoff.targetSession, null)

    // session-index 中旧 session 已回收
    assert.equal(lookupInstance('ses_target'), null)
  })

  it('executing + force=false → AMBIGUOUS_STATE', async () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [{ role: 'arch', sessionId: 'ses_t' }],
      handoff: { status: 'executing', source: 'pua', target: 'arch', targetSession: 'ses_t' },
    }
    saveInstanceState(instanceId, state)

    const result = await retryHandoff(instanceId, null, { force: false })
    assert.equal(result.error, 'AMBIGUOUS_STATE')
  })

  it('executing + force=true → retryReady', async () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [{ role: 'arch', sessionId: 'ses_t' }],
      handoff: { status: 'executing', source: 'pua', target: 'arch', targetSession: 'ses_t' },
    }
    saveInstanceState(instanceId, state)
    indexSession('ses_t', instanceId)

    const registry = getRegistry()
    const fakeSM = { instanceId, workflowId: 'wf-1', taskId: 't1' }
    registry.register(fakeSM, [{ role: 'arch', sessionId: 'ses_t' }])

    const result = await retryHandoff(instanceId, null, { force: true })
    assert.ok(result.retryReady)
  })

  it('delivered → 无需重试', async () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [],
      handoff: { status: 'delivered', source: 'pua', target: 'arch' },
    }
    saveInstanceState(instanceId, state)

    const result = await retryHandoff(instanceId, null)
    assert.ok(result.alreadyDelivered)
  })

  it('pending → INVALID_STATUS', async () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [],
      handoff: { status: 'pending', source: 'pua', target: 'arch' },
    }
    saveInstanceState(instanceId, state)

    await assert.rejects(
      () => retryHandoff(instanceId, null),
      (e) => e.code === 'INVALID_STATUS'
    )
  })
})

// ── Cancel 测试 ──

describe('cancelHandoff', () => {
  it('完整回收 session-index + bindings + registry + handoff', () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [
        { role: 'pua', sessionId: 'ses_source' },
        { role: 'arch', sessionId: 'ses_target' },
      ],
      handoff: {
        status: 'failed', source: 'pua', target: 'arch',
        targetSession: 'ses_target',
      },
    }
    saveInstanceState(instanceId, state)
    indexSession('ses_target', instanceId)

    const registry = getRegistry()
    const fakeSM = { instanceId, workflowId: 'wf-1', taskId: 't1' }
    registry.register(fakeSM, [
      { role: 'pua', sessionId: 'ses_source' },
      { role: 'arch', sessionId: 'ses_target' },
    ])

    const result = cancelHandoff(instanceId)
    assert.ok(result.cancelled)

    // 文件：handoff 为 null、bindings 只剩 pua
    const updated = loadInstanceState(instanceId)
    assert.equal(updated.handoff, null)
    assert.equal(updated.bindings.length, 1)
    assert.equal(updated.bindings[0].role, 'pua')

    // registry：旧 session 解绑
    assert.equal(registry.getBySession('ses_target'), null)
    assert.ok(registry.getBySession('ses_source'))

    // session-index 已清
    assert.equal(lookupInstance('ses_target'), null)
  })

  it('无 handoff → HandoffError', () => {
    saveInstanceState(instanceId, { workflowId: 'wf-1', instanceId, bindings: [] })
    assert.throws(
      () => cancelHandoff(instanceId),
      (e) => e.code === 'NO_HANDOFF'
    )
  })
})

// ── buildHandoffPrompt 测试 ──

describe('buildHandoffPrompt', () => {
  it('生成包含节点信息的 prompt', () => {
    const fakeSM = { workflowId: 'code-review-wf', instanceId: 'inst-1' }
    const node = {
      id: 'arch_review',
      objective: '进行架构审查',
      output: { artifact: 'review-report.md' },
      capabilities: ['read', 'write'],
      instructions: ['阅读代码', '写审查报告'],
      constraints: ['不修改代码'],
    }

    const prompt = buildHandoffPrompt(fakeSM, node)
    assert.ok(prompt.includes('arch_review'))
    assert.ok(prompt.includes('进行架构审查'))
    assert.ok(prompt.includes('review-report.md'))
    assert.ok(prompt.includes('阅读代码'))
    assert.ok(prompt.includes('不修改代码'))
  })
})

// ── 失败路径测试 ──

describe('handoff 失败路径', () => {
  it('transition→handoff 失败后 state 有 failed 锚点（可 retry/cancel）', () => {
    // 模拟：transition 后 handoff 失败时，上层应写入 failed state
    // 这里直接测 state 写入 + cancel 可恢复
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [{ role: 'pua', sessionId: 'ses_source' }],
      handoff: {
        status: 'failed',
        source: 'pua',
        target: 'arch',
        targetSession: null,
        lastError: '目标角色 "arch" 不在线',
        errorAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }
    saveInstanceState(instanceId, state)

    // cancel 应该可以清除 failed+targetSession=null 的 handoff
    const result = cancelHandoff(instanceId)
    assert.ok(result.cancelled)
    const updated = loadInstanceState(instanceId)
    assert.equal(updated.handoff, null)
    assert.equal(updated.bindings.length, 1) // pua 保留
  })

  it('retry cleanup 后 triggerHandoff 失败不卡在 pending', async () => {
    // 场景：failed → retryHandoff 清理完（pending+targetSession=null）
    //       → 上层 triggerHandoff 又失败 → 应回写 failed，下次 retry 仍可用
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [{ role: 'pua', sessionId: 'ses_source' }],
      handoff: {
        status: 'failed',
        source: 'pua',
        target: 'arch',
        targetSession: null,
        lastError: '第一次失败',
      },
    }
    saveInstanceState(instanceId, state)

    // retryHandoff 清理
    const result = await retryHandoff(instanceId, null)
    assert.ok(result.retryReady)

    // 模拟 triggerHandoff 失败 → 上层应回写 failed
    const pendingState = loadInstanceState(instanceId)
    assert.equal(pendingState.handoff.status, 'pending')
    assert.equal(pendingState.handoff.targetSession, null)

    // 上层回写 failed
    pendingState.handoff.status = 'failed'
    pendingState.handoff.lastError = '第二次也失败了'
    pendingState.handoff.errorAt = new Date().toISOString()
    saveInstanceState(instanceId, pendingState)

    // 验证：再次 retry 不会 INVALID_STATUS
    const result2 = await retryHandoff(instanceId, null)
    assert.ok(result2.retryReady)
  })

  it('failed+targetSession=null 状态可以连续 retry', async () => {
    const state = {
      workflowId: 'wf-1', instanceId,
      bindings: [{ role: 'pua', sessionId: 'ses_source' }],
      handoff: { status: 'failed', source: 'pua', target: 'arch', targetSession: null },
    }
    saveInstanceState(instanceId, state)

    // retry → cleanup → retryReady
    const r1 = await retryHandoff(instanceId, null)
    assert.ok(r1.retryReady)

    // 回写 failed
    const s = loadInstanceState(instanceId)
    s.handoff.status = 'failed'
    saveInstanceState(instanceId, s)

    // 再次 retry — 不应 crash
    const r2 = await retryHandoff(instanceId, null)
    assert.ok(r2.retryReady)
  })
})

// ── isPlaceholder 测试 ──

describe('WorkflowRegistry — isPlaceholder', () => {
  it('占位 session → isPlaceholder = true', () => {
    const registry = getRegistry()
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [
      { role: 'pua', sessionId: 'ses_pua' },
      { role: 'arch', sessionId: 'ses_pua_arch', placeholder: true },
    ])
    assert.equal(registry.isPlaceholder('inst-1', 'arch'), true)
    assert.equal(registry.isPlaceholder('inst-1', 'pua'), false)
  })

  it('真实 session → isPlaceholder = false', () => {
    const registry = getRegistry()
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [
      { role: 'pua', sessionId: 'ses_pua' },
      { role: 'arch', sessionId: 'ses_arch' },  // 无 placeholder
    ])
    assert.equal(registry.isPlaceholder('inst-1', 'arch'), false)
    assert.equal(registry.isPlaceholder('inst-1', 'pua'), false)
  })

  it('无绑定 → isPlaceholder = true（需要 handoff）', () => {
    const registry = getRegistry()
    const fakeSM = { instanceId: 'inst-1', workflowId: 'wf', taskId: 't1' }
    registry.register(fakeSM, [])
    assert.equal(registry.isPlaceholder('inst-1', 'unknown_role'), true)
  })
})
