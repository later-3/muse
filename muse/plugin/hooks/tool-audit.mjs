/**
 * T10.5: Muse Plugin — tool.execute.after hook
 *
 * 工具调用运行时审计。
 * 只记录元信息 (tool name, callID, output length)。
 * 不记录完整 args/output (可能含敏感数据)。
 *
 * 注意: 这是运行时审计 (T10.5 职责)。
 * T11 memory_audit 表是领域审计 (记忆写入)。两者不混不替。
 */

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

export function createToolAudit({ logDir }) {
  const logPath = join(logDir, 'tool-calls.jsonl')

  return async (input, output) => {
    try {
      // input: { tool, sessionID, callID, args }
      // output: { title, output, metadata }
      const audit = {
        ts: Date.now(),
        tool: input.tool,
        sid: input.sessionID,
        callID: input.callID,
        title: output.title || '',
        outputLen: output.output?.length || 0,
      }
      appendFile(logPath, JSON.stringify(audit) + '\n').catch(() => {})
    } catch {
      // 降级: 不影响主流程
    }
  }
}
