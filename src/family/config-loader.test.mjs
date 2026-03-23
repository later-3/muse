/**
 * T21: config-loader tests
 *
 * Tests the 4-layer config loading, error cases, and legacy fallback.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { deepMerge, loadFamilyConfig, legacyConfig, DEFAULTS } from './config-loader.mjs'

// --- Test Helpers ---

function createTmpDir() {
  const dir = join(tmpdir(), `muse-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function setupFamilyHome(tmpDir, options = {}) {
  const { memberName = 'nvwa', familyConfig = {}, memberConfig = {}, skipFamilyJson = false } = options

  if (!skipFamilyJson) {
    writeFileSync(join(tmpDir, 'family.json'), JSON.stringify({
      name: "Test Family",
      owner: "tester",
      members: [memberName],
      created: "2026-01-01",
      version: 1,
    }))
  }

  // Family config
  writeFileSync(join(tmpDir, 'config.json'), JSON.stringify(familyConfig))

  // Member directories
  const memberDir = join(tmpDir, 'members', memberName)
  mkdirSync(join(memberDir, 'identity'), { recursive: true })
  mkdirSync(join(memberDir, 'memory'), { recursive: true })
  mkdirSync(join(memberDir, 'memory', 'attachments'), { recursive: true })

  // Member config
  writeFileSync(join(memberDir, 'config.json'), JSON.stringify(memberConfig))

  return memberDir
}

// --- Tests ---

describe('deepMerge', () => {
  it('should merge flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 })
    assert.deepEqual(result, { a: 1, b: 3, c: 4 })
  })

  it('should deep merge nested objects', () => {
    const result = deepMerge(
      { engine: { host: 'localhost', port: 3000 } },
      { engine: { port: 4096 } },
    )
    assert.deepEqual(result, { engine: { host: 'localhost', port: 4096 } })
  })

  it('should replace arrays instead of merging', () => {
    const result = deepMerge(
      { users: ['a', 'b'] },
      { users: ['c'] },
    )
    assert.deepEqual(result, { users: ['c'] })
  })

  it('should skip null/undefined sources', () => {
    const result = deepMerge({ a: 1 }, null, undefined, { b: 2 })
    assert.deepEqual(result, { a: 1, b: 2 })
  })

  it('should not mutate the original target', () => {
    const target = { a: { x: 1 } }
    const result = deepMerge(target, { a: { y: 2 } })
    assert.equal(target.a.y, undefined)  // original not mutated
    assert.equal(result.a.y, 2)
  })

  it('should handle 3+ sources (defaults → family → member)', () => {
    const result = deepMerge(
      { engine: { host: 'default', port: 3000 }, web: { port: 8080 } },
      { engine: { port: 4096 } },           // family config
      { engine: { host: 'custom' } },        // member config
    )
    assert.deepEqual(result, { engine: { host: 'custom', port: 4096 }, web: { port: 8080 } })
  })
})

describe('loadFamilyConfig', () => {
  let tmpDir
  const savedEnv = {}

  beforeEach(() => {
    tmpDir = createTmpDir()
    // Save and clear relevant env vars
    for (const key of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USERS', 'OPENCODE_HOST',
      'OPENCODE_PORT', 'MEMORY_DB_PATH', 'IDENTITY_PATH', 'WEB_PORT', 'WEB_HOST']) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    // Cleanup temp dir
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  })

  it('should load defaults when JSON configs are empty', () => {
    setupFamilyHome(tmpDir)
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.engine.host, 'http://127.0.0.1')
    assert.equal(config.engine.port, 4096)
    assert.equal(config.web.port, 4097)
    assert.equal(config.memory.maxEpisodicDays, 90)
  })

  it('should resolve member data paths to absolute paths', () => {
    setupFamilyHome(tmpDir)
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.ok(config.memory.dbPath.startsWith('/'), 'dbPath should be absolute')
    assert.ok(config.memory.dbPath.includes('members/nvwa/memory/memory.db'))
    assert.ok(config.identity.path.includes('members/nvwa/identity/identity.json'))
    assert.ok(config.telegram.imageDir.includes('members/nvwa/memory/attachments'))
  })

  it('should merge family config (layer 2) over defaults', () => {
    setupFamilyHome(tmpDir, {
      familyConfig: { engine: { port: 5000 }, web: { port: 5001 } },
    })
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.engine.port, 5000)
    assert.equal(config.web.port, 5001)
    assert.equal(config.engine.host, 'http://127.0.0.1')  // default preserved
  })

  it('should merge member config (layer 3) over family config', () => {
    setupFamilyHome(tmpDir, {
      familyConfig: { engine: { port: 5000 } },
      memberConfig: { telegram: { botToken: 'member-token' }, engine: { port: 6000 } },
    })
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.engine.port, 6000)  // member overrides family
    assert.equal(config.telegram.botToken, 'member-token')
  })

  it('should allow env override (layer 4) over JSON configs', () => {
    setupFamilyHome(tmpDir, {
      memberConfig: { telegram: { botToken: 'json-token' } },
    })
    process.env.TELEGRAM_BOT_TOKEN = 'env-token'
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.telegram.botToken, 'env-token')  // env wins
  })

  it('should allow env override for data paths', () => {
    setupFamilyHome(tmpDir)
    process.env.MEMORY_DB_PATH = '/custom/memory.db'
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.memory.dbPath, '/custom/memory.db')  // env takes precedence
  })

  // --- Error cases ---

  it('should throw when FAMILY_HOME directory does not exist', () => {
    assert.throws(
      () => loadFamilyConfig('/nonexistent/path'),
      /MUSE_HOME 指向的目录不存在/,
    )
  })

  it('should throw when family.json is missing', () => {
    setupFamilyHome(tmpDir, { skipFamilyJson: true })
    assert.throws(
      () => loadFamilyConfig(tmpDir),
      /无效的 FAMILY_HOME: 缺少 family.json/,
    )
  })

  it('should throw when config.json is corrupted JSON', () => {
    setupFamilyHome(tmpDir)
    writeFileSync(join(tmpDir, 'config.json'), '{invalid json}')
    assert.throws(
      () => loadFamilyConfig(tmpDir),
      /配置文件损坏/,
    )
  })

  it('should handle missing member config.json gracefully (empty object)', () => {
    // Setup family but delete member config
    setupFamilyHome(tmpDir)
    rmSync(join(tmpDir, 'members', 'nvwa', 'config.json'))
    const config = loadFamilyConfig(tmpDir, 'nvwa')

    assert.equal(config.engine.host, 'http://127.0.0.1')  // defaults apply
  })

  it('should support different member names', () => {
    setupFamilyHome(tmpDir, { memberName: 'atlas' })
    const config = loadFamilyConfig(tmpDir, 'atlas')

    assert.ok(config.memory.dbPath.includes('members/atlas/memory/memory.db'))
    assert.ok(config.identity.path.includes('members/atlas/identity/identity.json'))
  })
})

describe('legacyConfig', () => {
  it('should return config compatible with original format', () => {
    const config = legacyConfig()

    assert.equal(typeof config.telegram.botToken, 'string')
    assert.ok(Array.isArray(config.telegram.allowedUsers))
    assert.equal(config.engine.host, 'http://127.0.0.1')
    assert.equal(config.engine.port, 4096)
    assert.equal(config.web.port, 4097)
    assert.equal(config.memory.maxEpisodicDays, 90)
    assert.equal(config.daemon.heartbeatIntervalMs, 30000)
    assert.equal(config.daemon.maxFailures, 3)
  })

  it('should have imageDir in legacy mode', () => {
    const config = legacyConfig()
    assert.equal(config.telegram.imageDir, './data/images')
  })
})
