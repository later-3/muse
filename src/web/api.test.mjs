import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { WebServer } from './api.mjs'

// --- Mock Modules ---

function createMockModules() {
  const mocks = {
    identity: {
      data: {
        id: 'muse-test',
        identity: { name: '小缪', nickname: '缪缪', bio: 'AI 搭档', owner: 'Later' },
        psychology: { mbti: 'ENFP', traits: { humor: 0.8, warmth: 0.7, initiative: 0.6, precision: 0.7, verbosity: 0.5 } },
        linguistics: { style: '轻松', formality: 'casual-professional', catchphrases: ['嘿～'], language: 'zh-CN' },
        boundaries: { never_do: ['假装是人类'], always_do: ['坦诚'] },
      },
      health: async () => ({ ok: true, detail: { loaded: true } }),
      update: async (patch) => {
        Object.assign(createMockModules._lastIdentity, patch)
      },
      mergePersonaToAgentsMd: async () => ({ merged: true, path: '/tmp/AGENTS.md' }),
    },
    memory: {
      health: async () => ({ ok: true, detail: { totalSemantic: 5, totalEpisodic: 10 } }),
      listMemories: () => [
        { key: 'lang', value: 'prefers ESM', category: 'preference' },
      ],
      searchMemories: (q) => [
        { key: 'test', value: `match for ${q}`, category: 'test' },
      ],
      getRecentEpisodes: (days) => [
        { id: 1, role: 'user', content: 'hello', created_at: new Date().toISOString() },
      ],
      searchEpisodes: (q) => [
        { id: 2, role: 'assistant', content: `found ${q}` },
      ],
      getEpisodicStats: () => ({ totalEpisodes: 10, totalSessions: 3 }),
    },
    engine: {
      health: async () => ({ ok: true, detail: { connected: true } }),
      start: async () => {},
      stop: async () => {},
    },
    orchestrator: {
      handleMessage: async (text, ctx) => ({
        text: `Echo: ${text}`,
        model: 'test-model',
        sessionId: 'ses_test',
      }),
    },
    // T15: Capability Registry mock
    registry: {
      list: () => ({
        senses: [{ id: 'telegram_text', label: '文字', status: 'available' }],
        capabilities: [{ id: 'remember_user', label: '记忆', provider: 'mcp', status: 'available' }],
      }),
      senses: [{ id: 'telegram_text', label: '文字', status: 'available' }],
      capabilities: [{ id: 'remember_user', label: '记忆', provider: 'mcp', status: 'available' }],
    },
    // T16: Gap Journal mock
    gapJournal: {
      list: (filter) => [
        { id: 'gap-1', type: 'audio', source: 'telegram', reason: 'unsupported', timestamp: new Date().toISOString() },
      ],
      stats: () => ({ total: 1, byType: { audio: 1 }, bySource: { telegram: 1 } }),
    },
    // T17: ExecutionLog mock
    executionLog: {
      list: (filter) => [
        { id: 'exec-1', tools: ['bash'], routes: ['builtin'], success: true, timestamp: new Date().toISOString() },
      ],
      stats: () => ({ total: 1, byRoute: { builtin: 1 }, successRate: 100 }),
    },
    // Phase 2.5: Cerebellum mock
    cerebellum: {
      health: async () => ({ ok: true, detail: { consecutiveFailures: 0 } }),
    },
    // T32: Pulse mock
    pulse: {
      state: { dnd: false, frequency: 'normal', unresponsedCount: 1, lastProactiveAt: '2026-03-15T00:00:00Z', knownChatIds: ['123'] },
      health: () => ({ ok: true, detail: { running: true, triggerCount: 5 } }),
      pulseState: {
        set: (key, val) => { mocks.pulse.state[key] = val },
      },
    },
    // T34: HealthInsight mock
    healthInsight: {
      getLatest: () => ({ status: 'stable', reason: 'All systems nominal', suggestion: 'No action', timestamp: '2026-03-15T06:00:00Z', reportCount: 5 }),
    },
    // T35: Goals mock
    goals: {
      list: (opts) => [
        { id: 'goal-1', title: '学 Rust', status: 'active', progress: 40, category: 'learning', source: 'user', notes: [], deadline: '2026-06-01' },
      ],
      getActive: () => [{ id: 'goal-1', title: '学 Rust', status: 'active', progress: 40 }],
      getOverdue: () => [],
    },
    // T36: Threads mock
    threads: {
      list: (opts) => [
        { id: 'thread-1', title: '健康-跑步', category: 'health', episode_count: 3, summary: '用户在跑步' },
      ],
    },
  }
  return mocks
}

// --- Helpers ---

async function fetch(port, path, options = {}) {
  const { method = 'GET', body } = options
  const url = `http://127.0.0.1:${port}${path}`
  const res = await globalThis.fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

// --- Tests ---

describe('WebServer API', () => {
  const PORT = 19876  // 不和其他服务冲突
  const config = { web: { enabled: true, port: PORT, host: '127.0.0.1' } }
  let server
  let mocks

  before(async () => {
    mocks = createMockModules()
    server = new WebServer(config, mocks)
    await server.start()
  })

  after(async () => {
    await server.stop()
  })

  // --- Health ---

  it('GET /api/health returns combined health', async () => {
    const { status, json } = await fetch(PORT, '/api/health')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(json.data.identity)
    assert.ok(json.data.memory)
    assert.ok(json.data.engine)
    assert.ok(json.data.web)
  })

  // --- Status ---

  it('GET /api/status returns uptime and stats', async () => {
    const { status, json } = await fetch(PORT, '/api/status')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(typeof json.data.uptime === 'number')
  })

  // --- Identity ---

  it('GET /api/identity returns identity data with nested shape', async () => {
    const { status, json } = await fetch(PORT, '/api/identity')
    assert.equal(status, 200)
    // Must use NESTED path matching real Identity schema
    assert.equal(json.data.identity.name, '小缪')
    assert.equal(json.data.identity.nickname, '缪缪')
    assert.equal(json.data.psychology.mbti, 'ENFP')
    assert.equal(json.data.psychology.traits.humor, 0.8)
  })

  it('PUT /api/identity updates and returns data', async () => {
    createMockModules._lastIdentity = { ...mocks.identity.data }
    const { status, json } = await fetch(PORT, '/api/identity', {
      method: 'PUT',
      body: { nickname: '小小缪' },
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)
  })

  // --- Memory ---

  it('GET /api/memory/semantic lists all memories', async () => {
    const { status, json } = await fetch(PORT, '/api/memory/semantic')
    assert.equal(status, 200)
    assert.ok(Array.isArray(json.data))
    assert.ok(json.data.length > 0)
  })

  it('GET /api/memory/semantic?q=test searches memories', async () => {
    const { status, json } = await fetch(PORT, '/api/memory/semantic?q=test')
    assert.equal(status, 200)
    assert.ok(json.data[0].value.includes('test'))
  })

  it('GET /api/memory/episodic returns recent episodes', async () => {
    const { status, json } = await fetch(PORT, '/api/memory/episodic?days=3')
    assert.equal(status, 200)
    assert.ok(Array.isArray(json.data))
  })

  it('episodic has data even when semantic is empty (real-world scenario)', async () => {
    // This test covers the exact bug: semantic=0, episodic=N
    // Replace mock to simulate empty semantic
    const origList = mocks.memory.listMemories
    mocks.memory.listMemories = () => []

    const sem = await fetch(PORT, '/api/memory/semantic')
    assert.equal(sem.json.data.length, 0)

    const epi = await fetch(PORT, '/api/memory/episodic')
    assert.ok(epi.json.data.length > 0, 'episodic should have data when semantic is empty')

    // Restore
    mocks.memory.listMemories = origList
  })

  it('GET /api/status includes episodic stats with session count', async () => {
    const { json } = await fetch(PORT, '/api/status')
    assert.ok(json.data.memory, 'status should include memory stats')
    assert.equal(json.data.memory.totalSessions, 3)
  })

  it('GET /api/memory/episodic?q=hello searches episodes', async () => {
    const { status, json } = await fetch(PORT, '/api/memory/episodic?q=hello')
    assert.equal(status, 200)
    assert.ok(json.data[0].content.includes('hello'))
  })

  // --- Chat ---

  it('POST /api/chat sends message and returns reply', async () => {
    const { status, json } = await fetch(PORT, '/api/chat', {
      method: 'POST',
      body: { text: '你好' },
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(json.data.text.includes('Echo'))
    assert.ok(json.data.sessionId)
  })

  it('POST /api/chat rejects empty text', async () => {
    const { status, json } = await fetch(PORT, '/api/chat', {
      method: 'POST',
      body: { text: '' },
    })
    assert.equal(status, 400)
    assert.equal(json.ok, false)
  })

  it('GET /api/chat/history returns recent episodes', async () => {
    const { status, json } = await fetch(PORT, '/api/chat/history?n=5')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(Array.isArray(json.data))
  })

  // --- System ---

  it('POST /api/system/test tests engine connection', async () => {
    const { status, json } = await fetch(PORT, '/api/system/test', {
      method: 'POST',
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)
  })

  it('GET /api/system/logs returns log entries', async () => {
    const { status, json } = await fetch(PORT, '/api/system/logs?lines=10')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(Array.isArray(json.data))
    assert.ok(json.data.length > 0)
  })

  // --- SPA ---

  it('GET / returns HTML (or 500 if no file)', async () => {
    const res = await globalThis.fetch(`http://127.0.0.1:${PORT}/`)
    // May return 500 since index.html doesn't exist yet — that's OK
    assert.ok([200, 500].includes(res.status))
  })

  // --- Capabilities (T15) ---

  it('GET /api/capabilities returns senses and capabilities', async () => {
    const { status, json } = await fetch(PORT, '/api/capabilities')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(Array.isArray(json.data.senses))
    assert.ok(Array.isArray(json.data.capabilities))
    assert.ok(json.data.senses.length > 0)
  })

  // --- Gaps (T16) ---

  it('GET /api/gaps returns entries and stats', async () => {
    const { status, json } = await fetch(PORT, '/api/gaps')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(Array.isArray(json.data.entries))
    assert.ok(json.data.stats)
    assert.equal(json.data.stats.total, 1)
    assert.equal(json.data.entries[0].type, 'audio')
  })

  // --- Executions (T17) ---

  it('GET /api/executions returns entries and stats', async () => {
    const { status, json } = await fetch(PORT, '/api/executions')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.ok(Array.isArray(json.data.entries))
    assert.ok(json.data.stats)
    assert.equal(json.data.stats.total, 1)
    assert.equal(json.data.entries[0].routes[0], 'builtin')
  })

  // --- Self Check (Phase 2.5) ---

  it('GET /api/selfcheck returns three-layer health report', async () => {
    const { status, json } = await fetch(PORT, '/api/selfcheck')
    assert.equal(status, 200)
    assert.equal(json.ok, true)

    const report = json.data
    assert.ok(report.timestamp, 'should have timestamp')
    assert.ok(report.overall, 'should have overall status')

    // L1: System Health
    assert.ok(report.system, 'should have system layer')
    assert.ok(report.system.engine, 'should check engine')
    assert.ok(report.system.memory, 'should check memory')
    assert.ok(report.system.identity, 'should check identity')

    // L2: Self Model
    assert.ok(report.selfModel, 'should have selfModel layer')

    // L3: Life (placeholder)
    assert.ok(report.life, 'should have life layer')
    assert.equal(report.life.proactivity, null, 'life fields should be null (Phase 3)')
  })

  // --- 404 ---

  it('GET /api/unknown returns 404', async () => {
    const { status, json } = await fetch(PORT, '/api/unknown')
    assert.equal(status, 404)
    assert.equal(json.ok, false)
  })

  // --- T32: Pulse API ---

  it('GET /api/pulse/status returns pulse state', async () => {
    const { status, json } = await fetch(PORT, '/api/pulse/status')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.running, true)
    assert.equal(json.data.triggerCount, 5)
    assert.equal(json.data.dnd, false)
    assert.equal(json.data.frequency, 'normal')
    assert.equal(json.data.unresponsedCount, 1)
    assert.equal(json.data.knownChatIds, 1)
  })

  it('PUT /api/pulse/config updates dnd', async () => {
    const { status, json } = await fetch(PORT, '/api/pulse/config', {
      method: 'PUT',
      body: { dnd: true },
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.dnd, true)
    // Reset
    mocks.pulse.state.dnd = false
  })

  it('PUT /api/pulse/config rejects invalid frequency', async () => {
    const { status, json } = await fetch(PORT, '/api/pulse/config', {
      method: 'PUT',
      body: { frequency: 'invalid-value' },
    })
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    // frequency should remain unchanged
    assert.equal(json.data.frequency, 'normal')
  })

  // --- T34: Health Insight API ---

  it('GET /api/health/insight returns latest insight', async () => {
    const { status, json } = await fetch(PORT, '/api/health/insight')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.latest.status, 'stable')
    assert.equal(json.data.latest.reason, 'All systems nominal')
    assert.ok(json.data.latest.timestamp)
  })

  it('GET /api/health/insight returns null when no insights', async () => {
    // Temporarily override
    const orig = mocks.healthInsight.getLatest
    mocks.healthInsight.getLatest = () => null
    const { status, json } = await fetch(PORT, '/api/health/insight')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.latest, null)
    mocks.healthInsight.getLatest = orig
  })

  // --- T35: Goals API ---

  it('GET /api/goals returns goals list with counts', async () => {
    const { status, json } = await fetch(PORT, '/api/goals')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.goals.length, 1)
    assert.equal(json.data.goals[0].title, '学 Rust')
    assert.equal(json.data.counts.active, 1)
    assert.equal(json.data.counts.overdue, 0)
  })

  // --- T36: Threads API ---

  it('GET /api/threads returns threads list', async () => {
    const { status, json } = await fetch(PORT, '/api/threads')
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.equal(json.data.threads.length, 1)
    assert.equal(json.data.threads[0].title, '健康-跑步')
    assert.equal(json.data.count, 1)
  })
})
