/**
 * T39-1.2: MemberClient 单元测试
 *
 * 用 node:http 创建 mock OpenCode server，验证：
 * - createSession: POST /session → 返回 id
 * - prompt: POST /session/:id/prompt_async → 204
 * - pollUntilDone: GET /session/status + seenBusy 语义
 * - fetchLastReply: GET /session/:id/message → 最后 assistant 消息
 * - sendAndWait: 完整闭环
 * - ping: /global/health 优先 → /provider 降级
 * - 错误处理：超时、网络错误、HTTP 错误
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { MemberClient } from './member-client.mjs'

/**
 * 创建 mock OpenCode HTTP server
 * @param {(req, res) => void} handler
 * @returns {Promise<{ server, url, close }>}
 */
function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const url = `http://127.0.0.1:${port}`
      resolve({
        server,
        url,
        close: () => new Promise(r => server.close(r)),
      })
    })
  })
}

/** 读取请求 body */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}

describe('T39-1.2: MemberClient', () => {
  let mock, client

  afterEach(async () => {
    if (mock) await mock.close()
    mock = null
    client = null
  })

  describe('createSession', () => {
    it('POST /session → 返回 sessionId', async () => {
      mock = await createMockServer((req, res) => {
        assert.equal(req.method, 'POST')
        assert.equal(req.url, '/session')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id: 'ses_test_123' }))
      })
      client = new MemberClient(mock.url)
      const sessionId = await client.createSession()
      assert.equal(sessionId, 'ses_test_123')
    })

    it('返回无效数据时应抛错', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ noId: true }))
      })
      client = new MemberClient(mock.url)
      await assert.rejects(
        () => client.createSession(),
        (err) => err.message.includes('缺少 id')
      )
    })
  })

  describe('prompt', () => {
    it('POST /session/:id/prompt_async → 204', async () => {
      let receivedBody = null
      mock = await createMockServer(async (req, res) => {
        assert.equal(req.method, 'POST')
        assert.equal(req.url, '/session/ses_123/prompt_async')
        receivedBody = JSON.parse(await readBody(req))
        res.writeHead(204)
        res.end()
      })
      client = new MemberClient(mock.url)
      await client.prompt('ses_123', '你好')

      assert.ok(receivedBody)
      assert.equal(receivedBody.parts[0].type, 'text')
      assert.equal(receivedBody.parts[0].text, '你好')
    })
  })

  describe('请求 headers', () => {
    it('应带 x-opencode-directory header', async () => {
      let receivedHeaders = null
      mock = await createMockServer((req, res) => {
        receivedHeaders = req.headers
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id: 'ses_1' }))
      })
      client = new MemberClient(mock.url, '/custom/workspace')
      await client.createSession()

      assert.equal(receivedHeaders['x-opencode-directory'], '/custom/workspace')
      assert.equal(receivedHeaders['content-type'], 'application/json')
    })
  })

  describe('pollUntilDone', () => {
    it('seenBusy 语义：busy → unknown = 完成', async () => {
      let callCount = 0
      mock = await createMockServer((req, res) => {
        callCount++
        res.writeHead(200, { 'Content-Type': 'application/json' })
        if (callCount <= 2) {
          // 前 2 次返回 busy
          res.end(JSON.stringify({ ses_123: 'busy' }))
        } else {
          // 第 3 次 session 不在 map 中 = unknown
          res.end(JSON.stringify({}))
        }
      })
      client = new MemberClient(mock.url)
      await client.pollUntilDone('ses_123', { pollIntervalMs: 50, timeoutMs: 5000 })

      assert.ok(callCount >= 3, `应至少轮询 3 次，实际 ${callCount}`)
    })

    it('直接 idle = 完成', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ses_123: 'idle' }))
      })
      client = new MemberClient(mock.url)
      await client.pollUntilDone('ses_123', { pollIntervalMs: 50, timeoutMs: 5000 })
    })

    it('对象格式状态 { type: "busy" }', async () => {
      let callCount = 0
      mock = await createMockServer((req, res) => {
        callCount++
        res.writeHead(200, { 'Content-Type': 'application/json' })
        if (callCount <= 1) {
          res.end(JSON.stringify({ ses_123: { type: 'busy' } }))
        } else {
          res.end(JSON.stringify({}))
        }
      })
      client = new MemberClient(mock.url)
      await client.pollUntilDone('ses_123', { pollIntervalMs: 50, timeoutMs: 5000 })
    })

    it('超时应抛错', async () => {
      mock = await createMockServer((req, res) => {
        // 永远返回 busy
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ses_123: 'busy' }))
      })
      client = new MemberClient(mock.url)
      await assert.rejects(
        () => client.pollUntilDone('ses_123', { pollIntervalMs: 50, timeoutMs: 200 }),
        (err) => err.message.includes('超时')
      )
    })
  })

  describe('fetchLastReply', () => {
    it('提取最后一条 assistant 消息文本', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify([
          { info: { role: 'user' }, parts: [{ type: 'text', text: '问题' }] },
          { info: { role: 'assistant' }, parts: [{ type: 'text', text: '回答1' }] },
          { info: { role: 'assistant' }, parts: [{ type: 'text', text: '回答2' }] },
        ]))
      })
      client = new MemberClient(mock.url)
      const reply = await client.fetchLastReply('ses_123')
      assert.equal(reply, '回答2')
    })

    it('无 assistant 消息返回空字符串', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify([
          { info: { role: 'user' }, parts: [{ type: 'text', text: '问题' }] },
        ]))
      })
      client = new MemberClient(mock.url)
      const reply = await client.fetchLastReply('ses_123')
      assert.equal(reply, '')
    })
  })

  describe('sendAndWait', () => {
    it('完整闭环: prompt → poll → fetchLastReply', async () => {
      let step = 0
      mock = await createMockServer(async (req, res) => {
        if (req.method === 'POST' && req.url.includes('prompt_async')) {
          step = 1
          await readBody(req)
          res.writeHead(204)
          res.end()
        } else if (req.url === '/session/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          if (step === 1) {
            step = 2
            res.end(JSON.stringify({ ses_123: 'busy' }))
          } else {
            res.end(JSON.stringify({}))
          }
        } else if (req.url.includes('/message')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify([
            { info: { role: 'assistant' }, parts: [{ type: 'text', text: '搞定了！' }] },
          ]))
        } else {
          res.writeHead(404)
          res.end()
        }
      })
      client = new MemberClient(mock.url)
      const reply = await client.sendAndWait('ses_123', '请分析', { pollIntervalMs: 50, timeoutMs: 5000 })
      assert.equal(reply, '搞定了！')
    })
  })

  describe('ping', () => {
    it('/global/health 成功 → true', async () => {
      mock = await createMockServer((req, res) => {
        if (req.url === '/global/health') {
          res.writeHead(200)
          res.end('ok')
        } else {
          res.writeHead(404)
          res.end()
        }
      })
      client = new MemberClient(mock.url)
      assert.equal(await client.ping(), true)
    })

    it('/global/health 失败 → 降级 /provider', async () => {
      mock = await createMockServer((req, res) => {
        if (req.url === '/provider') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify([]))
        } else {
          res.writeHead(500)
          res.end()
        }
      })
      client = new MemberClient(mock.url)
      assert.equal(await client.ping(), true)
    })

    it('全部失败 → false', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(500)
        res.end()
      })
      client = new MemberClient(mock.url)
      assert.equal(await client.ping(), false)
    })
  })

  describe('错误处理', () => {
    it('HTTP 404 应抛错并包含 status', async () => {
      mock = await createMockServer((req, res) => {
        res.writeHead(404)
        res.end('not found')
      })
      client = new MemberClient(mock.url)
      await assert.rejects(
        () => client.createSession(),
        (err) => {
          assert.ok(err.message.includes('404'))
          assert.equal(err.status, 404)
          return true
        }
      )
    })

    it('网络不可达应抛错', async () => {
      client = new MemberClient('http://127.0.0.1:1')  // 不会有服务在端口 1
      await assert.rejects(
        () => client.createSession(),
        (err) => err.message.includes('失败')
      )
    })
  })
})
