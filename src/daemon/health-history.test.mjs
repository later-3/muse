/**
 * T33: HealthHistory tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HealthHistory } from './health-history.mjs'

const TEST_DIR = join(import.meta.dirname, '.test-health-history-' + process.pid)

describe('HealthHistory', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('save writes JSON file with timestamp-based name', () => {
    const hh = new HealthHistory(TEST_DIR)
    const report = { timestamp: '2026-03-15T01:00:00.000Z', overall: '🟢', system: {} }
    const filename = hh.save(report)
    assert.ok(filename)
    assert.ok(filename.startsWith('health-'))
    assert.ok(filename.endsWith('.json'))
    assert.ok(existsSync(join(TEST_DIR, filename)))
  })

  it('save skips when no timestamp', () => {
    const hh = new HealthHistory(TEST_DIR)
    const result = hh.save({})
    assert.equal(result, null)
  })

  it('save creates directory if missing', () => {
    const subDir = join(TEST_DIR, 'sub', 'deep')
    const hh = new HealthHistory(subDir)
    hh.save({ timestamp: '2026-01-01T00:00:00.000Z', overall: '🟢' })
    assert.ok(existsSync(subDir))
  })

  it('list returns recent reports newest first', () => {
    const hh = new HealthHistory(TEST_DIR)
    hh.save({ timestamp: '2026-01-01T00:00:00.000Z', overall: '🟢' })
    hh.save({ timestamp: '2026-01-02T00:00:00.000Z', overall: '🟡' })
    hh.save({ timestamp: '2026-01-03T00:00:00.000Z', overall: '🔴' })

    const list = hh.list(10)
    assert.equal(list.length, 3)
    assert.equal(list[0].overall, '🔴') // newest first
    assert.equal(list[2].overall, '🟢')
  })

  it('list respects limit', () => {
    const hh = new HealthHistory(TEST_DIR)
    for (let i = 0; i < 5; i++) {
      hh.save({ timestamp: `2026-01-0${i + 1}T00:00:00.000Z`, overall: '🟢' })
    }
    const list = hh.list(2)
    assert.equal(list.length, 2)
  })

  it('list handles corrupted file gracefully', () => {
    const hh = new HealthHistory(TEST_DIR)
    writeFileSync(join(TEST_DIR, 'health-2026-01-01T00-00-00.json'), 'invalid!!!')
    const list = hh.list()
    assert.equal(list.length, 1)
    assert.equal(list[0].error, true)
  })

  it('detectTrend detects continuous degradation', () => {
    const hh = new HealthHistory(TEST_DIR)
    hh.save({ timestamp: '2026-01-01T00:00:00.000Z', overall: '🟢' })
    hh.save({ timestamp: '2026-01-02T00:00:00.000Z', overall: '🟡' })
    hh.save({ timestamp: '2026-01-03T00:00:00.000Z', overall: '🔴' })

    const trend = hh.detectTrend()
    assert.equal(trend.degraded, true)
    assert.equal(trend.count, 2) // last 2 are non-green
  })

  it('detectTrend returns false when healthy', () => {
    const hh = new HealthHistory(TEST_DIR)
    hh.save({ timestamp: '2026-01-01T00:00:00.000Z', overall: '🟢' })
    hh.save({ timestamp: '2026-01-02T00:00:00.000Z', overall: '🟢' })

    const trend = hh.detectTrend()
    assert.equal(trend.degraded, false)
  })

  it('detectTrend returns false with single report', () => {
    const hh = new HealthHistory(TEST_DIR)
    hh.save({ timestamp: '2026-01-01T00:00:00.000Z', overall: '🔴' })

    const trend = hh.detectTrend()
    assert.equal(trend.degraded, false) // need >= 2 to flag
  })

  it('cleanup removes old files beyond limit', () => {
    const hh = new HealthHistory(TEST_DIR)
    for (let i = 0; i < 5; i++) {
      hh.save({ timestamp: `2026-01-0${i + 1}T00:00:00.000Z`, overall: '🟢' })
    }

    hh.cleanup(3) // keep only 3
    const files = readdirSync(TEST_DIR).filter(f => f.endsWith('.json'))
    assert.equal(files.length, 3)
    // Should keep the newest 3
    assert.ok(files.some(f => f.includes('2026-01-05')))
    assert.ok(files.some(f => f.includes('2026-01-04')))
    assert.ok(files.some(f => f.includes('2026-01-03')))
  })

  // --- E2E ---

  it('E2E: save → list → detectTrend full chain', () => {
    const hh = new HealthHistory(TEST_DIR)

    // Simulate 3 selfCheck reports over time
    hh.save({
      timestamp: '2026-03-15T06:00:00.000Z',
      overall: '🟢',
      system: { engine: { status: '🟢' } },
    })
    hh.save({
      timestamp: '2026-03-15T12:00:00.000Z',
      overall: '🟡',
      system: { engine: { status: '🟡' } },
    })
    hh.save({
      timestamp: '2026-03-15T18:00:00.000Z',
      overall: '🔴',
      system: { engine: { status: '🔴' } },
    })

    // Verify list
    const history = hh.list(10)
    assert.equal(history.length, 3)
    assert.equal(history[0].overall, '🔴') // newest
    assert.equal(history[0].system.engine.status, '🔴')

    // Verify trend
    const trend = hh.detectTrend()
    assert.ok(trend.degraded, 'should detect degradation')
    assert.equal(trend.count, 2)

    // Verify cleanup doesn't touch anything under limit
    hh.cleanup(100)
    assert.equal(readdirSync(TEST_DIR).filter(f => f.endsWith('.json')).length, 3)
  })
})

// --- S2: Pulse 触发器注册验证 ---

describe('T33 S2: health-check trigger registration', () => {
  it('Pulse.register accepts health-check trigger with skipAntiSpam', async () => {
    const { Pulse } = await import('./pulse.mjs')
    const stateDir = join(import.meta.dirname, '.test-pulse-s2-' + process.pid)
    mkdirSync(stateDir, { recursive: true })

    try {
      const pulse = new Pulse({
        config: { enabled: true, stateDir },
        stateDir,
        onTrigger: async () => {},
      })
      pulse.register({
        id: 'health-check',
        interval: 6 * 3600_000,
        action: 'selfCheck',
        skipAntiSpam: true,
      })

      const h = await pulse.health()
      assert.ok(h.detail.triggers.some(t => t.id === 'health-check'), 'health-check trigger should be registered')

      const trigger = h.detail.triggers.find(t => t.id === 'health-check')
      assert.equal(trigger.action, 'selfCheck')
      assert.equal(trigger.interval, 6 * 3600_000)
    } finally {
      rmSync(stateDir, { recursive: true, force: true })
    }
  })
})

// --- S3: Init 目录验证 ---

describe('T33 S3: init creates health-history directory', () => {
  it('initFamily creates pulse/health-history/ directory', async () => {
    const { initFamily } = await import('../family/init.mjs')
    const tmpHome = join(import.meta.dirname, '.test-init-s3-' + process.pid)

    try {
      mkdirSync(tmpHome, { recursive: true })
      initFamily(tmpHome, { memberName: 'muse', force: true })

      // Verify health-history dir exists
      const healthHistoryDir = join(tmpHome, 'members', 'muse', 'pulse', 'health-history')
      assert.ok(existsSync(healthHistoryDir), 'pulse/health-history/ directory should exist')
    } finally {
      rmSync(tmpHome, { recursive: true, force: true })
    }
  })
})
