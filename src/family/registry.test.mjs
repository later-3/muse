/**
 * T39-1.1: Family Registry 单元测试
 *
 * 覆盖：
 * - register / unregister / findByRole / findByName / getAllOnline
 * - 原子写 + version 递增
 * - 真实冲突重试（monkey-patch atomicWrite 制造 VersionConflictError）
 * - 脏在线自愈
 * - role 唯一（重复 role 抛错）
 * - registry.json 损坏抛 RegistryCorruptError（不静默降级）
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  registerMember,
  unregisterMember,
  findByRole,
  findByName,
  getAllOnline,
  readRegistry,
  getRegistryPath,
  VersionConflictError,
  RegistryCorruptError,
  _testHooks,
} from './registry.mjs'

describe('T39-1.1: Family Registry', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'muse-registry-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  describe('register', () => {
    it('应该创建 registry.json 并写入 member 条目', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098', pid: 1234 }, tmpDir)

      const registry = readRegistry(getRegistryPath(tmpDir))
      assert.equal(registry.version, 1)
      assert.equal(registry.members.nvwa.role, 'orchestrator')
      assert.equal(registry.members.nvwa.engine, 'http://127.0.0.1:4098')
      assert.equal(registry.members.nvwa.pid, 1234)
      assert.equal(registry.members.nvwa.status, 'online')
      assert.ok(registry.members.nvwa.registeredAt)
    })

    it('多个 member 依次注册，version 递增', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)
      registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir)

      const registry = readRegistry(getRegistryPath(tmpDir))
      assert.equal(registry.version, 2)
      assert.ok(registry.members.nvwa)
      assert.ok(registry.members.arch)
    })
  })

  describe('unregister', () => {
    it('应该把 status 设为 offline', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)
      unregisterMember('nvwa', tmpDir)

      const registry = readRegistry(getRegistryPath(tmpDir))
      assert.equal(registry.members.nvwa.status, 'offline')
      assert.ok(registry.members.nvwa.unregisteredAt)
    })

    it('注销不存在的 member 不报错', () => {
      assert.doesNotThrow(() => {
        unregisterMember('nonexistent', tmpDir)
      })
    })
  })

  describe('findByRole', () => {
    it('应该返回唯一在线 member', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098', pid: 111 }, tmpDir)
      registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101', pid: 222 }, tmpDir)

      const result = findByRole('arch', tmpDir)
      assert.deepEqual(result, { name: 'arch', role: 'arch', engine: 'http://127.0.0.1:4101', pid: 222 })
    })

    it('offline member 不返回', () => {
      registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir)
      unregisterMember('arch', tmpDir)

      assert.equal(findByRole('arch', tmpDir), null)
    })

    it('无匹配返回 null', () => {
      assert.equal(findByRole('nonexistent', tmpDir), null)
    })

    it('重复 role 应该抛错（不静默返回第一个）', () => {
      registerMember('arch-1', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir)
      registerMember('arch-2', { role: 'arch', engine: 'http://127.0.0.1:4102' }, tmpDir)

      assert.throws(
        () => findByRole('arch', tmpDir),
        (err) => {
          assert.ok(err.message.includes('违反唯一约束'))
          assert.ok(err.message.includes('arch-1'))
          assert.ok(err.message.includes('arch-2'))
          return true
        }
      )
    })
  })

  describe('findByName', () => {
    it('应该返回完整 member 信息', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098', pid: 111 }, tmpDir)

      const result = findByName('nvwa', tmpDir)
      assert.equal(result.name, 'nvwa')
      assert.equal(result.role, 'orchestrator')
      assert.equal(result.status, 'online')
    })

    it('不存在返回 null', () => {
      assert.equal(findByName('nonexistent', tmpDir), null)
    })
  })

  describe('getAllOnline', () => {
    it('只返回在线 member', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)
      registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir)
      unregisterMember('arch', tmpDir)

      const online = getAllOnline(tmpDir)
      assert.equal(online.length, 1)
      assert.equal(online[0].name, 'nvwa')
    })

    it('空 registry 返回空数组', () => {
      assert.deepEqual(getAllOnline(tmpDir), [])
    })
  })

  describe('脏在线自愈', () => {
    it('注册已存在的 online member 应覆盖（自愈）', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098', pid: 111 }, tmpDir)
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098', pid: 222 }, tmpDir)

      const result = findByName('nvwa', tmpDir)
      assert.equal(result.pid, 222)
      assert.equal(result.status, 'online')
    })
  })

  describe('version 冲突重试（真实冲突）', () => {
    afterEach(() => {
      _testHooks.beforeWrite = null
    })

    it('read 和 write 之间被外部写入时，应触发 CAS 冲突并重试成功', () => {
      // 先创建初始 registry
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)

      let conflictCount = 0
      // 钩子：在 atomicWrite 前偷偷递增 version（模拟外部 writer）
      // 只干扰第一次，让重试能成功
      _testHooks.beforeWrite = (registryPath) => {
        if (conflictCount === 0) {
          conflictCount++
          // 外部 writer 把 version 改掉
          const current = JSON.parse(readFileSync(registryPath, 'utf-8'))
          current.version += 1
          writeFileSync(registryPath, JSON.stringify(current, null, 2), 'utf-8')
        }
      }

      // 这次 register 的第一次 write 会失败（version 已被篡改），重试后成功
      registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir)

      assert.equal(conflictCount, 1, '应触发过一次冲突')
      const registry = readRegistry(getRegistryPath(tmpDir))
      assert.equal(registry.members.arch.status, 'online')
    })

    it('连续 MAX_RETRIES+1 次冲突应抛 VersionConflictError', () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)

      // 每次 write 前都篡改 version → 永远冲突
      _testHooks.beforeWrite = (registryPath) => {
        const current = JSON.parse(readFileSync(registryPath, 'utf-8'))
        current.version += 1
        writeFileSync(registryPath, JSON.stringify(current, null, 2), 'utf-8')
      }

      assert.throws(
        () => registerMember('arch', { role: 'arch', engine: 'http://127.0.0.1:4101' }, tmpDir),
        (err) => err instanceof VersionConflictError
      )
    })

    it('VersionConflictError 有正确的属性', () => {
      const err = new VersionConflictError(1, 2)
      assert.equal(err.name, 'VersionConflictError')
      assert.equal(err.expected, 1)
      assert.equal(err.actual, 2)
    })
  })

  describe('registry.json 损坏', () => {
    it('损坏的 JSON 应该抛 RegistryCorruptError（不静默返回空）', () => {
      const registryPath = getRegistryPath(tmpDir)
      mkdirSync(tmpDir, { recursive: true })
      writeFileSync(registryPath, 'NOT VALID JSON', 'utf-8')

      assert.throws(
        () => readRegistry(registryPath),
        (err) => {
          assert.equal(err.name, 'RegistryCorruptError')
          assert.ok(err.path.includes('registry.json'))
          return true
        }
      )
    })

    it('损坏时 register 应该抛错（防止覆盖）', () => {
      const registryPath = getRegistryPath(tmpDir)
      mkdirSync(tmpDir, { recursive: true })
      writeFileSync(registryPath, '{broken', 'utf-8')

      assert.throws(
        () => registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir),
        (err) => err.name === 'RegistryCorruptError'
      )
    })

    it('RegistryCorruptError 有正确的属性', () => {
      const err = new RegistryCorruptError('/some/path/registry.json', 'parse error')
      assert.equal(err.name, 'RegistryCorruptError')
      assert.ok(err.path.includes('registry.json'))
    })
  })

  describe('registry.json 格式', () => {
    it('文件是格式化的 JSON', async () => {
      registerMember('nvwa', { role: 'orchestrator', engine: 'http://127.0.0.1:4098' }, tmpDir)

      const content = await readFile(getRegistryPath(tmpDir), 'utf-8')
      const parsed = JSON.parse(content)
      assert.equal(typeof parsed.version, 'number')
      assert.equal(typeof parsed.members, 'object')
      assert.ok(content.includes('\n'))
    })
  })
})
