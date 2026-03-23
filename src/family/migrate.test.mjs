/**
 * T21: migrate.mjs tests
 */

import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { migrate } from './migrate.mjs'

function createTmpDir(prefix = 'muse-migrate-test') {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function createOldDataDir(baseDir) {
  const dataDir = join(baseDir, 'data')
  mkdirSync(join(dataDir, 'images'), { recursive: true })

  // identity.json
  writeFileSync(join(dataDir, 'identity.json'), JSON.stringify({
    identity: { name: '小缪', nickname: '缪缪' },
    version: 1,
  }))

  // memory.db (fake file for testing)
  writeFileSync(join(dataDir, 'memory.db'), 'fake-sqlite-data')

  // Some images
  writeFileSync(join(dataDir, 'images', 'test.jpg'), 'fake-image')

  // .env
  writeFileSync(join(baseDir, '.env'), [
    'TELEGRAM_BOT_TOKEN=my-bot-token',
    'TELEGRAM_ALLOWED_USERS=123,456',
    'WEB_PORT=5000',
    '# This is a comment',
    '',
    'OPENCODE_HOST=http://custom-host',
  ].join('\n'))

  return dataDir
}

describe('migrate', () => {
  const cleanups = []

  afterEach(() => {
    for (const dir of cleanups) {
      try { rmSync(dir, { recursive: true, force: true }) } catch {}
    }
    cleanups.length = 0
  })

  it('should migrate identity.json + memory.db + images', async () => {
    const srcDir = createTmpDir('migrate-src')
    cleanups.push(srcDir)
    const dataDir = createOldDataDir(srcDir)

    const targetDir = createTmpDir('migrate-target')
    cleanups.push(targetDir)
    rmSync(targetDir, { recursive: true })  // migrate will create it

    // Change CWD temporarily for .env resolution
    const origCwd = process.cwd()
    process.chdir(srcDir)
    try {
      await migrate(targetDir, { dataDir })
    } finally {
      process.chdir(origCwd)
    }

    // Verify structure
    assert.ok(existsSync(join(targetDir, 'family.json')))
    assert.ok(existsSync(join(targetDir, 'members', 'nvwa', 'identity', 'identity.json')))
    assert.ok(existsSync(join(targetDir, 'members', 'nvwa', 'memory', 'memory.db')))
    assert.ok(existsSync(join(targetDir, 'members', 'nvwa', 'memory', 'attachments', 'test.jpg')))

    // Verify identity content preserved
    const id = JSON.parse(readFileSync(join(targetDir, 'members', 'nvwa', 'identity', 'identity.json'), 'utf-8'))
    assert.equal(id.identity.name, '小缪')

    // Verify .env was parsed into configs
    const memberCfg = JSON.parse(readFileSync(join(targetDir, 'members', 'nvwa', 'config.json'), 'utf-8'))
    assert.equal(memberCfg.telegram.botToken, 'my-bot-token')
    assert.deepEqual(memberCfg.telegram.allowedUsers, ['123', '456'])

    const familyCfg = JSON.parse(readFileSync(join(targetDir, 'config.json'), 'utf-8'))
    assert.equal(familyCfg.web.port, 5000)
    assert.equal(familyCfg.engine.host, 'http://custom-host')

    // Original data preserved
    assert.ok(existsSync(join(dataDir, 'identity.json')), 'Original data should be preserved')
  })

  it('should throw when data dir does not exist', async () => {
    await assert.rejects(
      () => migrate('/tmp/muse-nonexistent', { dataDir: '/nonexistent/data' }),
      /旧数据目录不存在/,
    )
  })

  it('should throw when identity.json missing from data/', async () => {
    const srcDir = createTmpDir('migrate-no-id')
    cleanups.push(srcDir)
    const dataDir = join(srcDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    // No identity.json

    const targetDir = createTmpDir('migrate-target-2')
    cleanups.push(targetDir)
    rmSync(targetDir, { recursive: true })

    await assert.rejects(
      () => migrate(targetDir, { dataDir }),
      /无旧数据可迁移/,
    )
  })

  it('should throw when target FAMILY_HOME already exists', async () => {
    const srcDir = createTmpDir('migrate-existing')
    cleanups.push(srcDir)
    createOldDataDir(srcDir)

    const targetDir = createTmpDir('migrate-exists')
    cleanups.push(targetDir)
    // Create a family.json to simulate existing
    writeFileSync(join(targetDir, 'family.json'), '{}')

    const origCwd = process.cwd()
    process.chdir(srcDir)
    try {
      await assert.rejects(
        () => migrate(targetDir, { dataDir: join(srcDir, 'data') }),
        /目标 FAMILY_HOME 已存在/,
      )
    } finally {
      process.chdir(origCwd)
    }
  })
})
