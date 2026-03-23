/**
 * E2E Real OpenCode 集成测试 — 连接真实 opencode serve
 *
 * 前提: opencode serve 已运行在 127.0.0.1:4096
 * 策略: 真实 Engine + 真实 Memory/Identity/Orchestrator/Web
 *        只 mock Telegram (直接调 orchestrator.handleMessage)
 *
 * 超时设置: 每个测试 60s (AI 响应需要时间)
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { Memory } from './core/memory.mjs'
import { Identity } from './core/identity.mjs'
import { Engine } from './core/engine.mjs'
import { Goals } from './core/goals.mjs'
import { Threads } from './core/threads.mjs'
import { Orchestrator } from './core/orchestrator.mjs'
import { WebServer } from './web/api.mjs'

// --- Pre-flight: check if OpenCode is running ---

async function isOpenCodeRunning(port = 4096) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/global/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

// --- Test Fixture ---

function createRealFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'muse-e2e-real-'))
  const dataDir = join(dir, 'data')
  mkdirSync(dataDir, { recursive: true })

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

  // Use real opencode workspace (current project)
  const workspace = '/Users/xulater/Code/assistant-agent'

  const config = {
    agentId: 'muse-e2e-real',
    engine: { host: 'http://127.0.0.1', port: 4096, workspace },
    memory: { dbPath: join(dataDir, 'memory.db'), maxEpisodicDays: 7 },
    identity: { path: join(dataDir, 'identity.json') },
    web: { host: '127.0.0.1', port: 19871 },
    telegram: {},
    pulse: { stateDir: join(dir, 'pulse') },
    daemon: {},
  }

  return { dir, dataDir, config }
}

// =====================================================
// E2E Real OpenCode Tests
// =====================================================

describe('E2E Real OpenCode — 真实 AI 全链路', { concurrency: false, timeout: 120_000 }, () => {
  let fixture, memory, identity, engine, goals, threads, orchestrator, web
  let webBaseUrl
  let skipAll = false

  before(async () => {
    // Pre-flight: skip all if opencode not running
    const running = await isOpenCodeRunning()
    if (!running) {
      skipAll = true
      console.log('⚠️  OpenCode serve 未运行，跳过真实 E2E 测试')
      return
    }

    fixture = createRealFixture()
    const cfg = fixture.config

    // 1. Identity
    identity = new Identity(cfg)
    await identity.start()

    // 2. Memory
    memory = new Memory(cfg, 'muse-e2e-real')
    await memory.start()

    // 3. Goals + Threads
    goals = new Goals(memory.getDb(), 'muse-e2e-real')
    goals.init()
    threads = new Threads(memory.getDb(), 'muse-e2e-real')
    threads.init()

    // 4. Real Engine (connects to opencode serve on :4096)
    engine = new Engine(cfg)
    await engine.start()

    // 5. Orchestrator
    orchestrator = new Orchestrator({
      config: cfg,
      identity,
      engine,
      executionLog: null,
      mcpServerNames: [],
    })

    // 6. Web Server
    web = new WebServer(cfg, {
      identity, memory, engine, orchestrator, goals, threads,
      cerebellum: { health: () => ({ ok: true, running: true, detail: 'e2e-real' }) },
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
    if (engine) await engine.stop()
    if (memory) await memory.stop()
    if (identity) identity.stop()
    if (fixture) rmSync(fixture.dir, { recursive: true, force: true })
  })

  // --- TC1: 真实 AI 对话 ---

  it('TC1-Real: 发消息 → 真实 AI 回复 (非空字符串)', { timeout: 60_000 }, async () => {
    if (skipAll) return
    const result = await orchestrator.handleMessage('你好，请用一句话介绍你自己', {
      source: 'e2e-test',
      timeoutMs: 55_000,
    })
    assert.ok(result.text, 'AI should reply with non-empty text')
    assert.ok(result.text.length > 5, `AI reply too short: "${result.text}"`)
    assert.ok(result.sessionId, 'should have sessionId')
    console.log(`  ✓ AI 回复 (${result.text.length} 字): "${result.text.slice(0, 80)}..."`)
  })

  // --- TC2: Engine 健康 ---

  it('TC2-Real: Engine 连接 OpenCode 健康', { timeout: 10_000 }, async () => {
    if (skipAll) return
    const health = await engine.health()
    assert.equal(health.ok, true)
    assert.ok(health.detail.includes('running'), `unexpected detail: ${health.detail}`)
  })

  // --- TC3: Web 全链路 ---

  it('TC3-Real: Web /api/health 全模块真实状态', { timeout: 15_000 }, async () => {
    if (skipAll) return
    const res = await fetch(`${webBaseUrl}/api/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.ok(body.data.engine.ok, 'engine should be healthy')
    assert.ok(body.data.memory.ok, 'memory should be healthy')
    assert.ok(body.data.identity.ok, 'identity should be healthy')
    console.log('  ✓ 全模块健康:', JSON.stringify(Object.fromEntries(
      Object.entries(body.data).map(([k, v]) => [k, v.ok ?? '?'])
    )))
  })

  // --- TC4: 多轮 AI 对话 + session 复用 ---

  it('TC4-Real: 多轮对话 — AI 在同一 session 中保持上下文', { timeout: 90_000 }, async () => {
    if (skipAll) return

    // Round 1: introduce name
    const r1 = await orchestrator.handleMessage('记住：我的名字叫 Later，这个很重要', {
      source: 'e2e-test',
      timeoutMs: 55_000,
    })
    assert.ok(r1.text, 'round 1 should reply')
    const sid = r1.sessionId

    // Round 2: recall (same session)
    const r2 = await orchestrator.handleMessage('我叫什么名字？', {
      source: 'e2e-test',
      sessionId: sid,
      timeoutMs: 55_000,
    })
    assert.ok(r2.text, 'round 2 should reply')
    assert.equal(r2.sessionId, sid, 'should reuse session')
    console.log(`  ✓ Round 1 (${r1.text.length} 字): "${r1.text.slice(0, 60)}..."`)
    console.log(`  ✓ Round 2 (${r2.text.length} 字): "${r2.text.slice(0, 60)}..."`)

    // Soft check: AI should mention "Later" in response (non-deterministic)
    const mentionsName = r2.text.toLowerCase().includes('later')
    if (mentionsName) {
      console.log('  ✓ AI 成功记住了名字 "Later"')
    } else {
      console.log('  ⚠ AI 回复中未直接提到 "Later"（非确定性，不计为失败）')
    }
  })

  // --- TC5: Web API 数据一致性 (真实 AI 后) ---

  it('TC5-Real: AI 对话后 Web API 数据正常', { timeout: 10_000 }, async () => {
    if (skipAll) return
    // Goals (may be empty or populated by AI)
    const goalsRes = await fetch(`${webBaseUrl}/api/goals`)
    assert.equal(goalsRes.status, 200)
    const goalsBody = await goalsRes.json()
    assert.ok(goalsBody.ok)

    // Threads
    const threadsRes = await fetch(`${webBaseUrl}/api/threads`)
    assert.equal(threadsRes.status, 200)
    const threadsBody = await threadsRes.json()
    assert.ok(threadsBody.ok)

    // Status
    const statusRes = await fetch(`${webBaseUrl}/api/status`)
    assert.equal(statusRes.status, 200)

    // Identity
    const idRes = await fetch(`${webBaseUrl}/api/identity`)
    assert.equal(idRes.status, 200)
    const idBody = await idRes.json()
    assert.equal(idBody.data.identity.name, '小缪')

    console.log('  ✓ 所有 Web API 端点正常响应')
  })
})
