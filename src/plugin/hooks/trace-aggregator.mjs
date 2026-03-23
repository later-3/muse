/**
 * opencode-trace: TraceAggregator
 *
 * 以 session 为单位聚合一次对话的完整链路：
 *   session.created → 工具调用序列 → session.idle/error
 * 完成后写 traces/{sessionId}.jsonl 文件，供 trace-reader 查询。
 *
 * 设计原则:
 *   - 纯观察，不干预 AI 行为
 *   - 内存 Map 存 pending session，完成后立即清理
 *   - 写入失败降级（不影响主流程）
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export class TraceAggregator {
  /** @type {Map<string, object>} sessionId → trace entry */
  #pending = new Map()
  #tracesDir

  constructor({ logDir }) {
    this.#tracesDir = join(logDir, 'traces')
    try { mkdirSync(this.#tracesDir, { recursive: true }) } catch { /* 降级 */ }
  }

  onSessionCreated(sessionId, { agent, model } = {}) {
    this.#pending.set(sessionId, {
      sessionId,
      startedAt: Date.now(),
      agent: agent || 'unknown',
      model: model || 'unknown',
      tools: [],
    })
  }

  onToolCall(sessionId, { tool, durationMs, error } = {}) {
    const entry = this.#pending.get(sessionId)
    if (!entry) return
    entry.tools.push({
      ts: Date.now(),
      tool,
      ...(durationMs !== undefined && { durationMs }),
      ...(error && { error: String(error).slice(0, 200) }),
    })
  }

  onSessionComplete(sessionId, { status, error } = {}) {
    const entry = this.#pending.get(sessionId)
    if (!entry) return
    this.#pending.delete(sessionId)

    entry.completedAt = Date.now()
    entry.totalMs = entry.completedAt - entry.startedAt
    entry.status = status || 'completed'
    if (error) entry.error = String(error).slice(0, 500)

    try {
      const filePath = join(this.#tracesDir, `${sessionId}.json`)
      appendFileSync(filePath, JSON.stringify(entry) + '\n')
    } catch { /* 降级 */ }
  }

  /** 返回内存中 pending session 数（供测试/health check）*/
  get pendingCount() { return this.#pending.size }
}
