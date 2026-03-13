/**
 * T10.5: Muse Plugin — 入口
 *
 * OpenCode Plugin 格式:
 *   export default async function(input: PluginInput): Promise<Hooks>
 *
 * input 包含: { client, project, directory, worktree, $ }
 * 返回 Hooks 对象，OpenCode 会在对应生命周期点回调。
 *
 * 评审守则:
 *   1. chat.system.transform 只补动态上下文，不承载人格
 *   2. Hook 只触发/观察，不替 AI 做重决策
 *   3. event 白名单过滤，不全量落盘
 *   4. 运行时审计 vs 领域审计分层
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createEventLogger } from './hooks/event-logger.mjs'
import { createMessageHook } from './hooks/message-hook.mjs'
import { createToolAudit } from './hooks/tool-audit.mjs'
import { createSystemPrompt } from './hooks/system-prompt.mjs'

export default async function musePlugin(input) {
  const { directory } = input
  const logDir = join(directory, 'muse', 'data', 'hook-logs')

  // 确保日志目录存在
  try {
    mkdirSync(logDir, { recursive: true })
  } catch {
    // 降级: 日志写不了不影响主流程
  }

  console.log('[muse-plugin] loaded, logDir:', logDir)

  return {
    // P0: 全局事件日志 (白名单过滤)
    event: createEventLogger({ logDir }),

    // P1: 消息到达记录
    'chat.message': createMessageHook({ logDir }),

    // P1: 工具调用运行时审计
    'tool.execute.after': createToolAudit({ logDir }),

    // P1: 动态上下文注入 (仅时间等，不含人格)
    'experimental.chat.system.transform': createSystemPrompt(),
  }
}
