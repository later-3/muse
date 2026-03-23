/**
 * T10.5: Muse Plugin — tool.execute.before/after hooks
 *
 * 工具调用运行时审计：
 *   YYYY-MM-DD/tool-starts.jsonl  — tool.execute.before 写入（工具开始）
 *   YYYY-MM-DD/tool-calls.jsonl   — tool.execute.after 写入（工具结束）
 *
 * 对比两个文件，可找出「开始了但未结束」的工具（即执行卡死的工具）。
 *
 * 按日归档：日志写入 {logDir}/YYYY-MM-DD/{filename}.jsonl
 * durationMs: 调用前后时间差（由 before/after 对计算）
 * outputSummary: 工具输出前 200 字摘要（支持字符串/对象类型）
 * error: 工具失败时的错误信息（截断 500 字）
 *
 * 使用 appendFileSync 保证短进程下日志不丢。
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** 进行中的工具调用开始时间，用于计算 durationMs */
const pendingCalls = new Map()

/** 返回按日归档的文件路径，并确保目录存在 */
function getDailyPath(logDir, filename) {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const dir = join(logDir, date)
  try { mkdirSync(dir, { recursive: true }) } catch { /* 降级 */ }
  return join(dir, filename)
}

export function createToolStartHook({ logDir }) {
  return async (input) => {
    try {
      if (input?.callID) {
        const ts = Date.now()
        pendingCalls.set(input.callID, ts)
        appendFileSync(getDailyPath(logDir, 'tool-starts.jsonl'), JSON.stringify({
          ts,
          tool: input.tool,
          sid: input.sessionID,
          callID: input.callID,
        }) + '\n')
      }
    } catch { /* 降级 */ }
  }
}

export function createToolAudit({ logDir }) {
  return async (input, output) => {
    try {
      const startTime = input?.callID ? pendingCalls.get(input.callID) : undefined
      const durationMs = startTime ? Date.now() - startTime : undefined
      if (input?.callID) pendingCalls.delete(input.callID)

      const rawOutput = output.output
      const outputLen = typeof rawOutput === 'string'
        ? rawOutput.length
        : rawOutput != null ? JSON.stringify(rawOutput).length : 0
      const outputSummary = typeof rawOutput === 'string'
        ? rawOutput.slice(0, 200)
        : rawOutput != null ? JSON.stringify(rawOutput).slice(0, 200) : ''

      const audit = {
        ts: Date.now(),
        tool: input.tool,
        sid: input.sessionID,
        callID: input.callID,
        title: output.title || '',
        outputLen,
        ...(outputSummary && { outputSummary }),
        ...(durationMs !== undefined && { durationMs }),
        ...(output.error && { error: String(output.error).slice(0, 500) }),
      }
      appendFileSync(getDailyPath(logDir, 'tool-calls.jsonl'), JSON.stringify(audit) + '\n')
    } catch { /* 降级 */ }
  }
}
