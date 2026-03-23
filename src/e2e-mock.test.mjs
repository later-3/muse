/**
 * E2E Mock 集成测试 — Phase 1~3 全链路验证
 *
 * 策略: Mock Telegram + Engine (不需要真 OpenCode)，
 *        真实 Memory / Identity / Goals / Threads / Web / Orchestrator
 *
 * 消息链路:
 *   orchestrator.handleMessage(text) → Engine.sendAndWait (mock)
 *   → Memory/Goals/Threads 真实 SQLite → Web API 真实 HTTP
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { Memory } from './core/memory.mjs'
import { Identity } from './core/identity.mjs'
import { Goals } from './core/goals.mjs'
import { Threads } from './core/threads.mjs'
import { Orchestrator } from './core/orchestrator.mjs'
import { WebServer } from './web/api.mjs'

// --- Mock Engine ---

function createMockEngine(opts = {}) {
  let sessionCounter = 0
  const sessions = new Map()

  return {
    _calls: [],       // track all sendAndWait calls
    _toolCalls: [],   // mock tool calls to inject in response

    async health() {
      return { ok: true, detail: { sessions: sessions.size, provider: 'mock' } }
    },

    async createSession() {
      const id = `mock-session-${++sessionCounter}`
      sessions.set(id, { id, created_at: new Date().toISOString() })
      return { id }
    },

    async listSessions() {
      return [...sessions.values()]
    },

    async sendAndWait(sessionId, text, _opts = {}) {
      this._calls.push({ sessionId, text, ts: Date.now() })

      // Custom handler for specific messages
      if (opts.onMessage) {
        const custom = await opts.onMessage(sessionId, text)
        if (custom) return custom
      }

      // Default: echo back with mock AI response
      return {
        text: `[mock-reply] 收到: ${text.slice(0, 50)}`,
        sessionId,
        messages: this._toolCalls,
      }
    },
  }
}

// --- Test Fixture ---

function createE2EFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'muse-e2e-'))
  const dataDir = join(dir, 'data')
  mkdirSync(dataDir, { recursive: true })

  // Identity data (nested structure: identity.{name/owner/...} + boundaries.{never_do/...})
  const identityData = {
    identity: {
      name: '小缪',
      nickname: '缪缪',
      owner: 'Later',
      mbti: 'ENFP',
      bio: 'Later 的 AI 搭档',
    },
    boundaries: {
      never_do: ['假装是人类'],
      always_do: ['诚实回答'],
    },
  }
  writeFileSync(join(dataDir, 'identity.json'), JSON.stringify(identityData, null, 2))

  const config = {
    agentId: 'muse-test',
    engine: { host: 'http://127.0.0.1', port: 19999, workspace: dir },
    memory: { dbPath: join(dataDir, 'memory.db'), maxEpisodicDays: 7 },
    identity: { path: join(dataDir, 'identity.json') },
    web: { host: '127.0.0.1', port: 19870 },
    telegram: {},
    pulse: { stateDir: join(dir, 'pulse') },
    daemon: {},
  }

  return { dir, dataDir, config }
}

// =====================================================
// E2E Mock Tests — Phase 1~3 全链路
// =====================================================

describe('E2E Mock — Phase 1~3 全链路验证', { concurrency: false }, () => {
  let fixture, memory, identity, goals, threads, engine, orchestrator, web
  let webBaseUrl

  before(async () => {
    fixture = createE2EFixture()
    const cfg = fixture.config

    // 1. Identity (真实)
    identity = new Identity(cfg)
    await identity.start()

    // 2. Memory (真实 SQLite)
    memory = new Memory(cfg, 'muse-test')
    await memory.start()

    // 3. Goals + Threads (真实，共享 Memory DB)
    goals = new Goals(memory.getDb(), 'muse-test')
    goals.init()
    threads = new Threads(memory.getDb(), 'muse-test')
    threads.init()

    // 4. Mock Engine
    engine = createMockEngine({
      onMessage: async (sessionId, text) => {
        // Simulate specific AI behaviors for test scenarios
        if (text.includes('我叫 Later')) {
          // AI would normally call set_memory via MCP
          memory.setMemory('user_name', 'Later', {
            category: 'identity',
            source: 'user_stated',
            confidence: 'high',
          })
          return {
            text: '嘿 Later！很高兴认识你～ 我记住了你的名字 😊',
            sessionId,
            messages: [],
          }
        }

        if (text.includes('我想学 Rust')) {
          // AI would normally call create_goal via MCP
          goals.create({ title: '学 Rust', category: 'learning' })
          return {
            text: '好目标！学 Rust 能让你写更安全的底层代码 🦀 我帮你记下来了！',
            sessionId,
            messages: [],
          }
        }

        if (text.includes('你还记得我叫什么')) {
          // AI would normally call get_user_profile or search_memory
          const memories = memory.listMemories()
          const name = memories.find(m => m.key === 'user_name')
          if (name) {
            return {
              text: `当然记得！你叫 ${name.value} 呀～`,
              sessionId,
              messages: [],
            }
          }
        }

        if (text.includes('跑步')) {
          // AI creates a thread about running
          threads.create({ title: '健康-跑步', category: 'health', summary: '用户关注跑步运动' })
          return {
            text: '跑步是个好习惯！我帮你开了一条"健康-跑步"的主题线 🏃',
            sessionId,
            messages: [],
          }
        }

        return null  // use default response
      },
    })

    // 5. Orchestrator (真实，用 mock engine)
    orchestrator = new Orchestrator({
      config: cfg,
      identity,
      engine,
      executionLog: null,
      mcpServerNames: [],
    })

    // 6. Web Server (真实 HTTP)
    web = new WebServer(cfg, {
      identity,
      memory,
      engine,
      orchestrator,
      goals,
      threads,
      cerebellum: { health: () => ({ ok: true, running: true, detail: 'mock' }) },
      registry: { listCapabilities: () => [] },
      gapJournal: { list: () => [] },
      executionLog: { getStats: () => ({ total: 0, routes: {} }) },
      selfCheck: async () => ({ ok: true, modules: {} }),
      healthHistory: { list: () => [], detectTrend: () => ({ degraded: false }) },
      healthInsight: { latest: () => null },
    })
    await web.start()
    webBaseUrl = `http://127.0.0.1:${cfg.web.port}`
  })

  after(async () => {
    if (web) await web.stop()
    if (memory) await memory.stop()
    if (identity) identity.stop()
    rmSync(fixture.dir, { recursive: true, force: true })
  })

  // --- TC1: 消息链路 ---

  it('TC1: 发消息 → Orchestrator → 收到 AI 回复', async () => {
    const result = await orchestrator.handleMessage('你好小缪', { source: 'test' })
    assert.ok(result.text.includes('收到'))
    assert.ok(result.sessionId.startsWith('mock-session-'))
    assert.equal(engine._calls.length, 1)
  })

  // --- TC2: 记忆写入 + 跨 session 记忆召回 ---

  it('TC2: AI 记住用户名 → 跨 session 召回', async () => {
    // First conversation: user introduces themselves
    const r1 = await orchestrator.handleMessage('我叫 Later', { source: 'test' })
    assert.ok(r1.text.includes('Later'))

    // Verify memory was written
    const memories = memory.listMemories()
    const name = memories.find(m => m.key === 'user_name')
    assert.ok(name, 'user_name should be in memory')
    assert.equal(name.value, 'Later')

    // Second conversation (new session): recall
    const r2 = await orchestrator.handleMessage('你还记得我叫什么', { source: 'test' })
    assert.ok(r2.text.includes('Later'), `reply should mention Later: ${r2.text}`)
    // Different session
    assert.notEqual(r1.sessionId, r2.sessionId)
  })

  // --- TC3: Goal 创建 + Web 可见 ---

  it('TC3: 对话中创建 Goal → Web /api/goals 可见', async () => {
    const r = await orchestrator.handleMessage('我想学 Rust', { source: 'test' })
    assert.ok(r.text.includes('Rust'))

    // Check via Web API — response shape: { ok, data: { goals: [...] } }
    const res = await fetch(`${webBaseUrl}/api/goals`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(body.data.goals.length >= 1)
    assert.ok(body.data.goals.some(g => g.title === '学 Rust'))
  })

  // --- TC4: Thread 创建 + Web 可见 ---

  it('TC4: 对话中创建 Thread → Web /api/threads 可见', async () => {
    const r = await orchestrator.handleMessage('我最近开始跑步了', { source: 'test' })
    assert.ok(r.text.includes('跑步'))

    // Check via Web API — response shape: { ok, data: { threads: [...] } }
    const res = await fetch(`${webBaseUrl}/api/threads`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(body.data.threads.length >= 1)
    assert.ok(body.data.threads.some(t => t.title === '健康-跑步'))
  })

  // --- TC5: Web /api/health 全模块状态 ---

  it('TC5: Web /api/health 返回所有模块健康状态', async () => {
    const res = await fetch(`${webBaseUrl}/api/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    // Response shape: { ok, data: { identity, memory, engine, web, cerebellum } }
    assert.ok(body.data, 'should have data')
    assert.ok(body.data.identity, 'should have identity health')
    assert.ok(body.data.engine, 'should have engine health')
  })

  // --- TC6: Web /api/status 总览 ---

  it('TC6: Web /api/status 返回系统总状态', async () => {
    const res = await fetch(`${webBaseUrl}/api/status`)
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.ok, true)
  })

  // --- TC7: Web /api/identity 读取 + PUT 热更新 ---

  it('TC7: Web /api/identity 读取 + PUT 热更新', async () => {
    // Read — response: { ok, data: { identity: { name, ... }, boundaries: {...} } }
    const r1 = await fetch(`${webBaseUrl}/api/identity`)
    assert.equal(r1.status, 200)
    const d1 = await r1.json()
    assert.equal(d1.data.identity.name, '小缪')
    assert.equal(d1.data.identity.owner, 'Later')

    // Update identity fields
    const r2 = await fetch(`${webBaseUrl}/api/identity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: { name: '缪缪', mbti: 'INTP' } }),
    })
    assert.equal(r2.status, 200)

    // Verify update persisted
    const r3 = await fetch(`${webBaseUrl}/api/identity`)
    const d3 = await r3.json()
    assert.equal(d3.data.identity.name, '缪缪')
    assert.equal(d3.data.identity.mbti, 'INTP')
  })

  // --- TC8: 多轮对话 session 复用 ---

  it('TC8: 同一 session 多轮对话', async () => {
    const r1 = await orchestrator.handleMessage('第一轮', { source: 'test' })
    const sid = r1.sessionId

    // Reuse session
    const r2 = await orchestrator.handleMessage('第二轮', {
      source: 'test',
      sessionId: sid,
    })
    assert.equal(r2.sessionId, sid, 'should reuse same session')
  })

  // --- TC9: Engine 故障 → 错误传播 ---

  it('TC9: Engine 故障时 Orchestrator 正确传播错误', async () => {
    // Temporarily make engine fail
    const origSendAndWait = engine.sendAndWait.bind(engine)
    engine.sendAndWait = async () => { throw new Error('OpenCode down') }

    await assert.rejects(
      () => orchestrator.handleMessage('should fail', { source: 'test' }),
      { message: 'OpenCode down' },
    )

    // Restore
    engine.sendAndWait = origSendAndWait
  })

  // --- TC10: Web /api/goals + /api/threads 数据一致性 ---

  it('TC10: Web API 数据与内存数据一致', async () => {
    // Goals — web shape: { ok, data: { goals: [...] } }
    const dbGoals = goals.list()
    const webGoals = await (await fetch(`${webBaseUrl}/api/goals`)).json()
    assert.equal(webGoals.data.goals.length, dbGoals.length)

    // Threads — web shape: { ok, data: { threads: [...] } }
    const dbThreads = threads.list()
    const webThreads = await (await fetch(`${webBaseUrl}/api/threads`)).json()
    assert.equal(webThreads.data.threads.length, dbThreads.length)
  })
})
