/**
 * Session Context Sidecar — 跨进程 Session 感知
 *
 * 问题: MCP Server 是 OpenCode 的子进程 (stdio)，无法获取当前 session ID。
 * 方案: Plugin (主进程) 在 tool.execute.before 时写 .session-ctx 文件，
 *       MCP (子进程) 通过此模块读取。
 *
 * 文件路径: $MUSE_MEMBER_DIR/data/.session-ctx
 * 格式: { sessionID, tool, ts, memberName }
 * TTL: 5 分钟（过期视为无效）
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 上下文文件名 */
const CTX_FILENAME = '.session-ctx'

/** 上下文有效期 (ms) — 超过此时间视为过期 */
const CTX_TTL_MS = 300_000 // 5 minutes

/**
 * 解析当前 session ID（MCP 子进程调用）
 *
 * 优先级:
 *   1. 显式环境变量 OPENCODE_SESSION_ID（预留，目前不存在）
 *   2. Sidecar 文件 .session-ctx（Plugin 写入）
 *   3. fallback 'unknown'
 *
 * @returns {string} sessionID
 */
export function resolveSessionId() {
  // 1. 环境变量（预留兼容）
  if (process.env.OPENCODE_SESSION_ID) {
    return process.env.OPENCODE_SESSION_ID
  }

  // 2. Sidecar 文件
  const memberDir = process.env.MUSE_MEMBER_DIR
  if (memberDir) {
    try {
      const ctxPath = join(memberDir, 'data', CTX_FILENAME)
      const raw = readFileSync(ctxPath, 'utf-8')
      const ctx = JSON.parse(raw)

      // 过期检查
      if (ctx.sessionID && typeof ctx.ts === 'number') {
        const age = Date.now() - ctx.ts
        if (age < CTX_TTL_MS) {
          return ctx.sessionID
        }
      }
    } catch {
      // 文件不存在或解析失败 → 降级
    }
  }

  // 3. fallback
  return 'unknown'
}

/**
 * 写入 session context（Plugin 主进程调用）
 *
 * @param {object} opts
 * @param {string} opts.sessionID
 * @param {string} [opts.tool] - 触发写入的工具名
 * @param {string} [opts.memberName] - 当前 member 名称
 */
export function writeSessionContext({ sessionID, tool, memberName }) {
  const memberDir = process.env.MUSE_MEMBER_DIR
  if (!memberDir || !sessionID) return

  try {
    const ctxPath = join(memberDir, 'data', CTX_FILENAME)
    writeFileSync(ctxPath, JSON.stringify({
      sessionID,
      tool: tool || 'unknown',
      ts: Date.now(),
      memberName: memberName || process.env.MUSE_MEMBER || 'unknown',
    }))
  } catch {
    // 写入失败降级，不影响主流程
  }
}
