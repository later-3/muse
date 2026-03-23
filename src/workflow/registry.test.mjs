import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseWorkflow } from './definition.mjs'
import { StateMachine } from './state-machine.mjs'
import { WorkflowRegistry, setRegistry, getRegistry } from './registry.mjs'

function devWorkflow() {
  return parseWorkflow({
    id: 'dev-task',
    name: 'Test',
    version: '1.0',
    initial: 'analyze',
    participants: [{ role: 'orchestrator' }, { role: 'executor' }],
    nodes: {
      analyze: {
        type: 'action',
        participant: 'orchestrator',
        objective: 'analyze',
        capabilities: ['code_read'],
        bash_policy: 'deny',
        transitions: { submit: { target: 'execute', actor: 'agent' } },
      },
      execute: {
        type: 'handoff',
        participant: 'executor',
        objective: 'execute',
        capabilities: ['code_read', 'code_write'],
        bash_policy: 'test_build',
        transitions: { done: { target: 'end', actor: 'agent' } },
      },
      end: { type: 'terminal' },
    },
  })
}

describe('WorkflowRegistry — 基本操作', () => {
  let reg, sm

  beforeEach(() => {
    reg = new WorkflowRegistry({ workspaceRoot: '/test/project' })
    sm = new StateMachine(devWorkflow(), { taskId: 't1' })
  })

  it('register + getBySession', () => {
    reg.register(sm, [{ role: 'orchestrator', sessionId: 'ses_1' }])
    const found = reg.getBySession('ses_1')
    assert.equal(found.instanceId, sm.instanceId)
  })

  it('未注册 session → null', () => {
    assert.equal(reg.getBySession('unknown'), null)
  })

  it('getRoleBySession', () => {
    reg.register(sm, [
      { role: 'orchestrator', sessionId: 'ses_1' },
      { role: 'executor', sessionId: 'ses_2' },
    ])
    assert.equal(reg.getRoleBySession('ses_1'), 'orchestrator')
    assert.equal(reg.getRoleBySession('ses_2'), 'executor')
  })

  it('unregister 清除实例和 session', () => {
    reg.register(sm, [{ role: 'orchestrator', sessionId: 'ses_1' }])
    reg.unregister(sm.instanceId)
    assert.equal(reg.getBySession('ses_1'), null)
    assert.equal(reg.size, 0)
  })

  it('bindSession 追加绑定', () => {
    reg.register(sm, [{ role: 'orchestrator', sessionId: 'ses_1' }])
    reg.bindSession(sm.instanceId, 'ses_2', 'executor')
    assert.equal(reg.getRoleBySession('ses_2'), 'executor')
  })

  it('listInstances', () => {
    reg.register(sm, [])
    const list = reg.listInstances()
    assert.equal(list.length, 1)
    assert.equal(list[0].workflowId, 'dev-task')
  })
})

describe('WorkflowRegistry — 参与者状态判定', () => {
  let reg, sm

  beforeEach(() => {
    reg = new WorkflowRegistry({ workspaceRoot: '/test/project' })
    sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    reg.register(sm, [
      { role: 'orchestrator', sessionId: 'ses_orch' },
      { role: 'executor', sessionId: 'ses_exec' },
    ])
  })

  it('当前节点参与者 → active', () => {
    // analyze 节点 participant=orchestrator
    assert.equal(reg.getParticipantStatus('ses_orch'), 'active')
  })

  it('非当前节点参与者 → frozen', () => {
    // analyze 节点 participant=orchestrator, executor 应该冻结
    assert.equal(reg.getParticipantStatus('ses_exec'), 'frozen')
  })

  it('未绑定 session → unbound', () => {
    assert.equal(reg.getParticipantStatus('ses_unknown'), 'unbound')
  })

  it('流转后状态切换', () => {
    sm.transition('submit', 'agent')  // analyze → execute
    // 现在 execute 节点 participant=executor
    assert.equal(reg.getParticipantStatus('ses_exec'), 'active')
    assert.equal(reg.getParticipantStatus('ses_orch'), 'frozen')
  })
})

describe('全局 registry', () => {
  it('set / get', () => {
    const reg = new WorkflowRegistry()
    setRegistry(reg)
    assert.equal(getRegistry(), reg)
    setRegistry(null) // cleanup
  })
})
