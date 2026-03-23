import { Telegraf } from 'telegraf'
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../logger.mjs'
import { TelegramSense, UNSUPPORTED_TG_TYPES } from '../perception/telegram-sense.mjs'

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
  #ingress
  #modules
  #pulseState
  #tts
  #channel
  #startTime
  #running = false
  #started = false
  #botUsername = ''  // 群聊 @mention 检测用

  /** 实例私有 session 映射: userId → sessionId */
  #userSessions = new Map()

  /**
   * @param {object} config
   * @param {object} orchestrator
   * @param {object} [options]
   * @param {object} [options.bot] - 可选 bot 注入 (测试用)
   * @param {object} [options.pulseState] - T31: PulseState 实例 (可选)
   * @param {object} [options.tts] - T38: TextToSpeech 实例 (可选)
   * @param {object} [options.channel] - TelegramChannel 实例 (可选)
   */
  constructor(config, orchestrator, { bot, ingress, modules, pulseState, tts, channel } = {}) {
    this.#config = config
    this.#orchestrator = orchestrator
    this.#ingress = ingress || null
    this.#modules = modules || null
    this.#pulseState = pulseState || null
    this.#tts = tts || null
    this.#channel = channel || null
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

    // 获取 bot username 用于群聊 @mention 检测
    try {
      const botInfo = await this.#bot.telegram.getMe()
      this.#botUsername = botInfo.username?.toLowerCase() || ''
      log.info(`[telegram] Bot username: @${this.#botUsername}`)
    } catch (e) {
      log.warn(`[telegram] 获取 bot username 失败: ${e.message}, 群聊 @mention 检测将不生效`)
      this.#botUsername = ''
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
    // 私聊: 直接通过
    // 群聊: 需要被 @ 才会处理 (在消息 handler 中检测)
    // 这里不做限制，放到消息 handler 中判断

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

  /**
   * TG-GROUP-001: 解析消息中的 mention，精确识别是否被@的是自己
   * @param {object} ctx - Telegraf context
   * @returns {{isMentioned: boolean, targetBot: string|null, isBroadcast: boolean}} 解析结果
   */
  #parseMention(ctx) {
    const text = ctx.message?.text || ''
    const entities = ctx.message?.entities || []
    const caption = ctx.message?.caption || ''
    const captionEntities = ctx.message?.caption_entities || []

    let isMentioned = false      // 是否被@的是自己
    let targetBot = null         // 被@的bot username（如果有）

    // 处理所有 entities（message text 和 caption）
    const allEntities = [...entities, ...captionEntities]

    for (const entity of allEntities) {
      const sourceText = entity.offset >= text.length ? caption : text
      const offset = entity.offset >= text.length ? entity.offset - text.length : entity.offset

      if (entity.type === 'mention') {
        // @username 格式
        const mentionText = sourceText.slice(offset, offset + entity.length)
        const mentionedUsername = mentionText.slice(1).toLowerCase()
        if (!targetBot) {
          targetBot = mentionedUsername
        }
        // 检查是否是@自己
        if (mentionedUsername === this.#botUsername.toLowerCase()) {
          isMentioned = true
        }
      }
      if (entity.type === 'bot_command') {
        const cmdText = sourceText.slice(offset, offset + entity.length)
        // 检查是否是 @自己的命令
        if (cmdText.includes(`@${this.#botUsername}`)) {
          isMentioned = true
          targetBot = this.#botUsername
        }
      }
      // text_mention: 某些客户端直接引用用户
      if (entity.type === 'text_mention' && entity.user?.username) {
        const mentionedUsername = entity.user.username.toLowerCase()
        if (!targetBot) {
          targetBot = mentionedUsername
        }
        if (mentionedUsername === this.#botUsername.toLowerCase()) {
          isMentioned = true
        }
      }
    }

    // 检查是否是回复本 bot 的消息
    const replyToUsername = ctx.message?.reply_to_message?.from?.username
    if (replyToUsername) {
      const replyUsernameLower = replyToUsername.toLowerCase()
      if (!targetBot) {
        targetBot = replyUsernameLower
      }
      if (replyUsernameLower === this.#botUsername.toLowerCase()) {
        isMentioned = true
      }
    }

    // 广播 = 没有@任何人 且 没有被回复消息指向特定人
    const isBroadcast = !targetBot && !isMentioned

    return { isMentioned, targetBot, isBroadcast }
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
        '/wf - 工作流指令 (init/status/approve/reject/abort)\n' +
        '/memory - 查看记忆 (待开发)\n' +
        '/identity - 身份信息 (待开发)\n' +
        '/help - 显示此列表',
      )
    })

    this.#bot.command('status', async (ctx) => {
      try {
        const uptime = Math.floor((Date.now() - this.#startTime) / 1000)

        // 优先用 selfCheck()，降级到 orchestrator.health()
        if (this.#modules?.selfCheck) {
          const report = await this.#modules.selfCheck()
          const lines = [
            `${report.overall} Muse 体检报告`,
            '',
            '— 系统 —',
          ]

          // L1: System Health
          for (const [name, check] of Object.entries(report.system)) {
            lines.push(`${check.status} ${this.#labelFor(name)}: ${check.detail}`)
          }

          // L2: Self Model
          if (report.selfModel) {
            lines.push('', '— 自我认知 —')
            if (report.selfModel.capabilityRegistry) {
              const r = report.selfModel.capabilityRegistry
              lines.push(`${r.status} 能力: ${r.senseCount} 感知 / ${r.capCount} 能力`)
            }
            if (report.selfModel.knownGaps) {
              const g = report.selfModel.knownGaps
              lines.push(`${g.status} 已知缺口: ${g.total} 个`)
            }
            if (report.selfModel.routeCoverage) {
              const rc = report.selfModel.routeCoverage
              lines.push(`${rc.status} 路由: ${rc.detail}`)
            }
          }

          // L3: Life (预留)
          if (report.life?._note) {
            lines.push('', `⏳ 生命质感: ${report.life._note}`)
          }

          lines.push('', `⏱ 运行: ${uptime}s | 💬 会话: ${this.#userSessions.size}`)
          await ctx.reply(lines.join('\n'))
        } else {
          // 降级: selfCheck 未注入时用旧逻辑
          const h = await this.#orchestrator.health()
          const lines = [
            '📊 Muse 体检摘要',
            '',
            `🧠 引擎: ${h.detail.engine.ok ? '✅' : '❌'}`,
            `👤 身份: ${h.detail.identity.ok ? '✅' : '❌'}`,
            `💬 会话: ${this.#userSessions.size}`,
            `⏱ 运行: ${uptime}s`,
          ]
          await ctx.reply(lines.join('\n'))
        }
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

    // T39: 工作流指令
    this.#bot.command('wf', async (ctx) => {
      try {
        await this.#handleWorkflowCommand(ctx)
      } catch (e) {
        log.error(`[telegram] /wf 指令错误: ${e.message}`)
        await ctx.reply(`⚠️ 工作流指令错误: ${e.message}`)
      }
    })
  }

  // --- T39: 工作流 Telegram 指令 ---

  async #handleWorkflowCommand(ctx) {
    const text = ctx.message.text || ''
    const parts = text.replace(/^\/wf\s*/, '').trim().split(/\s+/)
    const sub = parts[0] || ''

    // 延迟导入避免循环依赖
    const { getRegistry } = await import('../workflow/registry.mjs')

    switch (sub) {
      case 'init': {
        // /wf init <workflow-path> <task-id>
        const wfPath = parts[1]
        const taskId = parts[2] || `wf-${Date.now()}`
        if (!wfPath) {
          await ctx.reply('用法: /wf init <workflow.json路径> [task-id]')
          return
        }

        const { initWorkflow } = await import('../workflow/loader.mjs')
        const workspaceRoot = process.env.MUSE_ROOT || process.cwd()

        // 从工作流定义自动读 participants，每个 role 绑一个虚拟 session
        const { readFile } = await import('node:fs/promises')
        const { resolve, isAbsolute: isAbs } = await import('node:path')
        const fullPath = isAbs(wfPath) ? wfPath : resolve(workspaceRoot, wfPath)
        const raw = JSON.parse(await readFile(fullPath, 'utf-8'))
        const bindings = (raw.participants || []).map(p => ({
          role: p.role,
          sessionId: `tg_${p.role}_${Date.now()}`,
        }))

        const { sm } = await initWorkflow({
          workflowPath: fullPath,
          taskId,
          workspaceRoot,
          bindings,
        })

        // T39: 保存状态到文件，供 OpenCode plugin 子进程加载
        const { saveWorkflowState } = await import('../workflow/bridge.mjs')
        saveWorkflowState(sm, bindings, fullPath)

        // 回复用户工作流已初始化
        const node = sm.getCurrentNode()
        const nodeLines = [
          `✅ 工作流已启动: ${raw.name || raw.id}`,
          `📍 当前节点: ${node.id} (${node.participant} 负责)`,
          '',
          `🎯 目标: ${node.objective || '(未定义)'}`,
        ]
        if (node.instructions?.length) {
          nodeLines.push('📝 步骤:')
          node.instructions.forEach((s, i) => nodeLines.push(`  ${i + 1}. ${s}`))
        }
        if (node.constraints?.length) {
          nodeLines.push('⚠️ 约束:')
          node.constraints.forEach(c => nodeLines.push(`  - ${c}`))
        }
        nodeLines.push('', '下次你发消息给我，我会在工作流上下文中回复你。')
        await ctx.reply(nodeLines.join('\n'))
        break
      }

      case 'status': {
        const registry = getRegistry()
        if (!registry || registry.size === 0) {
          await ctx.reply('📭 当前没有运行中的工作流\n\n发 /wf init <path> 初始化')
          return
        }

        const instances = registry.listInstances()
        const lines = ['📊 工作流状态\n']

        for (const inst of instances) {
          const sm = registry.getInstance(inst.instanceId)
          const node = sm?.getCurrentNode()
          lines.push(`🏷 ${inst.workflowId} (${inst.status})`)
          lines.push(`  实例: ${inst.instanceId}`)
          lines.push(`  节点: ${node?.id || '?'} (${node?.type || '?'})`)
          if (node?.objective) lines.push(`  目标: ${node.objective}`)
          if (node?.participant) lines.push(`  参与者: ${node.participant}`)

          // 显示可用 transition
          if (node?.transitions) {
            const trans = Object.entries(node.transitions)
              .map(([e, t]) => `${e}→${t.target} (${t.actor})`)
              .join(', ')
            lines.push(`  流转: ${trans}`)
          }
          lines.push('')
        }

        await ctx.reply(lines.join('\n'))
        break
      }

      case 'approve':
      case 'reject': {
        const registry = getRegistry()
        if (!registry || registry.size === 0) {
          await ctx.reply('📭 没有运行中的工作流')
          return
        }

        // 找第一个有 user-actor transition 的实例
        const instances = registry.listInstances()
        let handled = false

        for (const inst of instances) {
          const sm = registry.getInstance(inst.instanceId)
          if (!sm || sm.status !== 'running') continue
          const node = sm.getCurrentNode()
          if (!node?.transitions) continue

          const event = sub === 'approve' ? 'approve' : 'reject'
          if (node.transitions[event]?.actor === 'user') {
            try {
              const result = sm.transition(event, 'user')
              await ctx.reply(
                `✅ ${sub === 'approve' ? '已批准' : '已拒绝'}\n\n` +
                `${result.from} → ${result.to}\n` +
                `状态: ${sm.status}\n` +
                `节点: ${sm.currentNodeId}`,
              )
              handled = true
              log.info(`[telegram] /wf ${sub}`, { instance: inst.instanceId, from: result.from, to: result.to })
            } catch (e) {
              await ctx.reply(`❌ 流转失败: ${e.message}`)
              handled = true
            }
            break
          }
        }

        if (!handled) {
          await ctx.reply(`📭 当前没有等待 ${sub} 的工作流节点`)
        }
        break
      }

      case 'abort': {
        const registry = getRegistry()
        if (!registry || registry.size === 0) {
          await ctx.reply('📭 没有运行中的工作流')
          return
        }

        const instances = registry.listInstances().filter(i => i.status === 'running')
        if (!instances.length) {
          await ctx.reply('📭 没有运行中的工作流')
          return
        }

        const { shutdownWorkflow } = await import('../workflow/loader.mjs')
        for (const inst of instances) {
          shutdownWorkflow(inst.instanceId)
        }
        await ctx.reply(`⏹ 已终止 ${instances.length} 个工作流实例`)
        break
      }

      default:
        await ctx.reply(
          '📋 /wf 工作流指令\n\n' +
          '/wf init <path> [taskId] - 初始化工作流\n' +
          '/wf status - 查看工作流状态\n' +
          '/wf approve - 批准 (审核节点)\n' +
          '/wf reject - 拒绝 (审核节点)\n' +
          '/wf abort - 终止所有工作流',
        )
    }
  }

  // --- T31: 主动推送 ---

  /**
   * Send proactive message to known chatIds
   * @param {string} text - message text
   * @param {object} opts
   * @param {string[]} opts.chatIds - target chat IDs
   */
  async sendProactive(text, { chatIds = [] } = {}) {
    if (!chatIds.length) {
      log.warn('[telegram] sendProactive: 无目标 chatId，跳过')
      return { sent: 0, failed: 0 }
    }

    // Truncate if too long
    const safeText = text.length > MAX_MESSAGE_LENGTH
      ? text.slice(0, MAX_MESSAGE_LENGTH - 3) + '...'
      : text

    let sent = 0, failed = 0
    for (const chatId of chatIds) {
      try {
        await this.#bot.telegram.sendMessage(chatId, safeText)
        sent++
        log.info(`[telegram] 主动推送: chatId=${chatId} len=${safeText.length}`)
      } catch (e) {
        failed++
        log.warn(`[telegram] 主动推送失败: chatId=${chatId} ${e.message}`)
      }
    }
    return { sent, failed }
  }

  // --- 消息处理 (先回后补) ---

  #registerMessageHandler() {
    this.#bot.on('text', async (ctx) => {
      const userId = String(ctx.from.id)
      const chatId = String(ctx.chat.id)
      const chatType = ctx.chat?.type || 'private'
      const text = ctx.message.text
      const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')

      // 跳过 / 命令消息（已由 bot.command() 处理）
      if (text.startsWith('/')) {
        log.info(`[telegram] 跳过命令消息: "${text.slice(0, 50)}"`)
        return
      }

      // TG-GROUP-001: 群聊消息处理逻辑
      const { isMentioned, targetBot, isBroadcast } = this.#parseMention(ctx)
      const enableBroadcast = this.#config.telegram?.enableBroadcast ?? false

      if (chatType !== 'private') {
        // 被@了但不是@我，忽略
        if (targetBot && !isMentioned) {
          log.info({
            type: 'group_message',
            chatId,
            sender: userId,
            senderName: userName,
            text: text.slice(0, 100),
            isMentioned: false,
            targetBot,
            action: 'ignored_not_me',
            chatType
          })
          return
        }

        // 广播模式关闭，且没有@我，忽略
        if (!isMentioned && !enableBroadcast) {
          log.info({
            type: 'group_message',
            chatId,
            sender: userId,
            senderName: userName,
            text: text.slice(0, 100),
            isMentioned: false,
            targetBot: null,
            action: 'ignored_broadcast_disabled',
            chatType
          })
          return
        }

        // 记录群聊消息日志
        log.info({
          type: 'group_message',
          chatId,
          sender: userId,
          senderName: userName,
          text: text.slice(0, 100),
          isMentioned,
          targetBot,
          isBroadcast,
          action: isMentioned ? 'directed' : (isBroadcast ? 'broadcast' : 'processed'),
          chatType,
          enableBroadcast
        })
      }

      // T31: chatId 采集 + 未回复归零
      if (this.#pulseState) {
        this.#pulseState.addChatId(chatId)
        this.#pulseState.resetUnresponsed()
      }

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

      // [3] 通过 Perception Ingress 或直连 Orchestrator
      try {
        const sessionId = this.#userSessions.get(userId) || undefined
        log.info(`[telegram]   session=${sessionId || '(新建)'}`)

        let result
        if (this.#ingress) {
          // T14: text 走统一感知流水线
          const perception = TelegramSense.fromTextMessage(ctx)
          result = await this.#ingress.handle(perception, {
            sessionId,
            timeoutMs: MAX_WAIT_MS,
          })
        } else {
          // 降级: ingress 未注入时直连 Orchestrator
          result = await this.#orchestrator.handleMessage(text, {
            sessionId,
            source: 'telegram',
            timeoutMs: MAX_WAIT_MS,
          })
        }

        aborted = true
        clearInterval(progressTimer)

        // 保存 session 映射
        this.#userSessions.set(userId, result.sessionId)

        const elapsed = Math.round((Date.now() - startTime) / 1000)
        log.info(`[telegram] 📤 发送回复: user=${userId} len=${result.text.length} elapsed=${elapsed}s`)

        // [4] 编辑占位消息为最终回复 (支持图片回复)
        await this.#deliverReply(ctx, chatId, placeholderId, result.text)
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

    // T14: photo handler — 图片消息
    this.#bot.on('photo', async (ctx) => {
      const userId = String(ctx.from.id)
      const chatId = String(ctx.chat.id)
      const chatType = ctx.chat?.type || 'private'
      const caption = ctx.message.caption || ''
      const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')

      // TG-GROUP-001: 群聊图片消息处理
      const { isMentioned, targetBot, isBroadcast } = this.#parseMention(ctx)
      const enableBroadcast = this.#config.telegram?.enableBroadcast ?? false

      if (chatType !== 'private') {
        if (targetBot && !isMentioned) {
          log.info({
            type: 'group_message', chatId, sender: userId, senderName: userName,
            caption: caption.slice(0, 100), isMentioned: false, targetBot,
            action: 'ignored_not_me', chatType, msgType: 'photo'
          })
          return
        }
        if (!isMentioned && !enableBroadcast) {
          log.info({
            type: 'group_message', chatId, sender: userId, senderName: userName,
            caption: caption.slice(0, 100), isMentioned: false, targetBot: null,
            action: 'ignored_broadcast_disabled', chatType, msgType: 'photo'
          })
          return
        }
        log.info({
          type: 'group_message', chatId, sender: userId, senderName: userName,
          caption: caption.slice(0, 100), isMentioned, targetBot, isBroadcast,
          action: isMentioned ? 'directed' : 'broadcast', chatType, msgType: 'photo', enableBroadcast
        })
      }

      log.info(`[telegram] 📷 收到图片: user=${userId} caption="${caption.slice(0, 50)}"`)

      if (!this.#ingress) {
        await ctx.reply('暂不支持图片处理')
        return
      }

      // reply-first
      let placeholderMsg
      try {
        placeholderMsg = await ctx.reply('🤔 看看图片...')
      } catch (e) {
        log.error(`[telegram] ✖ 发送占位消息失败: ${e.message}`)
        return
      }

      try {
        const sessionId = this.#userSessions.get(userId) || undefined
        const perception = TelegramSense.fromPhotoMessage(ctx)
        const result = await this.#ingress.handle(perception, { sessionId })

        if (result.sessionId) {
          this.#userSessions.set(userId, result.sessionId)
        }

        await this.#deliverReply(ctx, chatId, placeholderMsg.message_id, result.text)
        log.info(`[telegram] ✅ 图片回复已送达: user=${userId}`)
      } catch (e) {
        log.error(`[telegram] ✖ 图片处理失败: user=${userId} error=${e.message}`)
        try {
          await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, undefined, '⚠️ 抱歉，处理图片时出了点问题。')
        } catch { await ctx.reply('⚠️ 抱歉，处理图片时出了点问题。').catch(() => {}) }
      }
    })

    // T38: voice/audio handler — 语音消息 (和图片一样: 下载→本地→AI 多模态理解)
    const voiceHandler = async (ctx) => {
      const userId = String(ctx.from.id)
      const chatId = String(ctx.chat.id)
      const chatType = ctx.chat?.type || 'private'
      const voice = ctx.message.voice || ctx.message.audio
      const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')

      // TG-GROUP-001: 群聊语音消息处理
      const { isMentioned, targetBot, isBroadcast } = this.#parseMention(ctx)
      const enableBroadcast = this.#config.telegram?.enableBroadcast ?? false

      if (chatType !== 'private') {
        if (targetBot && !isMentioned) {
          log.info({
            type: 'group_message', chatId, sender: userId, senderName: userName,
            isMentioned: false, targetBot, action: 'ignored_not_me',
            chatType, msgType: 'voice'
          })
          return
        }
        if (!isMentioned && !enableBroadcast) {
          log.info({
            type: 'group_message', chatId, sender: userId, senderName: userName,
            isMentioned: false, targetBot: null, action: 'ignored_broadcast_disabled',
            chatType, msgType: 'voice'
          })
          return
        }
        log.info({
          type: 'group_message', chatId, sender: userId, senderName: userName,
          isMentioned, targetBot, isBroadcast,
          action: isMentioned ? 'directed' : 'broadcast',
          chatType, msgType: 'voice', enableBroadcast
        })
      }

      log.info(`[telegram] 🎤 收到语音: user=${userId} duration=${voice?.duration}s size=${voice?.file_size}B`)

      // T31: chatId 采集 + 未回复归零
      if (this.#pulseState) {
        this.#pulseState.addChatId(chatId)
        this.#pulseState.resetUnresponsed()
      }

      if (!this.#ingress) {
        await ctx.reply('暂不支持语音处理')
        return
      }

      // reply-first
      let placeholderMsg
      try {
        placeholderMsg = await ctx.reply('🎧 听语音中...')
      } catch (e) {
        log.error(`[telegram] ✖ 发送占位消息失败: ${e.message}`)
        return
      }

      try {
        const sessionId = this.#userSessions.get(userId) || undefined

        // 构建 PerceptionObject — 带 fileId 给 Ingress 下载
        const perception = TelegramSense.fromAudioMessage(ctx, '')
        const result = await this.#ingress.handle(perception, {
          sessionId,
          timeoutMs: MAX_WAIT_MS,
        })

        if (result.sessionId) {
          this.#userSessions.set(userId, result.sessionId)
        }

        // T38: 语音回复 — 用户发语音, Muse 也用语音回
        const replied = await this.#tryVoiceReply(ctx, chatId, placeholderMsg.message_id, result.text)
        if (!replied) {
          // TTS 失败 → 降级为文字回复
          await this.#editOrResend(ctx, chatId, placeholderMsg.message_id, result.text)
        }
        log.info(`[telegram] ✅ 语音回复已送达: user=${userId} mode=${replied ? 'voice' : 'text'}`)

      } catch (e) {
        log.error(`[telegram] ✖ 语音处理失败: user=${userId} error=${e.message}`)
        try {
          await ctx.telegram.editMessageText(
            chatId, placeholderMsg.message_id, undefined,
            '⚠️ 抱歉，处理语音时出了点问题。')
        } catch { await ctx.reply('⚠️ 抱歉，处理语音时出了点问题。').catch(() => {}) }
      }
    }
    this.#bot.on('voice', voiceHandler)
    this.#bot.on('audio', voiceHandler)

    // T14: unsupported type handlers — 视频/文件等 (T38: voice/audio 已移出)
    for (const tgType of UNSUPPORTED_TG_TYPES) {
      this.#bot.on(tgType, async (ctx) => {
        const userId = String(ctx.from.id)
        const chatId = String(ctx.chat.id)
        const chatType = ctx.chat?.type || 'private'
        const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')

        // TG-GROUP-001: 群聊不支持类型处理
        const { isMentioned, targetBot, isBroadcast } = this.#parseMention(ctx)
        const enableBroadcast = this.#config.telegram?.enableBroadcast ?? false

        if (chatType !== 'private') {
          if (targetBot && !isMentioned) {
            log.info({
              type: 'group_message', chatId, sender: userId, senderName: userName,
              isMentioned: false, targetBot, action: 'ignored_not_me',
              chatType, msgType: tgType
            })
            return
          }
          if (!isMentioned && !enableBroadcast) {
            log.info({
              type: 'group_message', chatId, sender: userId, senderName: userName,
              isMentioned: false, targetBot: null, action: 'ignored_broadcast_disabled',
              chatType, msgType: tgType
            })
            return
          }
          log.info({
            type: 'group_message', chatId, sender: userId, senderName: userName,
            isMentioned, targetBot, isBroadcast,
            action: isMentioned ? 'directed' : 'broadcast',
            chatType, msgType: tgType, enableBroadcast
          })
        }

        log.info(`[telegram] ⚠️ 收到不支持的类型: ${tgType} user=${userId}`)

        if (this.#ingress) {
          const perception = TelegramSense.fromUnsupportedMessage(ctx, tgType)
          const result = await this.#ingress.handle(perception)
          await ctx.reply(result.text)
        } else {
          await ctx.reply('抱歉，我暂时只能处理文字消息哦～')
        }
      })
    }
  }

  /**
   * 根据回复内容自动选择文本或图片发送
   */
  async #deliverReply(ctx, chatId, messageId, text) {
    const imageReply = parseImageReply(text)
    if (!imageReply) {
      await this.#editOrResend(ctx, chatId, messageId, text)
      return
    }

    if (!this.#channel) {
      log.warn('[telegram] 回复包含图片，但 channel 未注入，回退文本发送')
      await this.#editOrResend(ctx, chatId, messageId, text)
      return
    }

    const safeCaption = imageReply.caption.length > 1024
      ? imageReply.caption.slice(0, 1021) + '...'
      : imageReply.caption

    const photoSource = await resolvePhotoSource(imageReply.src)
    const sendResult = await this.#channel.sendPhoto(chatId, photoSource, { caption: safeCaption })
    if (!sendResult.ok) {
      log.warn(`[telegram] sendPhoto 失败，回退文本发送: ${sendResult.error}`)
      await this.#editOrResend(ctx, chatId, messageId, text)
      return
    }

    try {
      await ctx.telegram.deleteMessage(chatId, messageId)
    } catch {
      // 删除失败不影响图片结果
    }
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

  /**
   * T38: 尝试语音回复 — TTS 转语音 + sendVoice
   *
   * @param {object} ctx - Telegraf context
   * @param {string} chatId
   * @param {number} placeholderMsgId - 占位消息 ID (成功后删除)
   * @param {string} text - AI 的文字回复
   * @returns {Promise<boolean>} 是否成功发送语音
   */
  async #tryVoiceReply(ctx, chatId, placeholderMsgId, text) {
    if (!this.#tts || !this.#channel) return false

    try {
      // TTS: 文字 → ogg/opus Buffer
      const ttsResult = await this.#tts.synthesize(text)
      if (!ttsResult.ok) {
        log.warn(`[telegram] TTS 失败: ${ttsResult.error}`)
        return false
      }

      // 发送语音 (附带文字作为 caption, 方便不方便听的时候看)
      const caption = text.length > 1024 ? text.slice(0, 1021) + '...' : text
      const sendResult = await this.#channel.sendVoice(chatId, ttsResult.buffer, { caption })
      if (!sendResult.ok) {
        log.warn(`[telegram] sendVoice 失败: ${sendResult.error}`)
        return false
      }

      // 删除占位消息
      try {
        await ctx.telegram.deleteMessage(chatId, placeholderMsgId)
      } catch { /* 删除失败不影响 */ }

      log.info(`[telegram] 🔊 语音回复已发送 (engine=${ttsResult.engine})`)
      return true
    } catch (e) {
      log.warn(`[telegram] 语音回复异常: ${e.message}, 将降级为文字`)
      return false
    }
  }

  // --- selfCheck key → 中文标签 ---

  #labelFor(key) {
    const labels = {
      engine: '🧠 引擎', memory: '💾 记忆', identity: '👤 身份',
      telegram: '💬 Telegram', web: '🌐 Web', cerebellum: '🫀 小脑',
      routing: '🔀 路由', gaps: '⚠️ 缺口',
    }
    return labels[key] || key
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

/**
 * 从回复中提取第一张 markdown 图片 `![alt](src)`。
 * 返回 null 表示普通文本回复。
 */
export function parseImageReply(text) {
  if (typeof text !== 'string' || !text.includes('![')) return null
  const match = text.match(/!\[([^\]]*)\]\(([^)]+)\)/)
  if (!match) return null

  const alt = match[1].trim()
  const rawSrc = match[2].trim()
  if (!rawSrc) return null

  const src = rawSrc.startsWith('<') && rawSrc.endsWith('>')
    ? rawSrc.slice(1, -1).trim()
    : rawSrc

  const restText = text.replace(match[0], '').trim()
  const caption = (restText || alt || '🖼️').trim()

  return { src, caption }
}

async function resolvePhotoSource(src) {
  if (src.startsWith('http://') || src.startsWith('https://')) return src

  if (src.startsWith('file://')) {
    const p = fileURLToPath(src)
    return readFile(p)
  }

  const path = normalizeLocalPath(src)
  if (path && await fileExists(path)) {
    return readFile(path)
  }

  // 非本地路径：交给 Telegram API 作为 file_id 或 URL 处理
  return src
}

function normalizeLocalPath(src) {
  if (!src) return null
  if (src.startsWith('~/')) return resolve(homedir(), src.slice(2))
  if (isAbsolute(src)) return src
  if (src.startsWith('./') || src.startsWith('../')) return resolve(process.cwd(), src)
  return resolve(process.cwd(), src)
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export { MAX_MESSAGE_LENGTH }
