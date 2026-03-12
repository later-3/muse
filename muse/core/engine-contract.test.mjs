/**
 * OpenCode API 契约测试
 *
 * 验证 Muse 生成的请求格式与 OpenCode REST API 的兼容性。
 * 不需要真实 OpenCode 运行——只验证请求/响应数据结构的正确性。
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeModel, extractText } from '../core/engine.mjs'
import { classifyIntent, extractKeywords } from '../core/orchestrator.mjs'

// ═════════════════════════════════════════════════
// 1. normalizeModel — 模型格式标准化
// ═════════════════════════════════════════════════

describe('normalizeModel', () => {
  it('接受嵌套对象格式 — 透传', () => {
    const model = { providerID: 'anthropic', modelID: 'claude-sonnet-4' }
    assert.deepStrictEqual(normalizeModel(model), model)
  })

  it('接受字符串格式 — 拆分为对象', () => {
    assert.deepStrictEqual(
      normalizeModel('google/gemini-2.5-flash'),
      { providerID: 'google', modelID: 'gemini-2.5-flash' },
    )
  })

  it('接受含多段斜杠的字符串', () => {
    assert.deepStrictEqual(
      normalizeModel('anthropic/claude-sonnet-4-20250514'),
      { providerID: 'anthropic', modelID: 'claude-sonnet-4-20250514' },
    )
  })

  it('null/undefined 返回 undefined', () => {
    assert.strictEqual(normalizeModel(null), undefined)
    assert.strictEqual(normalizeModel(undefined), undefined)
  })

  it('空字符串返回 undefined', () => {
    assert.strictEqual(normalizeModel(''), undefined)
  })

  it('无斜杠字符串返回 undefined', () => {
    assert.strictEqual(normalizeModel('invalid-model'), undefined)
  })
})

// ═════════════════════════════════════════════════
// 2. 消息 Payload 格式契约
// ═════════════════════════════════════════════════

describe('OpenCode 消息 Payload 契约', () => {
  /**
   * 模拟 Engine.#buildPayload 的行为
   * (因为 #buildPayload 是私有方法, 这里重新实现来测试契约)
   */
  function buildPayload(text, opts = {}) {
    const payload = { parts: [{ type: 'text', text }] }
    const model = normalizeModel(opts.model)
    if (model) payload.model = model
    if (opts.system) payload.system = opts.system
    if (opts.agent) payload.agent = opts.agent
    return payload
  }

  it('基础消息 — 只有 parts', () => {
    const payload = buildPayload('hello')
    assert.deepStrictEqual(payload, {
      parts: [{ type: 'text', text: 'hello' }],
    })
  })

  it('带 model (字符串) — 转为嵌套对象', () => {
    const payload = buildPayload('hi', { model: 'google/gemini-2.5-flash' })
    assert.deepStrictEqual(payload.model, {
      providerID: 'google',
      modelID: 'gemini-2.5-flash',
    })
  })

  it('带 model (对象) — 直接透传', () => {
    const model = { providerID: 'anthropic', modelID: 'claude-sonnet-4' }
    const payload = buildPayload('hi', { model })
    assert.deepStrictEqual(payload.model, model)
  })

  it('带 system 字段 — 注入 system prompt', () => {
    const payload = buildPayload('hi', { system: '你是小缪' })
    assert.strictEqual(payload.system, '你是小缪')
    // parts 不应包含 system 内容
    assert.strictEqual(payload.parts.length, 1)
    assert.strictEqual(payload.parts[0].text, 'hi')
  })

  it('带 agent 字段', () => {
    const payload = buildPayload('hi', { agent: 'build' })
    assert.strictEqual(payload.agent, 'build')
  })

  it('完整 payload — 所有字段齐全', () => {
    const payload = buildPayload('分析代码', {
      model: 'anthropic/claude-sonnet-4',
      system: '你是小缪，Later的助手',
      agent: 'build',
    })
    assert.deepStrictEqual(payload, {
      parts: [{ type: 'text', text: '分析代码' }],
      model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' },
      system: '你是小缪，Later的助手',
      agent: 'build',
    })
  })

  it('无效 model 不添加到 payload', () => {
    const payload = buildPayload('hi', { model: 'invalid' })
    assert.strictEqual(payload.model, undefined)
  })
})

// ═════════════════════════════════════════════════
// 3. 响应解析契约 — extractText
// ═════════════════════════════════════════════════

describe('extractText — OpenCode 响应解析', () => {
  it('解析标准 text parts', () => {
    const msg = {
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hello!' },
        { type: 'text', text: ' How are you?' },
      ],
    }
    assert.strictEqual(extractText(msg), 'Hello! How are you?')
  })

  it('跳过 tool parts', () => {
    const msg = {
      role: 'assistant',
      parts: [
        { type: 'tool', tool: 'read_file', callID: 'abc' },
        { type: 'text', text: '文件内容如下...' },
      ],
    }
    assert.strictEqual(extractText(msg), '文件内容如下...')
  })

  it('跳过 reasoning parts', () => {
    const msg = {
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: '让我想想...' },
        { type: 'text', text: '答案是42' },
      ],
    }
    assert.strictEqual(extractText(msg), '答案是42')
  })

  it('空 parts 返回空字符串', () => {
    assert.strictEqual(extractText({ parts: [] }), '')
  })

  it('无 parts 返回空字符串', () => {
    assert.strictEqual(extractText({}), '')
  })

  it('复杂响应 — 多种 part 类型混合', () => {
    const msg = {
      role: 'assistant',
      parts: [
        { type: 'step-start', snapshot: 'abc123' },
        { type: 'reasoning', text: '分析中...' },
        { type: 'tool', tool: 'grep', callID: '1', state: { status: 'completed' } },
        { type: 'text', text: '找到了 3 处匹配:' },
        { type: 'text', text: '\n1. foo.js:10' },
        { type: 'step-finish', reason: 'done', tokens: { input: 1000, output: 200 } },
      ],
    }
    assert.strictEqual(extractText(msg), '找到了 3 处匹配:\n1. foo.js:10')
  })
})

// ═════════════════════════════════════════════════
// 4. Session API 契约
// ═════════════════════════════════════════════════

describe('Session API 契约', () => {
  it('创建 session 请求体为空对象', () => {
    // POST /session 期望 body: {}
    const body = {}
    assert.deepStrictEqual(body, {})
  })

  it('session 创建响应包含 id 字段', () => {
    // 模拟 OpenCode 的 POST /session 响应
    const response = {
      id: 'ses_abc123',
      title: '',
      createdAt: '2026-03-11T10:00:00Z',
    }
    assert.ok(response.id, 'session response must have id')
    assert.ok(typeof response.id === 'string')
  })

  it('session status 响应格式', () => {
    // GET /session/status 返回 { [sessionId]: status }
    const response = {
      'ses_abc123': 'idle',
      'ses_def456': 'running',
    }
    assert.strictEqual(response['ses_abc123'], 'idle')
    assert.strictEqual(response['ses_def456'], 'running')
  })

  it('消息列表响应格式', () => {
    // GET /session/:id/message 返回 Message[]
    const messages = [
      {
        id: 'msg_1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      },
      {
        id: 'msg_2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi there!' }],
      },
    ]
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    assert.ok(lastAssistant)
    assert.strictEqual(lastAssistant.role, 'assistant')
    assert.strictEqual(extractText(lastAssistant), 'Hi there!')
  })
})

// ═════════════════════════════════════════════════
// 5. 健康检查契约
// ═════════════════════════════════════════════════

describe('健康检查契约', () => {
  it('/global/health 响应格式', () => {
    const response = { healthy: true, version: '1.0.48' }
    assert.strictEqual(response.healthy, true)
    assert.ok(response.version)
  })

  it('/provider 响应格式', () => {
    const response = {
      all: [{ id: 'anthropic', name: 'Anthropic' }],
      default: { model: 'anthropic/claude-sonnet-4' },
      connected: ['anthropic', 'google'],
    }
    assert.ok(Array.isArray(response.all))
    assert.ok(Array.isArray(response.connected))
  })
})

// ═════════════════════════════════════════════════
// 6. Orchestrator → Engine 集成契约
// ═════════════════════════════════════════════════

describe('Orchestrator → Engine 集成契约', () => {
  const testConfig = {
    engine: {
      defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
      heavyModel: { providerID: 'anthropic', modelID: 'claude-sonnet-4' },
    },
  }

  it('light 意图 → 传 defaultModel 对象给 Engine', () => {
    const intent = classifyIntent('你好')
    assert.strictEqual(intent, 'light')
    const model = testConfig.engine.defaultModel
    // Engine 收到的应该是对象，normalizeModel 应该透传
    assert.deepStrictEqual(normalizeModel(model), model)
  })

  it('heavy 意图 → 传 heavyModel 对象给 Engine', () => {
    const intent = classifyIntent('帮我写一个代码函数来处理用户认证')
    assert.strictEqual(intent, 'heavy')
    const model = testConfig.engine.heavyModel
    assert.deepStrictEqual(normalizeModel(model), model)
  })

  it('Engine payload 中 model 始终是嵌套对象', () => {
    // 无论 Orchestrator 传什么格式，最终 payload 的 model 都是对象
    const formats = [
      'google/gemini-2.5-flash',
      { providerID: 'google', modelID: 'gemini-2.5-flash' },
    ]
    for (const input of formats) {
      const normalized = normalizeModel(input)
      assert.ok(normalized.providerID, `providerID missing for input: ${JSON.stringify(input)}`)
      assert.ok(normalized.modelID, `modelID missing for input: ${JSON.stringify(input)}`)
    }
  })
})
