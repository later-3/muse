/**
 * T10.5: Muse Plugin — chat.message hook
 *
 * 消息到达时记录元信息 (sessionID, agent, model)。
 * 不做重决策，只观察和记录。
 *
 * 按日归档：日志写入 {logDir}/YYYY-MM-DD/messages.jsonl
 * 使用 appendFileSync 保证短进程下日志不丢。
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** 返回按日归档的文件路径，并确保目录存在 */
function getDailyPath(logDir, filename) {
  const date = new Date().toISOString().slice(0, 10)
  const dir = join(logDir, date)
  try { mkdirSync(dir, { recursive: true }) } catch { /* 降级 */ }
  return join(dir, filename)
}

export function createMessageHook({ logDir }) {
  return async (input, _output) => {
    try {
      // model 字段兼容：opencode 传 { providerID, modelID } 或 string 或其他结构
      const rawModel = input.model
      let modelStr = 'unknown'
      if (typeof rawModel === 'string') {
        modelStr = rawModel
      } else if (rawModel?.modelID) {
        modelStr = rawModel.providerID
          ? `${rawModel.providerID}/${rawModel.modelID}`
          : rawModel.modelID
      } else if (rawModel?.id) {
        modelStr = rawModel.id
      }

      const line = JSON.stringify({
        ts: Date.now(),
        hook: 'chat.message',
        sid: input.sessionID,
        agent: input.agent || 'default',
        model: modelStr,
        ...(input.messageID && { messageID: input.messageID }),
        // 首次诊断：dump input 的 key 列表（不含敏感内容）
        _inputKeys: Object.keys(input),
        _modelType: typeof rawModel,
        _modelKeys: rawModel && typeof rawModel === 'object' ? Object.keys(rawModel) : undefined,
      })
      appendFileSync(getDailyPath(logDir, 'messages.jsonl'), line + '\n')
    } catch { /* 降级 */ }
  }
}
