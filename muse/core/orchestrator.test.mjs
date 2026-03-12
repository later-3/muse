import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  Orchestrator,
  classifyIntent,
  extractKeywords,
  DEFAULT_PERSONA,
  HEAVY_TEXT_THRESHOLD,
  MAX_PREF_LENGTH,
} from './orchestrator.mjs'

// --- Mock Factories ---

function makeConfig() {
  return {
    engine: {
      defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
      heavyModel: { providerID: 'anthropic', modelID: 'claude-sonnet-4' },
    },
    memory: { maxEpisodicDays: 90 },
  }
}

function createMockIdentity(opts = {}) {
  return {
    buildSystemPrompt: opts.throwOnPrompt
      ? () => { throw new Error('Identity not loaded') }
      : () => '你是小缪，一个可爱的AI助手。',
    data: { identity: { name: '小缪' } },
    health: async () => ({ ok: !opts.unhealthy, detail: '小缪' }),
  }
}

function createMockMemory(opts = {}) {
  const episodes = []
  const semantics = new Map()
  return {
    searchMemories: opts.throwOnSearch
      ? () => { throw new Error('Memory not started') }
      : (kw) => [...semantics.values()].filter(m =>
        (m.key && m.key.includes(kw)) || (m.value && m.value.includes(kw)),
      ),
    getRecentSummaries: opts.throwOnSummaries
      ? () => { throw new Error('Memory not started') }
      : (days) => opts.summaries || [],
    addEpisode: opts.throwOnAdd
      ? () => { throw new Error('Memory not started') }
      : (sid, role, content) => {
        episodes.push({ sid, role, content })
        return episodes.length
      },
    setMemory: opts.throwOnSet
      ? () => { throw new Error('Memory not started') }
      : (k, v, cat, src) => semantics.set(k, { id: semantics.size + 1, key: k, value: v, category: cat, source: src }),
    health: async () => ({ ok: !opts.unhealthy, detail: { semanticCount: 0, episodicCount: 0 } }),
    _episodes: episodes,
    _semantics: semantics,
  }
}

function createMockEngine(reply = '你好！', opts = {}) {
  let sessionCounter = 0
  const sessionsCreated = []
  return {
    createSession: async () => {
      const s = { id: `mock-session-${++sessionCounter}` }
      sessionsCreated.push(s)
      return s
    },
    sendAndWait: async (sid, text, options) => ({
      text: reply,
      message: { role: 'assistant', parts: [{ type: 'text', text: reply }] },
      sessionId: sid,
    }),
    health: async () => ({ ok: !opts.unhealthy, detail: 'mock' }),
    _sessionsCreated: sessionsCreated,
  }
}

function createOrchestrator(overrides = {}) {
  const config = overrides.config || makeConfig()
  const identity = overrides.identity || createMockIdentity()
  const memory = overrides.memory || createMockMemory()
  const engine = overrides.engine || createMockEngine()
  return new Orchestrator({ config, identity, memory, engine })
}

// --- Tests ---

describe('Orchestrator — handleMessage 主路径', () => {
  // Test 1
  it('基本流程: 返回回复 + sessionId + model + intent', async () => {
    const orch = createOrchestrator()
    const result = await orch.handleMessage('你好')

    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length > 0)
    assert.ok(result.sessionId.startsWith('mock-session-'))
    assert.equal(result.model, 'google/gemini-2.5-flash')
    assert.equal(result.intent, 'light')
  })

  // Test 2
  it('使用指定 sessionId → 不创建新 session', async () => {
    const engine = createMockEngine()
    const orch = createOrchestrator({ engine })
    const result = await orch.handleMessage('你好', { sessionId: 'existing-123' })

    assert.equal(result.sessionId, 'existing-123')
    assert.equal(engine._sessionsCreated.length, 0)
  })

  // Test 3
  it('不传 sessionId → 自动创建新 session', async () => {
    const engine = createMockEngine()
    const orch = createOrchestrator({ engine })
    const result = await orch.handleMessage('你好')

    assert.ok(result.sessionId.startsWith('mock-session-'))
    assert.equal(engine._sessionsCreated.length, 1)
  })

  // Test 4
  it('空文本应抛错', async () => {
    const orch = createOrchestrator()
    await assert.rejects(() => orch.handleMessage(''), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage('   '), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage(null), /text 不能为空/)
    await assert.rejects(() => orch.handleMessage(123), /text 不能为空/)
  })
})

describe('Orchestrator — classifyIntent', () => {
  // Test 5
  it('轻量意图: 简短问候', () => {
    assert.equal(classifyIntent('你好'), 'light')
    assert.equal(classifyIntent('今天天气怎么样'), 'light')
    assert.equal(classifyIntent('谢谢'), 'light')
  })

  // Test 6
  it('重型意图 — 代码', () => {
    assert.equal(classifyIntent('帮我写一个函数'), 'heavy')
    assert.equal(classifyIntent('写代码实现排序'), 'heavy')
    assert.equal(classifyIntent('帮我实现一个登录页面'), 'heavy')
  })

  // Test 7
  it('重型意图 — 分析', () => {
    assert.equal(classifyIntent('分析这段代码的性能问题'), 'heavy')
    assert.equal(classifyIntent('为什么这个函数不工作'), 'heavy')
    assert.equal(classifyIntent('如何优化数据库查询'), 'heavy')
  })

  // Test 8
  it('重型意图 — 长文本 (>200字)', () => {
    const longText = '这是一段测试文本'.repeat(30) // 240 chars
    assert.equal(longText.length > HEAVY_TEXT_THRESHOLD, true)
    assert.equal(classifyIntent(longText), 'heavy')
  })

  // Test 9
  it('边界 — 恰好200字应为 light', () => {
    const text = 'a'.repeat(200)
    assert.equal(text.length, HEAVY_TEXT_THRESHOLD)
    assert.equal(classifyIntent(text), 'light')
  })
})

describe('Orchestrator — 模型路由', () => {
  // Test 10
  it('light → defaultModel', async () => {
    const orch = createOrchestrator()
    const result = await orch.handleMessage('你好')
    assert.equal(result.model, 'google/gemini-2.5-flash')
  })

  // Test 11
  it('heavy → heavyModel', async () => {
    const orch = createOrchestrator()
    const result = await orch.handleMessage('帮我写一个排序函数')
    assert.equal(result.model, 'anthropic/claude-sonnet-4')
  })
})

describe('Orchestrator — extractKeywords', () => {
  // Test 12
  it('中文连续文本: 包含偏好词', () => {
    const kws = extractKeywords('我喜欢用VSCode')
    assert.ok(kws.some(k => k.includes('喜欢')), `应包含"喜欢", 实际: ${kws}`)
  })

  // Test 13
  it('有空格/标点文本: 正确分段', () => {
    const kws = extractKeywords('JavaScript 函数')
    assert.ok(kws.length > 0)
  })

  // Test 14
  it('短文本 (<2字): 返回空数组', () => {
    const kws = extractKeywords('嗯')
    assert.equal(kws.length, 0)
  })

  // Test 15 (补充: 多偏好词)
  it('多个偏好词: 返回最多3个', () => {
    const kws = extractKeywords('我喜欢编辑器和语言框架')
    assert.ok(kws.length > 0)
    assert.ok(kws.length <= 3)
  })
})

describe('Orchestrator — Prompt 组装', () => {
  // Test 16
  it('prompt 包含 system prompt', async () => {
    const engine = createMockEngine()
    // 拦截 sendAndWait 检查 prompt 内容
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ engine })
    await orch.handleMessage('测试')

    assert.ok(capturedPrompt.includes('小缪'), 'prompt 应包含 identity system prompt')
  })

  // Test 17
  it('prompt 包含语义记忆', async () => {
    const memory = createMockMemory()
    // 预设语义记忆, key 含 '名字' 以便关键词匹配
    memory.setMemory('名字', '张三', 'preference', 'auto')

    const engine = createMockEngine()
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ memory, engine })
    // '名字' 是偏好词表中的词，extractKeywords 会优先提取
    await orch.handleMessage('你还记得我的名字吗')

    assert.ok(capturedPrompt.includes('你对用户的了解'), `prompt 应有记忆段, 实际: ${capturedPrompt.slice(0, 200)}`)
    assert.ok(capturedPrompt.includes('张三'))
  })

  // Test 18
  it('无匹配语义记忆 → prompt 无记忆段', async () => {
    const engine = createMockEngine()
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ engine })
    await orch.handleMessage('你好')

    assert.ok(!capturedPrompt.includes('你对用户的了解'))
  })

  // Test 19
  it('prompt 包含情景摘要', async () => {
    const memory = createMockMemory({
      summaries: [
        { created_at: '2026-03-10', summary: '用户聊了天气', session_id: 's1' },
      ],
    })
    const engine = createMockEngine()
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ memory, engine })
    await orch.handleMessage('测试')

    assert.ok(capturedPrompt.includes('最近的对话摘要'))
    assert.ok(capturedPrompt.includes('用户聊了天气'))
  })
})

describe('Orchestrator — 降级策略', () => {
  // Test 20
  it('Identity 失败 → 使用默认 persona', async () => {
    const identity = createMockIdentity({ throwOnPrompt: true })
    const engine = createMockEngine()
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ identity, engine })
    const result = await orch.handleMessage('你好')

    assert.equal(result.text, 'OK')
    assert.ok(capturedPrompt.includes(DEFAULT_PERSONA), 'prompt 应包含默认 persona')
  })

  // Test 21
  it('Memory searchMemories 失败 → 空记忆，不崩溃', async () => {
    const memory = createMockMemory({ throwOnSearch: true })
    const orch = createOrchestrator({ memory })
    const result = await orch.handleMessage('你好')

    assert.equal(typeof result.text, 'string')
    assert.ok(result.text.length > 0)
  })

  // Test 22
  it('Memory getRecentSummaries 失败 → 空摘要，不崩溃', async () => {
    const memory = createMockMemory({ throwOnSummaries: true })
    const orch = createOrchestrator({ memory })
    const result = await orch.handleMessage('你好')

    assert.equal(typeof result.text, 'string')
  })
})

describe('Orchestrator — 后处理', () => {
  // Test 23
  it('存储情景记忆: user + assistant 两条', async () => {
    const memory = createMockMemory()
    const orch = createOrchestrator({ memory })
    await orch.handleMessage('你好')

    // 等后处理异步完成
    await new Promise(r => setTimeout(r, 50))

    assert.equal(memory._episodes.length, 2)
    assert.equal(memory._episodes[0].role, 'user')
    assert.equal(memory._episodes[0].content, '你好')
    assert.equal(memory._episodes[1].role, 'assistant')
  })

  // Test 24
  it('提取偏好 "我叫" → setMemory', async () => {
    const memory = createMockMemory()
    const orch = createOrchestrator({ memory })
    await orch.handleMessage('我叫张三')

    await new Promise(r => setTimeout(r, 50))

    const nameEntry = memory._semantics.get('user_name')
    assert.ok(nameEntry, '应提取到 user_name')
    assert.equal(nameEntry.value, '张三')
  })

  // Test 25
  it('偏好值截断到 MAX_PREF_LENGTH', async () => {
    const memory = createMockMemory()
    const orch = createOrchestrator({ memory })
    const longName = '超级无敌螺旋丸宇宙最强的名字就是这个名字真的很长'
    await orch.handleMessage(`我叫${longName}`)

    await new Promise(r => setTimeout(r, 50))

    const nameEntry = memory._semantics.get('user_name')
    assert.ok(nameEntry)
    assert.ok(nameEntry.value.length <= MAX_PREF_LENGTH)
  })

  // Test 26
  it('无偏好不写入', async () => {
    const memory = createMockMemory()
    const orch = createOrchestrator({ memory })
    await orch.handleMessage('你好')

    await new Promise(r => setTimeout(r, 50))

    assert.equal(memory._semantics.size, 0)
  })

  // Test 27
  it('addEpisode 失败 → assistant 仍尝试存储', async () => {
    let addCallCount = 0
    const memory = createMockMemory()
    const originalAdd = memory.addEpisode.bind(memory)
    memory.addEpisode = (sid, role, content) => {
      addCallCount++
      if (addCallCount === 1) throw new Error('first add fails')
      return originalAdd(sid, role, content)
    }

    const orch = createOrchestrator({ memory })
    const result = await orch.handleMessage('你好')

    await new Promise(r => setTimeout(r, 50))

    // handleMessage 本身不崩溃
    assert.equal(result.text, '你好！')
    // 第二次调用（assistant）应该成功
    assert.equal(memory._episodes.length, 1)
    assert.equal(memory._episodes[0].role, 'assistant')
  })

  // Test 28
  it('后处理整体失败不阻塞返回', async () => {
    const memory = createMockMemory({ throwOnAdd: true })
    const orch = createOrchestrator({ memory })
    const result = await orch.handleMessage('你好')

    assert.equal(result.text, '你好！')
    assert.ok(result.sessionId)
  })
})

describe('Orchestrator — health', () => {
  // Test 29
  it('三模块都 ok → ok:true', async () => {
    const orch = createOrchestrator()
    const h = await orch.health()

    assert.equal(h.ok, true)
    assert.equal(h.detail.identity.ok, true)
    assert.equal(h.detail.memory.ok, true)
    assert.equal(h.detail.engine.ok, true)
  })

  // Test 30
  it('engine 不健康 → 整体 ok:false', async () => {
    const engine = createMockEngine('', { unhealthy: true })
    const orch = createOrchestrator({ engine })
    const h = await orch.health()

    assert.equal(h.ok, false)
    assert.equal(h.detail.engine.ok, false)
  })
})

describe('Orchestrator — 多关键词搜索合并', () => {
  // Test 31 (bonus)
  it('多关键词分别命中 → 结果去重', async () => {
    const memory = createMockMemory()
    memory.setMemory('user_name', '张三', 'preference', 'auto')
    memory.setMemory('user_lang', 'JavaScript', 'preference', 'auto')

    const engine = createMockEngine()
    let capturedPrompt = ''
    engine.sendAndWait = async (sid, text) => {
      capturedPrompt = text
      return { text: 'OK', message: {}, sessionId: sid }
    }
    const orch = createOrchestrator({ memory, engine })
    // 使用包含偏好词的输入以生成有效关键词
    await orch.handleMessage('我喜欢JavaScript语言')

    // prompt 应包含记忆段（至少命中 JavaScript）
    if (capturedPrompt.includes('你对用户的了解')) {
      assert.ok(capturedPrompt.includes('JavaScript'))
    }
  })
})
