import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { initWorkflow, initWorkflowFromJSON, shutdownWorkflow } from './loader.mjs'
import { getRegistry, setRegistry } from './registry.mjs'

const WF_PATH = join(import.meta.dirname, 'examples', 'code-review-wf.json')

afterEach(() => setRegistry(null))

describe('WorkflowLoader — initWorkflow (文件)', () => {
  it('从文件加载并初始化 registry', async () => {
    const { sm, registry } = await initWorkflow({
      workflowPath: WF_PATH,
      taskId: 'loader-test-1',
      workspaceRoot: '/test',
      bindings: [
        { role: 'pua', sessionId: 'ses_pua' },
        { role: 'arch', sessionId: 'ses_arch' },
      ],
    })

    assert.equal(sm.workflowId, 'code-review-wf')
    assert.equal(sm.taskId, 'loader-test-1')
    assert.equal(registry.getParticipantStatus('ses_pua'), 'active')
    assert.equal(registry.getParticipantStatus('ses_arch'), 'frozen')
    assert.equal(getRegistry(), registry)
  })
})

describe('WorkflowLoader — initWorkflowFromJSON', () => {
  it('从 JSON 对象初始化', () => {
    const { sm } = initWorkflowFromJSON({
      definition: {
        id: 'simple', name: 'S', version: '1.0', initial: 'a',
        participants: [{ role: 'w' }],
        nodes: {
          a: { type: 'action', participant: 'w', capabilities: [], bash_policy: 'deny',
               transitions: { go: { target: 'b', actor: 'agent' } } },
          b: { type: 'terminal' },
        },
      },
      taskId: 't2',
      workspaceRoot: '/test',
      bindings: [{ role: 'w', sessionId: 's1' }],
    })
    assert.equal(sm.currentNodeId, 'a')
    assert.equal(getRegistry().getParticipantStatus('s1'), 'active')
  })
})

describe('WorkflowLoader — shutdownWorkflow', () => {
  it('关闭实例 → abort + unregister', async () => {
    const { sm, registry } = await initWorkflow({
      workflowPath: WF_PATH,
      taskId: 't3',
      workspaceRoot: '/test',
      bindings: [{ role: 'pua', sessionId: 's1' }],
    })

    shutdownWorkflow(sm.instanceId)
    assert.equal(sm.status, 'aborted')
    assert.equal(registry.getBySession('s1'), null)
  })
})
