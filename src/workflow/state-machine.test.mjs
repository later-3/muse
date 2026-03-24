import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseWorkflow } from './definition.mjs'
import { StateMachine, TransitionError } from './state-machine.mjs'

// ── 测试用工作流定义 ──

function devWorkflow() {
  return parseWorkflow({
    id: 'dev-task',
    name: '开发任务',
    version: '1.0',
    initial: 'analyze',
    participants: [
      { role: 'orchestrator' },
      { role: 'executor' },
    ],
    nodes: {
      analyze: {
        type: 'action',
        participant: 'orchestrator',
        objective: '分析任务',
        capabilities: ['code_read', 'workflow_control'],
        bash_policy: 'deny',
        output: { artifact: 'task-package.json', required: true },
        exit_criteria: { artifacts: ['task-package.json'] },
        transitions: { submit: { target: 'review', actor: 'agent' } },
      },
      review: {
        type: 'gate',
        participant: 'orchestrator',
        objective: '等待审核',
        capabilities: ['code_read'],
        bash_policy: 'deny',
        transitions: {
          approve: { target: 'execute', actor: 'user' },
          reject: { target: 'analyze', actor: 'user' },
        },
      },
      execute: {
        type: 'handoff',
        participant: 'executor',
        objective: '编写代码',
        capabilities: ['code_read', 'code_write', 'shell_exec'],
        bash_policy: 'test_build',
        transitions: { done: { target: 'done', actor: 'agent' } },
      },
      done: {
        type: 'terminal',
      },
    },
  })
}

describe('StateMachine — 基本流转', () => {
  it('创建后处于 initial 节点', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    assert.equal(sm.currentNodeId, 'analyze')
    assert.equal(sm.status, 'running')
    assert.equal(sm.workflowId, 'dev-task')
    assert.equal(sm.taskId, 't1')
  })

  it('合法 transition → 成功流转', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    const result = sm.transition('submit', 'agent')
    assert.equal(result.from, 'analyze')
    assert.equal(result.to, 'review')
    assert.equal(sm.currentNodeId, 'review')
  })

  it('流转到 terminal 节点 → status = completed', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')       // analyze → review
    sm.transition('approve', 'user')       // review → execute
    sm.transition('done', 'agent')         // execute → done (terminal)
    assert.equal(sm.status, 'completed')
    assert.equal(sm.currentNodeId, 'done')
  })

  it('完整流转历史记录', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.transition('approve', 'user')
    const history = sm.history
    assert.equal(history.length, 3)  // start + submit + approve
    assert.equal(history[0].event, 'start')
    assert.equal(history[1].event, 'submit')
    assert.equal(history[2].event, 'approve')
  })
})

describe('StateMachine — Actor 校验', () => {
  it('agent 触发 actor=agent transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    assert.equal(sm.currentNodeId, 'review')
  })

  it('agent 触发 actor=user transition → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    assert.throws(
      () => sm.transition('approve', 'agent'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('user'))
        assert.equal(err.details.required, 'user')
        assert.equal(err.details.actual, 'agent')
        return true
      },
    )
    // 状态不变
    assert.equal(sm.currentNodeId, 'review')
  })

  it('user 触发 actor=user transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')   // → review
    sm.transition('approve', 'user')   // → execute
    assert.equal(sm.currentNodeId, 'execute')
  })

  it('user reject 回退到 analyze', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')   // → review
    sm.transition('reject', 'user')    // → analyze
    assert.equal(sm.currentNodeId, 'analyze')
  })
})

describe('StateMachine — 异常场景', () => {
  it('未知 event → 报错', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    assert.throws(
      () => sm.transition('fly', 'agent'),
      TransitionError,
    )
  })

  it('已完成的工作流 → transition 报错', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.transition('approve', 'user')
    sm.transition('done', 'agent')
    assert.equal(sm.status, 'completed')
    assert.throws(
      () => sm.transition('submit', 'agent'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('completed'))
        return true
      },
    )
  })

  it('已终止的工作流 → transition 报错', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.abort('testing')
    assert.equal(sm.status, 'aborted')
    assert.throws(
      () => sm.transition('submit', 'agent'),
      TransitionError,
    )
  })
})

describe('StateMachine — Artifact + Exit Criteria', () => {
  it('无 exit_criteria → satisfied', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review (no exit_criteria)
    const { satisfied } = sm.checkExitCriteria()
    assert.equal(satisfied, true)
  })

  it('有 exit_criteria 未满足 → not satisfied', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    // analyze 节点需要 task-package.json
    const { satisfied, missing } = sm.checkExitCriteria()
    assert.equal(satisfied, false)
    assert.ok(missing.some(m => m.includes('task-package.json')))
  })

  it('注册 artifact 后 exit_criteria 满足', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.registerArtifact('task-package.json', '/data/runs/t1/task-package.json')
    const { satisfied } = sm.checkExitCriteria()
    assert.equal(satisfied, true)
  })

  it('hasArtifact / getArtifact', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    assert.equal(sm.hasArtifact('foo'), false)
    assert.equal(sm.getArtifact('foo'), null)
    sm.registerArtifact('foo', '/path/foo')
    assert.equal(sm.hasArtifact('foo'), true)
    assert.ok(sm.getArtifact('foo').path === '/path/foo')
  })
})

describe('StateMachine — 暂停 / 恢复 / 终止', () => {
  it('pause → status = paused', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.pause()
    assert.equal(sm.status, 'paused')
  })

  it('resume → status = running', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.pause()
    sm.resume()
    assert.equal(sm.status, 'running')
  })

  it('abort → status = aborted, 历史记录 abort', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.abort('test reason')
    assert.equal(sm.status, 'aborted')
    const last = sm.history.at(-1)
    assert.equal(last.event, 'abort')
    assert.equal(last.reason, 'test reason')
  })
})

describe('StateMachine — 持久化', () => {
  it('toState → fromState 一致性', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'agent')
    sm1.registerArtifact('task-package.json', '/data/tp.json')

    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)

    assert.equal(sm2.currentNodeId, 'review')
    assert.equal(sm2.instanceId, sm1.instanceId)
    assert.equal(sm2.taskId, 't1')
    assert.equal(sm2.hasArtifact('task-package.json'), true)
    assert.equal(sm2.history.length, sm1.history.length)
  })

  it('恢复后可继续 transition', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'agent')

    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)
    sm2.transition('approve', 'user')

    assert.equal(sm2.currentNodeId, 'execute')
  })

  it('toState 是深拷贝，修改不影响原状态', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    const state = sm.toState()
    state.current_node = 'hacked'
    assert.equal(sm.currentNodeId, 'analyze')  // 不受影响
  })
})

describe('StateMachine — Decision 节点自动路由', () => {
  function decisionWorkflow() {
    return parseWorkflow({
      id: 'decision-test',
      name: 'Decision Test',
      version: '1.0',
      initial: 'start',
      participants: [{ role: 'worker' }],
      nodes: {
        start: {
          type: 'action',
          participant: 'worker',
          capabilities: ['code_read'],
          bash_policy: 'deny',
          transitions: { next: { target: 'check', actor: 'agent' } },
        },
        check: {
          type: 'decision',
          participant: 'worker',
          capabilities: [],
          bash_policy: 'deny',
          transitions: {
            has_report: {
              target: 'success',
              actor: 'system',
              condition: { type: 'artifact_exists', artifact: 'report.json' },
            },
            default: {
              target: 'fail',
              actor: 'system',
            },
          },
        },
        success: { type: 'terminal' },
        fail: { type: 'terminal' },
      },
    })
  }

  it('条件满足 → 走条件路径', () => {
    const sm = new StateMachine(decisionWorkflow(), { taskId: 't1' })
    sm.registerArtifact('report.json', '/data/report.json')
    const result = sm.transition('next', 'agent')  // start → check → 自动 → success
    assert.equal(sm.currentNodeId, 'success')
    assert.equal(sm.status, 'completed')
  })

  it('条件不满足 → 走 default', () => {
    const sm = new StateMachine(decisionWorkflow(), { taskId: 't1' })
    // 未注册 report.json
    sm.transition('next', 'agent')  // start → check → 自动 → fail
    assert.equal(sm.currentNodeId, 'fail')
    assert.equal(sm.status, 'completed')
  })

  it('artifact_missing 条件', () => {
    const def = parseWorkflow({
      id: 'missing-test', name: 'Test', version: '1.0', initial: 'start',
      participants: [{ role: 'w' }],
      nodes: {
        start: {
          type: 'action', participant: 'w', capabilities: [], bash_policy: 'deny',
          transitions: { go: { target: 'decide', actor: 'agent' } },
        },
        decide: {
          type: 'decision', participant: 'w', capabilities: [], bash_policy: 'deny',
          transitions: {
            retry: {
              target: 'start', actor: 'system',
              condition: { type: 'artifact_missing', artifact: 'done.json' },
            },
            default: { target: 'end', actor: 'system' },
          },
        },
        end: { type: 'terminal' },
      },
    })
    const sm = new StateMachine(def, { taskId: 't1' })
    sm.transition('go', 'agent')  // → decide → retry(artifact missing) → start
    assert.equal(sm.currentNodeId, 'start')
  })

  it('decision 流转记录完整', () => {
    const sm = new StateMachine(decisionWorkflow(), { taskId: 't1' })
    sm.transition('next', 'agent')
    // history: start → check(via next) → fail(via default)
    const history = sm.history
    assert.ok(history.some(h => h.event === 'next'))
    assert.ok(history.some(h => h.event === 'default' && h.actor === 'system'))
  })
})

describe('StateMachine — Admin Override', () => {
  it('admin 触发 actor=agent 的 transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    // analyze → review, transition actor=agent
    const result = sm.transition('submit', 'admin')
    assert.equal(result.to, 'review')
    assert.equal(sm.currentNodeId, 'review')
  })

  it('admin 触发 actor=user 的 transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    // review → execute, transition actor=user
    const result = sm.transition('approve', 'admin')
    assert.equal(result.to, 'execute')
    assert.equal(sm.currentNodeId, 'execute')
  })

  it('system 触发 actor=agent 的 transition → 仍然拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    assert.throws(
      () => sm.transition('submit', 'system'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.equal(err.details.required, 'agent')
        assert.equal(err.details.actual, 'system')
        return true
      },
    )
  })

  it('admin override 的 history 记录 actor=admin', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin')
    const entry = sm.history.at(-1)
    assert.equal(entry.actor, 'admin')
    assert.equal(entry.event, 'submit')
  })
})

describe('StateMachine — Transition Meta', () => {
  it('不传 meta → history 无 meta 字段', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    const entry = sm.history.at(-1)
    assert.equal(entry.meta, undefined)
  })

  it('传入 meta → history 包含 meta', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin', {
      on_behalf_of: 'planner',
      evidence: '质量检查通过',
    })
    const entry = sm.history.at(-1)
    assert.deepEqual(entry.meta, {
      on_behalf_of: 'planner',
      evidence: '质量检查通过',
    })
  })

  it('meta 不影响 transition 逻辑', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin', { on_behalf_of: 'user', evidence: '通过' })
    assert.equal(sm.currentNodeId, 'review')
  })

  it('toState/fromState 保留 meta', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'admin', { on_behalf_of: 'user', evidence: '通过' })
    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)
    const entry = sm2.history.at(-1)
    assert.deepEqual(entry.meta, { on_behalf_of: 'user', evidence: '通过' })
  })
})

describe('StateMachine — Rollback', () => {
  it('回退到已访问的节点 → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // analyze → review
    const result = sm.rollback('analyze', 'admin', '产出不合格')
    assert.equal(result.from, 'review')
    assert.equal(result.to, 'analyze')
    assert.equal(sm.currentNodeId, 'analyze')
  })

  it('回退到未访问的节点 → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    // 只访问了 analyze，还没到 execute
    assert.throws(
      () => sm.rollback('execute', 'admin', 'test'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('未访问'))
        return true
      },
    )
  })

  it('agent 不能触发 rollback → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    assert.throws(
      () => sm.rollback('analyze', 'agent', 'test'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('system 或 admin'))
        return true
      },
    )
  })

  it('user 不能触发 rollback → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    assert.throws(
      () => sm.rollback('analyze', 'user', 'test'),
      TransitionError,
    )
  })

  it('rollback 的 history 记录', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.rollback('analyze', 'admin', '产出不合格')
    const entry = sm.history.at(-1)
    assert.equal(entry.event, 'rollback')
    assert.equal(entry.from, 'review')
    assert.equal(entry.to, 'analyze')
    assert.equal(entry.actor, 'admin')
    assert.equal(entry.reason, '产出不合格')
  })

  it('rollback 带 meta', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.rollback('analyze', 'admin', '用户要求退回', {
      on_behalf_of: 'user',
      evidence: '用户消息: "退回"',
    })
    const entry = sm.history.at(-1)
    assert.equal(entry.meta.on_behalf_of, 'user')
  })

  it('已完成的工作流 → rollback 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.transition('approve', 'user')
    sm.transition('done', 'agent')
    assert.equal(sm.status, 'completed')
    assert.throws(
      () => sm.rollback('analyze', 'admin', 'test'),
      TransitionError,
    )
  })

  it('rollback 后可以继续正常 transition', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    sm.rollback('analyze', 'admin', '重做')  // → analyze
    sm.transition('submit', 'agent')  // → review again
    assert.equal(sm.currentNodeId, 'review')
  })

  it('paused 状态下 rollback → 恢复为 running', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.pause()
    assert.equal(sm.status, 'paused')
    sm.rollback('analyze', 'admin', 'test')
    assert.equal(sm.status, 'running')
  })

  it('toState/fromState 保留 rollback 记录', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'agent')
    sm1.rollback('analyze', 'admin', 'test')
    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)
    assert.equal(sm2.currentNodeId, 'analyze')
    const entry = sm2.history.at(-1)
    assert.equal(entry.event, 'rollback')
  })

  it('rollback 触发 onTransition listener', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    const events = []
    sm.onTransition((e) => events.push(e))
    sm.rollback('analyze', 'admin', 'test')
    assert.equal(events.length, 1)
    assert.equal(events[0].event, 'rollback')
    assert.equal(events[0].from, 'review')
    assert.equal(events[0].to, 'analyze')
    assert.equal(events[0].status, 'running')
    assert.equal(events[0].instanceId, sm.instanceId)
  })
})

