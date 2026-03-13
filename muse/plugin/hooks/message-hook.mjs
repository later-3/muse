/**
 * T10.5: Muse Plugin — chat.message hook
 *
 * 消息到达时记录元信息 (sessionID, agent, model)。
 * 不做重决策，只观察和记录。
 */

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

export function createMessageHook({ logDir }) {
  const logPath = join(logDir, 'messages.jsonl')

  return async (input, _output) => {
    try {
      // input: { sessionID, agent?, model?, messageID?, variant? }
      const line = JSON.stringify({
        ts: Date.now(),
        hook: 'chat.message',
        sid: input.sessionID,
        agent: input.agent || 'default',
        model: input.model?.modelID || 'unknown',
      })
      appendFile(logPath, line + '\n').catch(() => {})
    } catch {
      // 降级
    }
  }
}
