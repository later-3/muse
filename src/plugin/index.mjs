/**
 * T10.5: Muse Plugin — 入口
 *
 * logDir 优先级:
 *   1. MUSE_TRACE_DIR env var（family member 专属路径）
 *   2. fallback: {CWD}/data/trace (member 家目录下)
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createEventLogger } from './hooks/event-logger.mjs'
import { writeSessionContext } from '../mcp/session-context.mjs'
import { createMessageHook } from './hooks/message-hook.mjs'
import { createToolAudit, createToolStartHook } from './hooks/tool-audit.mjs'
import { createSystemPrompt } from './hooks/system-prompt.mjs'
import { TraceAggregator } from './hooks/trace-aggregator.mjs'

/**
 * T39: 工作流 transition 推送通知
 * 通过 Telegram 通知用户工作流状态变化
 */
let _tgCredentials = null
function getTgCredentials() {
  if (_tgCredentials) return _tgCredentials
  try {
    const memberDir = process.env.MUSE_MEMBER_DIR
    if (memberDir) {
      const cfg = JSON.parse(readFileSync(`${memberDir}/config.json`, 'utf-8'))
      _tgCredentials = { botToken: cfg.telegram?.botToken, chatId: cfg.telegram?.chatId }
      return _tgCredentials
    }
  } catch { /* ignore */ }
  _tgCredentials = {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  }
  return _tgCredentials
}
async function notifyWorkflowTransition(info) {
  const { botToken, chatId } = getTgCredentials()
  if (!botToken || !chatId) return

  const emoji = info.status === 'completed' ? '✅' : info.status === 'aborted' ? '⛔' : '🔄'
  const lines = [
    `${emoji} 工作流状态变更`,
    '',
    `📍 ${info.from} → ${info.to}`,
    `🏷 事件: ${info.event} (${info.status})`,
  ]

  if (info.status === 'completed') {
    lines.push('', '🎉 工作流已完成！')
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* 推送失败降级 */ }
}

export default async function musePlugin(input) {
  const { directory } = input
  const logDir = process.env.MUSE_TRACE_DIR || join(directory, 'data', 'trace')

  // 诊断日志
  console.log(`[muse-plugin] loading...`)
  console.log(`[muse-plugin]   directory: ${directory}`)
  console.log(`[muse-plugin]   MUSE_TRACE_DIR: ${process.env.MUSE_TRACE_DIR || '(not set)'}`)
  console.log(`[muse-plugin]   logDir: ${logDir}`)

  // 测试写入
  try {
    mkdirSync(logDir, { recursive: true })
    const testFile = join(logDir, '.plugin-test')
    writeFileSync(testFile, new Date().toISOString())
    console.log(`[muse-plugin]   write test: ✅`)
  } catch (e) {
    console.error(`[muse-plugin]   write test: ❌ ${e.message}`)
  }

  console.log(`[muse-plugin] loaded`)

  // P1: TraceAggregator — session 粒度聚合（供 trace-reader 查询）
  const aggregator = new TraceAggregator({ logDir })

  // event hook 需要感知 aggregator
  const eventLogger = createEventLogger({ logDir })

  // T39-1.3: plugin 初始化时重建 session-index + 恢复 registry（崩溃恢复）
  // + 自动 ACK 所有 pending handoffs（基础设施层 ACK）
  let autoAckHandoff = null
  try {
    const { rebuildIndex, restoreRegistryFromBridge } = await import('../workflow/bridge.mjs')
    const handoffMod = await import('../family/handoff.mjs')
    autoAckHandoff = handoffMod.autoAckHandoff
    rebuildIndex()
    await restoreRegistryFromBridge()  // 从 state.json 恢复内存 registry
  } catch { /* 首次启动或 bridge 未就绪，忽略 */ }

  const eventHook = async (ctx) => {
    await eventLogger(ctx)
    try {
      const { event } = ctx
      const type = event?.type
      const props = event?.properties || {}
      const sid = props.sessionID || props.info?.sessionID

      if (!sid) return

      if (type === 'session.created') {
        aggregator.onSessionCreated(sid, {})
        // 基础设施 ACK：检测到新 session 创建，如果它是 handoff 目标 session，自动 ACK
        if (autoAckHandoff) {
          try {
            const { lookupInstance } = await import('../workflow/bridge.mjs')
            const found = lookupInstance(sid)
            if (found) {
              autoAckHandoff(found)
              console.log(`[muse-plugin] auto-ack handoff for instance ${found}`)
            }
          } catch { /* 降级 */ }
        }
      } else if (type === 'session.idle') {
        aggregator.onSessionComplete(sid, { status: 'completed' })
        // 缺失汇报检测：session 结束了但 handoff 仍在 executing → 没调 notify_planner
        try {
          const { lookupInstance, loadInstanceState, appendTrace } = await import('../workflow/bridge.mjs')
          const found = lookupInstance(sid)
          if (found) {
            const st = loadInstanceState(found)
            if (st?.handoff?.status === 'executing' && st.handoff.targetSession === sid) {
              console.warn(`[muse-plugin] ⚠️ session ${sid.slice(-8)} ended without notify_planner (instance: ${found})`)
              appendTrace(found, {
                phase: 'handoff_missing_notify',
                sessionId: sid,
                handoffTarget: st.handoff.target,
                mechanism: 'session_idle_guard',
              })
            }
          }
        } catch { /* 降级 */ }
      } else if (type === 'session.error') {
        aggregator.onSessionComplete(sid, { status: 'error', error: props.error })
      }
    } catch { /* 降级 */ }
  }

  // tool.execute.after 需要同步给 aggregator
  const toolAudit = createToolAudit({ logDir })
  const toolAuditHook = async (input, output) => {
    await toolAudit(input, output)
    try {
      if (input?.sessionID) {
        const startTime = input?.callID
          ? Date.now() // after 里取不到 startTime，用 output 里的 durationMs 如果有的话
          : undefined
        aggregator.onToolCall(input.sessionID, {
          tool: input.tool,
          error: output?.error,
        })
      }
    } catch { /* 降级 */ }
  }

  // T39: system prompt hook
  const toolStartHook = createToolStartHook({ logDir })
  const systemPromptHook = createSystemPrompt()

  return {
    event: eventHook,
    'chat.message': createMessageHook({ logDir }),
    'tool.execute.before': async (input) => {
      await toolStartHook(input)
      // Session Context Sidecar: 每次工具调用前写入当前 sessionID
      // MCP 子进程通过 session-context.mjs 读取此文件获取 session 信息
      if (input?.sessionID) {
        writeSessionContext({ sessionID: input.sessionID, tool: input.tool })
      }
    },
    'tool.execute.after': toolAuditHook,
    'experimental.chat.system.transform': async (input, output) => {
      await systemPromptHook(input, output)
    },
  }
}
