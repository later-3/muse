import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWorkflow,
  WorkflowDefinition,
  WorkflowValidationError,
  NODE_TYPES,
  BASH_POLICIES,
} from './definition.mjs'

// ── 测试用最小合法定义 ──

function minimalWorkflow(overrides = {}) {
  return {
    id: 'test-wf',
    name: 'Test Workflow',
    version: '1.0',
    initial: 'start',
    participants: [{ role: 'worker', description: 'test worker' }],
    nodes: {
      start: {
        type: 'action',
        participant: 'worker',
        objective: 'do something',
        capabilities: ['code_read'],
        bash_policy: 'deny',
        transitions: {
          done: { target: 'end', actor: 'agent' },
        },
      },
      end: {
        type: 'terminal',
      },
    },
    ...overrides,
  }
}

describe('WorkflowDefinition — 解析', () => {
  it('合法定义 → 解析成功', () => {
    const def = parseWorkflow(minimalWorkflow())
    assert.ok(def instanceof WorkflowDefinition)
    assert.equal(def.id, 'test-wf')
    assert.equal(def.name, 'Test Workflow')
    assert.equal(def.version, '1.0')
    assert.equal(def.initial, 'start')
  })

  it('getNode 返回节点定义（含注入的 id）', () => {
    const def = parseWorkflow(minimalWorkflow())
    const start = def.getNode('start')
    assert.equal(start.id, 'start')
    assert.equal(start.type, 'action')
    assert.equal(start.participant, 'worker')
  })

  it('getNode 不存在的节点 → null', () => {
    const def = parseWorkflow(minimalWorkflow())
    assert.equal(def.getNode('nonexistent'), null)
  })

  it('getInitialNode 返回初始节点', () => {
    const def = parseWorkflow(minimalWorkflow())
    const initial = def.getInitialNode()
    assert.equal(initial.id, 'start')
  })

  it('listNodeIds 返回所有节点 ID', () => {
    const def = parseWorkflow(minimalWorkflow())
    const ids = def.listNodeIds()
    assert.deepEqual(ids.sort(), ['end', 'start'])
  })

  it('toJSON 返回原始数据', () => {
    const def = parseWorkflow(minimalWorkflow())
    const json = def.toJSON()
    assert.equal(json.id, 'test-wf')
    assert.ok(json.nodes.start)
    assert.ok(json.nodes.end)
  })
})

describe('WorkflowDefinition — 校验：顶层字段', () => {
  it('缺少 id → 报错', () => {
    assert.throws(
      () => parseWorkflow(minimalWorkflow({ id: undefined })),
      WorkflowValidationError,
    )
  })

  it('缺少 initial → 报错', () => {
    assert.throws(
      () => parseWorkflow(minimalWorkflow({ initial: undefined })),
      WorkflowValidationError,
    )
  })

  it('缺少 nodes → 报错', () => {
    assert.throws(
      () => parseWorkflow(minimalWorkflow({ nodes: undefined })),
      WorkflowValidationError,
    )
  })

  it('initial 指向不存在的节点 → 报错', () => {
    assert.throws(
      () => parseWorkflow(minimalWorkflow({ initial: 'ghost' })),
      (err) => {
        assert.ok(err instanceof WorkflowValidationError)
        assert.ok(err.errors.some(e => e.includes('ghost')))
        return true
      },
    )
  })
})

describe('WorkflowDefinition — 校验：节点', () => {
  it('未知节点类型 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.type = 'unknown_type'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('unknown_type')))
        return true
      },
    )
  })

  it('participant 未在 participants 中声明 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.participant = 'nobody'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('nobody')))
        return true
      },
    )
  })

  it('未知 bash_policy → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.bash_policy = 'yolo'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('yolo')))
        return true
      },
    )
  })

  it('所有合法 bash_policy 值 → 通过', () => {
    for (const policy of BASH_POLICIES) {
      const wf = minimalWorkflow()
      wf.nodes.start.bash_policy = policy
      assert.ok(parseWorkflow(wf) instanceof WorkflowDefinition, `policy "${policy}" should pass`)
    }
  })

  it('所有合法节点类型 → 通过', () => {
    for (const type of NODE_TYPES) {
      const wf = minimalWorkflow()
      if (type === 'terminal') {
        wf.nodes.start.type = 'action'
        wf.nodes.end.type = type
      } else {
        wf.nodes.start.type = type
      }
      // 不抛就算通过
      parseWorkflow(wf)
    }
  })
})

describe('WorkflowDefinition — 校验：transition', () => {
  it('transition target 指向不存在节点 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.transitions.done.target = 'nowhere'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('nowhere')))
        return true
      },
    )
  })

  it('未知 actor → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.transitions.done.actor = 'robot'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('robot')))
        return true
      },
    )
  })

  it('terminal 节点有 transitions → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.end.transitions = { restart: { target: 'start', actor: 'agent' } }
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('terminal')))
        return true
      },
    )
  })
})

describe('WorkflowDefinition — 校验：file_scope', () => {
  it('file_scope.allowed_paths 非数组 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.file_scope = { allowed_paths: 'not-array' }
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('allowed_paths')))
        return true
      },
    )
  })

  it('file_scope.blocked_paths 非数组 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.file_scope = { blocked_paths: 123 }
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('blocked_paths')))
        return true
      },
    )
  })

  it('合法 file_scope → 通过', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.file_scope = {
      allowed_paths: ['muse/src/'],
      blocked_paths: ['muse/src/workflow/'],
    }
    assert.ok(parseWorkflow(wf) instanceof WorkflowDefinition)
  })
})

describe('WorkflowDefinition — 校验：output', () => {
  it('output.artifact 非字符串 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.output = { artifact: 123 }
    assert.throws(
      () => parseWorkflow(wf),
      (err) => {
        assert.ok(err.errors.some(e => e.includes('artifact')))
        return true
      },
    )
  })

  it('合法 output → 通过', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.output = { artifact: 'result.json', required: true }
    assert.ok(parseWorkflow(wf) instanceof WorkflowDefinition)
  })
})

describe('WorkflowDefinition — 复杂定义', () => {
  it('多节点多参与者完整工作流 → 解析成功', () => {
    const def = parseWorkflow({
      id: 'dev-task',
      name: '开发任务工作流',
      version: '1.0',
      initial: 'analyze',
      participants: [
        { role: 'orchestrator', description: '编排者' },
        { role: 'executor', description: '执行者' },
      ],
      nodes: {
        analyze: {
          type: 'action',
          participant: 'orchestrator',
          objective: '分析任务',
          capabilities: ['code_read', 'workflow_control'],
          bash_policy: 'deny',
          output: { artifact: 'task-package.json', required: true },
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
          capabilities: ['code_read', 'code_write', 'shell_exec', 'workflow_control'],
          bash_policy: 'test_build',
          file_scope: {
            allowed_paths: ['muse/src/', 'muse/docs/'],
            blocked_paths: ['muse/src/workflow/', 'AGENTS.md'],
          },
          transitions: { done: { target: 'verify', actor: 'agent' } },
        },
        verify: {
          type: 'action',
          participant: 'orchestrator',
          objective: '验证结果',
          capabilities: ['code_read', 'workflow_control'],
          bash_policy: 'deny',
          transitions: {
            pass: { target: 'done', actor: 'agent' },
            fail: { target: 'execute', actor: 'agent' },
          },
        },
        done: {
          type: 'terminal',
        },
      },
    })

    assert.equal(def.id, 'dev-task')
    assert.equal(def.listNodeIds().length, 5)
    assert.equal(def.getNode('execute').bash_policy, 'test_build')
    assert.deepEqual(def.getNode('execute').file_scope.blocked_paths, ['muse/src/workflow/', 'AGENTS.md'])
    assert.equal(def.getNode('review').transitions.approve.actor, 'user')
  })
})

describe('WorkflowDefinition — driver 校验', () => {
  it('driver=self → 合法', () => {
    const def = parseWorkflow({ ...minimalWorkflow(), driver: 'self' })
    assert.equal(def.driver, 'self')
  })

  it('driver=planner → 合法', () => {
    const def = parseWorkflow({ ...minimalWorkflow(), driver: 'planner' })
    assert.equal(def.driver, 'planner')
  })

  it('driver 省略 → 默认 self', () => {
    const def = parseWorkflow(minimalWorkflow())
    assert.equal(def.driver, 'self')
  })

  it('driver=xxx → 报错', () => {
    assert.throws(
      () => parseWorkflow({ ...minimalWorkflow(), driver: 'xxx' }),
      (err) => err.errors?.some(e => e.includes('driver')),
    )
  })
})

describe('WorkflowDefinition — max_iterations / rollback_target', () => {
  it('max_iterations=3 → 合法', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.max_iterations = 3
    const def = parseWorkflow(wf)
    assert.ok(def)
  })

  it('max_iterations=0 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.max_iterations = 0
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('max_iterations=-1 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.max_iterations = -1
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('max_iterations=1.5 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.max_iterations = 1.5
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('rollback_target 指向已有节点 → 合法', () => {
    const wf = minimalWorkflow()
    // start 节点的 rollback_target 指向 end 节点
    wf.nodes.start.rollback_target = 'end'
    const def = parseWorkflow(wf)
    assert.ok(def)
  })

  it('rollback_target 指向不存在的节点 → 报错', () => {
    const wf = minimalWorkflow()
    wf.nodes.start.rollback_target = 'nonexistent'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('rollback_target')),
    )
  })
})
