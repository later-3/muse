/**
 * T30: PulseState tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PulseState } from './pulse-state.mjs'

const TEST_DIR = join(import.meta.dirname, '.test-pulse-state-' + process.pid)

describe('PulseState', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('load creates default when state.json missing', () => {
    const state = new PulseState(TEST_DIR)
    const data = state.load()
    assert.deepEqual(data.knownChatIds, [])
    assert.equal(data.unresponsedCount, 0)
    assert.equal(data.dnd, false)
    assert.equal(data.frequency, 'normal')
    assert.ok(existsSync(join(TEST_DIR, 'state.json')))
  })

  it('load recovers from corrupted state.json', () => {
    writeFileSync(join(TEST_DIR, 'state.json'), '{invalid json!!!}')
    const state = new PulseState(TEST_DIR)
    const data = state.load()
    assert.equal(data.unresponsedCount, 0)
    assert.equal(data.frequency, 'normal')
  })

  it('load/save roundtrip', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    state.update({ dnd: true, frequency: 'reduced' })

    const state2 = new PulseState(TEST_DIR)
    const data = state2.load()
    assert.equal(data.dnd, true)
    assert.equal(data.frequency, 'reduced')
  })

  it('addChatId deduplicates', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    state.addChatId(12345)
    state.addChatId(12345)
    state.addChatId(67890)
    assert.deepEqual(state.get('knownChatIds'), [12345, 67890])
  })

  it('incrementUnresponsed and resetUnresponsed', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    state.incrementUnresponsed()
    state.incrementUnresponsed()
    assert.equal(state.get('unresponsedCount'), 2)
    assert.ok(state.get('lastProactiveAt'))

    state.resetUnresponsed()
    assert.equal(state.get('unresponsedCount'), 0)
    assert.ok(state.get('lastUserReplyAt'))
  })

  it('recordTrigger stores timestamp', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    state.recordTrigger('greeting')
    const history = state.get('triggerHistory')
    assert.ok(history.greeting)
    assert.ok(new Date(history.greeting).getTime() > 0)
  })

  it('snapshot returns independent copy', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    const snap = state.snapshot()
    snap.dnd = true
    assert.equal(state.get('dnd'), false)
  })

  it('creates directory if missing', () => {
    const subDir = join(TEST_DIR, 'sub', 'deep')
    const state = new PulseState(subDir)
    state.load()
    assert.ok(existsSync(join(subDir, 'state.json')))
  })

  it('atomic write (tmp + rename)', () => {
    const state = new PulseState(TEST_DIR)
    state.load()
    state.update({ frequency: 'minimal' })
    // .tmp should not exist after save
    assert.ok(!existsSync(join(TEST_DIR, 'state.json.tmp')))
    // state.json should have the update
    const raw = JSON.parse(readFileSync(join(TEST_DIR, 'state.json'), 'utf-8'))
    assert.equal(raw.frequency, 'minimal')
  })
})
