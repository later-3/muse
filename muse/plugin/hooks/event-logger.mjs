/**
 * T10.5: Muse Plugin — event hook
 *
 * 接收 OpenCode Bus 的关键事件，写入 JSONL 日志。
 * 白名单过滤: 只记录 Session.Created/Error/Idle + tool.execute 等，
 * 不写高频的 PartDelta/Updated。
 */

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

/** 只记录这些事件类型 (白名单) */
const EVENT_WHITELIST = new Set([
  'session.created',
  'session.deleted',
  'session.error',
  'session.status',
  'session.idle',
  'compaction.compacted',
  'todo.updated',
  'file.edited',
])

export function createEventLogger({ logDir }) {
  const logPath = join(logDir, 'events.jsonl')

  return async ({ event }) => {
    try {
      const type = event?.type
      if (!type) return

      // 白名单过滤: 跳过高频事件
      if (!EVENT_WHITELIST.has(type)) return

      const line = JSON.stringify({
        ts: Date.now(),
        type,
        ...(event.properties?.sessionID && { sid: event.properties.sessionID }),
        ...(event.properties?.error && { error: String(event.properties.error).slice(0, 200) }),
      })
      appendFile(logPath, line + '\n').catch(() => {})
    } catch {
      // 降级: 不影响主流程
    }
  }
}
