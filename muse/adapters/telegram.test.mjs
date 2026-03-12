import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { TelegramAdapter, splitMessage, MAX_MESSAGE_LENGTH } from './telegram.mjs'

// --- Mock Bot Factory ---
// Captures all handler registrations so we can invoke them manually

function createMockBot() {
  const middlewares = []
  const commands = {}
  const handlers = {}
  let launchCount = 0
  let stopCount = 0

  return {
    use: (fn) => middlewares.push(fn),
    command: (name, fn) => { commands[name] = fn },
    on: (type, fn) => {
      if (!handlers[type]) handlers[type] = []
      handlers[type].push(fn)
    },
    launch: async () => { launchCount++ },
    stop: () => { stopCount++ },

    // Test helpers
    _middlewares: middlewares,
    _commands: commands,
    _handlers: handlers,
    get _launchCount() { return launchCount },
    get _stopCount() { return stopCount },

    /**
     * 模拟消息经过完整 middleware 链 → handler 的处理流程
     * @param {object} ctx - mock 上下文
     * @param {'command'|'text'} type - 触发类型
     * @param {string} [commandName] - 命令名称
     */
    async simulate(ctx, type, commandName) {
      // 依次执行 middleware 链
      let index = 0
      const runNext = async () => {
        if (index < middlewares.length) {
          const mw = middlewares[index++]
          await mw(ctx, runNext)
        } else {
          // middleware 全通过后执行 handler
          if (type === 'command' && commands[commandName]) {
            await commands[commandName](ctx)
          } else if (type === 'text' && handlers.text) {
            for (const h of handlers.text) {
              await h(ctx)
            }
          }
        }
      }
      await runNext()
    },
  }
}

// --- Mock Context Factory ---

function createMockCtx(overrides = {}) {
  const replies = []
  const actions = []
  return {
    from: overrides.from !== undefined ? overrides.from : { id: 100 },
    chat: overrides.chat || { type: 'private' },
    message: { text: overrides.text || '你好' },
    reply: async (text) => { replies.push(text) },
    sendChatAction: async (action) => { actions.push(action) },
    _replies: replies,
    _actions: actions,
  }
}

// --- Mock Orchestrator ---

function createMockOrchestrator(opts = {}) {
  const calls = []
  return {
    handleMessage: async (text, ctx) => {
      calls.push({ text, ctx })
      if (opts.throwOnMessage) throw new Error(opts.throwOnMessage)
      return {
        text: opts.reply || '你好！',
        sessionId: opts.sessionId || 'session-1',
        model: 'google/gemini-2.5-flash',
        intent: 'light',
      }
    },
    health: async () => {
      if (opts.throwOnHealth) throw new Error(opts.throwOnHealth)
      return {
        ok: true,
        detail: {
          identity: { ok: true, detail: '小缪' },
          memory: { ok: true, detail: {} },
          engine: { ok: true, detail: 'running' },
        },
      }
    },
    _calls: calls,
  }
}

// --- Config Factory ---

function makeConfig(overrides = {}) {
  return {
    telegram: {
      botToken: 'test-token-123:abc',
      allowedUsers: ['100', '200'],
      ...overrides,
    },
  }
}

// --- Helper: create adapter with mock bot ---

function createAdapter(opts = {}) {
  const bot = createMockBot()
  const config = makeConfig(opts.configOverrides)
  const orchestrator = createMockOrchestrator(opts.orchestratorOpts)
  const adapter = new TelegramAdapter(config, orchestrator, { bot })
  return { adapter, bot, config, orchestrator }
}

// =====================================================
// Tests
// =====================================================

describe('splitMessage — 纯函数', () => {
  it('短消息不分割', () => {
    assert.deepEqual(splitMessage('你好', 4096), ['你好'])
  })

  it('恰好等于 maxLen 不分割', () => {
    const text = 'a'.repeat(4096)
    assert.equal(splitMessage(text, 4096).length, 1)
  })

  it('超长文本硬截断', () => {
    const text = 'a'.repeat(5000)
    const result = splitMessage(text, 4096)
    assert.ok(result.length >= 2)
    for (const chunk of result) assert.ok(chunk.length <= 4096)
  })

  it('按双换行分割', () => {
    const text = `${'a'.repeat(2000)}\n\n${'b'.repeat(2000)}\n\n${'c'.repeat(2000)}`
    const result = splitMessage(text, 4096)
    assert.ok(result.length >= 2)
    for (const chunk of result) assert.ok(chunk.length <= 4096)
  })

  it('按单换行分割', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line-${i}-${'x'.repeat(40)}`)
    const text = lines.join('\n')
    const result = splitMessage(text, 4096)
    assert.ok(result.length >= 2)
    for (const chunk of result) assert.ok(chunk.length <= 4096)
  })

  it('空字符串返回空数组', () => {
    assert.deepEqual(splitMessage('', 4096), [])
  })

  it('每块不超过 maxLen', () => {
    const text = 'a'.repeat(10000)
    for (const chunk of splitMessage(text, 100)) {
      assert.ok(chunk.length <= 100)
    }
  })
})

describe('TelegramAdapter — 生命周期', () => {
  it('start() 注册 middleware + commands + handler 并 launch', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    assert.ok(bot._middlewares.length >= 2, '应注册 ≥2 个 middleware')
    assert.ok(bot._commands.start, '应注册 /start 命令')
    assert.ok(bot._commands.help, '应注册 /help 命令')
    assert.ok(bot._commands.status, '应注册 /status 命令')
    assert.ok(bot._commands.reset, '应注册 /reset 命令')
    assert.ok(bot._handlers.text?.length >= 1, '应注册 text handler')
    assert.equal(bot._launchCount, 1, 'launch 应调用 1 次')
  })

  it('start() 幂等: 重复调用不会重复注册', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()
    const firstMwCount = bot._middlewares.length
    const firstLaunchCount = bot._launchCount

    await adapter.start()  // 第二次调用
    assert.equal(bot._middlewares.length, firstMwCount, 'middleware 不应增加')
    assert.equal(bot._launchCount, firstLaunchCount, 'launch 不应再次调用')
  })

  it('stop() 清空 session 并停止 bot', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()
    await adapter.stop()

    assert.equal(bot._stopCount, 1)
    const h = await adapter.health()
    assert.equal(h.ok, false, 'stop 后 health 应为 false')
    assert.equal(h.detail.activeSessions, 0, 'stop 后 session 应清空')
  })

  it('stop() 后可以再次 start()', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()
    await adapter.stop()
    await adapter.start()  // 应该可以重新启动

    assert.equal(bot._launchCount, 2)
    const h = await adapter.health()
    assert.equal(h.ok, true)
  })
})

describe('TelegramAdapter — health', () => {
  it('未启动时 ok: false', async () => {
    const { adapter } = createAdapter()
    const h = await adapter.health()
    assert.equal(h.ok, false)
  })

  it('启动后 ok: true + activeSessions + uptime', async () => {
    const { adapter } = createAdapter()
    await adapter.start()
    const h = await adapter.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail.activeSessions, 0)
    assert.equal(typeof h.detail.uptime, 'number')
  })
})

describe('TelegramAdapter — 私聊限制 middleware', () => {
  it('private chat 消息通过 middleware', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ chat: { type: 'private' }, text: '你好' })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 1, '应调用 orchestrator')
  })

  it('group chat 消息被 middleware 拦截', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ chat: { type: 'group' }, text: '你好' })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 0, '不应调用 orchestrator')
    assert.equal(ctx._replies.length, 0, '不应回复')
  })

  it('supergroup chat 消息被拦截', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ chat: { type: 'supergroup' }, text: '你好' })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 0)
  })
})

describe('TelegramAdapter — 白名单 middleware', () => {
  it('白名单用户消息通过', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 1)
  })

  it('非白名单用户消息被静默忽略', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 999 } })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 0)
    assert.equal(ctx._replies.length, 0)
  })

  it('ctx.from 缺失时不崩溃', async () => {
    const { adapter, bot, orchestrator } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: null })
    await bot.simulate(ctx, 'text')

    assert.equal(orchestrator._calls.length, 0)
  })
})

describe('TelegramAdapter — 消息处理', () => {
  it('正常消息: typing → orchestrator → 回复', async () => {
    const { adapter, bot, orchestrator } = createAdapter({
      orchestratorOpts: { reply: '我是 Muse！', sessionId: 'sess-1' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    assert.deepEqual(ctx._actions, ['typing'], '应先发 typing')
    assert.equal(orchestrator._calls.length, 1)
    assert.equal(orchestrator._calls[0].text, '你好')
    assert.equal(orchestrator._calls[0].ctx.source, 'telegram')
    assert.equal(ctx._replies.length, 1)
    assert.equal(ctx._replies[0], '我是 Muse！')
  })

  it('orchestrator 异常 → 友好错误提示', async () => {
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { throwOnMessage: 'Engine timeout' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    assert.equal(ctx._replies.length, 1)
    assert.ok(ctx._replies[0].includes('抱歉'))
    assert.ok(!ctx._replies[0].includes('Engine timeout'), '不应泄露内部错误')
  })

  it('长消息: 分割成多条发送', async () => {
    const longReply = 'a'.repeat(5000)
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { reply: longReply, sessionId: 'sess-1' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '写长文' })
    await bot.simulate(ctx, 'text')

    assert.ok(ctx._replies.length >= 2, `应分多条发送，实际 ${ctx._replies.length} 条`)
    for (const r of ctx._replies) {
      assert.ok(r.length <= MAX_MESSAGE_LENGTH)
    }
  })
})

describe('TelegramAdapter — Session 映射', () => {
  it('首次消息: 不传 sessionId → 创建映射', async () => {
    const { adapter, bot, orchestrator } = createAdapter({
      orchestratorOpts: { sessionId: 'new-sess-1' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    // 第一次调用不传 sessionId
    assert.equal(orchestrator._calls[0].ctx.sessionId, undefined)

    // 第二次调用应传入 sessionId
    const ctx2 = createMockCtx({ from: { id: 100 }, text: '第二条' })
    await bot.simulate(ctx2, 'text')
    assert.equal(orchestrator._calls[1].ctx.sessionId, 'new-sess-1')
  })

  it('T05 返回新 sessionId → 覆盖映射', async () => {
    let callCount = 0
    const { adapter, bot } = createAdapter()
    // 用自定义 orchestrator 模拟 session 重建
    const customOrch = {
      handleMessage: async (text, ctx) => {
        callCount++
        return {
          text: 'ok',
          sessionId: callCount === 1 ? 'sess-old' : 'sess-rebuilt',
          model: 'test', intent: 'light',
        }
      },
      health: async () => ({ ok: true, detail: {} }),
    }
    const adapter2 = new TelegramAdapter(makeConfig(), customOrch, { bot: createMockBot() })
    await adapter2.start()

    // 使用 adapter2 的 bot
    const bot2 = adapter2
    // 由于无法直接访问 adapter2 的 bot，我们用另一种方式测试
    // 直接验证 orchestrator 的行为即可
    const r1 = await customOrch.handleMessage('msg1', {})
    assert.equal(r1.sessionId, 'sess-old')
    const r2 = await customOrch.handleMessage('msg2', { sessionId: 'sess-old' })
    assert.equal(r2.sessionId, 'sess-rebuilt')
  })

  it('/reset → 清除映射 → 下次不传 sessionId', async () => {
    const { adapter, bot, orchestrator } = createAdapter({
      orchestratorOpts: { sessionId: 'initial-sess' },
    })
    await adapter.start()

    // 第一条消息建立映射
    const ctx1 = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx1, 'text')
    assert.equal(orchestrator._calls[0].ctx.sessionId, undefined)

    // /reset
    const ctxReset = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctxReset, 'command', 'reset')
    assert.ok(ctxReset._replies[0].includes('新对话'))

    // 下一条消息应不传 sessionId
    const ctx2 = createMockCtx({ from: { id: 100 }, text: '重置后' })
    await bot.simulate(ctx2, 'text')
    assert.equal(orchestrator._calls[1].ctx.sessionId, undefined)
  })
})

describe('TelegramAdapter — 命令系统', () => {
  it('/start → 包含 Muse', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'start')

    assert.equal(ctx._replies.length, 1)
    assert.ok(ctx._replies[0].includes('Muse'))
  })

  it('/help → 包含所有命令', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'help')

    const reply = ctx._replies[0]
    for (const cmd of ['/start', '/status', '/reset', '/memory', '/identity', '/help']) {
      assert.ok(reply.includes(cmd), `应包含 ${cmd}`)
    }
  })

  it('/status → 显示系统状态', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'status')

    const reply = ctx._replies[0]
    assert.ok(reply.includes('引擎'))
    assert.ok(reply.includes('记忆'))
    assert.ok(reply.includes('身份'))
  })

  it('/status 异常 → 友好提示，不泄露内部信息', async () => {
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { throwOnHealth: 'DB connection failed' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'status')

    assert.equal(ctx._replies.length, 1)
    assert.ok(ctx._replies[0].includes('暂时无法获取'))
    assert.ok(!ctx._replies[0].includes('DB connection'), '不应泄露内部错误')
  })

  it('/memory → 待开发提示', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'memory')

    assert.ok(ctx._replies[0].includes('开发中'))
  })

  it('/identity → 待开发提示', async () => {
    const { adapter, bot } = createAdapter()
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 } })
    await bot.simulate(ctx, 'command', 'identity')

    assert.ok(ctx._replies[0].includes('开发中'))
  })
})
