/**
 * T09 集成联调 — 风险区域集成测试
 *
 * 聚焦 3 个系统级风险 (来自 T07/T08 评审):
 *   1. Web 降级: Engine 不可用时 Web 仍提供真实降级状态
 *   2. Identity/Web 契约: Web 编辑身份 → Identity 数据结构一致
 *   3. Cerebellum 失败语义 + 诊断闭环
 *
 * 注意: index.test.mjs 已有 14 项系统级测试覆盖基本 DI/启动/关闭/路由，
 * 本文件不重复这些，只覆盖 T09 新增风险验收标准 ⑦⑧⑨⑩⑪。
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

import { Identity } from './core/identity.mjs'
import { Memory } from './core/memory.mjs'
import { WebServer } from './web/api.mjs'
import { Cerebellum } from './daemon/cerebellum.mjs'

// --- Helpers ---

/** 分配一个固定测试端口段，避免和其他测试冲突 */
let testPortCounter = 19850

function nextTestPort() {
  return testPortCounter++
}

function createTestFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-int-test-'))
  const dbPath = path.join(tmpDir, 'test-memory.db')
  const identityPath = path.join(tmpDir, 'test-identity.json')

  const identityData = {
    id: 'test-identity',
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    identity: {
      name: '小缪',
      nickname: '缪缪',
      bio: '测试用 AI 助手',
      owner: 'Tester',
    },
    psychology: {
      mbti: 'ENFP',
      traits: { humor: 0.8, warmth: 0.7, initiative: 0.6, precision: 0.7, verbosity: 0.5 },
    },
    linguistics: {
      style: '轻松专业',
      formality: 'casual',
      catchphrases: ['嘿～'],
      forbidden_words: [],
      language: 'zh-CN',
    },
    motivations: {
      core_drive: '测试辅助',
      values: ['高效'],
    },
    boundaries: {
      never_do: ['假装是人类'],
      always_do: ['诚实回答'],
    },
  }
  fs.writeFileSync(identityPath, JSON.stringify(identityData, null, 2))

  const webPort = nextTestPort()

  return {
    config: {
      telegram: { botToken: 'test-token', allowedUsers: [] },
      engine: {
        host: 'http://127.0.0.1',
        port: 19990,  // 不存在的端口 — 用于 mock
        workspace: tmpDir,
        defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
        heavyModel: { providerID: 'anthropic', modelID: 'claude-sonnet-4' },
      },
      memory: { dbPath, maxEpisodicDays: 90 },
      identity: { path: identityPath },
      web: { port: webPort, host: '127.0.0.1' },
      daemon: {
        heartbeatIntervalMs: 100,
        maxFailures: 3,
        sessionGCIntervalMs: 999_999,
      },
    },
    webPort,
    identityData,
    identityPath,
    tmpDir,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    },
  }
}

function createMockEngine(healthy = true) {
  let running = healthy
  return {
    start: async () => { running = true },
    stop: async () => { running = false },
    health: async () => ({ ok: running, detail: running ? 'mock-healthy' : 'mock-unreachable' }),
    createSession: async () => ({ id: `test-session-${Date.now()}` }),
    sendAndWait: async () => ({
      text: '[mock reply]',
      message: { role: 'assistant' },
    }),
  }
}

/** 对本地 Web 服务发 HTTP 请求 */
async function webFetch(port, urlPath, opts = {}) {
  const { method = 'GET', body } = opts
  const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000),
  })
  const json = await res.json()
  return { status: res.status, json }
}

function createMockOpenCodeServer(handler) {
  return new Promise(resolve => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function closeServer(server) {
  return new Promise(resolve => server.close(resolve))
}

// =====================================================
// 验收标准 ⑦: Web 在 Engine 失败时仍可访问且显示降级状态
// =====================================================

describe('IT-08 Web 降级 — Engine 不可用时的诊断入口', () => {
  let fixture, web, identity, memory

  beforeEach(async () => {
    fixture = createTestFixture()
    identity = new Identity(fixture.config)
    memory = new Memory(fixture.config)
    const engine = createMockEngine(false)  // Engine 不可用

    await identity.start()
    await memory.start()

    web = new WebServer(fixture.config, { identity, memory, engine, orchestrator: null })
    await web.start()
  })

  afterEach(async () => {
    await web.stop()
    await memory.stop()
    await identity.stop()
    fixture.cleanup()
  })

  it('Web 仍然在线', async () => {
    const h = await web.health()
    assert.equal(h.ok, true, 'Web 自身应正常')
  })

  it('/api/health 返回 engine: unreachable 降级状态', async () => {
    const { status, json } = await webFetch(fixture.webPort, '/api/health')
    assert.equal(status, 200, 'HTTP 应返回 200 (接口本身正常)')
    assert.equal(json.ok, false, '整体 ok 应为 false (Engine 不可用)')
    assert.equal(json.data.engine.ok, false, 'engine.ok 应为 false')
    assert.equal(json.data.identity.ok, true, 'identity 应正常')
    assert.equal(json.data.memory.ok, true, 'memory 应正常')
  })
})

// =====================================================
// 验收标准 ⑧: Web 身份编辑 → Identity 数据结构完全对齐
// =====================================================

describe('IT-06 身份热更契约 — Web 编辑 → Identity 对齐', () => {
  let fixture, web, identity, memory

  beforeEach(async () => {
    fixture = createTestFixture()
    identity = new Identity(fixture.config)
    memory = new Memory(fixture.config)
    const engine = createMockEngine(true)

    await identity.start()
    await memory.start()

    web = new WebServer(fixture.config, { identity, memory, engine, orchestrator: null })
    await web.start()
  })

  afterEach(async () => {
    await web.stop()
    await memory.stop()
    await identity.stop()
    fixture.cleanup()
  })

  it('GET /api/identity 返回完整嵌套结构', async () => {
    const { json } = await webFetch(fixture.webPort, '/api/identity')
    assert.equal(json.ok, true)
    // 验证关键嵌套: identity.data.identity.name (不是 identity.data.name)
    assert.equal(json.data.identity.name, '小缪')
    assert.equal(json.data.psychology.mbti, 'ENFP')
    assert.ok(json.data.psychology.traits.humor > 0)
    assert.equal(json.data.linguistics.formality, 'casual')
  })

  it('PUT /api/identity 修改 → Identity 实时反映 + 持久化', async () => {
    const patch = {
      identity: { name: '小测', nickname: '测测', bio: '修改后的助手', owner: 'Tester' },
      psychology: {
        mbti: 'INTJ',
        traits: { humor: 0.3, warmth: 0.9, initiative: 0.4, precision: 0.9, verbosity: 0.2 },
      },
    }

    const { status, json } = await webFetch(fixture.webPort, '/api/identity', {
      method: 'PUT',
      body: patch,
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)

    // 验证 Identity 模块内存中的数据已更新
    assert.equal(identity.data.identity.name, '小测')
    assert.equal(identity.data.psychology.mbti, 'INTJ')

    // 验证 system prompt 反映了新名字
    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('小测'), `prompt 应包含新名字 "小测"`)

    // 验证文件也更新了 (持久化)
    const fileData = JSON.parse(fs.readFileSync(fixture.identityPath, 'utf-8'))
    assert.equal(fileData.identity.name, '小测')
    assert.equal(fileData.psychology.mbti, 'INTJ')
  })
})

// =====================================================
// 验收标准 ⑨: Cerebellum start() 失败后 health() 状态回滚
// =====================================================

describe('IT-09 Cerebellum 失败语义', () => {
  it('未启动时 health().ok === false (不伪装运行)', async () => {
    const cerebellum = new Cerebellum({
      engine: { host: 'http://127.0.0.1', port: 39999, workspace: '/tmp' },
      daemon: { heartbeatIntervalMs: 5000, maxFailures: 3, sessionGCIntervalMs: 999_999 },
    })

    const h = await cerebellum.health()
    assert.equal(h.ok, false, '未启动时 ok 应为 false')
    assert.equal(h.detail.cerebellum, 'stopped')

    await cerebellum.stop()
  })

  it('start() 失败 → 状态回滚 + lastFailureReason 有值 (真实失败场景)', async () => {
    // mock server 占用端口但始终返回 503
    // → attach 失败 (health check 503)
    // → spawn opencode → 端口被占或健康检查始终 503
    // → 超时 (1s) → 抛错 → 回滚
    const { server, port } = await createMockOpenCodeServer((req, res) => {
      // 所有健康检查端点都返回 503
      if (req.url === '/global/health' || req.url === '/provider') {
        res.writeHead(503)
        return res.end()
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum({
      engine: { host: 'http://127.0.0.1', port, workspace: '/tmp' },
      daemon: {
        heartbeatIntervalMs: 5000,
        maxFailures: 3,
        sessionGCIntervalMs: 999_999,
        spawnTimeoutMs: 1000,  // 1s 快速超时
      },
    })

    try {
      await cerebellum.start()
      assert.fail('应抛出启动超时')
    } catch (err) {
      assert.ok(err.message.includes('启动超时'), `错误信息应含"启动超时": ${err.message}`)
    }

    // 关键验证: 启动失败后状态已回滚
    const h = await cerebellum.health()
    assert.equal(h.ok, false, '启动失败后 ok 应为 false')
    assert.equal(h.detail.cerebellum, 'stopped', '状态应回滚为 stopped')
    assert.ok(h.detail.lastFailureReason !== null, '应记录失败原因')
    assert.ok(h.detail.lastFailureReason.includes('start failed'), `lastFailureReason: ${h.detail.lastFailureReason}`)

    await cerebellum.stop()
    await closeServer(server)
  })
})

// =====================================================
// 验收标准 ⑩: Cerebellum session GC 真实性
// =====================================================

describe('IT-10 Cerebellum GC 真实性 (通过可测试入口)', () => {
  it('过期 session 被清理 + DELETE 500 不计数 + 新 session 保留', async () => {
    const deletedIds = []
    const { server, port } = await createMockOpenCodeServer((req, res) => {
      if (req.url === '/global/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ healthy: true }))
      }
      if (req.url === '/session' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify([
          { id: 'expired-ok', createdAt: new Date(Date.now() - 25 * 3600_000).toISOString() },
          { id: 'expired-500', createdAt: new Date(Date.now() - 48 * 3600_000).toISOString() },
          { id: 'fresh', createdAt: new Date().toISOString() },
        ]))
      }
      if (req.method === 'DELETE' && req.url.startsWith('/session/')) {
        const id = req.url.split('/').pop()
        if (id === 'expired-500') {
          res.writeHead(500)
          return res.end('Internal Server Error')
        }
        deletedIds.push(id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ ok: true }))
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum({
      engine: { host: 'http://127.0.0.1', port, workspace: '/tmp' },
      daemon: { heartbeatIntervalMs: 5000, maxFailures: 3, sessionGCIntervalMs: 999_999 },
    })
    await cerebellum.start()

    await cerebellum.runSessionGC()

    const h = await cerebellum.health()
    assert.ok(h.detail.lastGCResult !== null, '应有 GC 结果')
    assert.equal(h.detail.lastGCResult.ok, true)
    assert.equal(h.detail.lastGCResult.cleaned, 1, '只有 expired-ok 成功清理')
    assert.equal(h.detail.lastGCResult.total, 3, '共 3 个 session')
    assert.deepEqual(deletedIds, ['expired-ok'])

    await cerebellum.stop()
    await closeServer(server)
  })
})

// =====================================================
// 验收标准 ⑪: Cerebellum.health() 诊断数据可读取
// =====================================================

describe('IT-11 诊断闭环 — Cerebellum health 通过 Web /api/health 聚合读取', () => {
  it('Web /api/health 响应包含 cerebellum 诊断数据', async () => {
    const fixture = createTestFixture()

    const { server: ocServer, port: ocPort } = await createMockOpenCodeServer((req, res) => {
      if (req.url === '/global/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ healthy: true }))
      }
      if (req.url === '/session' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify([]))
      }
      res.writeHead(404).end()
    })

    const identity = new Identity(fixture.config)
    const memory = new Memory(fixture.config)
    const engine = createMockEngine(true)
    const cerebellum = new Cerebellum({
      engine: { host: 'http://127.0.0.1', port: ocPort, workspace: '/tmp' },
      daemon: { heartbeatIntervalMs: 5000, maxFailures: 3, sessionGCIntervalMs: 999_999 },
    })

    await identity.start()
    await memory.start()
    await cerebellum.start()
    await cerebellum.runSessionGC()

    // 注入 cerebellum 到 Web 模块依赖
    const web = new WebServer(fixture.config, {
      identity, memory, engine, orchestrator: null, cerebellum,
    })
    await web.start()

    // 通过 HTTP 请求验证“系统级读取”
    const { status, json } = await webFetch(fixture.webPort, '/api/health')
    assert.equal(status, 200)
    assert.equal(json.ok, true, '所有模块都健康')

    // 关键验证: cerebellum 诊断数据在 Web 响应中
    assert.ok(json.data.cerebellum, '/api/health 应包含 cerebellum 字段')
    assert.equal(json.data.cerebellum.ok, true)
    assert.equal(json.data.cerebellum.detail.cortex, 'healthy')
    assert.equal(json.data.cerebellum.detail.cerebellum, 'running')
    assert.ok('heartbeatHistory' in json.data.cerebellum.detail)
    assert.ok('lastRestartTime' in json.data.cerebellum.detail)
    assert.ok('lastFailureReason' in json.data.cerebellum.detail)
    assert.ok(json.data.cerebellum.detail.lastGCResult !== null, '应有 GC 结果')

    // 其他模块也正常
    assert.ok(json.data.identity.ok)
    assert.ok(json.data.memory.ok)
    assert.ok(json.data.engine.ok)

    await web.stop()
    await cerebellum.stop()
    await memory.stop()
    await identity.stop()
    await closeServer(ocServer)
    fixture.cleanup()
  })
})
