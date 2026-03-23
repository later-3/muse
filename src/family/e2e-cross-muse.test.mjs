/**
 * T39-1.E2E: 跨 Muse 工作流端到端测试
 *
 * 使用 mock OpenCode server 模拟 target muse，
 * 验证完整 handoff 3-step + 真实 prompt/gate hook 回写。
 *
 * 关键区别于单元测试：
 * - ACK / delivered 由真实 workflow-prompt hook 写回
 * - gate 拦截由真实 workflow-gate hook 验证
 * - 不直接修改 bridge state（除故障注入场景）
 *
 * 场景：E1 (完整 3-step) / E4a (hook 后失败幂等) / E4b (保持 executing) / E6 (retry force=true)
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'

import { handleWorkflowInit, handleWorkflowTransition, handleWorkflowRetryHandoff } from '../mcp/workflow-tools.mjs'
import { setRegistry as setWorkflowRegistry, getRegistry } from '../workflow/registry.mjs'
import { loadInstanceState, lookupInstance } from '../workflow/bridge.mjs'
import { createWorkflowPrompt } from '../plugin/hooks/workflow-prompt.mjs'
import { createWorkflowGate } from '../plugin/hooks/workflow-gate.mjs'

// ── Helpers ──

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── 真实 prompt hook 实例（每个测试复用同一个 hook）──

let promptHook
let gateHook

// ── Mock OpenCode Server ──

function createMockServer() {
  let port
  const sessions = new Map()   // sessionId → 'pending'|'busy'|'idle'
  let sessionCounter = 0
  let promptCount = 0
  let failAt = null            // null | 'before_hook' | 'after_hook'
  let failOnPromptN = 0        // 0 = 所有；N = 只第 N 次
  let onPromptCb = null        // 可选额外回调

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const method = req.method
    let body = ''

    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      // POST /session
      if (method === 'POST' && url.pathname === '/session') {
        sessionCounter++
        const id = `mock-ses-${sessionCounter}`
        sessions.set(id, 'pending')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id }))
        return
      }

      // POST /session/:id/prompt_async
      const promptMatch = url.pathname.match(/^\/session\/([^/]+)\/prompt_async$/)
      if (method === 'POST' && promptMatch) {
        const sid = promptMatch[1]
        promptCount++
        const currentN = promptCount

        const shouldFault = failAt && (failOnPromptN === 0 || failOnPromptN === currentN)

        if (shouldFault && failAt === 'before_hook') {
          res.writeHead(503)
          res.end('Service Unavailable (before_hook)')
          return
        }

        // ★ 调用真实 prompt hook（模拟 target muse 收到 prompt）
        // hook 内部会读 bridge state 写 ACK / delivered
        sessions.set(sid, 'busy')
        try {
          const output = { system: [] }
          await promptHook({ sessionID: sid }, output)
        } catch { /* hook 内部错误不影响 HTTP 响应 */ }

        // 额外回调（E4a 等场景）
        if (onPromptCb) onPromptCb(currentN, sid)

        setTimeout(() => sessions.set(sid, 'idle'), 30)

        if (shouldFault && failAt === 'after_hook') {
          res.writeHead(503)
          res.end('Service Unavailable (after_hook)')
          return
        }

        res.writeHead(204)
        res.end()
        return
      }

      // GET /session/status
      if (method === 'GET' && url.pathname === '/session/status') {
        const statusMap = {}
        for (const [sid, status] of sessions) {
          if (status !== 'idle') statusMap[sid] = status
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(statusMap))
        return
      }

      // GET /session/:id/message
      const msgMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/)
      if (method === 'GET' && msgMatch) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify([{
          role: 'assistant',
          parts: [{ type: 'text', text: 'mock reply' }],
        }]))
        return
      }

      // GET /global/health
      if (method === 'GET' && url.pathname === '/global/health') {
        res.writeHead(200)
        res.end('ok')
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })
  })

  return {
    start: () => new Promise(resolve => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port
        resolve()
      })
    }),
    close: () => new Promise(resolve => server.close(resolve)),
    get port() { return port },
    get url() { return `http://127.0.0.1:${port}` },
    get promptCount() { return promptCount },
    sessions,
    setFault: (fault, onPromptN = 0) => {
      failAt = fault
      failOnPromptN = onPromptN
    },
    clearFault: () => { failAt = null; failOnPromptN = 0 },
    resetPromptCount: () => { promptCount = 0 },
    onPrompt: (cb) => { onPromptCb = cb },
    clearOnPrompt: () => { onPromptCb = null },
  }
}

// ── 工作流定义 ──

function crossMuseWorkflow() {
  return {
    id: 'cross-muse-wf', name: 'Cross Muse', version: '1.0', initial: 'analyze',
    participants: [
      { role: 'pua' },
      { role: 'arch' },
    ],
    nodes: {
      analyze: {
        type: 'action', participant: 'pua', objective: '分析任务',
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        output: { artifact: 'analysis.json', required: true },
        exit_criteria: { artifacts: ['analysis.json'] },
        transitions: { submit_review: { target: 'arch_review', actor: 'agent' } },
      },
      arch_review: {
        type: 'action', participant: 'arch', objective: '架构审查',
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        transitions: { done: { target: 'end', actor: 'agent' } },
      },
      end: { type: 'terminal' },
    },
  }
}

// ── 写 family registry ──

function writeFamilyRegistry(tmpDir, familyName, archEngineUrl) {
  const familyDir = join(tmpDir, familyName)
  mkdirSync(familyDir, { recursive: true })
  writeFileSync(join(familyDir, 'registry.json'), JSON.stringify({
    version: 1,
    members: {
      'mock-arch': {
        role: 'arch',
        engine: archEngineUrl,
        status: 'online',
        pid: process.pid,
      },
    },
  }))
}

// ── 测试 ──

describe('E2E: 跨 Muse Handoff（真实 hook）', () => {
  let mockServer, tmpDir

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'muse-e2e-'))
    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test-family'
    process.env.MUSE_ROOT = tmpDir
    setWorkflowRegistry(null)

    // 创建真实 hook 实例
    promptHook = createWorkflowPrompt()
    gateHook = createWorkflowGate()

    mockServer = createMockServer()
    await mockServer.start()

    const wfPath = join(tmpDir, 'cross-muse-wf.json')
    await writeFile(wfPath, JSON.stringify(crossMuseWorkflow()))
    writeFamilyRegistry(tmpDir, 'test-family', mockServer.url)
  })

  afterEach(async () => {
    setWorkflowRegistry(null)
    mockServer.clearOnPrompt()
    await mockServer.close()
    delete process.env.MUSE_HOME
    delete process.env.MUSE_FAMILY
    delete process.env.MUSE_ROOT
    try { await rm(tmpDir, { recursive: true }) } catch {}
  })

  async function initWorkflow() {
    const wfPath = join(tmpDir, 'cross-muse-wf.json')
    const result = await handleWorkflowInit('ses_pua', { workflow_id: wfPath }, tmpDir)
    const info = JSON.parse(result.content[0].text)
    assert.equal(info.success, true, 'init 应成功')
    return info.instance
  }

  // ── E1: 完整 handoff 3-step ──
  // ACK 和 delivered 均由真实 prompt hook 写回

  it('E1: 完整 handoff — prompt hook 写 acked + delivered', async () => {
    const instanceId = await initWorkflow()

    // transition → arch_review 触发 handoff
    // 内部 executeHandoff 3-step:
    //   Step 1: createSession → pending
    //   Step 2: prompt(BIND) → mock server 调 promptHook → hook 检测 pending → 写 acked
    //   Step 3: prompt(EXECUTE) → mock server 调 promptHook → hook 检测 executing → 写 delivered
    const t = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const tInfo = JSON.parse(t.content[0].text)

    assert.equal(tInfo.success, true, 'transition 应成功')
    assert.equal(tInfo.to, 'arch_review')
    assert.ok(tInfo.handoff, '应触发 handoff')
    assert.equal(tInfo.handoff.triggered, true)
    assert.equal(tInfo.handoff.target, 'arch')

    // ★ 断言：由真实 hook 写入的 delivered
    const finalState = loadInstanceState(instanceId)
    assert.equal(finalState.handoff.status, 'delivered',
      'prompt hook 应将 handoff 写为 delivered')
    assert.ok(finalState.handoff.ackedAt, '应有 ackedAt 时间戳（hook 写入）')
    assert.ok(finalState.handoff.deliveredAt, '应有 deliveredAt 时间戳（hook 写入）')

    // mock server 收到 2 次 prompt
    assert.equal(mockServer.promptCount, 2, 'BIND + EXECUTE = 2 次 prompt')
  })

  // ── E4b: Step 3 hook 前失败 → 保持 executing + lastError ──
  // before_hook 在第 2 次 prompt（EXECUTE）失败：server 拒绝，hook 没跑

  it('E4b: Step 3 EXECUTE 前失败 → failed + lastError + 可恢复', async () => {
    const instanceId = await initWorkflow()

    // ★ 只在第 2 次 prompt（Step 3 EXECUTE）注入 before_hook：
    // 第 1 次 BIND → 正常（真实 hook 写 acked）
    // 第 2 次 EXECUTE → 503（hook 没机会执行 → 不写 delivered）
    mockServer.setFault('before_hook', 2)

    const t = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const tInfo = JSON.parse(t.content[0].text)

    assert.equal(tInfo.success, false, 'Step 3 失败 → success=false')
    assert.equal(tInfo.handoff_failed, true)
    assert.equal(tInfo.handoff.recoverable, true)

    const state = loadInstanceState(instanceId)
    // 外层 catch 写 failed（覆盖 executing）+ lastError
    assert.equal(state.handoff.status, 'failed')
    assert.ok(state.handoff.lastError, '应有 lastError')
    assert.ok(state.handoff.errorAt, '应有 errorAt')

    // ★ 关键：Step 2 BIND 正常走了（promptCount 应 >= 1）
    // hook 对 BIND prompt 写了 acked，但外层 catch 重建了 handoff 对象
    assert.ok(mockServer.promptCount >= 1, 'Step 2 BIND 应已发送')
  })

  // ── E4a: Step 3 after_hook 失败 + hook 已写 delivered → 幂等 ──
  // after_hook: server 接收并处理了 prompt（hook 写 delivered），但返回 503

  it('E4a: Step 3 after_hook — hook 已写 delivered → 幂等不重发', async () => {
    const instanceId = await initWorkflow()

    // ★ 第 2 次 prompt（EXECUTE）注入 after_hook：
    // hook 正常执行（写 delivered），但 HTTP 返回 503
    // executeHandoff catch 检查 state → 发现 delivered → 不 throw（幂等）
    mockServer.setFault('after_hook', 2)

    const t = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const tInfo = JSON.parse(t.content[0].text)

    // transition 应成功（幂等路径）
    assert.equal(tInfo.success, true, 'after_hook 幂等：transition 应成功')
    assert.ok(tInfo.handoff, '应有 handoff 信息')

    // ★ 由真实 hook 写入的 delivered
    const state = loadInstanceState(instanceId)
    assert.equal(state.handoff.status, 'delivered',
      'hook 已写 delivered，最终状态应为 delivered')
    assert.ok(state.handoff.deliveredAt, 'deliveredAt 应由 hook 写入')

    // 不重复投递
    assert.equal(mockServer.promptCount, 2, 'BIND + EXECUTE = 2 次，不重发')
  })

  // ── E6: retry force=true → 新 session + 旧清理 ──

  it('E6: retry force=true → 新 session + 旧清理', async () => {
    const instanceId = await initWorkflow()

    // 先触发失败 handoff（Step 2 BIND 就失败）
    mockServer.setFault('before_hook')

    const t1 = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const t1Info = JSON.parse(t1.content[0].text)
    assert.equal(t1Info.success, false, '初次 handoff 应失败')

    const failedState = loadInstanceState(instanceId)
    assert.equal(failedState.handoff.status, 'failed')
    const oldSessionId = failedState.handoff.targetSession
    const oldPromptCount = mockServer.promptCount

    // 清除故障 → retry 走正常 3-step
    mockServer.clearFault()

    const retryResult = await handleWorkflowRetryHandoff('ses_pua', { force: true })
    const retryInfo = JSON.parse(retryResult.content[0].text)

    assert.equal(retryInfo.retried, true, 'retry 应返回 retried=true')
    assert.equal(retryInfo.target, 'arch')

    // ★ 旧 session-index 应被清理
    if (oldSessionId) {
      assert.equal(lookupInstance(oldSessionId), null,
        '旧 session 应从 session-index 移除')
    }

    // ★ 新 session 应被创建
    assert.ok(mockServer.sessions.size >= 2, '应有新旧至少 2 个 session')

    // ★ 新 prompt 应已发送（BIND + EXECUTE）
    assert.ok(mockServer.promptCount > oldPromptCount,
      'retry 后应有新 prompt 调用')

    // ★ 由真实 hook 写入的 delivered
    const finalState = loadInstanceState(instanceId)
    assert.equal(finalState.handoff.status, 'delivered',
      'retry 后由 hook 写入 delivered')
    assert.ok(finalState.handoff.deliveredAt, 'deliveredAt 应由 hook 写入')

    // 新 binding 和旧不同
    const newBinding = finalState.bindings.find(b => b.role === 'arch')
    assert.ok(newBinding, 'bindings 中应有 arch')
    assert.notEqual(newBinding.sessionId, oldSessionId,
      '新 binding sessionId 应不同于旧的')
  })

  // ── E3-extra: gate hook 拦截 + 放行 ──

  it('E3-extra: gate hook 在非 delivered 态拦截 read 工具 + delivered 态放行', async () => {
    const instanceId = await initWorkflow()

    // 用 onPrompt 在 BIND prompt（第 1 次）到达时捕获 targetSession
    // 此时 hook 刚写完 acked，是测试 gate 拦截的好时机
    let capturedTargetSid = null
    let gateBlockedInAcked = false
    mockServer.onPrompt(async (n, sid) => {
      if (n === 1) {
        capturedTargetSid = sid
        // ★ acked 态时调 gate hook — 应拦截 read 工具
        try {
          await gateHook({ tool: 'read', args: {}, sessionID: sid })
        } catch (err) {
          if (err.message.includes('工作流拦截')) gateBlockedInAcked = true
        }
      }
    })

    // 触发完整 handoff（3-step → delivered）
    const t = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const tInfo = JSON.parse(t.content[0].text)
    assert.equal(tInfo.success, true)
    mockServer.clearOnPrompt()

    // ★ 断言：acked 态时 read 被拦截
    assert.ok(gateBlockedInAcked, 'acked 态应拦截 read 工具')

    // ★ 断言：delivered 态时 workflow_status 放行
    const state = loadInstanceState(instanceId)
    assert.equal(state.handoff.status, 'delivered')
    await assert.doesNotReject(
      () => gateHook({ tool: 'workflow_status', args: {}, sessionID: capturedTargetSid }),
      'delivered 态应放行 workflow_status'
    )
  })
})
