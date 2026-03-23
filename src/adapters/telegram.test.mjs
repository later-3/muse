import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { TelegramAdapter, splitMessage, parseImageReply, MAX_MESSAGE_LENGTH } from './telegram.mjs'

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
    catch: () => {},  // T14 fix: bot.catch() 全局错误处理
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
  const edits = []
  const deletes = []
  let replyMsgId = 1000
  const chatId = overrides.chat?.id || 42
  return {
    from: overrides.from !== undefined ? overrides.from : { id: 100, first_name: 'Test' },
    chat: overrides.chat || { type: 'private', id: chatId },
    message: { text: overrides.text || '你好', message_id: overrides.messageId || 1 },
    reply: async (text) => { replies.push(text); return { message_id: ++replyMsgId } },
    sendChatAction: async (action) => { actions.push(action) },
    telegram: {
      editMessageText: async (chat, msgId, _inline, text) => { edits.push({ chat, msgId, text }) },
      deleteMessage: async (chat, msgId) => { deletes.push({ chat, msgId }) },
    },
    _replies: replies,
    _actions: actions,
    _edits: edits,
    _deletes: deletes,
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

function createMockChannel(opts = {}) {
  const photos = []
  return {
    sendPhoto: async (chatId, photoSource, meta = {}) => {
      photos.push({ chatId, photoSource, meta })
      if (opts.failSendPhoto) {
        return { ok: false, error: 'mock sendPhoto failed' }
      }
      return { ok: true }
    },
    _photos: photos,
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

// --- Mock Ingress Factory ---

function createMockIngress(orchestrator) {
  const calls = []
  return {
    handle: async (perception, context = {}) => {
      calls.push({ perception, context })
      // 委托给 orchestrator，模拟真实 Ingress 行为
      const text = perception.text || perception.textFallback || '[unknown]'
      const result = await orchestrator.handleMessage(text, {
        source: perception.source,
        sessionId: context.sessionId,
        timeoutMs: context.timeoutMs,
      })
      return { ...result, handled: true }
    },
    _calls: calls,
  }
}

// --- Helper: create adapter with mock bot ---

function createAdapter(opts = {}) {
  const bot = createMockBot()
  const config = makeConfig(opts.configOverrides)
  const orchestrator = createMockOrchestrator(opts.orchestratorOpts)
  const ingress = opts.withIngress ? createMockIngress(orchestrator) : undefined
  const channel = opts.withChannel ? createMockChannel(opts.channelOpts) : undefined
  const adapter = new TelegramAdapter(config, orchestrator, { bot, ingress, channel })
  return { adapter, bot, config, orchestrator, ingress, channel }
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

describe('parseImageReply — 纯函数', () => {
  it('提取 markdown 图片和文字说明', () => {
    const result = parseImageReply('转好了\n\n![小缪](self-portrait.png)')
    assert.equal(result.src, 'self-portrait.png')
    assert.equal(result.caption, '转好了')
  })

  it('无 markdown 图片时返回 null', () => {
    assert.equal(parseImageReply('普通文本回复'), null)
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

describe('TelegramAdapter — 消息处理 (降级路径: 无 Ingress)', () => {
  it('正常消息: 占位 → orchestrator → 编辑回复', async () => {
    const { adapter, bot, orchestrator } = createAdapter({
      orchestratorOpts: { reply: '我是 Muse！', sessionId: 'sess-1' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    // 占位消息
    assert.equal(ctx._replies[0], '🤔 思考中...')
    // orchestrator 被调用
    assert.equal(orchestrator._calls.length, 1)
    assert.equal(orchestrator._calls[0].text, '你好')
    assert.equal(orchestrator._calls[0].ctx.source, 'telegram')
    // 最终回复通过 editMessageText
    assert.ok(ctx._edits.length >= 1, '应通过编辑占位消息回复')
    assert.equal(ctx._edits[ctx._edits.length - 1].text, '我是 Muse！')
  })

  it('orchestrator 异常 → 编辑占位为友好错误提示', async () => {
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { throwOnMessage: 'Engine timeout' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    // 占位消息 + 错误编辑
    assert.equal(ctx._replies[0], '🤔 思考中...')
    assert.ok(ctx._edits.length >= 1)
    const errText = ctx._edits[ctx._edits.length - 1].text
    assert.ok(errText.includes('抱歉'), `错误消息: ${errText}`)
    assert.ok(!errText.includes('Engine timeout'), '不应泄露内部错误')
  })

  it('长消息: 删除占位 + 分段发送', async () => {
    const longReply = 'a'.repeat(5000)
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { reply: longReply, sessionId: 'sess-1' },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '写长文' })
    await bot.simulate(ctx, 'text')

    // 占位消息 + 长消息分段 (占位被删除后重新发送)
    assert.ok(ctx._replies.length >= 2, `应有占位+分段，实际 ${ctx._replies.length} 条`)
    // 所有非占位消息不超过 MAX_MESSAGE_LENGTH
    for (const r of ctx._replies.slice(1)) {
      assert.ok(r.length <= MAX_MESSAGE_LENGTH)
    }
  })

  it('回复包含 markdown 图片时调用 sendPhoto', async () => {
    const { adapter, bot, channel } = createAdapter({
      withChannel: true,
      orchestratorOpts: {
        reply: '转好了，给你看图。\n\n![小缪](https://example.com/muse.png)',
        sessionId: 'sess-photo-1',
      },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '来张图' })
    await bot.simulate(ctx, 'text')

    assert.equal(channel._photos.length, 1)
    assert.equal(channel._photos[0].chatId, '42')
    assert.equal(channel._photos[0].photoSource, 'https://example.com/muse.png')
    assert.equal(channel._photos[0].meta.caption, '转好了，给你看图。')
    assert.equal(ctx._deletes.length, 1, '发送图片后应删除占位消息')
  })

  it('sendPhoto 失败时回退到文本编辑', async () => {
    const { adapter, bot, channel } = createAdapter({
      withChannel: true,
      channelOpts: { failSendPhoto: true },
      orchestratorOpts: {
        reply: '转好了\n\n![小缪](https://example.com/muse.png)',
        sessionId: 'sess-photo-fallback',
      },
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '来张图' })
    await bot.simulate(ctx, 'text')

    assert.equal(channel._photos.length, 1)
    assert.ok(ctx._edits.length >= 1, '图片发送失败应回退文本编辑')
    assert.ok(ctx._edits[ctx._edits.length - 1].text.includes('![小缪]'))
  })
})

describe('TelegramAdapter — 消息处理 (Ingress 路径)', () => {
  it('text 通过 Ingress 路由: 占位 → ingress.handle → 编辑回复', async () => {
    const { adapter, bot, orchestrator, ingress } = createAdapter({
      orchestratorOpts: { reply: '通过 Ingress！', sessionId: 'sess-ingress' },
      withIngress: true,
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '你好' })
    await bot.simulate(ctx, 'text')

    // 应走 Ingress 而非直接调 Orchestrator
    assert.equal(ingress._calls.length, 1, '应调用 ingress.handle()')
    assert.equal(ingress._calls[0].perception.type, 'text')
    assert.equal(ingress._calls[0].perception.source, 'telegram')
    assert.equal(ingress._calls[0].perception.text, '你好')

    // orchestrator 通过 ingress 间接被调用
    assert.equal(orchestrator._calls.length, 1)
    assert.equal(orchestrator._calls[0].text, '你好')

    // 最终回复
    assert.ok(ctx._edits.length >= 1)
    assert.equal(ctx._edits[ctx._edits.length - 1].text, '通过 Ingress！')
  })

  it('Ingress 异常 → 编辑占位为友好错误提示', async () => {
    const { adapter, bot } = createAdapter({
      orchestratorOpts: { throwOnMessage: 'Ingress error' },
      withIngress: true,
    })
    await adapter.start()

    const ctx = createMockCtx({ from: { id: 100 }, text: '测试' })
    await bot.simulate(ctx, 'text')

    assert.ok(ctx._edits.length >= 1)
    const errText = ctx._edits[ctx._edits.length - 1].text
    assert.ok(errText.includes('抱歉'), `错误消息: ${errText}`)
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
    assert.ok(ctxReset._replies.some(r => r.includes('新对话')))

    // 下一条消息应不传 sessionId
    const ctx2 = createMockCtx({ from: { id: 100 }, text: '重置后' })
    await bot.simulate(ctx2, 'text')
    assert.equal(orchestrator._calls[1].ctx.sessionId, undefined)
  })

  it('Session 映射在 Ingress 模式下也正确工作', async () => {
    const { adapter, bot, orchestrator, ingress } = createAdapter({
      orchestratorOpts: { sessionId: 'ingress-sess' },
      withIngress: true,
    })
    await adapter.start()

    // 第一条消息 → 无 sessionId
    const ctx1 = createMockCtx({ from: { id: 100 }, text: '一' })
    await bot.simulate(ctx1, 'text')
    assert.equal(ingress._calls[0].context.sessionId, undefined)

    // 第二条消息 → 应传入上次返回的 sessionId
    const ctx2 = createMockCtx({ from: { id: 100 }, text: '二' })
    await bot.simulate(ctx2, 'text')
    assert.equal(ingress._calls[1].context.sessionId, 'ingress-sess')
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
