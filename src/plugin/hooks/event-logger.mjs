/**
 * T10.5: Muse Plugin — event hook
 *
 * 接收 OpenCode Bus 的关键事件，写入 JSONL 日志。
 * 白名单过滤: 只记录重要事件，不写高频的 PartDelta。
 *
 * 按日归档：日志写入 {logDir}/YYYY-MM-DD/events.jsonl
 * 使用 appendFileSync 保证短进程下日志不丢。
 */

import { appendFileSync, mkdirSync } from 'node:fs'
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
  'message.part.updated',  // 工具调用完成事件
])

/** message.part.updated 只记录 tool 类型的 part，过滤文本 delta */
function isToolPart(props) {
  return props?.type === 'tool' || props?.tool
}

/** 返回按日归档的文件路径，并确保目录存在 */
function getDailyPath(logDir, filename) {
  const date = new Date().toISOString().slice(0, 10)
  const dir = join(logDir, date)
  try { mkdirSync(dir, { recursive: true }) } catch { /* 降级 */ }
  return join(dir, filename)
}

export function createEventLogger({ logDir }) {
  return async ({ event }) => {
    try {
      const type = event?.type
      if (!type) return

      if (!EVENT_WHITELIST.has(type)) return
      if (type === 'message.part.updated' && !isToolPart(event.properties)) return

      const sid = event.properties?.sessionID || event.properties?.info?.sessionID
      const error = event.properties?.error

      const line = JSON.stringify({
        ts: Date.now(),
        type,
        ...(sid && { sid }),
        ...(error && { error: String(error).slice(0, 1000) }),
        ...(type === 'message.part.updated' && event.properties?.tool && {
          tool: event.properties.tool
        }),
      })
      appendFileSync(getDailyPath(logDir, 'events.jsonl'), line + '\n')
    } catch { /* 降级 */ }
  }
}
