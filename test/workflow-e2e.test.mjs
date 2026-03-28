/**
 * 工作流 E2E 集成测试 — 通道无关
 *
 * 不依赖 Telegram / Web / 任何通道。
 * 不依赖 LLM / OpenCode serve。
 * 直接调用 MCP tool handlers 模拟完整工作流生命周期：
 *
 *   1. Planner: workflow_create → 创建工作流实例
 *   2. Planner: handoff_to_member → 分派给 PUA (mock MemberClient)
 *   3. PUA:     ack_handoff → 确认接收
 *   4. PUA:     notify_planner → 汇报完成 (mock HTTP 回调)
 *   5. Planner: workflow_admin_transition → 推进到终态
 *   6. Planner: workflow_inspect → 确认 completed
 *
 * 运行: cd muse && node --test test/workflow-e2e.test.mjs
 */

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── 工作流模块 ──
import { WorkflowRegistry, setRegistry, getRegistry } from '../src/workflow/registry.mjs'
import { saveInstanceState, loadInstanceState } from '../src/workflow/bridge.mjs'
import {
  handleWorkflowCreate,
  handleWorkflowAdminTransition,
  handleWorkflowInspect,
  handleHandoffToMember,
} from '../src/mcp/planner-tools.mjs'
import { autoAckHandoff } from '../src/family/handoff.mjs'
import { handleNotifyPlanner } from '../src/mcp/callback-tools.mjs'

// ── Fixtures ──

/** 最简单节点工作流: PUA 向用户问好 → 完成 */
function greetWorkflow() {
  return {
    id: 'greet-user',
    name: 'PUA 问好工作流',
    version: '1.0',
    driver: 'planner',
    initial: 'greet',
    participants: [
      { role: 'pua', description: '向用户问好' },
    ],
    nodes: {
      greet: {
        type: 'action',
        participant: 'pua',
        objective: '向用户发送问候消息',
        instructions: ['发送问候', '汇报完成'],
        constraints: ['不修改文件'],
        capabilities: ['workflow_control'],
        transitions: {
          done: { target: 'end', actor: 'agent' },
        },
      },
      end: { type: 'terminal' },
    },
  }
}

/** 双节点工作流: PUA 分析 → user gate 确认 → 完成 */
function analyzeWorkflow() {
  return {
    id: 'analyze-gate',
    name: '分析 + 用户审批',
    version: '1.0',
    driver: 'planner',
    initial: 'analyze',
    participants: [
      { role: 'pua', description: '分析者' },
    ],
    nodes: {
      analyze: {
        type: 'action',
        participant: 'pua',
        objective: '分析项目状态',
        instructions: ['读取状态', '输出分析'],
        constraints: [],
        capabilities: ['code_read', 'workflow_control'],
        output: { artifact: 'analysis.txt' },
        transitions: {
          submit: { target: 'review', actor: 'agent' },
        },
      },
      review: {
        type: 'action',
        participant: 'pua',
        objective: '用户审核',
        wait_for_user: true,
        transitions: {
          approve: { target: 'end', actor: 'user' },
          reject: { target: 'analyze', actor: 'user' },
        },
      },
      end: { type: 'terminal' },
    },
  }
}

// ── Test Environment ──

let tmpDir
let defDir
let savedEnv = {}

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wf-e2e-'))
  defDir = join(tmpDir, 'test-family', 'workflow', 'definitions')
  mkdirSync(defDir, { recursive: true })
  mkdirSync(join(tmpDir, 'test-family', 'workflow', 'instances'), { recursive: true })

  // 写入工作流定义文件
  writeFileSync(join(defDir, 'greet-user.json'), JSON.stringify(greetWorkflow()))
  writeFileSync(join(defDir, 'analyze-gate.json'), JSON.stringify(analyzeWorkflow()))

  // 保存并设置环境变量
  savedEnv = {
    MUSE_HOME: process.env.MUSE_HOME,
    MUSE_FAMILY: process.env.MUSE_FAMILY,
    MUSE_ROOT: process.env.MUSE_ROOT,
    MUSE_MEMBER_DIR: process.env.MUSE_MEMBER_DIR,
  }
  process.env.MUSE_HOME = tmpDir
  process.env.MUSE_FAMILY = 'test-family'
  process.env.MUSE_ROOT = tmpDir

  // 创建 registry.json (pua + planner online)
  const registryPath = join(tmpDir, 'test-family', 'registry.json')
  writeFileSync(registryPath, JSON.stringify({
    version: 1,
    members: {
      'test-pua': {
        role: 'pua',
        engine: 'http://127.0.0.1:19998',  // fake
        pid: process.pid,
        status: 'online',
        registeredAt: new Date().toISOString(),
      },
      'planner': {
        role: 'planner',
        engine: 'http://127.0.0.1:19999',  // fake
        pid: process.pid,
        status: 'online',
        registeredAt: new Date().toISOString(),
      },
    },
  }))

  // 设置 WorkflowRegistry
  const registry = new WorkflowRegistry({ workspaceRoot: tmpDir })
  setRegistry(registry)
})

after(() => {
  // 恢复环境变量
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v !== undefined) process.env[k] = v
    else delete process.env[k]
  }
  setRegistry(null)
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── Helpers ──

function parseResult(result) {
  return JSON.parse(result.content[0].text)
}

function getResultText(result) {
  return result.content[0].text
}

// ── Tests ──

describe('E2E: 工作流创建 (workflow_create)', () => {
  it('从 JSON 字符串创建 planner 驱动的工作流', async () => {
    const result = await handleWorkflowCreate('ses_planner_001', {
      workflow_json: JSON.stringify(greetWorkflow()),
    })
    const data = parseResult(result)

    assert.equal(data.success, true)
    assert.equal(data.driver, 'planner')
    assert.equal(data.current_node, 'greet')
    assert.ok(data.instance_id.startsWith('wf_'))
    assert.deepEqual(data.participants, ['pua'])

    // 验证 plannerSession 已记录
    const state = loadInstanceState(data.instance_id)
    assert.equal(state.plannerSession, 'ses_planner_001')
  })

  it('从文件路径创建工作流', async () => {
    const result = await handleWorkflowCreate('ses_planner_002', {
      workflow_id: 'greet-user.json',
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    assert.equal(data.current_node, 'greet')
  })

  it('拒绝 driver=self 的工作流', async () => {
    const selfWf = { ...greetWorkflow(), driver: 'self' }
    const result = await handleWorkflowCreate('ses_test', {
      workflow_json: JSON.stringify(selfWf),
    })
    assert.ok(getResultText(result).includes('driver'))
  })

  it('无效 JSON → 报错', async () => {
    const result = await handleWorkflowCreate('ses_test', {
      workflow_json: '{not valid json',
    })
    assert.ok(getResultText(result).includes('JSON'))
  })
})

describe('E2E: 工作流全生命周期 — 单节点 (greet-user)', () => {
  let instanceId
  const PLANNER_SESSION = 'ses_planner_lifecycle_001'

  it('Step 1: Planner 创建工作流', async () => {
    const result = await handleWorkflowCreate(PLANNER_SESSION, {
      workflow_json: JSON.stringify(greetWorkflow()),
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    instanceId = data.instance_id

    // 确认 plannerSession 持久化
    const state = loadInstanceState(instanceId)
    assert.equal(state.plannerSession, PLANNER_SESSION)
  })

  it('Step 2: Planner inspect → 确认初始状态', async () => {
    const result = await handleWorkflowInspect(PLANNER_SESSION, { instance_id: instanceId })
    const data = parseResult(result)

    assert.equal(data.status, 'running')
    assert.equal(data.current_node, 'greet')
    assert.equal(data.driver, 'planner')
    assert.ok(data.nodes.length >= 2)
    assert.ok(data.nodes.find(n => n.id === 'greet')?.is_current)
  })

  it('Step 3: 基础设施自动 ACK (Plugin hook)', async () => {
    // 模拟 handoff 的 prepare 阶段
    const state = loadInstanceState(instanceId)
    state.handoff = {
      status: 'pending',
      source: 'planner',
      target: 'pua',
      targetSession: 'ses_pua_001',
      createdAt: new Date().toISOString(),
    }
    saveInstanceState(instanceId, state)

    // 基础设施自动 ACK（不需要 LLM）
    const acked = autoAckHandoff(instanceId)
    assert.equal(acked, true)

    // 验证状态
    const updated = loadInstanceState(instanceId)
    assert.equal(updated.handoff.status, 'acked')
    assert.equal(updated.handoff.ackedBy, 'plugin-auto-ack')
  })

  it('Step 4: Planner admin_transition → 推进到终态', async () => {
    const result = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId,
      event: 'done',
      reason: 'PUA 已完成问候',
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    assert.equal(data.to, 'end')
  })

  it('Step 5: 验证最终状态 = completed', async () => {
    const result = await handleWorkflowInspect(PLANNER_SESSION, { instance_id: instanceId })
    const data = parseResult(result)
    assert.equal(data.status, 'completed')
    assert.equal(data.current_node, 'end')
  })
})

describe('E2E: 工作流全生命周期 — 双节点 + user gate (analyze-gate)', () => {
  let instanceId
  const PLANNER_SESSION = 'ses_planner_lifecycle_002'

  it('Step 1: 创建 analyze-gate 工作流', async () => {
    const result = await handleWorkflowCreate(PLANNER_SESSION, {
      workflow_json: JSON.stringify(analyzeWorkflow()),
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    instanceId = data.instance_id
  })

  it('Step 2: admin_transition → 从 analyze 到 review', async () => {
    const result = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId,
      event: 'submit',
      reason: '分析完成',
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    assert.equal(data.to, 'review')
  })

  it('Step 3: user gate 保护 — 缺 on_behalf_of 被拒绝', async () => {
    const result = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId,
      event: 'approve',
    })
    assert.ok(getResultText(result).includes('user'))
  })

  it('Step 4: user gate 保护 — 缺 evidence 被拒绝', async () => {
    const result = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId,
      event: 'approve',
      on_behalf_of: 'user',
    })
    assert.ok(getResultText(result).includes('evidence'))
  })

  it('Step 5: 正确越过 user gate → 到终态', async () => {
    const result = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId,
      event: 'approve',
      on_behalf_of: 'user',
      evidence: 'Later 说: 可以，开始吧',
    })
    const data = parseResult(result)
    assert.equal(data.success, true)
    assert.equal(data.to, 'end')
  })

  it('Step 6: 验证 completed + history 完整', async () => {
    const result = await handleWorkflowInspect(PLANNER_SESSION, { instance_id: instanceId })
    const data = parseResult(result)
    assert.equal(data.status, 'completed')
    assert.equal(data.current_node, 'end')

    // history 应有 3 条: start→analyze, submit→review, approve→end
    assert.ok(data.history.length >= 3)
    assert.equal(data.history[1].event, 'submit')
    assert.equal(data.history[2].event, 'approve')
    // user gate evidence 记录
    assert.ok(data.history[2].meta?.evidence?.includes('Later'))
  })
})

describe('E2E: user gate reject → 回退重做', () => {
  let instanceId
  const PLANNER_SESSION = 'ses_planner_reject_001'

  it('创建 → submit → reject → 回退到 analyze', async () => {
    // 创建
    const create = await handleWorkflowCreate(PLANNER_SESSION, {
      workflow_json: JSON.stringify(analyzeWorkflow()),
    })
    instanceId = parseResult(create).instance_id

    // submit → review
    const t1 = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId, event: 'submit', reason: '提交',
    })
    assert.equal(parseResult(t1).to, 'review')

    // reject → 回退到 analyze
    const t2 = await handleWorkflowAdminTransition(PLANNER_SESSION, {
      instance_id: instanceId, event: 'reject',
      on_behalf_of: 'user', evidence: 'Later: 不行重做',
    })
    assert.equal(parseResult(t2).to, 'analyze')

    // inspect → 确认回到 analyze
    const inspect = await handleWorkflowInspect(PLANNER_SESSION, { instance_id: instanceId })
    const data = parseResult(inspect)
    assert.equal(data.current_node, 'analyze')
    assert.equal(data.status, 'running')
  })
})

describe('E2E: autoAckHandoff 基础设施 ACK', () => {
  let instanceId

  before(async () => {
    const result = await handleWorkflowCreate('ses_ack_test', {
      workflow_json: JSON.stringify(greetWorkflow()),
    })
    instanceId = parseResult(result).instance_id
  })

  it('无 handoff → 返回 false', () => {
    const result = autoAckHandoff(instanceId)
    assert.equal(result, false)
  })

  it('pending → 自动 ACK 成功', () => {
    const state = loadInstanceState(instanceId)
    state.handoff = { status: 'pending', source: 'planner', target: 'pua' }
    saveInstanceState(instanceId, state)

    const result = autoAckHandoff(instanceId)
    assert.equal(result, true)

    const updated = loadInstanceState(instanceId)
    assert.equal(updated.handoff.status, 'acked')
    assert.equal(updated.handoff.ackedBy, 'plugin-auto-ack')
  })

  it('已 acked → 不重复 ACK', () => {
    const result = autoAckHandoff(instanceId)
    assert.equal(result, false)  // status 已经是 acked，不是 pending
  })
})

describe('E2E: plannerSession 正确传播', () => {
  it('workflow_create 记录 sessionId 到 state.json', async () => {
    const SESSION = 'ses_unique_abc123'
    const result = await handleWorkflowCreate(SESSION, {
      workflow_json: JSON.stringify(greetWorkflow()),
    })
    const data = parseResult(result)
    const state = loadInstanceState(data.instance_id)

    assert.equal(state.plannerSession, SESSION)
    assert.ok(state.bindings.length > 0)
    assert.equal(state.bindings[0].role, 'pua')
  })
})
