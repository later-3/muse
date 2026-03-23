/**
 * T21: init.mjs tests
 */

import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initFamily } from './init.mjs'

function createTmpPath() {
  return join(tmpdir(), `muse-init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

describe('initFamily', () => {
  const cleanups = []

  afterEach(() => {
    for (const dir of cleanups) {
      try { rmSync(dir, { recursive: true, force: true }) } catch {}
    }
    cleanups.length = 0
  })

  it('should create complete directory structure', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir)

    assert.ok(existsSync(join(dir, 'family.json')))
    assert.ok(existsSync(join(dir, 'config.json')))
    assert.ok(existsSync(join(dir, 'shared', 'rules.json')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'config.json')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'identity', 'identity.json')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'memory')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'memory', 'attachments')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'capability')))
    assert.ok(existsSync(join(dir, 'members', 'nvwa', 'skills')))
  })

  it('should write valid family.json', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir, { owner: 'later', familyName: "Later's Family" })

    const family = JSON.parse(readFileSync(join(dir, 'family.json'), 'utf-8'))
    assert.equal(family.name, "Later's Family")
    assert.equal(family.owner, 'later')
    assert.deepEqual(family.members, ['nvwa'])
    assert.equal(family.version, 1)
    assert.ok(family.created)
  })

  it('should create valid default identity matching core/identity.mjs schema', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir)

    const id = JSON.parse(readFileSync(join(dir, 'members', 'nvwa', 'identity', 'identity.json'), 'utf-8'))
    // Fields required by identity.mjs validation
    assert.equal(id.identity.name, '小缪')
    assert.equal(id.identity.nickname, '缪缪')
    assert.equal(id.identity.owner, 'Later')
    assert.ok(id.psychology.mbti)
    assert.ok(id.linguistics.style)
    assert.ok(id.motivations.core_drive)
    assert.ok(id.boundaries.never_do.length >= 1, 'boundaries.never_do must have at least 1 item')
    assert.ok(id.boundaries.always_do.length >= 1)
    assert.equal(id.schemaVersion, '1.0')
  })

  it('should support custom member name', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir, { memberName: 'atlas' })

    assert.ok(existsSync(join(dir, 'members', 'atlas', 'config.json')))
    assert.ok(existsSync(join(dir, 'members', 'atlas', 'identity', 'identity.json')))

    const family = JSON.parse(readFileSync(join(dir, 'family.json'), 'utf-8'))
    assert.deepEqual(family.members, ['atlas'])
  })

  it('should throw on existing family without --force', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir)  // first time OK

    assert.throws(
      () => initFamily(dir),  // second time without force → error
      /Family 已存在/,
    )
  })

  it('should allow --force to overwrite', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    initFamily(dir, { owner: 'old' })
    initFamily(dir, { owner: 'new', force: true })

    const family = JSON.parse(readFileSync(join(dir, 'family.json'), 'utf-8'))
    assert.equal(family.owner, 'new')
  })

  it('should return familyHome and memberDir', () => {
    const dir = createTmpPath()
    cleanups.push(dir)
    const result = initFamily(dir)

    assert.ok(result.familyHome.includes(dir.split('/').pop()))
    assert.ok(result.memberDir.includes('members/nvwa'))
  })
})
