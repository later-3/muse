import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

import { Identity } from './core/identity.mjs'
import { Memory } from './core/memory.mjs'
import { Orchestrator } from './core/orchestrator.mjs'
import { splitMessage } from './adapters/telegram.mjs'

// =====================================================
// 系统级集成测试
//
// T13 瘦身后:
//   - Orchestrator 只做消息转发 + session 管理
//   - 不再手动注入记忆、人格、意图分类
//   - 记忆由 AI 自主调 MCP (T11)
//   - 人格由 AGENTS.md 原生注入 (T12)
// =====================================================

// --- Test Fixtures ---

function createTestConfig() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-sys-test-'))
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

  return {
    config: {
      telegram: { botToken: 'test-token', allowedUsers: ['100', '200'] },
      engine: {
        host: 'http://127.0.0.1',
        port: 4096,
        workspace: tmpDir,
        defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
        heavyModel: { providerID: 'anthropic', modelID: 'claude-sonnet-4' },
      },
      memory: { dbPath, maxEpisodicDays: 90 },
      identity: { path: identityPath },
      web: { port: 4097, host: '127.0.0.1' },
      daemon: { heartbeatIntervalMs: 30000, maxFailures: 3 },
    },
    tmpDir,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    },
  }
}

function createMockEngine() {
  let running = false
  let sessionCounter = 0
  let lastSentText = ''
  return {
    start: async () => { running = true },
    stop: async () => { running = false },
    health: async () => ({ ok: running, detail: 'mock-engine' }),
    createSession: async () => ({ id: `test-session-${++sessionCounter}` }),
    sendAndWait: async (sid, text, opts) => {
      lastSentText = text
      return {
        text: `[mock reply to: ${text.slice(-30)}...]`,
        sessionId: sid,
      }
    },
    get _lastSentText() { return lastSentText },
  }
}

// =====================================================
// Tests
// =====================================================

describe('系统级 — T13 瘦身后模块验证', () => {
  let fixture

  beforeEach(() => {
    fixture = createTestConfig()
  })

  afterEach(() => {
    fixture.cleanup()
  })

  it('T01 Config → T02 Identity: 正确加载身份文件', async () => {
    const identity = new Identity(fixture.config)
    await identity.start()

    assert.equal(identity.data.identity.name, '小缪')
    assert.ok(identity.buildSystemPrompt().length > 0)

    const h = await identity.health()
    assert.equal(h.ok, true)

    await identity.stop()
  })

  it('T01 Config → T04 Memory: 正确创建数据库', async () => {
    const memory = new Memory(fixture.config)
    await memory.start()

    memory.setMemory('test_key', 'test_value', 'test', 'auto')
    const result = memory.getMemory('test_key')
    assert.equal(result.value, 'test_value')

    const h = await memory.health()
    assert.equal(h.ok, true)
    assert.ok(h.detail.semanticCount >= 1)

    await memory.stop()
  })

  it('T13 Orchestrator: 直接转发用户原文，不注入额外内容', async () => {
    const identity = new Identity(fixture.config)
    const engine = createMockEngine()

    await identity.start()
    await engine.start()

    const orchestrator = new Orchestrator({
      config: fixture.config,
      identity,
      engine,
    })

    const result = await orchestrator.handleMessage('你好世界', { source: 'test' })

    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length > 0)
    assert.ok(result.sessionId.startsWith('test-session-'))
    // T13: engine 收到原始 text，不是 enriched prompt
    assert.equal(engine._lastSentText, '你好世界')
    // T13: 不再返回 intent/model
    assert.equal(result.intent, undefined)
    assert.equal(result.model, undefined)

    await identity.stop()
  })

  it('T13 Orchestrator: 构造器不再需要 memory', async () => {
    const identity = new Identity(fixture.config)
    const engine = createMockEngine()

    await identity.start()
    await engine.start()

    // 不传 memory — T13 后不再需要
    const orchestrator = new Orchestrator({
      config: fixture.config,
      identity,
      engine,
    })

    const result = await orchestrator.handleMessage('测试', { source: 'test' })
    assert.ok(result.text)

    await identity.stop()
  })

  it('T13 health: 只聚合 identity + engine', async () => {
    const identity = new Identity(fixture.config)
    const engine = createMockEngine()

    await identity.start()
    await engine.start()

    const orchestrator = new Orchestrator({
      config: fixture.config,
      identity,
      engine,
    })

    const h = await orchestrator.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail.identity.ok, true)
    assert.equal(h.detail.engine.ok, true)
    assert.equal(h.detail.memory, undefined, 'T13: memory 不再由 Orchestrator 聚合')

    // Engine 不健康 → 整体不健康
    await engine.stop()
    const h2 = await orchestrator.health()
    assert.equal(h2.ok, false)

    await identity.stop()
  })
})

describe('系统级 — 启动/关闭顺序', () => {
  let fixture

  beforeEach(() => {
    fixture = createTestConfig()
  })

  afterEach(() => {
    fixture.cleanup()
  })

  it('Identity + Memory 启动/停止互不影响', async () => {
    const identity = new Identity(fixture.config)
    const memory = new Memory(fixture.config)

    await identity.start()
    await memory.start()

    const ih = await identity.health()
    const mh = await memory.health()
    assert.equal(ih.ok, true)
    assert.equal(mh.ok, true)

    await memory.stop()
    const ih2 = await identity.health()
    assert.equal(ih2.ok, true)

    await identity.stop()
  })

  it('Memory 幂等 start()', async () => {
    const memory = new Memory(fixture.config)
    await memory.start()
    await memory.start()

    memory.setMemory('k', 'v', 'test', 'auto')
    assert.equal(memory.getMemory('k').value, 'v')

    await memory.stop()
  })
})

describe('系统级 — 跨模块工具函数', () => {
  it('splitMessage 处理中文内容', () => {
    const longChinese = '这是一段很长的中文内容。'.repeat(500)
    const chunks = splitMessage(longChinese, 4096)
    assert.ok(chunks.length >= 2)
    for (const c of chunks) assert.ok(c.length <= 4096)
  })
})
