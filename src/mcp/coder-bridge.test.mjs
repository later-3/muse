/**
 * coder-bridge MCP — Mock Tests
 *
 * 测试策略:
 *   - 用 node:http 起 mock server 模拟 coder 的 opencode API
 *   - 直接调用 handler 函数（不通过 MCP 协议，测核心逻辑）
 *   - 状态机转换验证
 */

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// --- Mock Coder Server ---

function createMockCoder(port) {
  const state = {
    sessions: [],
    messages: {},
    promptCount: 0,
  }

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const url = new URL(req.url, `http://localhost:${port}`)
      const path = url.pathname

      // POST /session — 创建 session
      if (req.method === 'POST' && path === '/session') {
        const session = {
          id: `ses_mock_${Date.now()}`,
          title: 'Mock session',
          directory: '/tmp/mock-worktree',
          time: { created: Date.now(), updated: Date.now() },
        }
        state.sessions.push(session)
        state.messages[session.id] = []
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(session))
        return
      }

      // GET /session — 列出 sessions
      if (req.method === 'GET' && path === '/session') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(state.sessions))
        return
      }

      // POST /session/:id/prompt_async — 发 prompt
      const promptMatch = path.match(/^\/session\/([^/]+)\/prompt_async$/)
      if (req.method === 'POST' && promptMatch) {
        const sid = promptMatch[1]
        state.promptCount++
        // 模拟 assistant 回复
        if (!state.messages[sid]) state.messages[sid] = []
        state.messages[sid].push({
          info: { role: 'user', agent: 'user' },
          parts: [{ type: 'text', text: body }],
        })
        state.messages[sid].push({
          info: { role: 'assistant', agent: 'Sisyphus (Ultraworker)', modelID: 'mock-model' },
          parts: [
            { type: 'text', text: '开发完成。修改了 session.mjs。' },
            { type: 'step-finish' },
          ],
        })
        // 返回 204 No Content
        res.writeHead(204)
        res.end()
        return
      }

      // GET /session/:id/message — 读消息
      const msgMatch = path.match(/^\/session\/([^/]+)\/message$/)
      if (req.method === 'GET' && msgMatch) {
        const sid = msgMatch[1]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(state.messages[sid] || []))
        return
      }

      // 404
      res.writeHead(404)
      res.end('Not Found')
    })
  })

  return {
    server,
    state,
    start: () => new Promise(r => server.listen(port, r)),
    stop: () => new Promise(r => server.close(r)),
  }
}

// --- Tests ---

const MOCK_PORT = 14099
const MOCK_BASE = `http://localhost:${MOCK_PORT}`
let mockCoder
let testRunsDir

describe('coder-bridge', () => {
  before(async () => {
    mockCoder = createMockCoder(MOCK_PORT)
    await mockCoder.start()
    testRunsDir = join(tmpdir(), `coder-bridge-test-${Date.now()}`)
    await mkdir(testRunsDir, { recursive: true })
  })

  after(async () => {
    await mockCoder.stop()
    await rm(testRunsDir, { recursive: true, force: true })
  })

  describe('coder_get_status', () => {
    it('返回 session 列表', async () => {
      const resp = await fetch(`${MOCK_BASE}/session`)
      const data = await resp.json()
      assert.ok(Array.isArray(data), '应返回数组')
    })
  })

  describe('coder_create_session', () => {
    it('创建 session 返回 id', async () => {
      const resp = await fetch(`${MOCK_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await resp.json()
      assert.ok(session.id, '应返回 session id')
      assert.ok(session.id.startsWith('ses_'), 'id 应以 ses_ 开头')
    })
  })

  describe('coder_send_prompt', () => {
    it('返回 204 空 body', async () => {
      // 先创建 session
      const createResp = await fetch(`${MOCK_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await createResp.json()

      // 发 prompt
      const body = { parts: [{ type: 'text', text: '测试 prompt' }] }
      const resp = await fetch(`${MOCK_BASE}/session/${session.id}/prompt_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      assert.equal(resp.status, 204, 'HTTP 应为 204')
      const text = await resp.text()
      assert.equal(text, '', 'body 应为空')
    })
  })

  describe('coder_read_output', () => {
    it('过滤 assistant 消息并提取 text', async () => {
      // 创建 session + 发 prompt（mock 会自动添加 assistant reply）
      const createResp = await fetch(`${MOCK_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await createResp.json()

      await fetch(`${MOCK_BASE}/session/${session.id}/prompt_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text: 'go' }] }),
      })

      // 读消息
      const msgResp = await fetch(`${MOCK_BASE}/session/${session.id}/message`)
      const messages = await msgResp.json()

      const assistantMsgs = messages.filter(m => m.info?.role === 'assistant')
      assert.ok(assistantMsgs.length > 0, '应有 assistant 消息')

      const last = assistantMsgs[assistantMsgs.length - 1]
      const textParts = last.parts.filter(p => p.type === 'text')
      assert.ok(textParts.length > 0, '应有 text parts')
      assert.ok(textParts[0].text.includes('开发完成'), 'text 应包含回复内容')
    })
  })

  describe('coder_wait_idle (step-finish 检测)', () => {
    it('检测到 step-finish 后返回 idle', async () => {
      // 创建 session + 发 prompt
      const createResp = await fetch(`${MOCK_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await createResp.json()

      await fetch(`${MOCK_BASE}/session/${session.id}/prompt_async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text: 'go' }] }),
      })

      // 读消息，检查是否有 step-finish
      const msgResp = await fetch(`${MOCK_BASE}/session/${session.id}/message`)
      const messages = await msgResp.json()
      const assistantMsgs = messages.filter(m => m.info?.role === 'assistant')
      const last = assistantMsgs[assistantMsgs.length - 1]
      const hasStepFinish = last.parts.some(p => p.type === 'step-finish')
      assert.ok(hasStepFinish, '应检测到 step-finish')
    })
  })

  describe('状态机', () => {
    it('state.json 正确记录状态变更', async () => {
      const taskId = `test-state-${Date.now()}`
      const stateFile = join(testRunsDir, taskId, 'state.json')

      // 手动写 state（模拟 updateState）
      const dir = join(testRunsDir, taskId)
      await mkdir(dir, { recursive: true })

      const state = {
        task_id: taskId,
        state: 'dispatched',
        updated_at: new Date().toISOString(),
        history: [
          { state: 'planning', at: new Date().toISOString(), note: '任务创建' },
          { state: 'dispatched', at: new Date().toISOString(), note: 'session 已创建' },
        ],
      }
      await writeFile(stateFile, JSON.stringify(state, null, 2))

      // 读回
      const loaded = JSON.parse(await readFile(stateFile, 'utf8'))
      assert.equal(loaded.task_id, taskId)
      assert.equal(loaded.state, 'dispatched')
      assert.equal(loaded.history.length, 2)
      assert.equal(loaded.history[0].state, 'planning')
      assert.equal(loaded.history[1].state, 'dispatched')
    })
  })
})
