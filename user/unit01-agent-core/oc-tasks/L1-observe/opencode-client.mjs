/**
 * OpenCode REST API 客户端 — oc01/02/03 共用
 * 
 * 封装了 OpenCode Server 的核心 API:
 *   - createSession()         → POST /session
 *   - sendMessage(sid, text)  → POST /session/{id}/prompt_async
 *   - waitForCompletion(sid)  → poll GET /session/status
 *   - getMessages(sid)        → GET /session/{id}/message
 *   - getSession(sid)         → GET /session/{id}
 */

const DEFAULT_PORT = 5555

export function createClient(port = DEFAULT_PORT) {
  const base = `http://127.0.0.1:${port}`

  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${base}${path}`, opts)
    if (res.status === 204) return null
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
    return res.json()
  }

  return {
    base,

    /** 创建新 session */
    async createSession() {
      return api('POST', '/session', {})
    },

    /** 发消息 (异步, 返回 204) */
    async sendMessage(sessionId, text) {
      await api('POST', `/session/${sessionId}/prompt_async`, {
        parts: [{ type: 'text', text }],
      })
    },

    /** 等待 session 完成, 返回 {elapsed, polls} */
    async waitForCompletion(sessionId, maxSeconds = 60) {
      const start = Date.now()
      for (let i = 1; i <= maxSeconds; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const allStatus = await api('GET', '/session/status')
        const entry = allStatus?.[sessionId]
        if (!entry) {
          return { elapsed: Math.round((Date.now() - start) / 1000), polls: i }
        }
        const status = typeof entry === 'string' ? entry : (entry.status || 'working')
        process.stdout.write(`   ⏳ poll #${i}: ${status} (${Math.round((Date.now()-start)/1000)}s)    \r`)
      }
      throw new Error(`超时 (${maxSeconds}s)`)
    },

    /** 获取 session 的全部消息 */
    async getMessages(sessionId) {
      return api('GET', `/session/${sessionId}/message`)
    },

    /** 获取 session 元数据 */
    async getSession(sessionId) {
      return api('GET', `/session/${sessionId}`)
    },

    /** 列出所有 session */
    async listSessions() {
      return api('GET', '/session')
    },
  }
}

/** 从消息中提取工具调用 */
export function extractToolCalls(messages) {
  const tools = []
  for (const msg of messages) {
    for (const part of (msg.parts || [])) {
      if (part.type === 'tool-invocation' || part.type === 'tool_use') {
        tools.push({
          name: part.toolName || part.name || part.id,
          args: part.input || part.args || {},
          state: part.state || 'unknown',
        })
      }
    }
  }
  return tools
}

/** 从消息中提取文本回复 */
export function extractReplyText(messages) {
  const assistantMsgs = messages.filter(m => m.info?.role === 'assistant')
  if (!assistantMsgs.length) return ''
  const last = assistantMsgs[assistantMsgs.length - 1]
  return (last.parts || [])
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('\n')
}

/** 构建 Agent Loop 链路摘要 */
export function buildLoopSummary(messages) {
  const userMsgs = messages.filter(m => m.info?.role === 'user')
  const aiMsgs = messages.filter(m => m.info?.role === 'assistant')
  const tools = extractToolCalls(messages)
  return {
    totalMessages: messages.length,
    userMessages: userMsgs.length,
    aiMessages: aiMsgs.length,
    toolCalls: tools,
    loopRounds: aiMsgs.length,
    model: messages[0]?.info?.model?.modelID || 'unknown',
  }
}
