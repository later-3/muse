/**
 * T31: Pulse Actions — Pulse trigger callback implementation
 *
 * Dispatches trigger actions: creates AI session, generates proactive
 * message via Engine, pushes via Telegram, updates PulseState.
 *
 * Dependencies: engine, telegram, pulse, identity
 */
import { createLogger } from '../logger.mjs'

const log = createLogger('pulse-actions')

/**
 * Dispatch a Pulse trigger action
 * @param {object} trigger - { id, interval, action }
 * @param {object} modules - { engine, telegram, pulse, identity, goals, threads }
 */
export async function dispatch(trigger, modules) {
  const { engine, telegram, pulse, identity, goals, threads } = modules
  const chatIds = pulse.state?.knownChatIds || []

  log.info(`dispatch: trigger=${trigger.id}, action=${trigger.action}, chatIds=${chatIds.length}`)

  // T36: threadWeave — background batch classification (no push, no chatIds needed)
  if (trigger.action === 'threadWeave') {
    if (!threads) {
      log.warn('Threads 模块不可用，跳过 threadWeave')
      return
    }
    try {
      const { ThreadWeaver } = await import('./thread-weaver.mjs')
      const weaver = new ThreadWeaver({ threads, engine })
      await weaver.weave()
    } catch (e) {
      log.warn(`threadWeave 失败: ${e.message}`)
    }
    return
  }

  if (chatIds.length === 0) {
    log.warn(`无已知 chatId，跳过主动推送 (trigger=${trigger.id})`)
    return
  }

  // T35: goalCheck — AI reads goals and decides whether to remind
  if (trigger.action === 'goalCheck') {
    if (!goals) {
      log.warn(`Goals 模块不可用，跳过 goalCheck`)
      return
    }
    const active = goals.getActive()
    if (active.length === 0) {
      log.debug(`无 active 目标，跳过 goalCheck`)
      return
    }

    const overdue = goals.getOverdue()
    const session = await engine.createSession()
    log.info(`goalCheck: ${active.length} 个活跃目标, ${overdue.length} 个超期`)

    const goalSummary = active.map(g => {
      let line = `- "${g.title}" 进度=${g.progress}%`
      if (g.deadline) line += ` 截止=${g.deadline}`
      if (overdue.some(o => o.id === g.id)) line += ' ⚠️超期'
      return line
    }).join('\n')

    const basePrompt = identity.buildSystemPrompt()
    const result = await engine.sendAndWait(session.id,
      `用户当前的目标:\n${goalSummary}\n\n请判断：现在有没有值得关心或提醒的目标？如果有，用 1-3 句话关心一下。如果没有特别的，回复空字符串。`,
      {
        system: basePrompt + '\n\n你在检查用户的目标进度。只在真正需要时才提醒，不要每次都发消息。',
        timeoutMs: 30_000,
      },
    )

    if (result.text?.trim()) {
      log.info(`goalCheck 生成消息: "${result.text.slice(0, 50)}"`)
      const pushResult = await telegram.sendProactive(result.text, { chatIds })
      if (pushResult.sent > 0) {
        pulse.pulseState.incrementUnresponsed()
      }
    } else {
      log.debug(`goalCheck: AI 判断不需要提醒`)
    }
    return
  }

  // 1. Create AI Session
  const session = await engine.createSession()
  log.info(`创建 AI Session: ${session.id} (trigger=${trigger.id})`)

  // 2. Build system prompt from Identity (reuse buildSystemPrompt for full persona + boundaries)
  const basePrompt = identity.buildSystemPrompt()
  const systemPrompt = basePrompt + '\n\n你现在要主动给用户发一条消息。要求：简短温暖，1-3 句话，带 emoji。'

  // 3. Scenario message (as text to sendAndWait)
  const now = new Date()
  const hour = now.getHours()
  const scenario = trigger.action === 'greet'
    ? `现在是${hour}点，请生成一条关心用户的日常问候`
    : `请根据动作 "${trigger.action}" 生成一条主动消息`

  // 4. AI generates message
  //    text = scenario (user message slot)
  //    opts.system = full persona + boundaries + proactive instruction
  const result = await engine.sendAndWait(session.id, scenario, {
    system: systemPrompt,
    timeoutMs: 30_000,
  })

  if (!result.text?.trim()) {
    log.warn(`AI 生成空消息，跳过推送 (trigger=${trigger.id}, session=${session.id})`)
    return
  }

  log.info(`AI 生成消息: "${result.text.slice(0, 50)}" (trigger=${trigger.id})`)

  // 5. Push via Telegram
  const pushResult = await telegram.sendProactive(result.text, { chatIds })

  // 6. Update state — only if at least one message was actually sent
  if (pushResult.sent > 0) {
    pulse.pulseState.incrementUnresponsed()
  } else {
    log.warn(`所有推送失败，不递增未回复计数 (trigger=${trigger.id})`)
  }
}
