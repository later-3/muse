/**
 * T43: standalone.mjs 单元测试 + API 级测试
 *
 * 覆盖：
 * - 纯函数：matchRoute, discoverMembers, readMemberConfig, listWorkflowInstances
 * - HTTP API：handleRequest → GET /api/family/members, GET /api/member/:name/config,
 *   GET /, POST restart, 404
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { discoverMembers, readMemberConfig, listWorkflowInstances, matchRoute, handleRequest } from './standalone.mjs'

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

// ── Mock HTTP req/res for handleRequest tests ──

function mockReq(method, url, body) {
  return {
    method,
    url,
    headers: { host: 'localhost:4200' },
    [Symbol.asyncIterator]: async function* () {
      if (body) yield Buffer.from(body)
    },
  }
}

function mockRes() {
  const res = {
    _status: null,
    _headers: {},
    _body: '',
    writeHead(status, headers) {
      res._status = status
      Object.assign(res._headers, headers || {})
    },
    end(data) {
      res._body = data ? (typeof data === 'string' ? data : data.toString()) : ''
    },
    json() {
      return JSON.parse(res._body)
    },
  }
  return res
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

  // ── 纯函数测试 ──

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
    })

    it('MUSE_HOME 未设置 → 空数组', () => {
      delete process.env.MUSE_HOME
      assert.strictEqual(discoverMembers().length, 0)
    })
  })

  describe('readMemberConfig', () => {
    it('读取 config.json + identity.json', () => {
      const cfg = readMemberConfig('nvwa')
      assert.strictEqual(cfg.config.role, 'nvwa')
      assert.strictEqual(cfg.identity.name, 'Test NvWa')
    })

    it('不存在的 member → null', () => {
      assert.strictEqual(readMemberConfig('nonexistent'), null)
    })
  })

  describe('listWorkflowInstances', () => {
    it('扫描活跃 + 归档实例', () => {
      const result = listWorkflowInstances()
      assert.strictEqual(result.active.length, 1)
      assert.strictEqual(result.active[0].instanceId, 'wf_test_001')
      assert.strictEqual(result.archived.length, 1)
      assert.strictEqual(result.archived[0].status, 'completed')
    })
  })

  // ── HTTP API 测试 ──

  describe('handleRequest — API 层', () => {
    it('GET /api/family/members → 200 + 成员列表', async () => {
      const req = mockReq('GET', '/api/family/members')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.family, FAMILY)
      assert.strictEqual(data.members.length, 2)
      assert.ok(data.members.find(m => m.name === 'nvwa'))
    })

    it('GET /api/member/nvwa/config → 200 + config + identity', async () => {
      const req = mockReq('GET', '/api/member/nvwa/config')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.name, 'nvwa')
      assert.strictEqual(data.config.role, 'nvwa')
      assert.strictEqual(data.identity.name, 'Test NvWa')
    })

    it('GET /api/member/nonexistent/config → 404', async () => {
      const req = mockReq('GET', '/api/member/nonexistent/config')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
      assert.ok(res.json().error.includes('not found'))
    })

    it('GET /api/member/nvwa/health → offline member returns offline status', async () => {
      const req = mockReq('GET', '/api/member/coder/health')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.status, 'offline')
    })

    it('GET /api/workflow/instances → 200 + active/archived', async () => {
      const req = mockReq('GET', '/api/workflow/instances')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.active.length, 1)
      assert.strictEqual(data.archived.length, 1)
    })

    it('GET / → 200 + text/html (cockpit/index.html)', async () => {
      const req = mockReq('GET', '/')
      const res = mockRes()
      await handleRequest(req, res)

      // cockpit/index.html exists → 200
      assert.strictEqual(res._status, 200)
      assert.ok(res._headers['Content-Type'].includes('text/html'))
    })

    it('GET /nonexistent-api → 404', async () => {
      const req = mockReq('GET', '/api/does/not/exist')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
    })

    it('OPTIONS → 204 CORS preflight', async () => {
      const req = mockReq('OPTIONS', '/api/family/members')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 204)
      assert.ok(res._headers['Access-Control-Allow-Origin'])
    })

    it('POST /api/member/nonexistent/restart → 404', async () => {
      const req = mockReq('POST', '/api/member/nonexistent/restart')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
    })
  })

  // ── T46: Config Management API 测试 ──

  describe('T46: handleRequest — Config API', () => {
    beforeEach(() => {
      // Setup identity.json in proper schema format
      const membersDir = join(TMP, FAMILY, 'members')
      writeFileSync(join(membersDir, 'nvwa', 'data', 'identity.json'), JSON.stringify({
        id: 'test',
        identity: { name: '小缪', nickname: '缪缪', bio: 'Test bio', owner: 'Later' },
        psychology: { mbti: 'ENFP', traits: { humor: 0.8, warmth: 0.7 } },
      }))
      // Setup opencode.json
      writeFileSync(join(membersDir, 'nvwa', 'opencode.json'), JSON.stringify({
        model: 'test-model/v1',
        small_model: 'test-small/v1',
        permission: { bash: 'allow' },
      }))
    })

    it('GET /api/member/nvwa/identity → 200 + identity data', async () => {
      const req = mockReq('GET', '/api/member/nvwa/identity')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.identity.name, '小缪')
      assert.strictEqual(data.psychology.mbti, 'ENFP')
    })

    it('PUT /api/member/nvwa/identity → 200 + deep merge', async () => {
      const body = JSON.stringify({
        identity: { name: '新名字' },
        psychology: { traits: { humor: 0.9 } },
      })
      const req = mockReq('PUT', '/api/member/nvwa/identity', body)
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const result = res.json()
      assert.strictEqual(result.ok, true)
      // Verify merge: name changed, warmth preserved
      assert.strictEqual(result.identity.identity.name, '新名字')
      assert.strictEqual(result.identity.psychology.traits.humor, 0.9)
      assert.strictEqual(result.identity.psychology.traits.warmth, 0.7) // preserved

      // Verify file was written
      const written = JSON.parse(readFileSync(
        join(TMP, FAMILY, 'members', 'nvwa', 'data', 'identity.json'), 'utf-8'
      ))
      assert.strictEqual(written.identity.name, '新名字')
    })

    it('GET /api/member/nonexistent/identity → 404', async () => {
      const req = mockReq('GET', '/api/member/nonexistent/identity')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
    })

    it('GET /api/member/nvwa/model → 200 + model data', async () => {
      const req = mockReq('GET', '/api/member/nvwa/model')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const data = res.json()
      assert.strictEqual(data.model, 'test-model/v1')
      assert.strictEqual(data.small_model, 'test-small/v1')
    })

    it('PUT /api/member/nvwa/model → 200 + requiresRestart', async () => {
      const body = JSON.stringify({ model: 'new-model/v2' })
      const req = mockReq('PUT', '/api/member/nvwa/model', body)
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 200)
      const result = res.json()
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.model, 'new-model/v2')
      assert.strictEqual(result.requiresRestart, true)

      // Verify file: model changed, other fields preserved
      const written = JSON.parse(readFileSync(
        join(TMP, FAMILY, 'members', 'nvwa', 'opencode.json'), 'utf-8'
      ))
      assert.strictEqual(written.model, 'new-model/v2')
      assert.strictEqual(written.permission.bash, 'allow') // preserved
    })
  })

  // ── T45: OpenCode Proxy API 测试 ──

  describe('T45: handleRequest — OpenCode Proxy API', () => {
    it('GET /api/member/:name/oc/session → 503 for offline member', async () => {
      // coder is offline in fixture
      const req = mockReq('GET', '/api/member/coder/oc/session')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 503)
      assert.ok(res.json().error.includes('offline'))
    })

    it('GET /api/member/nonexistent/oc/session → 404', async () => {
      const req = mockReq('GET', '/api/member/nonexistent/oc/session')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
    })

    it('POST /api/member/:name/oc/session/:sid/prompt_async → 503 for offline', async () => {
      const body = JSON.stringify({ parts: [{ type: 'text', text: 'hello' }] })
      const req = mockReq('POST', '/api/member/coder/oc/session/sid-123/prompt_async', body)
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 503)
    })

    it('GET /api/member/nonexistent/oc/session/:sid/message → 404', async () => {
      const req = mockReq('GET', '/api/member/nonexistent/oc/session/sid-123/message')
      const res = mockRes()
      await handleRequest(req, res)

      assert.strictEqual(res._status, 404)
    })

    it('prompt_async 路由匹配正确', () => {
      const m = matchRoute('/api/member/:name/oc/session/:sid/prompt_async',
                           '/api/member/nvwa/oc/session/abc123/prompt_async')
      assert.ok(m)
      assert.strictEqual(m.params.name, 'nvwa')
      assert.strictEqual(m.params.sid, 'abc123')
    })
  })
})
