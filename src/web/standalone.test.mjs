/**
 * T43: standalone.mjs 单元测试
 *
 * 验证：成员发现、路由匹配、工作流实例扫描
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { discoverMembers, readMemberConfig, listWorkflowInstances, matchRoute } from './standalone.mjs'

// ── Test Fixture ──

const TMP = join(tmpdir(), `muse-t43-test-${Date.now()}`)
const FAMILY = 'test-family'

function setupFixture() {
  const familyDir = join(TMP, FAMILY)
  const membersDir = join(familyDir, 'members')

  // nvwa — online member
  mkdirSync(join(membersDir, 'nvwa', 'data'), { recursive: true })
  writeFileSync(join(membersDir, 'nvwa', 'config.json'), JSON.stringify({
    role: 'nvwa',
    engine: { host: 'http://127.0.0.1', port: 4096 },
  }))
  writeFileSync(join(membersDir, 'nvwa', 'data', 'identity.json'), JSON.stringify({
    name: 'Test NvWa',
    bio: 'Test bio',
  }))

  // coder — offline member (configured but not in registry)
  mkdirSync(join(membersDir, 'coder'), { recursive: true })
  writeFileSync(join(membersDir, 'coder', 'config.json'), JSON.stringify({
    role: 'coder',
    engine: { host: 'http://127.0.0.1', port: 4098 },
  }))

  // registry.json — nvwa is online
  writeFileSync(join(familyDir, 'registry.json'), JSON.stringify({
    version: 5,
    members: {
      nvwa: {
        role: 'nvwa',
        engine: 'http://127.0.0.1:4096',
        pid: 12345,
        status: 'online',
        registeredAt: '2026-03-24T00:00:00Z',
      },
    },
  }))

  // workflow instances
  const wfDir = join(familyDir, 'workflow', 'instances', 'wf_test_001')
  mkdirSync(wfDir, { recursive: true })
  writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
    workflowId: 'test-wf',
    taskId: 'task-001',
    instanceId: 'wf_test_001',
    bindings: [{ role: 'pua', memberName: 'test-pua' }],
    smState: { status: 'running', current_node: 'write_doc' },
  }))

  // archived workflow
  const archDir = join(familyDir, 'workflow', 'archive', '2026-03', 'wf_old_001')
  mkdirSync(archDir, { recursive: true })
  writeFileSync(join(archDir, 'state.json'), JSON.stringify({
    workflowId: 'old-wf',
    smState: { status: 'completed' },
  }))
}

describe('T43: standalone service', () => {
  beforeEach(() => {
    setupFixture()
    process.env.MUSE_HOME = TMP
    process.env.MUSE_FAMILY = FAMILY
  })

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    delete process.env.MUSE_HOME
    delete process.env.MUSE_FAMILY
  })

  describe('matchRoute', () => {
    it('静态路径匹配', () => {
      const m = matchRoute('/api/family/members', '/api/family/members')
      assert.ok(m)
      assert.deepStrictEqual(m.params, {})
    })

    it('参数路径匹配', () => {
      const m = matchRoute('/api/member/:name/health', '/api/member/nvwa/health')
      assert.ok(m)
      assert.strictEqual(m.params.name, 'nvwa')
    })

    it('不匹配', () => {
      const m = matchRoute('/api/member/:name/health', '/api/family/members')
      assert.strictEqual(m, null)
    })
  })

  describe('discoverMembers', () => {
    it('合并目录扫描 + registry', () => {
      const members = discoverMembers()
      assert.strictEqual(members.length, 2)

      const nvwa = members.find(m => m.name === 'nvwa')
      assert.strictEqual(nvwa.status, 'online')
      assert.strictEqual(nvwa.engine, 'http://127.0.0.1:4096')
      assert.strictEqual(nvwa.pid, 12345)

      const coder = members.find(m => m.name === 'coder')
      assert.strictEqual(coder.status, 'offline')
      assert.strictEqual(coder.engine, undefined)
    })

    it('MUSE_HOME 未设置 → 空数组', () => {
      delete process.env.MUSE_HOME
      const members = discoverMembers()
      assert.strictEqual(members.length, 0)
    })
  })

  describe('readMemberConfig', () => {
    it('读取 config.json + identity.json', () => {
      const cfg = readMemberConfig('nvwa')
      assert.strictEqual(cfg.name, 'nvwa')
      assert.strictEqual(cfg.config.role, 'nvwa')
      assert.strictEqual(cfg.identity.name, 'Test NvWa')
    })

    it('不存在的 member → null', () => {
      const cfg = readMemberConfig('nonexistent')
      assert.strictEqual(cfg, null)
    })
  })

  describe('listWorkflowInstances', () => {
    it('扫描活跃 + 归档实例', () => {
      const result = listWorkflowInstances()
      assert.strictEqual(result.active.length, 1)
      assert.strictEqual(result.active[0].instanceId, 'wf_test_001')
      assert.strictEqual(result.active[0].status, 'running')

      assert.strictEqual(result.archived.length, 1)
      assert.strictEqual(result.archived[0].instanceId, 'wf_old_001')
      assert.strictEqual(result.archived[0].status, 'completed')
    })
  })
})
