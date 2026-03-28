import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createWorker, orchestrate } from './exp02-orchestrator.mjs'

describe('exp02: Orchestrator', () => {
  it('should route task to matching worker', async () => {
    const workers = [
      createWorker('coder', t => t.includes('code'), t => ({ done: true, output: `coded: ${t}` })),
      createWorker('writer', t => t.includes('doc'), t => ({ done: true, output: `wrote: ${t}` })),
    ]
    const r = await orchestrate('write code for auth', workers)
    assert.equal(r.trace[0].worker, 'coder')
    assert.equal(r.totalRounds, 1)
  })

  it('should support multi-round orchestration', async () => {
    const workers = [
      createWorker('planner', t => t.startsWith('plan:'), t => ({ next: `code:${t.slice(5)}` })),
      createWorker('coder', t => t.startsWith('code:'), t => ({ next: `review:${t.slice(5)}` })),
      createWorker('reviewer', t => t.startsWith('review:'), t => ({ done: true, approved: true })),
    ]
    const r = await orchestrate('plan:add-memory', workers)
    assert.equal(r.totalRounds, 3)
    assert.equal(r.trace[0].worker, 'planner')
    assert.equal(r.trace[1].worker, 'coder')
    assert.equal(r.trace[2].worker, 'reviewer')
  })

  it('should stop at maxRounds', async () => {
    const workers = [createWorker('loop', () => true, () => ({ next: 'again' }))]
    const r = await orchestrate('start', workers, { maxRounds: 2 })
    assert.equal(r.totalRounds, 2)
  })

  it('should handle no matching worker', async () => {
    const r = await orchestrate('unknown task', [])
    assert.ok(r.trace[0].error.includes('no worker'))
  })
})
