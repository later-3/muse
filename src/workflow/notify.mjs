/**
 * T39-1.5: 工作流 Telegram 通知
 *
 * 两个触发点：
 * 1. notifyHandoffReceived — target muse 接管节点时
 * 2. notifyWorkflowCompleted — 工作流到达终点时
 */

import { readFileSync } from 'node:fs'
import { createLogger } from '../logger.mjs'

const log = createLogger('wf-notify')

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

async function sendTelegram(text) {
  const { botToken, chatId } = getTgCredentials()
  if (!botToken || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (e) {
    log.warn('Telegram 通知发送失败', { error: e.message })
  }
}

/**
 * target muse 接管工作流节点时通知用户
 */
export async function notifyHandoffReceived({ instanceId, workflowId, nodeName, nodeObjective }) {
  const member = process.env.MUSE_MEMBER || 'unknown'
  const text = [
    `🔄 *${member}* 接手工作流`,
    '',
    `📋 工作流: ${workflowId}`,
    `📍 节点: *${nodeName}*`,
    `🎯 目标: ${nodeObjective}`,
    '',
    `正在自主执行中...`,
  ].join('\n')
  await sendTelegram(text)
  log.info('已通知用户: handoff 接管', { instanceId, nodeName })
}

/**
 * 工作流到达终点（completed）时通知用户
 */
export async function notifyWorkflowCompleted({ instanceId, workflowId, history }) {
  const member = process.env.MUSE_MEMBER || 'unknown'
  const steps = (history || [])
    .filter(h => h.from)
    .map(h => `  ${h.from} → ${h.to}`)
    .join('\n')
  const text = [
    `✅ 工作流已完成`,
    '',
    `📋 工作流: ${workflowId}`,
    `🏁 由 *${member}* 完成最后一步`,
    '',
    `流转历史:`,
    steps,
    '',
    `🎉 全部节点执行完毕！`,
  ].join('\n')
  await sendTelegram(text)
  log.info('已通知用户: 工作流完成', { instanceId })
}

/**
 * 工作流自检失败时通知用户
 */
export async function notifyWorkflowError({ instanceId, workflowId, nodeName, error }) {
  const member = process.env.MUSE_MEMBER || 'unknown'
  const text = [
    `⛔ 工作流异常 — 已暂停`,
    '',
    `📋 工作流: ${workflowId}`,
    `📍 节点: *${nodeName}*`,
    `🤖 Muse: ${member}`,
    `❌ ${error}`,
    '',
    `请处理后通知我继续。`,
  ].join('\n')
  await sendTelegram(text)
  log.warn('已通知用户: 工作流异常', { instanceId, nodeName, error })
}
