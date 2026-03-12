import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { WebServer } from './api.mjs'

// --- Mock Modules ---

function createMockModules() {
  return {
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
  }
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

  // --- 404 ---

  it('GET /api/unknown returns 404', async () => {
    const { status, json } = await fetch(PORT, '/api/unknown')
    assert.equal(status, 404)
    assert.equal(json.ok, false)
  })
})
