import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseWorkflow } from '../workflow/definition.mjs'
import { StateMachine } from '../workflow/state-machine.mjs'
import { WorkflowRegistry, setRegistry } from '../workflow/registry.mjs'
import {
  handleWorkflowList,
  handleWorkflowInit,
  handleWorkflowStatus,
  handleWorkflowTransition,
  handleWorkflowEmitArtifact,
} from './workflow-tools.mjs'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('workflow_list', () => {
  let tmpDir, origEnv

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-list-'))
    origEnv = process.env.MUSE_MEMBER_DIR
    process.env.MUSE_MEMBER_DIR = tmpDir
  })
  afterEach(async () => {
    process.env.MUSE_MEMBER_DIR = origEnv
    try { await rm(tmpDir, { recursive: true }) } catch {}
  })

  it('无 workflows/ 目录 → 空列表', () => {
    const result = handleWorkflowList()
    const info = JSON.parse(result.content[0].text)
    assert.deepEqual(info.workflows, [])
  })

  it('有工作流 → 返回概要', async () => {
    await mkdir(join(tmpDir, 'workflows'))
    await writeFile(join(tmpDir, 'workflows', 'test-wf.json'), JSON.stringify({
      id: 'test-wf',
      name: '测试工作流',
      description: '测试用',
      participants: [{ role: 'dev' }],
      nodes: { start: { type: 'action' }, end: { type: 'terminal' } },
    }))
    const result = handleWorkflowList()
    const info = JSON.parse(result.content[0].text)
    assert.equal(info.workflows.length, 1)
    assert.equal(info.workflows[0].id, 'test-wf')
    assert.equal(info.workflows[0].name, '测试工作流')
    assert.deepEqual(info.workflows[0].participants, ['dev'])
    assert.deepEqual(info.workflows[0].nodes, ['start', 'end'])
  })
})

import { getRegistry } from '../workflow/registry.mjs'

describe('workflow_init → status 主路径', () => {
  let tmpDir, origHome, origFamily

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-init-'))
    origHome = process.env.MUSE_HOME
    origFamily = process.env.MUSE_FAMILY
    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test-family'
    setRegistry(null)
  })
  afterEach(async () => {
    setRegistry(null)
    process.env.MUSE_HOME = origHome
    process.env.MUSE_FAMILY = origFamily
    try { await rm(tmpDir, { recursive: true }) } catch {}
  })

  it('init 后调用者 session 可直接 status', async () => {
    const wfDef = {
      id: 'test-wf', name: 'Test', version: '1.0', initial: 'analyze',
      participants: [{ role: 'pua' }, { role: 'arch' }],
      nodes: {
        analyze: { type: 'action', participant: 'pua', objective: '分析',
          capabilities: ['code_read'], bash_policy: 'deny',
          transitions: { go: { target: 'review', actor: 'agent' } } },
        review: { type: 'action', participant: 'arch', objective: '审查',
          capabilities: ['code_read'], bash_policy: 'deny',
          transitions: { done: { target: 'end', actor: 'agent' } } },
        end: { type: 'terminal' },
      },
    }
    const wfPath = join(tmpDir, 'test-wf.json')
    await writeFile(wfPath, JSON.stringify(wfDef))

    const initResult = await handleWorkflowInit('ses_real_pua', { workflow_id: wfPath }, tmpDir)
    const initInfo = JSON.parse(initResult.content[0].text)
    assert.equal(initInfo.success, true)

    // ★ 关键断言：同一个 sessionId 可以 status
    const statusResult = await handleWorkflowStatus('ses_real_pua')
    const statusInfo = JSON.parse(statusResult.content[0].text)
    assert.equal(statusInfo.current_node.id, 'analyze')
    assert.equal(statusInfo.your_role, 'pua')
  })

  it('非调用者角色标记为 placeholder（不受 participants 数组顺序影响）', async () => {
    const wfDef = {
      id: 'test-wf2', name: 'Test2', version: '1.0', initial: 'start',
      participants: [{ role: 'arch' }, { role: 'pua' }],  // arch 在前
      nodes: {
        start: { type: 'action', participant: 'pua', objective: '开始',  // 但初始节点是 pua
          capabilities: ['code_read'], bash_policy: 'deny',
          transitions: { go: { target: 'end', actor: 'agent' } } },
        end: { type: 'terminal' },
      },
    }
    const wfPath = join(tmpDir, 'test-wf2.json')
    await writeFile(wfPath, JSON.stringify(wfDef))

    await handleWorkflowInit('ses_caller', { workflow_id: wfPath }, tmpDir)

    const registry = getRegistry()
    const sm = registry.getBySession('ses_caller')
    assert.ok(sm, '调用者 session 应该被注册')
    // pua 是初始节点 participant → 真实 session → isPlaceholder = false
    assert.equal(registry.isPlaceholder(sm.instanceId, 'pua'), false)
    // arch 不是初始节点 participant → 占位 → isPlaceholder = true
    assert.equal(registry.isPlaceholder(sm.instanceId, 'arch'), true)
  })
})

function devWorkflow() {
  return parseWorkflow({
    id: 'dev-task', name: 'Test', version: '1.0', initial: 'analyze',
    participants: [{ role: 'orchestrator' }, { role: 'executor' }],
    nodes: {
      analyze: {
        type: 'action', participant: 'orchestrator', objective: '分析任务',
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        output: { artifact: 'task-package.json', required: true },
        exit_criteria: { artifacts: ['task-package.json'] },
        transitions: { submit: { target: 'review', actor: 'agent' } },
      },
      review: {
        type: 'gate', participant: 'orchestrator', objective: '审核',
        capabilities: ['code_read'],
        bash_policy: 'deny',
        transitions: {
          approve: { target: 'execute', actor: 'user' },
          reject: { target: 'analyze', actor: 'user' },
        },
      },
      execute: {
        type: 'handoff', participant: 'executor', objective: '编码',
        capabilities: ['code_read', 'code_write'],
        bash_policy: 'test_build',
        transitions: { done: { target: 'end', actor: 'agent' } },
      },
      end: { type: 'terminal' },
    },
  })
}

let reg, sm
beforeEach(() => {
  reg = new WorkflowRegistry({ workspaceRoot: '/test' })
  sm = new StateMachine(devWorkflow(), { taskId: 't1' })
  reg.register(sm, [
    { role: 'orchestrator', sessionId: 'ses_orch' },
    { role: 'executor', sessionId: 'ses_exec' },
  ])
  setRegistry(reg)
})
afterEach(() => setRegistry(null))

describe('workflow_status', () => {
  it('返回当前状态', async () => {
    const result = await handleWorkflowStatus('ses_orch')
    const info = JSON.parse(result.content[0].text)
    assert.equal(info.current_node.id, 'analyze')
    assert.equal(info.your_role, 'orchestrator')
    assert.equal(info.participant_status, 'active')
    assert.ok(info.available_transitions.some(t => t.event === 'submit'))
  })

  it('未绑定 session → 提示', async () => {
    const result = await handleWorkflowStatus('ses_nobody')
    assert.ok(result.content[0].text.includes('未绑定'))
  })
})

describe('workflow_transition', () => {
  it('agent transition → 成功', async () => {
    const result = await handleWorkflowTransition('ses_orch', { event: 'submit' })
    const info = JSON.parse(result.content[0].text)
    assert.equal(info.success, true)
    assert.equal(info.from, 'analyze')
    assert.equal(info.to, 'review')
  })

  it('agent 触发 user transition → 失败', async () => {
    sm.transition('submit', 'agent')  // → review
    const result = await handleWorkflowTransition('ses_orch', { event: 'approve' })
    assert.ok(result.content[0].text.includes('失败'))
  })

  it('缺 event → 提示', async () => {
    const result = await handleWorkflowTransition('ses_orch', {})
    assert.ok(result.content[0].text.includes('event'))
  })

  it('output.required 但文件不存在 + MUSE_MEMBER → 拒绝流转', async () => {
    // 构建有 output.required 的工作流
    const wfDef = parseWorkflow({
      id: 'post-check', name: 'PostCheck', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          output: { artifact: 'result.md', required: true },
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const postSm = new StateMachine(wfDef, { taskId: 'post-t1' })
    reg.register(postSm, [{ role: 'dev', sessionId: 'ses_postcheck' }])

    const origMember = process.env.MUSE_MEMBER
    process.env.MUSE_MEMBER = 'test-dev'
    try {
      const result = await handleWorkflowTransition('ses_postcheck', { event: 'done' })
      const text = result.content[0].text
      assert.ok(text.includes('无法流转'), '应拒绝流转')
      assert.ok(text.includes('result.md'), '应提示缺失的文件名')
      assert.ok(text.includes('workflow_emit_artifact'), '应提示用 emit_artifact')
    } finally {
      process.env.MUSE_MEMBER = origMember
    }
  })

  it('output.required 且文件存在 + MUSE_MEMBER → 允许流转', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const { mkdtempSync } = await import('node:fs')
    const postTmpDir = mkdtempSync(join(tmpdir(), 'wf-postok-'))
    const wfDef = parseWorkflow({
      id: 'post-ok', name: 'PostOK', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          output: { artifact: 'result.md', required: true },
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const postSm = new StateMachine(wfDef, { taskId: 'post-t2' })
    reg.register(postSm, [{ role: 'dev', sessionId: 'ses_postok' }])

    // 创建 artifact 文件
    const artDir = join(postTmpDir, 'test-family', 'workflow', 'instances', postSm.instanceId, 'artifacts')
    mkdirSync(artDir, { recursive: true })
    writeFileSync(join(artDir, 'result.md'), '# Done')

    const origMember = process.env.MUSE_MEMBER
    const origHome = process.env.MUSE_HOME
    const origFam = process.env.MUSE_FAMILY
    process.env.MUSE_MEMBER = 'test-dev'
    process.env.MUSE_HOME = postTmpDir
    process.env.MUSE_FAMILY = 'test-family'
    try {
      const result = await handleWorkflowTransition('ses_postok', { event: 'done' })
      const info = JSON.parse(result.content[0].text)
      assert.equal(info.success, true, '应成功流转')
      assert.equal(info.new_status, 'completed')
    } finally {
      process.env.MUSE_MEMBER = origMember
      process.env.MUSE_HOME = origHome
      process.env.MUSE_FAMILY = origFam
    }
  })
})

describe('workflow_emit_artifact', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-test-'))
  })
  afterEach(async () => {
    try { await rm(tmpDir, { recursive: true }) } catch {}
  })

  it('写声明过的 artifact → 成功', async () => {
    const content = JSON.stringify({ goal: 'test', files_to_change: [] })
    const result = await handleWorkflowEmitArtifact('ses_orch', {
      name: 'task-package.json',
      content,
    }, tmpDir)
    const info = JSON.parse(result.content[0].text)
    assert.equal(info.success, true)
    assert.ok(info.path.includes('task-package.json'))
    assert.equal(sm.hasArtifact('task-package.json'), true)
  })

  it('写未声明的 artifact → 拒绝', async () => {
    const result = await handleWorkflowEmitArtifact('ses_orch', {
      name: 'evil.sh',
      content: 'hack',
    }, tmpDir)
    assert.ok(result.content[0].text.includes('不匹配'))
  })

  it('非当前节点声明者 → 拒绝', async () => {
    sm.transition('submit', 'agent')  // → review (无 output)
    const result = await handleWorkflowEmitArtifact('ses_orch', {
      name: 'task-package.json',
      content: '{}',
    }, tmpDir)
    assert.ok(result.content[0].text.includes('未声明'))
  })
})
