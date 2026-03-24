import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseWorkflow } from '../../workflow/definition.mjs'
import { StateMachine } from '../../workflow/state-machine.mjs'
import { WorkflowRegistry, setRegistry } from '../../workflow/registry.mjs'
import { createWorkflowGate } from './workflow-gate.mjs'
import { createWorkflowPrompt, compileNodePrompt } from './workflow-prompt.mjs'

function devWorkflow() {
  return parseWorkflow({
    id: 'dev-task', name: 'Test', version: '1.0', initial: 'analyze',
    participants: [{ role: 'orchestrator' }, { role: 'executor' }],
    nodes: {
      analyze: {
        type: 'action', participant: 'orchestrator', objective: '分析任务',
        instructions: ['读代码', '写分析'],
        constraints: ['禁止改代码'],
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        exit_criteria: { artifacts: ['task-package.json'] },
        transitions: { submit: { target: 'execute', actor: 'agent' } },
      },
      execute: {
        type: 'handoff', participant: 'executor', objective: '编写代码',
        capabilities: ['code_read', 'code_write', 'shell_exec', 'workflow_control'],
        bash_policy: 'test_build',
        file_scope: {
          allowed_paths: ['muse/src/', 'muse/docs/'],
          blocked_paths: ['muse/src/workflow/', 'AGENTS.md'],
        },
        transitions: { done: { target: 'end', actor: 'agent' } },
      },
      end: { type: 'terminal' },
    },
  })
}

describe('workflow-gate hook', () => {
  let gate, reg, sm

  beforeEach(() => {
    reg = new WorkflowRegistry({ workspaceRoot: '/Users/test/project' })
    sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    reg.register(sm, [
      { role: 'orchestrator', sessionId: 'ses_orch' },
      { role: 'executor', sessionId: 'ses_exec' },
    ])
    setRegistry(reg)
    gate = createWorkflowGate()
  })

  afterEach(() => setRegistry(null))

  it('analyze: orchestrator 调 read → 放行', async () => {
    await gate({ tool: 'read', args: {}, sessionID: 'ses_orch' })
    // 不抛就算通过
  })

  it('analyze: orchestrator 调 edit → 拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'edit', args: {}, sessionID: 'ses_orch' }),
      /不允许/,
    )
  })

  it('analyze: orchestrator 调 bash → 拦截 (deny)', async () => {
    await assert.rejects(
      () => gate({ tool: 'bash', args: { command: 'cat foo' }, sessionID: 'ses_orch' }),
      /不允许/,
    )
  })

  it('analyze: executor(冻结) 调 read → 放行', async () => {
    await gate({ tool: 'read', args: {}, sessionID: 'ses_exec' })
  })

  it('analyze: executor(冻结) 调 edit → 拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'edit', args: {}, sessionID: 'ses_exec' }),
      /冻结/,
    )
  })

  it('analyze: executor(冻结) 调 bash → 拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'bash', args: { command: 'ls' }, sessionID: 'ses_exec' }),
      /冻结/,
    )
  })

  it('execute: executor 调 edit(allowed path) → 放行', async () => {
    sm.transition('submit', 'agent')  // → execute
    await gate({
      tool: 'edit',
      args: { filePath: '/Users/test/project/muse/src/foo.mjs' },
      sessionID: 'ses_exec',
    })
  })

  it('execute: executor 调 edit(blocked path) → 拦截', async () => {
    sm.transition('submit', 'agent')
    await assert.rejects(
      () => gate({
        tool: 'edit',
        args: { filePath: '/Users/test/project/muse/src/workflow/x.mjs' },
        sessionID: 'ses_exec',
      }),
      /blocked/,
    )
  })

  it('execute: executor 调 edit(AGENTS.md) → 拦截', async () => {
    sm.transition('submit', 'agent')
    await assert.rejects(
      () => gate({
        tool: 'edit',
        args: { filePath: '/Users/test/project/AGENTS.md' },
        sessionID: 'ses_exec',
      }),
      /blocked/,
    )
  })

  it('execute: executor 调 bash + npm test → 放行', async () => {
    sm.transition('submit', 'agent')
    await gate({
      tool: 'bash',
      args: { command: 'npm test' },
      sessionID: 'ses_exec',
    })
  })

  it('execute: executor 调 bash + sed -i → 拦截', async () => {
    sm.transition('submit', 'agent')
    await assert.rejects(
      () => gate({
        tool: 'bash',
        args: { command: 'cat x | sed -i s/a/b/' },
        sessionID: 'ses_exec',
      }),
      /不允许/,
    )
  })

  it('execute: orchestrator(冻结) 调 bash → 拦截', async () => {
    sm.transition('submit', 'agent')
    await assert.rejects(
      () => gate({ tool: 'bash', args: { command: 'ls' }, sessionID: 'ses_orch' }),
      /冻结/,
    )
  })

  it('未绑定 session → 放行', async () => {
    await gate({ tool: 'bash', args: { command: 'rm -rf /' }, sessionID: 'ses_nobody' })
  })

  it('无 registry → 放行', async () => {
    setRegistry(null)
    await gate({ tool: 'edit', args: {}, sessionID: 'ses_orch' })
  })
})

describe('workflow-prompt hook', () => {
  let prompt, reg, sm

  beforeEach(() => {
    reg = new WorkflowRegistry({ workspaceRoot: '/test' })
    sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    reg.register(sm, [
      { role: 'orchestrator', sessionId: 'ses_orch' },
      { role: 'executor', sessionId: 'ses_exec' },
    ])
    setRegistry(reg)
    prompt = createWorkflowPrompt()
  })

  afterEach(() => setRegistry(null))

  it('活跃参与者 → 注入完整 prompt', async () => {
    const output = { system: [] }
    await prompt({ sessionID: 'ses_orch' }, output)
    assert.equal(output.system.length, 1)
    const text = output.system[0]
    assert.ok(text.includes('WORKFLOW'))
    assert.ok(text.includes('分析任务'))
    assert.ok(text.includes('读代码'))
    assert.ok(text.includes('禁止改代码'))
  })

  it('冻结参与者 → 注入冻结提示', async () => {
    const output = { system: [] }
    await prompt({ sessionID: 'ses_exec' }, output)
    const text = output.system[0]
    assert.ok(text.includes('冻结'))
    assert.ok(!text.includes('分析任务'))  // 不注入完整指令
  })

  it('未绑定 session → 不注入', async () => {
    const output = { system: [] }
    await prompt({ sessionID: 'ses_nobody' }, output)
    assert.equal(output.system.length, 0)
  })

  it('无 registry → 不注入', async () => {
    setRegistry(null)
    const output = { system: [] }
    await prompt({ sessionID: 'ses_orch' }, output)
    assert.equal(output.system.length, 0)
  })
})

describe('compileNodePrompt', () => {
  const def = devWorkflow()

  it('包含 objective', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('分析任务'))
  })

  it('包含可用工具列表', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('read'))
    assert.ok(text.includes('workflow_status'))
  })

  it('包含 exit_criteria', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('task-package.json'))
  })

  it('包含工作流名称和描述', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('Test'), '应包含工作流名称')
  })

  it('wait_for_user 节点 → 注入等待用户指令', () => {
    const wfDef = parseWorkflow({
      id: 'review-wf', name: 'Review', version: '1.0', initial: 'review',
      participants: [{ role: 'pm' }],
      nodes: {
        review: {
          type: 'action', participant: 'pm', wait_for_user: true,
          objective: '等待审核',
          transitions: { ok: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const sm = new StateMachine(wfDef, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('等待用户'), '应包含等待用户指令')
    assert.ok(!text.includes('自主执行'), '不应包含自主执行')
  })

  it('自主执行节点 → 注入自主执行规则', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('自主执行'), '应包含自主执行')
    assert.ok(text.includes('workflow_transition'), '应提到 transition')
  })

  it('read_first 声明 → 注入前置阅读路径', () => {
    const wfDef = parseWorkflow({
      id: 'rf-wf', name: 'ReadFirst', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          read_first: ['muse/docs/architecture.md', 'muse/docs/philosophy.md'],
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const sm = new StateMachine(wfDef, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('前置阅读'), '应有前置阅读段')
    assert.ok(text.includes('muse/docs/architecture.md'), '应列出路径')
    assert.ok(text.includes('muse/docs/philosophy.md'), '应列出所有路径')
    assert.ok(!text.includes('# Muse'), '不应注入文件全文')
  })

  it('无 read_first → 不显示前置阅读段', () => {
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(!text.includes('前置阅读'), '不应有前置阅读段')
  })
})

import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import { tmpdir } from 'node:os'

describe('compileNodePrompt — 输入自检', () => {
  let tmpDir, origHome, origFamily

  beforeEach(() => {
    tmpDir = mkdtempSync(pathJoin(tmpdir(), 'wf-precheck-'))
    origHome = process.env.MUSE_HOME
    origFamily = process.env.MUSE_FAMILY
    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test-fam'
  })

  afterEach(() => {
    process.env.MUSE_HOME = origHome
    process.env.MUSE_FAMILY = origFamily
  })

  function makeWfWithInput(inputArtifacts) {
    return parseWorkflow({
      id: 'check-wf', name: '自检测试', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          input: { artifacts: inputArtifacts },
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
  }

  it('输入文件缺失 → 返回错误提示 + 暂停', () => {
    const def = makeWfWithInput(['need-this.md'])
    const sm = new StateMachine(def, { taskId: 't1' })
    // 不创建文件，让 pre-check 发现缺失
    const artDir = pathJoin(tmpDir, 'test-fam', 'workflow', 'instances', sm.instanceId, 'artifacts')
    mkdirSync(artDir, { recursive: true })

    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('输入缺失'), '应提示输入缺失')
    assert.ok(text.includes('need-this.md'), '应列出缺失文件名')
    assert.ok(text.includes('暂停'), '应提示暂停')
    assert.ok(!text.includes('执行规则'), '不应注入执行规则')
  })

  it('输入文件存在 → 注入路径信息 + 正常执行', () => {
    const def = makeWfWithInput(['brief.md'])
    const sm = new StateMachine(def, { taskId: 't1' })
    const artDir = pathJoin(tmpDir, 'test-fam', 'workflow', 'instances', sm.instanceId, 'artifacts')
    mkdirSync(artDir, { recursive: true })
    writeFileSync(pathJoin(artDir, 'brief.md'), '# Task Brief')

    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('输入文件'), '应包含输入文件段')
    assert.ok(text.includes('brief.md'), '应列出输入文件名')
    assert.ok(text.includes(artDir), '应包含 artifact 路径')
    assert.ok(text.includes('执行规则'), '应注入正常执行规则')
    assert.ok(!text.includes('输入缺失'), '不应报错')
  })

  it('多个输入部分缺失 → 只报缺失的', () => {
    const def = makeWfWithInput(['exists.md', 'missing.md'])
    const sm = new StateMachine(def, { taskId: 't1' })
    const artDir = pathJoin(tmpDir, 'test-fam', 'workflow', 'instances', sm.instanceId, 'artifacts')
    mkdirSync(artDir, { recursive: true })
    writeFileSync(pathJoin(artDir, 'exists.md'), 'ok')

    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('输入缺失'), '应报缺失')
    assert.ok(text.includes('missing.md'), '应报缺失文件')
    assert.ok(!text.includes('exists.md') || text.includes('⛔ missing.md'), '已存在文件不应标 ⛔')
  })

  it('无 input 声明 → 不检查，正常执行', () => {
    const def = parseWorkflow({
      id: 'no-input', name: 'NoInput', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const sm = new StateMachine(def, { taskId: 't1' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')
    assert.ok(text.includes('执行规则'), '应注入正常执行规则')
    assert.ok(!text.includes('输入缺失'), '不应报错')
    assert.ok(!text.includes('输入文件'), '不应显示输入文件段')
  })
})

// --- T41-4: 系统通知头三分支验证 ---

describe('T41-4: compileNodePrompt 系统通知头', () => {
  function makeSimpleWorkflow(opts = {}) {
    return parseWorkflow({
      id: 'notify-wf', name: 'T41-4测试工作流', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }, { role: 'reviewer' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          wait_for_user: opts.wait_for_user ?? false,
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
  }

  it('active 节点：有系统通知头，含工作流名、节点 ID、安全边界声明、transition 指令', () => {
    const sm = new StateMachine(makeSimpleWorkflow(), { taskId: 't41' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')

    assert.ok(text.includes('[系统通知]'), '应有系统通知头')
    assert.ok(text.includes('T41-4测试工作流'), '应含工作流名称')
    assert.ok(text.includes('work'), '应含节点 ID')
    assert.ok(text.includes('安全/身份边界持续生效'), '应声明安全边界不被覆盖（P0 持续）')
    assert.ok(text.includes('workflow_transition'), '自主节点应有 transition 指令')
  })

  it('frozen 节点：无系统通知头，无 workflow_transition 指令', () => {
    const sm = new StateMachine(makeSimpleWorkflow(), { taskId: 't41' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'frozen')

    assert.ok(!text.includes('[系统通知]'), 'frozen 分支不应有系统通知头')
    assert.ok(!text.includes('workflow_transition'), 'frozen 分支不应有 transition 指令')
    assert.ok(text.includes('冻结'), '应标识冻结状态')
  })

  it('wait_for_user 节点：有通知头，但不含 transition 指令', () => {
    const sm = new StateMachine(makeSimpleWorkflow({ wait_for_user: true }), { taskId: 't41' })
    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')

    assert.ok(text.includes('[系统通知]'), '等待用户节点也应有通知头')
    assert.ok(!text.includes('完成后调 workflow_transition'), '等待用户节点不应有 transition 指令')
  })

  it('输入缺失分支：无系统通知头，无 workflow_transition 指令', () => {
    // 用 MUSE_HOME/MUSE_FAMILY 环境变量确保进入真实的输入缺失检查分支
    // mkdtempSync/mkdirSync/tmpdir/pathJoin 由文件内 hoisted import 提供
    const td = mkdtempSync(pathJoin(tmpdir(), 't41-missing-'))
    const savedHome = process.env.MUSE_HOME
    const savedFamily = process.env.MUSE_FAMILY
    process.env.MUSE_HOME = td
    process.env.MUSE_FAMILY = 'test-fam'

    const def = parseWorkflow({
      id: 't41-missing', name: 'T41缺失测试', version: '1.0', initial: 'work',
      participants: [{ role: 'dev' }],
      nodes: {
        work: {
          type: 'action', participant: 'dev', objective: '干活',
          input: { artifacts: ['task-brief.md'] },   // 不会创建，必然缺失
          transitions: { done: { target: 'end', actor: 'agent' } },
        },
        end: { type: 'terminal' },
      },
    })
    const sm = new StateMachine(def, { taskId: 't41-missing' })
    const artDir = pathJoin(td, 'test-fam', 'workflow', 'instances', sm.instanceId, 'artifacts')
    mkdirSync(artDir, { recursive: true })
    // 不创建 task-brief.md，触发缺失分支

    const text = compileNodePrompt(sm.getCurrentNode(), sm, 'active')

    // 核心约束：缺失分支提前 return，不应有系统通知头或 transition 指令
    assert.ok(!text.includes('[系统通知]'), '输入缺失分支不应有系统通知头')
    assert.ok(!text.includes('workflow_transition'), '输入缺失分支不应有 transition 指令')
    assert.ok(text.includes('输入缺失'), '应提示输入缺失')

    process.env.MUSE_HOME = savedHome
    process.env.MUSE_FAMILY = savedFamily
  })
})

// ── Planner Mode 测试 ──

function mockSm(driver = 'self') {
  return {
    instanceId: 'test-instance',
    workflowId: 'test-wf',
    taskId: 't1',
    status: 'running',
    definition: {
      name: 'Test Workflow',
      description: '',
      driver,
    },
  }
}

function mockNode(overrides = {}) {
  return {
    id: 'test-node',
    type: 'action',
    participant: 'worker',
    objective: '测试目标',
    capabilities: ['code_read'],
    bash_policy: 'deny',
    transitions: {
      done: { target: 'next', actor: 'agent' },
    },
    ...overrides,
  }
}

describe('compileNodePrompt — Planner Mode', () => {
  it('driver=self → 包含 "workflow_transition"', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('self'), 'active')
    assert.ok(prompt.includes('workflow_transition'))
    assert.ok(!prompt.includes('通知 Planner'))
  })

  it('driver=planner → 包含 "通知 Planner"', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'active')
    assert.ok(prompt.includes('通知 Planner'))
    assert.ok(prompt.includes('不要调用 workflow_transition'))
    assert.ok(prompt.includes('不要直接通过 Telegram 联系用户'))
  })

  it('driver=planner → 不包含 "workflow_transition" 调用指令', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'active')
    // 注意：只检查「执行指令」部分不含 transition 调用
    // 状态流转列表可能仍然显示可用 transition（见 2.2）
    assert.ok(!prompt.includes('完成后立即调用 workflow_transition'))
    assert.ok(!prompt.includes('完成后调 workflow_transition 推进'))
  })

  it('driver=planner + wait_for_user=true → 同样走 planner 分支', () => {
    const node = mockNode({ wait_for_user: true })
    const prompt = compileNodePrompt(node, mockSm('planner'), 'active')
    assert.ok(prompt.includes('通知 Planner'))
    // 不应包含 T39 的 "等待用户指令" 分支
    assert.ok(!prompt.includes('等待用户通过 Telegram 回复'))
  })

  it('driver=self + wait_for_user=true → T39 原逻辑', () => {
    const node = mockNode({ wait_for_user: true })
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('等待用户通过 Telegram 回复'))
    assert.ok(!prompt.includes('通知 Planner'))
  })

  it('driver=self + wait_for_user=false → T39 原逻辑', () => {
    const node = mockNode()
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('完成后立即调用 workflow_transition'))
  })

  it('frozen 状态 → 不受 planner mode 影响', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'frozen')
    assert.ok(prompt.includes('冻结状态'))
    assert.ok(!prompt.includes('通知 Planner'))
  })
})

describe('compileNodePrompt — Planner Mode Transition Display', () => {
  it('driver=self → 显示 transition 调用', () => {
    const node = mockNode({
      transitions: { done: { target: 'next', actor: 'agent' } },
    })
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('workflow_transition("done")'))
  })

  it('driver=planner → 不显示 transition 调用', () => {
    const node = mockNode({
      transitions: { done: { target: 'next', actor: 'agent' } },
    })
    const prompt = compileNodePrompt(node, mockSm('planner'), 'active')
    assert.ok(!prompt.includes('workflow_transition("done")'))
  })
})

function plannerWorkflow() {
  return parseWorkflow({
    id: 'planner-task', name: 'Planner Test', version: '1.0',
    driver: 'planner',  // ★ T42 新增
    initial: 'work',
    participants: [{ role: 'worker' }],
    nodes: {
      work: {
        type: 'action', participant: 'worker', objective: '干活',
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        transitions: { done: { target: 'end', actor: 'agent' } },
      },
      end: { type: 'terminal' },
    },
  })
}

describe('workflow-gate hook — Planner Mode', () => {
  let gate, reg, sm

  beforeEach(() => {
    reg = new WorkflowRegistry({ workspaceRoot: '/test' })
    sm = new StateMachine(plannerWorkflow(), { taskId: 't-planner' })
    reg.register(sm, [{ role: 'worker', sessionId: 'ses_worker' }])
    setRegistry(reg)
    gate = createWorkflowGate()
  })

  afterEach(() => setRegistry(null))

  it('driver=planner: active 调 workflow_transition → 拦截', async () => {
    await assert.rejects(
      () => gate({ tool: 'workflow_transition', args: {}, sessionID: 'ses_worker' }),
      /Planner/,
    )
  })

  it('driver=planner: active 调 workflow_status → 放行', async () => {
    await gate({ tool: 'workflow_status', args: {}, sessionID: 'ses_worker' })
  })

  it('driver=planner: active 调 read → 放行', async () => {
    await gate({ tool: 'read', args: {}, sessionID: 'ses_worker' })
  })
})


