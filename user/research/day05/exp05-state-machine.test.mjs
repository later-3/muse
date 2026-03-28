import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStateMachine } from './exp05-state-machine.mjs'

describe('exp05: State Machine', () => {
  const workflowDef = {
    initial: 'planning',
    states: {
      planning: { on: { approve: 'executing', cancel: 'cancelled' } },
      executing: { on: { done: 'reviewing', fail: 'failed' } },
      reviewing: { on: { accept: 'completed', reject: 'executing' } },
      completed: {},
      failed: { on: { retry: 'executing' } },
      cancelled: {},
    },
  }

  it('should start at initial state', () => {
    const sm = createStateMachine(workflowDef)
    assert.equal(sm.current, 'planning')
  })

  it('should transition on valid event', () => {
    const sm = createStateMachine(workflowDef)
    const r = sm.transition('approve')
    assert.equal(r.from, 'planning')
    assert.equal(r.to, 'executing')
    assert.equal(sm.current, 'executing')
  })

  it('should throw on invalid event', () => {
    const sm = createStateMachine(workflowDef)
    assert.throws(() => sm.transition('done'), /No transition/)
  })

  it('should track full history', () => {
    const sm = createStateMachine(workflowDef)
    sm.transition('approve')
    sm.transition('done')
    sm.transition('accept')
    assert.equal(sm.current, 'completed')
    assert.equal(sm.history.length, 4) // initial + 3 transitions
  })

  it('should support guard conditions', () => {
    const guarded = {
      initial: 'draft',
      states: {
        draft: { on: { submit: { target: 'review', guard: (ctx) => ctx.wordCount > 100 } } },
        review: {},
      },
    }
    const sm = createStateMachine(guarded)
    assert.throws(() => sm.transition('submit', { wordCount: 50 }), /Guard failed/)
    sm.transition('submit', { wordCount: 200 })
    assert.equal(sm.current, 'review')
  })

  it('Muse workflow: planning → executing → reviewing → completed', () => {
    const sm = createStateMachine(workflowDef)
    sm.transition('approve')     // planner approves
    sm.transition('done')        // coder finishes
    sm.transition('reject')      // reviewer rejects
    sm.transition('done')        // coder fixes
    sm.transition('accept')      // reviewer accepts
    assert.equal(sm.current, 'completed')
    assert.equal(sm.history.length, 6)
  })
})
