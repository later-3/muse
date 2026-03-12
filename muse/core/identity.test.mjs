import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Identity, deepMerge, createDefaultIdentity, VALID_TRAITS, TRAIT_LABELS } from './identity.mjs'

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'muse-identity-test-'))
}

function makeConfig(dir) {
  return { identity: { path: join(dir, 'identity.json') } }
}

function writeIdentity(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

describe('Identity', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  // Test 1: 默认加载
  it('should create default identity.json when file does not exist', async () => {
    const config = makeConfig(tmpDir)
    const identity = new Identity(config)
    await identity.start()

    assert.ok(identity.data)
    assert.equal(identity.data.identity.name, '小缪')
    assert.equal(identity.data.identity.nickname, '缪缪')
    assert.equal(identity.data.identity.owner, 'Later')

    // File should exist now
    const written = JSON.parse(readFileSync(config.identity.path, 'utf-8'))
    assert.equal(written.identity.name, '小缪')

    await identity.stop()
  })

  // Test 2: 正常加载
  it('should load existing identity.json', async () => {
    const config = makeConfig(tmpDir)
    const custom = createDefaultIdentity()
    custom.identity.name = '小助'
    custom.identity.nickname = '助助'
    writeIdentity(config.identity.path, custom)

    const identity = new Identity(config)
    await identity.start()

    assert.equal(identity.data.identity.name, '小助')
    assert.equal(identity.data.identity.nickname, '助助')

    await identity.stop()
  })

  // Test 3: schema 校验 — traits 超范围
  it('should reject trait values outside 0-1', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.psychology.traits.humor = 1.5
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /Trait "humor" must be 0-1/)
  })

  // Test 3b: schema 校验 — name 缺失
  it('should reject missing identity.name', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.identity.name = ''
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /identity\.name is required/)
  })

  // Test 3c: schema 校验 — unknown trait
  it('should reject unknown trait keys', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.psychology.traits.aggression = 0.5
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /Unknown trait: "aggression"/)
  })

  // Test 4: prompt 4 层结构
  it('should generate prompt with 4 layers', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('小缪'), 'should contain name')
    assert.ok(prompt.includes('## 风格'), 'should have style layer')
    assert.ok(prompt.includes('## 行为规则'), 'should have rules layer')
    assert.ok(prompt.includes('## 安全边界'), 'should have safety layer')
    assert.ok(prompt.includes('Later'), 'should contain owner')

    await identity.stop()
  })

  // Test 5: traits 高值
  it('should map high trait values to labels', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits.humor = 0.9
    data.psychology.traits.warmth = 0.8
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.ok(labels.includes('幽默风趣'), `labels should include 幽默风趣, got: ${labels}`)
    assert.ok(labels.includes('温暖贴心'), `labels should include 温暖贴心, got: ${labels}`)

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('幽默风趣'))

    await identity.stop()
  })

  // Test 6: traits 低值
  it('should map low trait values to labels', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits.humor = 0.2
    data.psychology.traits.warmth = 0.1
    data.psychology.traits.verbosity = 0.3
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.ok(labels.includes('严肃正式'), `labels should include 严肃正式, got: ${labels}`)
    assert.ok(labels.includes('理性客观'), `labels should include 理性客观, got: ${labels}`)
    assert.ok(labels.includes('言简意赅'), `labels should include 言简意赅, got: ${labels}`)

    await identity.stop()
  })

  // Test 7: traits 中值 — 不输出
  it('should not output labels for mid-range traits', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits = { humor: 0.5, warmth: 0.5, initiative: 0.5, precision: 0.5, verbosity: 0.5 }
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.equal(labels.length, 0, 'all mid-range traits should produce no labels')

    await identity.stop()
  })

  // Test 8: 深合并更新
  it('should deep merge updates without losing nested fields', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    // Only update humor, other traits should survive
    await identity.update({ psychology: { traits: { humor: 0.3 } } })

    assert.equal(identity.data.psychology.traits.humor, 0.3)
    assert.equal(identity.data.psychology.traits.warmth, 0.7, 'warmth should be preserved')
    assert.equal(identity.data.psychology.traits.precision, 0.7, 'precision should be preserved')
    assert.equal(identity.data.psychology.mbti, 'ENFP', 'mbti should be preserved')
    assert.equal(identity.data.identity.name, '小缪', 'name should be preserved')

    await identity.stop()
  })

  // Test 9: 原子写入 + updatedAt
  it('should atomically write and update timestamp', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const before = identity.data.updatedAt
    await new Promise(r => setTimeout(r, 10)) // ensure time difference
    await identity.update({ identity: { name: '小助' } })

    // File should be complete and valid
    const written = JSON.parse(readFileSync(config.identity.path, 'utf-8'))
    assert.equal(written.identity.name, '小助')
    assert.notEqual(written.updatedAt, before, 'updatedAt should change')

    await identity.stop()
  })

  // Test 10: last-known-good 回退 via reloadFromDisk
  it('should keep last-known-good when reload fails and recover on valid file', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()
    assert.equal(identity.data.identity.name, '小缪')

    // Step 1: Corrupt file
    writeFileSync(config.identity.path, '{ invalid json !!!', 'utf-8')

    // Step 2: Reload should fail, but keep old data
    const failResult = identity.reloadFromDisk()
    assert.equal(failResult, false, 'reload should return false on bad file')
    assert.equal(identity.data.identity.name, '小缪', 'should retain last good config')

    // Step 3: Write valid file back, reload should succeed
    const fixed = createDefaultIdentity()
    fixed.identity.name = '小助'
    writeIdentity(config.identity.path, fixed)
    const okResult = identity.reloadFromDisk()
    assert.equal(okResult, true, 'reload should return true on valid file')
    assert.equal(identity.data.identity.name, '小助', 'should load new config')

    await identity.stop()
  })

  // Test 11: stop 清理
  it('should clean up on stop', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()
    // Should not throw
    await identity.stop()
  })

  // Test 12: health
  it('should return health status', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const h = await identity.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail, '小缪')

    await identity.stop()
  })
})

describe('deepMerge', () => {
  it('should deep merge nested objects', () => {
    const target = { a: { b: 1, c: 2 }, d: 3 }
    const source = { a: { b: 10 } }
    const result = deepMerge(target, source)
    assert.equal(result.a.b, 10)
    assert.equal(result.a.c, 2, 'c should be preserved')
    assert.equal(result.d, 3)
  })

  it('should replace arrays entirely', () => {
    const target = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }
    const result = deepMerge(target, source)
    assert.deepEqual(result.arr, [4, 5])
  })

  it('should add new keys', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    const result = deepMerge(target, source)
    assert.equal(result.a, 1)
    assert.equal(result.b, 2)
  })
})
