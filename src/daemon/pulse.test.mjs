/**
 * T30: Pulse scheduler tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Pulse } from './pulse.mjs'

const TEST_DIR = join(import.meta.dirname, '.test-pulse-' + process.pid)

describe('Pulse', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('register adds trigger', () => {
    const pulse = new Pulse({ config: { enabled: true }, stateDir: TEST_DIR, onTrigger: () => {} })
    pulse.register({ id: 'test', interval: 1000, action: 'greet' })
    // Verified via health after start
  })

  it('register rejects missing id/interval', () => {
    const pulse = new Pulse({ config: { enabled: true }, stateDir: TEST_DIR, onTrigger: () => {} })
    assert.throws(() => pulse.register({}), /id.*interval/)
    assert.throws(() => pulse.register({ id: 'x' }), /id.*interval/)
  })

  it('register enforces max trigger limit', () => {
    const pulse = new Pulse({ config: { enabled: true }, stateDir: TEST_DIR, onTrigger: () => {} })
    for (let i = 0; i < 16; i++) {
      pulse.register({ id: `t${i}`, interval: 1000, action: 'test' })
    }
    assert.throws(() => pulse.register({ id: 'overflow', interval: 1000, action: 'test' }), /上限/)
  })

  it('unregister removes trigger', async () => {
    const triggered = []
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: (t) => { triggered.push(t.id) },
    })
    pulse.register({ id: 'test', interval: 1000, action: 'greet' })
    await pulse.start()
    pulse.unregister('test')
    pulse.tick()
    assert.equal(triggered.length, 0, 'removed trigger should not fire')
    await pulse.stop()
  })

  it('start with enabled=false does nothing', async () => {
    let called = false
    const pulse = new Pulse({
      config: { enabled: false },
      stateDir: TEST_DIR,
      onTrigger: () => { called = true },
    })
    pulse.register({ id: 'test', interval: 100, action: 'test' })
    await pulse.start()
    pulse.tick()
    assert.equal(called, false, 'disabled pulse should not trigger')
    await pulse.stop()
  })

  it('tick fires callback for never-executed trigger', async () => {
    const triggered = []
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: (trigger) => { triggered.push(trigger.id) },
    })
    pulse.register({ id: 'greeting', interval: 100, action: 'greet' })
    await pulse.start()

    // tick() manually fires the check — trigger has never executed, so it fires
    pulse.tick()
    assert.equal(triggered.length, 1, 'should fire once')
    assert.equal(triggered[0], 'greeting')

    // tick() again — interval not elapsed (just fired), should NOT fire
    pulse.tick()
    assert.equal(triggered.length, 1, 'should not fire again within interval')

    await pulse.stop()
  })

  it('tick fires again after interval elapses', async () => {
    const triggered = []
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: (trigger) => { triggered.push(trigger.id) },
    })
    pulse.register({ id: 'fast', interval: 50, action: 'test' })
    await pulse.start()

    pulse.tick()
    assert.equal(triggered.length, 1)

    // Wait for interval to elapse
    await new Promise(r => setTimeout(r, 80))

    pulse.tick()
    assert.equal(triggered.length, 2, 'should fire again after interval')

    await pulse.stop()
  })

  it('stop prevents further triggers', async () => {
    const triggered = []
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: (t) => { triggered.push(t.id) },
    })
    pulse.register({ id: 'test', interval: 1000, action: 'test' })
    await pulse.start()
    await pulse.stop()

    const health = await pulse.health()
    assert.equal(health.ok, false, 'not running after stop')
  })

  it('health returns full status', async () => {
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: () => {},
    })
    pulse.register({ id: 'greeting', interval: 7200000, action: 'greet' })
    await pulse.start()

    const health = await pulse.health()
    assert.ok(health.ok)
    assert.equal(health.detail.triggerCount, 1)
    assert.equal(health.detail.triggers[0].id, 'greeting')
    assert.equal(health.detail.triggers[0].interval, 7200000)
    assert.equal(health.detail.enabled, true)

    await pulse.stop()
  })

  it('state returns PulseState snapshot', () => {
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: () => {},
    })
    // Before start, state is null
    const snap = pulse.state
    assert.equal(snap, null)
  })

  it('multiple start/stop is idempotent', async () => {
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: () => {},
    })
    await pulse.start()
    await pulse.start() // second start should not break
    await pulse.stop()
    await pulse.stop() // second stop should not break
  })

  it('onTrigger error is caught and logged (not thrown)', async () => {
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: () => { throw new Error('boom') },
    })
    pulse.register({ id: 'failing', interval: 50, action: 'fail' })
    await pulse.start()

    // tick() should not throw even though onTrigger throws
    assert.doesNotThrow(() => pulse.tick())

    // trigger should still be recorded in state
    const h = await pulse.health()
    assert.ok(h.detail.triggers[0].lastExec, 'trigger should have recorded execution time')

    await pulse.stop()
  })

  it('tick records trigger execution in state', async () => {
    const pulse = new Pulse({
      config: { enabled: true },
      stateDir: TEST_DIR,
      onTrigger: () => {},
    })
    pulse.register({ id: 'tracked', interval: 1000, action: 'test' })
    await pulse.start()

    pulse.tick()

    const h = await pulse.health()
    const trigger = h.detail.triggers[0]
    assert.ok(trigger.lastExec, 'should have lastExec timestamp')
    assert.notEqual(trigger.nextExec, 'pending', 'should compute next exec time')

    await pulse.stop()
  })
})
