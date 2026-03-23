import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { Orchestrator } from './orchestrator.mjs'
import { ExecutionLog } from '../capability/router.mjs'

// --- Mock Factories ---

function createMockIdentity(opts = {}) {
  return {
    health: async () => ({ ok: !opts.unhealthy, detail: '小缪' }),
  }
}

function createMockEngine(reply = '你好！', opts = {}) {
  let sessionCounter = 0
  const sessionsCreated = []
  let lastSentText = ''
  return {
    createSession: async () => {
      const s = { id: `mock-session-${++sessionCounter}` }
      sessionsCreated.push(s)
      return s
    },
    sendAndWait: opts.throwOnSend
      ? async () => { throw new Error(opts.throwOnSend) }
      : async (sid, text, options) => {
          lastSentText = text
          return {
            text: reply,
            sessionId: sid,
            messages: opts.messages || [
              { parts: [
                { type: 'tool', tool: 'bash', callID: 'c1', state: {} },
                { type: 'text', text: reply },
              ] },
            ],
          }
        },
    health: async () => ({ ok: !opts.unhealthy, detail: 'mock' }),
    _sessionsCreated: sessionsCreated,
    get _lastSentText() { return lastSentText },
  }
}

function createOrchestrator(overrides = {}) {
  const config = overrides.config || {}
  const identity = overrides.identity || createMockIdentity()
  const engine = overrides.engine || createMockEngine()
  return new Orchestrator({ config, identity, engine })
}

// --- T13: 瘦身后的 Orchestrator 测试 ---

describe('T13 Orchestrator — handleMessage 薄转发', () => {
  it('基本流程: 返回回复 + sessionId', async () => {
    const orch = createOrchestrator()
    const result = await orch.handleMessage('你好')

    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length > 0)
    assert.ok(result.sessionId.startsWith('mock-session-'))
  })

  it('不再返回 model 和 intent', async () => {
    const orch = createOrchestrator()
    const result = await orch.handleMessage('你好')

    assert.equal(result.model, undefined, 'T13 不再有 model')
    assert.equal(result.intent, undefined, 'T13 不再有 intent')
  })

  it('直接传用户原文给 engine，不注入任何额外内容', async () => {
    const engine = createMockEngine()
    const orch = createOrchestrator({ engine })
    await orch.handleMessage('你好世界')

    // engine 收到的应该是原始 text，不是 enriched prompt
    assert.equal(engine._lastSentText, '你好世界', 'engine 应收到原始 text')
  })

  it('使用指定 sessionId → 不创建新 session', async () => {
    const engine = createMockEngine()
    const orch = createOrchestrator({ engine })
    const result = await orch.handleMessage('你好', { sessionId: 'existing-123' })

    assert.equal(result.sessionId, 'existing-123')
    assert.equal(engine._sessionsCreated.length, 0)
  })

  it('不传 sessionId → 自动创建新 session', async () => {
    const engine = createMockEngine()
    const orch = createOrchestrator({ engine })
    const result = await orch.handleMessage('你好')

    assert.ok(result.sessionId.startsWith('mock-session-'))
    assert.equal(engine._sessionsCreated.length, 1)
  })

  it('空文本应抛错', async () => {
    const orch = createOrchestrator()
    await assert.rejects(() => orch.handleMessage(''), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage('   '), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage(null), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage(123), /text 不能为空/)
  })
})

describe('T13 Orchestrator — session 重试', () => {
  it('session 失效 → 新建 session 重试', async () => {
    let callCount = 0
    const engine = createMockEngine()
    engine.sendAndWait = async (sid, text) => {
      callCount++
      if (callCount === 1) throw new Error('404 session not found')
      return { text: '重试成功', sessionId: sid }
    }

    const orch = createOrchestrator({ engine })
    const result = await orch.handleMessage('你好', { sessionId: 'stale-session' })

    assert.equal(result.text, '重试成功')
    assert.ok(result.sessionId.startsWith('mock-session-'), '应使用新 session')
    assert.equal(engine._sessionsCreated.length, 1)
  })

  it('非 session 错误 → 直接抛出', async () => {
    const engine = createMockEngine('', { throwOnSend: 'Network timeout' })
    const orch = createOrchestrator({ engine })

    await assert.rejects(
      () => orch.handleMessage('你好'),
      /Network timeout/,
    )
  })
})

describe('T13 Orchestrator — health', () => {
  it('identity + engine 都 ok → ok:true', async () => {
    const orch = createOrchestrator()
    const h = await orch.health()

    assert.equal(h.ok, true)
    assert.equal(h.detail.identity.ok, true)
    assert.equal(h.detail.engine.ok, true)
  })

  it('不再聚合 memory health', async () => {
    const orch = createOrchestrator()
    const h = await orch.health()

    assert.equal(h.detail.memory, undefined, 'memory 不再由 Orchestrator 聚合')
  })

  it('engine 不健康 → ok:false', async () => {
    const engine = createMockEngine('', { unhealthy: true })
    const orch = createOrchestrator({ engine })
    const h = await orch.health()

    assert.equal(h.ok, false)
    assert.equal(h.detail.engine.ok, false)
  })
})

describe('T13 Orchestrator — 已删除的 Phase 1 功能', () => {
  it('不再导出 classifyIntent', async () => {
    const mod = await import('./orchestrator.mjs')
    assert.equal(mod.classifyIntent, undefined, 'classifyIntent 应被删除')
  })

  it('不再导出 extractKeywords', async () => {
    const mod = await import('./orchestrator.mjs')
    assert.equal(mod.extractKeywords, undefined, 'extractKeywords 应被删除')
  })

  it('不再导出 DEFAULT_PERSONA', async () => {
    const mod = await import('./orchestrator.mjs')
    assert.equal(mod.DEFAULT_PERSONA, undefined, 'DEFAULT_PERSONA 应被删除')
  })

  it('不再导出 PREFERENCE_PATTERNS', async () => {
    const mod = await import('./orchestrator.mjs')
    assert.equal(mod.PREFERENCE_PATTERNS, undefined, 'PREFERENCE_PATTERNS 应被删除')
  })

  it('构造器不接受 memory 参数', () => {
    // 不传 memory 也能正常构造
    const orch = new Orchestrator({
      config: {},
      identity: createMockIdentity(),
      engine: createMockEngine(),
    })
    assert.ok(orch, '不传 memory 应正常构造')
  })
})

// ═════════════════════════════════════════════════
// T17: 主链集成 — handleMessage → executionLog 有记录
// ═════════════════════════════════════════════════

describe('T17: Orchestrator → ExecutionLog 主链集成', () => {
  it('handleMessage 后 executionLog 自动产生记录', async () => {
    const executionLog = new ExecutionLog()
    const engine = createMockEngine('你好！')
    const orch = new Orchestrator({
      config: {},
      identity: createMockIdentity(),
      engine,
      executionLog,
    })

    await orch.handleMessage('测试消息')

    const entries = executionLog.list()
    assert.equal(entries.length, 1, 'handleMessage 后应产生 1 条执行记录')
    assert.deepEqual(entries[0].tools, ['bash'], '应从 messages 提取到 bash 工具')
    assert.ok(entries[0].routes.includes('builtin'), 'bash → builtin')
    assert.equal(entries[0].success, true)
  })

  it('多工具 messages → 正确提取和分类 (config 驱动)', async () => {
    const executionLog = new ExecutionLog()
    const engine = createMockEngine('完成', {
      messages: [
        { parts: [
          { type: 'tool', tool: 'bash', callID: 'c1' },
          { type: 'tool', tool: 'read', callID: 'c2' },
          { type: 'tool', tool: 'websearch_web_search_exa', callID: 'c3' },
        ] },
      ],
    })
    const orch = new Orchestrator({
      config: {},
      identity: createMockIdentity(),
      engine,
      executionLog,
      mcpServerNames: ['websearch', 'memory-server'],
    })

    await orch.handleMessage('搜索点东西')

    const entries = executionLog.list()
    assert.equal(entries.length, 1)
    assert.ok(entries[0].tools.includes('bash'))
    assert.ok(entries[0].tools.includes('read'))
    assert.ok(entries[0].tools.includes('websearch_web_search_exa'))
    assert.ok(entries[0].routes.includes('builtin'))
    assert.ok(entries[0].routes.includes('mcp'), 'websearch_ 前缀 → mcp')
  })

  it('无工具调用 → routes 为空 (LLM 直接推理)', async () => {
    const executionLog = new ExecutionLog()
    const engine = createMockEngine('闲聊回复', {
      messages: [
        { parts: [{ type: 'text', text: '闲聊回复' }] },
      ],
    })
    const orch = new Orchestrator({
      config: {},
      identity: createMockIdentity(),
      engine,
      executionLog,
    })

    await orch.handleMessage('你好')

    const entries = executionLog.list()
    assert.equal(entries.length, 1)
    assert.deepEqual(entries[0].tools, [], '纯文字回复无工具')
    assert.deepEqual(entries[0].routes, [], '无工具 → routes 为空')
  })

  it('不传 executionLog → 不崩溃', async () => {
    const orch = new Orchestrator({
      config: {},
      identity: createMockIdentity(),
      engine: createMockEngine(),
    })
    const result = await orch.handleMessage('你好')
    assert.ok(result.text, '不传 executionLog 也能正常运行')
  })
})
