/**
 * T39 工作流引擎端到端测试
 *
 * 模拟 pua + arch 双参与者工作流完整链路：
 *   analyze(pua) → arch_review(arch) → check_result(decision) → done
 *
 * 验证：
 * - 工作流加载 + 实例创建
 * - session 绑定 + 参与者三态
 * - GateEnforcer 拦截（冻结态、能力白名单、bash deny）
 * - MCP 工具（status/transition/emit_artifact）
 * - Decision 节点自动路由
 * - Prompt 注入内容
 * - 完整状态流转历史
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { loadWorkflowFromFile, parseWorkflow } from './definition.mjs'
import { StateMachine } from './state-machine.mjs'
import { WorkflowRegistry, setRegistry, getRegistry } from './registry.mjs'
import { GateEnforcer } from './gate-enforcer.mjs'
import { createWorkflowGate } from '../plugin/hooks/workflow-gate.mjs'
import { createWorkflowPrompt, compileNodePrompt } from '../plugin/hooks/workflow-prompt.mjs'
import {
  handleWorkflowStatus,
  handleWorkflowTransition,
  handleWorkflowEmitArtifact,
} from '../mcp/workflow-tools.mjs'

const WF_PATH = join(import.meta.dirname, 'examples', 'code-review-wf.json')
const WORKSPACE = '/Users/test/project'

describe('E2E: code-review-wf 完整流程', () => {
  let def, sm, reg, gate, tmpDir

  beforeEach(async () => {
    // 1. 加载工作流定义
    def = await loadWorkflowFromFile(WF_PATH)

    // 2. 创建状态机
    sm = new StateMachine(def, { taskId: 'e2e-test-1' })

    // 3. 创建 registry + 绑定 session
    reg = new WorkflowRegistry({ workspaceRoot: WORKSPACE })
    reg.register(sm, [
      { role: 'pua', sessionId: 'ses_pua' },
      { role: 'arch', sessionId: 'ses_arch' },
    ])
    setRegistry(reg)

    // 4. 创建 gate hook
    gate = createWorkflowGate()

    // 5. 临时目录 for artifacts
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-e2e-'))
  })

  afterEach(async () => {
    setRegistry(null)
    try { await rm(tmpDir, { recursive: true }) } catch {}
  })

  it('完整链路: analyze → arch_review → decision → done', async () => {
    console.log('\n══════ E2E 开始 ══════\n')

    // ── Step 1: analyze 节点（pua 活跃）──
    console.log('--- Step 1: analyze 节点 ---')
    assert.equal(sm.currentNodeId, 'analyze')
    assert.equal(reg.getParticipantStatus('ses_pua'), 'active')
    assert.equal(reg.getParticipantStatus('ses_arch'), 'frozen')

    // pua 可以 read
    await gate({ tool: 'read', args: {}, sessionID: 'ses_pua' })
    console.log('[OK] pua read 放行')

    // pua 不能 edit（capabilities 里没有 code_write）
    await assert.rejects(
      () => gate({ tool: 'edit', args: {}, sessionID: 'ses_pua' }),
      /不允许/,
    )
    console.log('[OK] pua edit 拦截')

    // pua 不能 bash（deny）
    await assert.rejects(
      () => gate({ tool: 'bash', args: { command: 'ls' }, sessionID: 'ses_pua' }),
      /不允许/,
    )
    console.log('[OK] pua bash 拦截(deny)')

    // arch 被冻结，只能 read
    await gate({ tool: 'read', args: {}, sessionID: 'ses_arch' })
    console.log('[OK] arch(冻结) read 放行')
    await assert.rejects(
      () => gate({ tool: 'edit', args: {}, sessionID: 'ses_arch' }),
      /冻结/,
    )
    console.log('[OK] arch(冻结) edit 拦截')

    // 查询 workflow_status
    const status1 = await handleWorkflowStatus('ses_pua')
    const info1 = JSON.parse(status1.content[0].text)
    assert.equal(info1.current_node.id, 'analyze')
    assert.equal(info1.participant_status, 'active')
    console.log('[OK] workflow_status:', info1.current_node.id)

    // 检查 prompt 注入
    const prompt = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(prompt.includes('分析代码库'))
    assert.ok(prompt.includes('禁止'))
    console.log('[OK] prompt 注入含目标和禁止')

    // pua 产出 analysis-report.json
    const report = JSON.stringify({
      module: 'workflow',
      files: ['definition.mjs', 'state-machine.mjs'],
      dependencies: ['logger.mjs'],
      summary: '工作流引擎核心模块',
    })
    const emitResult = await handleWorkflowEmitArtifact('ses_pua', {
      name: 'analysis-report.json',
      content: report,
    }, tmpDir)
    const emitInfo = JSON.parse(emitResult.content[0].text)
    assert.equal(emitInfo.success, true)
    console.log('[OK] artifact 产出:', emitInfo.artifact)

    // exit_criteria 满足
    const exitCheck = sm.checkExitCriteria()
    assert.equal(exitCheck.satisfied, true)
    console.log('[OK] exit_criteria 满足')

    // ── Step 2: transition → arch_review ──
    console.log('\n--- Step 2: transition → arch_review ---')
    const t1 = await handleWorkflowTransition('ses_pua', { event: 'submit_review' })
    const t1Info = JSON.parse(t1.content[0].text)
    assert.equal(t1Info.success, true)
    assert.equal(t1Info.to, 'arch_review')
    assert.equal(sm.currentNodeId, 'arch_review')
    console.log('[OK] transition:', t1Info.from, '→', t1Info.to)

    // 参与者状态翻转
    assert.equal(reg.getParticipantStatus('ses_pua'), 'frozen')
    assert.equal(reg.getParticipantStatus('ses_arch'), 'active')
    console.log('[OK] 参与者翻转: pua=frozen, arch=active')

    // pua 被冻结
    await assert.rejects(
      () => gate({ tool: 'workflow_transition', args: {}, sessionID: 'ses_pua' }),
      /冻结/,
    )
    console.log('[OK] pua(冻结) workflow_transition 拦截')

    // ── Step 3: arch 审核 ──
    console.log('\n--- Step 3: arch 审核 ---')
    // arch 可以 read
    await gate({ tool: 'read', args: {}, sessionID: 'ses_arch' })
    console.log('[OK] arch(活跃) read 放行')

    // arch 产出 review-result.json
    const review = JSON.stringify({
      verdict: 'approve',
      comments: '架构合理，模块划分清晰',
      score: 9,
    })
    const reviewEmit = await handleWorkflowEmitArtifact('ses_arch', {
      name: 'review-result.json',
      content: review,
    }, tmpDir)
    const reviewInfo = JSON.parse(reviewEmit.content[0].text)
    assert.equal(reviewInfo.success, true)
    console.log('[OK] arch 产出 review-result.json')

    // ── Step 4: transition → check_result (decision) → done ──
    console.log('\n--- Step 4: decision 自动路由 ---')
    const t2 = await handleWorkflowTransition('ses_arch', { event: 'review_done' })
    const t2Info = JSON.parse(t2.content[0].text)
    assert.equal(t2Info.success, true)
    console.log('[OK] transition:', t2Info.from, '→', t2Info.to)

    // decision 节点应该自动路由到 done
    assert.equal(sm.currentNodeId, 'done')
    assert.equal(sm.status, 'completed')
    console.log('[OK] decision 自动路由到 done, status=completed')

    // ── 验证完整历史 ──
    console.log('\n--- 验证历史 ---')
    const history = sm.history
    console.log('流转历史:')
    for (const h of history) {
      console.log(`  ${h.from || 'null'} → ${h.to || 'null'} (${h.event}, actor=${h.actor})`)
    }
    assert.ok(history.length >= 4)
    assert.equal(history[0].event, 'start')
    assert.ok(history.some(h => h.event === 'submit_review'))
    assert.ok(history.some(h => h.event === 'review_done'))
    assert.ok(history.some(h => h.event === 'approved' && h.actor === 'system'))

    // ── 验证持久化一致性 ──
    const state = sm.toState()
    assert.equal(state.status, 'completed')
    assert.ok(state.artifacts['analysis-report.json'])
    assert.ok(state.artifacts['review-result.json'])
    console.log('[OK] 持久化状态一致')

    console.log('\n══════ E2E 完成 ══════\n')
  })

  it('拒绝场景: arch 不写审核报告 → decision 走 default 回退', async () => {
    // analyze → arch_review → 直接 review_done（不 emit artifact）→ decision
    sm.registerArtifact('analysis-report.json', '/tmp/a.json')
    sm.transition('submit_review', 'agent')

    // arch 直接 transition 不写报告
    sm.transition('review_done', 'agent')

    // decision: review-result.json 未注册 → artifact_exists 不满足 → 走 default → analyze
    assert.equal(sm.currentNodeId, 'analyze')
    assert.equal(sm.status, 'running')
    console.log('[OK] 缺 artifact → decision 走 default → 回退到 analyze')
  })
})

describe('E2E: 工作流定义加载', () => {
  it('从文件加载 code-review-wf.json → 成功', async () => {
    const def = await loadWorkflowFromFile(WF_PATH)
    assert.equal(def.id, 'code-review-wf')
    assert.equal(def.listNodeIds().length, 4)
    assert.equal(def.getNode('analyze').participant, 'pua')
    assert.equal(def.getNode('arch_review').participant, 'arch')
    assert.equal(def.getNode('check_result').type, 'decision')
    console.log('[OK] 工作流加载成功:', def.id, def.listNodeIds())
  })
})

describe('E2E: Gate 拦截场景', () => {
  let def, sm, reg, gate

  beforeEach(async () => {
    def = await loadWorkflowFromFile(WF_PATH)
    sm = new StateMachine(def, { taskId: 'gate-test' })
    reg = new WorkflowRegistry({ workspaceRoot: '/test' })
    reg.register(sm, [
      { role: 'pua', sessionId: 'ses_pua' },
      { role: 'arch', sessionId: 'ses_arch' },
    ])
    setRegistry(reg)
    gate = createWorkflowGate()
  })
  afterEach(() => setRegistry(null))

  it('analyze 节点: write 被拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'write', args: { filePath: '/test/foo.js' }, sessionID: 'ses_pua' }),
      /不允许/,
    )
    console.log('[OK] write 在 analyze 节点被拦截')
  })

  it('analyze 节点: edit 被拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'edit', args: {}, sessionID: 'ses_pua' }),
      /不允许/,
    )
    console.log('[OK] edit 在 analyze 节点被拦截')
  })

  it('analyze 节点: bash 被拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'bash', args: { command: 'rm -rf /' }, sessionID: 'ses_pua' }),
      /不允许/,
    )
    console.log('[OK] bash 在 analyze 节点被拦截')
  })

  it('analyze 节点: read 放行', async () => {
    await gate({ tool: 'read', args: {}, sessionID: 'ses_pua' })
    console.log('[OK] read 在 analyze 节点放行')
  })

  it('analyze 节点: workflow_list 放行 (ALWAYS_ALLOWED)', async () => {
    await gate({ tool: 'workflow_list', args: {}, sessionID: 'ses_pua' })
    console.log('[OK] workflow_list 在 analyze 节点放行')
  })

  it('analyze 节点: workflow_status 放行 (ALWAYS_ALLOWED)', async () => {
    await gate({ tool: 'workflow_status', args: {}, sessionID: 'ses_pua' })
    console.log('[OK] workflow_status 在 analyze 节点放行')
  })
})

describe('E2E: 用户确认流转', () => {
  it('analyze 节点 exit_criteria 含 actor=user', async () => {
    const def = await loadWorkflowFromFile(WF_PATH)
    const node = def.getNode('analyze')
    assert.equal(node.exit_criteria.actor, 'user')
    console.log('[OK] analyze exit_criteria.actor = user')
  })

  it('prompt 注入包含"等待: user"', async () => {
    const def = await loadWorkflowFromFile(WF_PATH)
    const sm = new StateMachine(def, { taskId: 'prompt-test' })
    const node = sm.getCurrentNode()
    const prompt = compileNodePrompt(node, sm, 'active')
    assert.ok(prompt.includes('等待: user'), 'prompt 应包含 "等待: user"')
    console.log('[OK] prompt 注入包含 "等待: user"')
  })

  it('prompt 注入包含用户确认约束', async () => {
    const def = await loadWorkflowFromFile(WF_PATH)
    const sm = new StateMachine(def, { taskId: 'constraint-test' })
    const node = sm.getCurrentNode()
    const prompt = compileNodePrompt(node, sm, 'active')
    assert.ok(prompt.includes('等待用户确认'), 'prompt 应包含等待用户确认的约束')
    console.log('[OK] prompt 注入包含用户确认约束')
  })
})
