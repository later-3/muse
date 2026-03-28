import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGate } from './exp03-hitl-gate.mjs'

describe('exp03: HITL Gate', () => {
  const classifier = (action) => {
    if (action.includes('delete') || action.includes('deploy')) return 'high'
    if (action.includes('modify')) return 'medium'
    return 'low'
  }

  it('should auto-approve low risk actions', async () => {
    const gate = createGate({ riskClassifier: classifier })
    const r = await gate.submit('read file')
    assert.equal(r.approved, true)
    assert.equal(r.auto, true)
  })

  it('should block high risk and require approval', async () => {
    const gate = createGate({ riskClassifier: classifier })
    const r = await gate.submit('delete database')
    assert.equal(r.approved, false)
    assert.equal(r.status, 'pending')
    assert.equal(r.risk, 'high')
  })

  it('should approve pending gate', async () => {
    const gate = createGate({ riskClassifier: classifier })
    const r1 = await gate.submit('deploy to production')
    const r2 = gate.approve(r1.gateId, 'verified safe')
    assert.equal(r2.approved, true)
    assert.equal(r2.action, 'deploy to production')
  })

  it('should reject pending gate', async () => {
    const gate = createGate({ riskClassifier: classifier })
    const r1 = await gate.submit('delete all users')
    const r2 = gate.reject(r1.gateId, 'too dangerous')
    assert.equal(r2.rejected, true)
  })

  it('should not double-approve', async () => {
    const gate = createGate({ riskClassifier: classifier })
    const r1 = await gate.submit('modify config')
    gate.approve(r1.gateId, 'ok')
    const r2 = gate.approve(r1.gateId, 'again')
    assert.ok(r2.error.includes('already'))
  })

  it('should track pending list', async () => {
    const gate = createGate({ riskClassifier: classifier })
    await gate.submit('delete X')
    await gate.submit('deploy Y')
    assert.equal(gate.getPending().length, 2)
    gate.approve('gate-1', 'ok')
    assert.equal(gate.getPending().length, 1)
  })
})
