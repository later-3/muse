/**
 * T42-4: Planner MCP Tools 测试
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkflowRegistry, setRegistry } from '../workflow/registry.mjs'
import { StateMachine } from '../workflow/state-machine.mjs'
import { parseWorkflow } from '../workflow/definition.mjs'
import { saveInstanceState, indexSession } from '../workflow/bridge.mjs'
import {
  PLANNER_TOOLS,
  handleWorkflowCreate,
  handleWorkflowAdminTransition,
  handleWorkflowInspect,
  handleWorkflowRollback,
  handleHandoffToMember,
  handleReadArtifact,
} from './planner-tools.mjs'

// ── Test Fixtures ──

function plannerWorkflow() {
  return {
    id: 'planner-test',
    name: 'Test Planner Workflow',
    version: '1.0',
    driver: 'planner',
    initial: 'analyze',
    participants: [{ role: 'coder' }, { role: 'user' }],
    nodes: {
      analyze: {
        type: 'action',
        participant: 'coder',
        objective: '分析需求',
        capabilities: ['code_read'],
        transitions: {
          submit: { target: 'review', actor: 'agent' },
        },
      },
      review: {
        type: 'handoff',
        participant: 'user',
        objective: '用户审核',
        wait_for_user: true,
        transitions: {
          approve: { target: 'done', actor: 'user' },
          reject: { target: 'analyze', actor: 'user' },
        },
      },
      done: {
        type: 'terminal',
      },
    },
  }
}

function selfWorkflow() {
  return {
    id: 'self-test',
    name: 'Test Self Workflow',
    version: '1.0',
    driver: 'self',
    initial: 'start',
    participants: [{ role: 'coder' }],
    nodes: {
      start: {
        type: 'action',
        participant: 'coder',
        objective: '开始',
        transitions: {
          done: { target: 'end', actor: 'agent' },
        },
      },
      end: { type: 'terminal' },
    },
  }
}

// ── Tests ──

describe('PLANNER_TOOLS 定义', () => {
  it('包含 6 个工具', () => {
    assert.equal(PLANNER_TOOLS.length, 6)
    const names = PLANNER_TOOLS.map(t => t.name)
    assert.ok(names.includes('workflow_create'))
    assert.ok(names.includes('workflow_admin_transition'))
    assert.ok(names.includes('workflow_inspect'))
    assert.ok(names.includes('workflow_rollback'))
    assert.ok(names.includes('handoff_to_member'))
    assert.ok(names.includes('read_artifact'))
  })

  it('工具定义包含 inputSchema', () => {
    for (const tool of PLANNER_TOOLS) {
      assert.ok(tool.inputSchema, `${tool.name} 缺少 inputSchema`)
      assert.equal(tool.inputSchema.type, 'object')
    }
  })
})

describe('workflow_create', () => {
  it('缺少 workflow_id → 报错', async () => {
    const result = await handleWorkflowCreate('test-session', {})
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('driver=self 的工作流 → 拒绝', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'planner-test-'))
    const defDir = join(tmpDir, 'test', 'workflow', 'definitions')
    mkdirSync(defDir, { recursive: true })
    writeFileSync(join(defDir, 'self.json'), JSON.stringify(selfWorkflow()))

    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test'

    const result = await handleWorkflowCreate('test-session', { workflow_id: 'self.json' })
    assert.ok(result.content[0].text.includes('driver'))

    delete process.env.MUSE_HOME
    delete process.env.MUSE_FAMILY
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('happy path: driver=planner 的工作流 → 创建成功', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'planner-test-'))
    const defDir = join(tmpDir, 'test', 'workflow', 'definitions')
    mkdirSync(defDir, { recursive: true })
    writeFileSync(join(defDir, 'plan.json'), JSON.stringify(plannerWorkflow()))

    // 设置 bridge 需要的环境变量
    const wfRoot = join(tmpDir, 'test', 'workflow')
    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test'

    const result = await handleWorkflowCreate('test-session', { workflow_id: 'plan.json' })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
    assert.equal(data.driver, 'planner')
    assert.equal(data.current_node, 'analyze')
    assert.ok(data.instance_id)

    delete process.env.MUSE_HOME
    delete process.env.MUSE_FAMILY
    rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('workflow_admin_transition', () => {
  it('缺少参数 → 报错', async () => {
    const result = await handleWorkflowAdminTransition('test-session', { instance_id: 'fake' })
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('实例不存在 → 报错', async () => {
    const result = await handleWorkflowAdminTransition('test-session', { instance_id: 'fake-id', event: 'submit' })
    assert.ok(result.content[0].text.includes('不存在'))
  })
})

describe('workflow_inspect', () => {
  it('缺少 instance_id → 报错', async () => {
    const result = await handleWorkflowInspect('test-session', {})
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('实例不存在 → 报错', async () => {
    const result = await handleWorkflowInspect('test-session', { instance_id: 'fake-id' })
    assert.ok(result.content[0].text.includes('不存在'))
  })
})

describe('workflow_rollback', () => {
  it('缺少参数 → 报错', async () => {
    const result = await handleWorkflowRollback('test-session', { instance_id: 'fake' })
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('实例不存在 → 报错', async () => {
    const result = await handleWorkflowRollback('test-session', {
      instance_id: 'fake-id',
      target_node: 'analyze',
      reason: 'test',
    })
    assert.ok(result.content[0].text.includes('不存在'))
  })
})

describe('read_artifact', () => {
  it('缺少参数 → 报错', async () => {
    const result = await handleReadArtifact('test-session', { instance_id: 'fake' })
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('../ 路径穿越 → 拒绝', async () => {
    const result = await handleReadArtifact('test-session', {
      instance_id: 'fake-id',
      name: '../secret.txt',
    })
    assert.ok(result.content[0].text.includes('非法'))
  })

  it('绝对路径 → 拒绝', async () => {
    const result = await handleReadArtifact('test-session', {
      instance_id: 'fake-id',
      name: '/etc/passwd',
    })
    assert.ok(result.content[0].text.includes('非法'))
  })
})

describe('workflow 生命周期 happy path', () => {
  let instanceId
  const tmpDir = mkdtempSync(join(tmpdir(), 'planner-lifecycle-'))

  // before: 创建工作流实例
  it('创建 → inspect → admin_transition → 终态', async () => {
    const defDir = join(tmpDir, 'test', 'workflow', 'definitions')
    mkdirSync(defDir, { recursive: true })
    writeFileSync(join(defDir, 'lifecycle.json'), JSON.stringify(plannerWorkflow()))

    process.env.MUSE_HOME = tmpDir
    process.env.MUSE_FAMILY = 'test'

    // 1. 创建
    const create = await handleWorkflowCreate('test-session', { workflow_id: 'lifecycle.json' })
    const createData = JSON.parse(create.content[0].text)
    assert.equal(createData.success, true)
    instanceId = createData.instance_id

    // 2. inspect
    const inspect = await handleWorkflowInspect('test-session', { instance_id: instanceId })
    const inspectData = JSON.parse(inspect.content[0].text)
    assert.equal(inspectData.status, 'running')
    assert.equal(inspectData.current_node, 'analyze')
    assert.ok(inspectData.nodes.length >= 3)

    // 3. admin_transition → review
    const t1 = await handleWorkflowAdminTransition('test-session', {
      instance_id: instanceId, event: 'submit', reason: '分析完成',
    })
    assert.equal(JSON.parse(t1.content[0].text).success, true)

    // 4. admin_transition with user gate → done
    const t2 = await handleWorkflowAdminTransition('test-session', {
      instance_id: instanceId, event: 'approve',
      on_behalf_of: 'user', evidence: 'Later 说: 通过',
    })
    assert.equal(JSON.parse(t2.content[0].text).success, true)

    // 5. inspect → completed
    const final = await handleWorkflowInspect('test-session', { instance_id: instanceId })
    const finalData = JSON.parse(final.content[0].text)
    assert.equal(finalData.status, 'completed')
    assert.equal(finalData.current_node, 'done')

    delete process.env.MUSE_HOME
    delete process.env.MUSE_FAMILY
    rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('handoff_to_member', () => {
  it('缺少参数 → 报错', async () => {
    const result = await handleHandoffToMember('test-session', { instance_id: 'fake' })
    assert.ok(result.content[0].text.includes('缺少'))
  })

  it('实例不存在 → 报错', async () => {
    const result = await handleHandoffToMember('test-session', {
      instance_id: 'fake-id', role: 'coder',
    })
    assert.ok(result.content[0].text.includes('不存在'))
  })
})
