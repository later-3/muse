import { Telegraf } from 'telegraf'
import { createLogger } from '../logger.mjs'

const log = createLogger('telegram')

// --- Constants ---

/** Telegram 单条消息最大长度 */
const MAX_MESSAGE_LENGTH = 4096

/** 进度更新间隔 (ms) — 每隔这么久编辑占位消息显示已等待时间 */
const PROGRESS_INTERVAL_MS = 15_000

/** 最大等待时间 (ms) — 超过后放弃等待 */
const MAX_WAIT_MS = 300_000

/** 进度消息的动画符号 */
const THINKING_FRAMES = ['🤔', '💭', '🧠', '⚡']

// --- TelegramAdapter ---

export class TelegramAdapter {
  #bot
  #config
  #orchestrator
  #startTime
  #running = false
  #started = false

  /** 实例私有 session 映射: userId → sessionId */
  #userSessions = new Map()

  /**
   * @param {object} config
   * @param {object} orchestrator
   * @param {object} [options]
   * @param {object} [options.bot] - 可选 bot 注入 (测试用)
   */
  constructor(config, orchestrator, { bot } = {}) {
    this.#config = config
    this.#orchestrator = orchestrator
    this.#bot = bot || new Telegraf(config.telegram.botToken)
    this.#startTime = Date.now()
  }

  // --- 生命周期 ---

  /** 启动 Bot (幂等: 重复调用不会重复注册 handler) */
  async start() {
    if (this.#started) {
      log.warn('Telegram Bot 已启动，跳过重复 start()')
      return
    }

    // 全局错误处理 (防止 "Unhandled error" 崩溃)
    this.#bot.catch((err, ctx) => {
      const userId = ctx?.from?.id || 'unknown'
      log.error(`[telegram] ✖ Bot 全局错误 (user=${userId}): ${err.message}`)
      log.error(`[telegram]   stack: ${err.stack?.split('\n').slice(0, 3).join(' → ')}`)
      // 不再在 catch 里 reply — reply-first 机制已经发过占位消息
    })

    this.#registerMiddleware()
    this.#registerCommands()
    this.#registerMessageHandler()

    // handlerTimeout: 设置足够大，实际超时由我们自己的 MAX_WAIT_MS 控制
    await this.#bot.launch({ handlerTimeout: MAX_WAIT_MS + 30_000 })
    this.#started = true
    this.#running = true
    log.info(`Telegram Bot 已启动 (long polling, handlerTimeout=${(MAX_WAIT_MS + 30_000) / 1000}s)`)
  }

  async stop() {
    this.#bot.stop('Muse shutdown')
    this.#running = false
    this.#started = false
    this.#userSessions.clear()
    log.info('Telegram Bot 已停止')
  }

  async health() {
    return {
      ok: this.#running,
      detail: {
        activeSessions: this.#userSessions.size,
        uptime: Math.floor((Date.now() - this.#startTime) / 1000),
      },
    }
  }

  // --- 中间件 ---

  #registerMiddleware() {
    // 私聊限制: Phase 1 只支持私聊
    this.#bot.use(async (ctx, next) => {
      if (ctx.chat?.type !== 'private') return
      await next()
    })

    // 白名单检查: 空列表 = 开发模式 (允许所有用户)
    this.#bot.use(async (ctx, next) => {
      if (!ctx.from?.id) {
        log.warn('收到缺少 from.id 的更新，跳过')
        return
      }
      const userId = String(ctx.from.id)
      const allowed = this.#config.telegram.allowedUsers
      if (allowed.length > 0 && !allowed.includes(userId)) {
        log.warn(`拒绝未授权用户: ${userId}`)
        return  // 静默忽略
      }
      await next()
    })
  }

  // --- 命令系统 ---

  #registerCommands() {
    this.#bot.command('start', async (ctx) => {
      await ctx.reply(
        '你好！我是 Muse ✨\n\n' +
        '直接发消息就可以和我聊天。\n' +
        '发 /help 查看所有命令。',
      )
    })

    this.#bot.command('help', async (ctx) => {
      await ctx.reply(
        '📋 命令列表\n\n' +
        '/start - 欢迎\n' +
        '/status - 系统状态\n' +
        '/reset - 新建对话\n' +
        '/memory - 查看记忆 (待开发)\n' +
        '/identity - 身份信息 (待开发)\n' +
        '/help - 显示此列表',
      )
    })

    this.#bot.command('status', async (ctx) => {
      try {
        const h = await this.#orchestrator.health()
        const uptime = Math.floor((Date.now() - this.#startTime) / 1000)
        const lines = [
          '📊 系统状态',
          '',
          `🧠 引擎: ${h.detail.engine.ok ? '✅ 运行中' : '❌ 不可用'}`,
          `💾 记忆: ${h.detail.memory.ok ? '✅ 正常' : '❌ 不可用'}`,
          `👤 身份: ${h.detail.identity.ok ? '✅ 已加载' : '❌ 未加载'}`,
          `⏱ 运行时间: ${uptime}s`,
          `💬 活跃会话: ${this.#userSessions.size}`,
        ]
        await ctx.reply(lines.join('\n'))
      } catch (e) {
        log.error('获取状态失败:', e.message)
        await ctx.reply('⚠️ 暂时无法获取系统状态，请稍后再试。')
      }
    })

    this.#bot.command('reset', async (ctx) => {
      const userId = String(ctx.from.id)
      this.#userSessions.delete(userId)
      await ctx.reply('🔄 已创建新对话。')
      log.info(`用户 ${userId} 重置了 session`)
    })

    this.#bot.command('memory', async (ctx) => {
      await ctx.reply('🧠 记忆查看功能开发中，敬请期待...')
    })

    this.#bot.command('identity', async (ctx) => {
      await ctx.reply('👤 身份查看功能开发中，敬请期待...')
    })

    this.#bot.command('id', async (ctx) => {
      await ctx.reply(`你的 Telegram User ID: ${ctx.from.id}`)
    })
  }

  // --- 消息处理 (先回后补) ---

  #registerMessageHandler() {
    this.#bot.on('text', async (ctx) => {
      const userId = String(ctx.from.id)
      const chatId = String(ctx.chat.id)
      const text = ctx.message.text
      const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')

      log.info(`[telegram] 📩 收到消息: user=${userId} (${userName}) chat=${chatId}`)
      log.info(`[telegram]   text="${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`)

      // [1] 立即发送占位消息
      let placeholderMsg
      try {
        placeholderMsg = await ctx.reply('🤔 思考中...')
      } catch (e) {
        log.error(`[telegram] ✖ 发送占位消息失败: ${e.message}`)
        return
      }
      const placeholderId = placeholderMsg.message_id

      // [2] 启动进度更新 (定时编辑占位消息 + typing 刷新)
      const startTime = Date.now()
      let progressCount = 0
      let aborted = false

      const progressTimer = setInterval(async () => {
        if (aborted) return
        progressCount++
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        const frame = THINKING_FRAMES[progressCount % THINKING_FRAMES.length]
        const progressText = `${frame} 思考中... (${elapsed}s)`
        try {
          await ctx.sendChatAction('typing')
          await ctx.telegram.editMessageText(
            chatId, placeholderId, undefined, progressText,
          )
        } catch {
          // 编辑失败不影响主流程 (可能消息已被替换)
        }
      }, PROGRESS_INTERVAL_MS)

      // [3] 后台执行 Orchestrator
      try {
        const sessionId = this.#userSessions.get(userId) || undefined
        log.info(`[telegram]   session=${sessionId || '(新建)'}`)

        const result = await this.#orchestrator.handleMessage(text, {
          sessionId,
          source: 'telegram',
          timeoutMs: MAX_WAIT_MS,
        })

        aborted = true
        clearInterval(progressTimer)

        // 保存 session 映射
        this.#userSessions.set(userId, result.sessionId)

        const elapsed = Math.round((Date.now() - startTime) / 1000)
        log.info(`[telegram] 📤 发送回复: user=${userId} len=${result.text.length} model=${result.model} elapsed=${elapsed}s`)

        // [4] 编辑占位消息为最终回复
        await this.#editOrResend(ctx, chatId, placeholderId, result.text)
        log.info(`[telegram] ✅ 回复已送达: user=${userId}`)
      } catch (e) {
        aborted = true
        clearInterval(progressTimer)

        const elapsed = Math.round((Date.now() - startTime) / 1000)
        log.error(`[telegram] ✖ 消息处理失败: user=${userId} error=${e.message} elapsed=${elapsed}s`)
        log.error(`[telegram]   stack: ${e.stack?.split('\n').slice(0, 3).join(' → ')}`)

        // 编辑占位消息为错误提示
        const errMsg = elapsed >= MAX_WAIT_MS / 1000
          ? `⚠️ 思考了 ${elapsed}s 还没搞定，可能问题太复杂了。再试一次或者换个问法？`
          : '⚠️ 抱歉，处理消息时出了点问题，请稍后再试。'
        try {
          await ctx.telegram.editMessageText(chatId, placeholderId, undefined, errMsg)
        } catch {
          await ctx.reply(errMsg).catch(() => {})
        }
      }
    })
  }

  /**
   * 编辑占位消息为最终回复，超长时删除占位并重新发送分段消息
   */
  async #editOrResend(ctx, chatId, messageId, text) {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      // 短消息: 直接编辑占位消息
      try {
        await ctx.telegram.editMessageText(chatId, messageId, undefined, text)
        return
      } catch (e) {
        // 编辑失败 (如消息已被删) → fallback 到重新发送
        log.warn(`[telegram] 编辑消息失败，回退到重发: ${e.message}`)
      }
    }

    // 长消息 or 编辑失败: 删除占位消息，分段发送
    try {
      await ctx.telegram.deleteMessage(chatId, messageId)
    } catch {
      // 删除失败不影响
    }
    await this.#sendLongMessage(ctx, text)
  }

  // --- 长消息分割 ---

  async #sendLongMessage(ctx, text) {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      await ctx.reply(text)
      return
    }

    const chunks = splitMessage(text, MAX_MESSAGE_LENGTH)
    for (const chunk of chunks) {
      await ctx.reply(chunk)
    }
  }
}

// --- Utilities (exported for testing) ---

/**
 * 按语义边界分割长文本
 * 优先级: 双换行(段落) → 单换行 → 空格 → 硬截断
 */
export function splitMessage(text, maxLen = MAX_MESSAGE_LENGTH) {
  const chunks = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // 优先按双换行分割（段落边界）
    let splitAt = remaining.lastIndexOf('\n\n', maxLen)
    // 退而求其次按单换行分割
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', maxLen)
    // 再退化按空格分割
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(' ', maxLen)
    // 最终硬截断
    if (splitAt <= 0) splitAt = maxLen

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}

export { MAX_MESSAGE_LENGTH }
