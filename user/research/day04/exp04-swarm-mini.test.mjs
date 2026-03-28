import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createAgent, run } from './exp04-swarm-mini.mjs'

describe('exp04: Mini Swarm', () => {
  it('single agent should handle and return', async () => {
    const bot = createAgent('greeter', { handler: (msg) => ({ reply: `hi: ${msg}`, done: true }) })
    const r = await run(bot, 'hello')
    assert.equal(r.turns, 1)
    assert.equal(r.lastResult.reply, 'hi: hello')
  })

  it('should handoff between agents', async () => {
    const coder = createAgent('coder', { handler: (msg) => ({ reply: `coded: ${msg}`, done: true }) })
    const planner = createAgent('planner', {
      handler: (msg) => ({ handoff: 'coder', message: `implement: ${msg}` }),
      handoffs: [coder],
    })
    const r = await run(planner, 'add auth')
    assert.equal(r.agent, 'coder')
    assert.equal(r.turns, 2)
    assert.equal(r.history[0].agent, 'planner')
    assert.equal(r.history[1].agent, 'coder')
  })

  it('should chain multiple handoffs', async () => {
    const reviewer = createAgent('reviewer', { handler: () => ({ approved: true, done: true }) })
    const coder = createAgent('coder', {
      handler: (msg) => ({ handoff: 'reviewer', message: `review: ${msg}` }),
      handoffs: [reviewer],
    })
    const planner = createAgent('planner', {
      handler: (msg) => ({ handoff: 'coder', message: `code: ${msg}` }),
      handoffs: [coder],
    })
    const r = await run(planner, 'fix bug')
    assert.equal(r.turns, 3)
    assert.equal(r.agent, 'reviewer')
    assert.equal(r.lastResult.approved, true)
  })

  it('should handle missing handoff target', async () => {
    const agent = createAgent('a', { handler: () => ({ handoff: 'nonexist' }), handoffs: [] })
    const r = await run(agent, 'test')
    assert.ok(r.history.some(h => h.error?.includes('not found')))
  })

  it('should respect maxTurns', async () => {
    const looper = createAgent('loop', { handler: () => ({ done: false, message: 'again' }) })
    const r = await run(looper, 'start', { maxTurns: 3 })
    assert.equal(r.turns, 3)
  })
})
