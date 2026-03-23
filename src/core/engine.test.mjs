import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Engine, extractText } from './engine.mjs'

// --- Mock Server Helpers ---

function createMockServer(handler) {
  return new Promise(resolve => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, port })
    })
  })
}

function closeServer(server) {
  return new Promise(resolve => server.close(resolve))
}

function makeConfig(port) {
  return {
    engine: {
      host: 'http://127.0.0.1',
      port,
      workspace: '/tmp/test-workspace',
    },
  }
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// --- Tests ---

describe('Engine — health check', () => {
  it('should return true when server responds 200', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true, version: '1.0.0' })
      if (req.url === '/provider') return jsonResponse(res, { providers: [] })
      res.writeHead(404).end()
    })
    const engine = new Engine(makeConfig(port))
    const h = await engine.health()
    assert.equal(h.ok, true)
    assert.ok(h.detail.includes('running'))
    await closeServer(server)
  })

  it('should return false when no server running', async () => {
    const engine = new Engine(makeConfig(59999)) // unlikely port
    const h = await engine.health()
    assert.equal(h.ok, false)
    assert.ok(h.detail.includes('unreachable'))
  })
})

describe('Engine — session management', () => {
  let server, port, engine

  before(async () => {
    ({ server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      if (req.method === 'POST' && req.url === '/session') {
        return jsonResponse(res, { id: 'ses_test_123', title: 'New Session' })
      }
      if (req.method === 'GET' && req.url === '/session') {
        return jsonResponse(res, [{ id: 'ses_test_123' }])
      }
      if (req.method === 'GET' && req.url === '/session/ses_test_123') {
        return jsonResponse(res, {
          id: 'ses_test_123',
          status: 'idle',
        })
      }
      if (req.method === 'GET' && req.url === '/session/ses_test_123/message') {
        return jsonResponse(res, [
          { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
          { role: 'assistant', parts: [{ type: 'text', text: 'hello!' }] },
        ])
      }
      if (req.method === 'DELETE' && req.url === '/session/ses_test_123') {
        return jsonResponse(res, { ok: true })
      }
      res.writeHead(404).end()
    }))
    engine = new Engine(makeConfig(port))
    await engine.start() // attach mode
  })

  after(async () => {
    await engine.stop()
    await closeServer(server)
  })

  it('should create a session', async () => {
    const session = await engine.createSession()
    assert.equal(session.id, 'ses_test_123')
  })

  it('should list sessions', async () => {
    const sessions = await engine.listSessions()
    assert.ok(Array.isArray(sessions))
    assert.equal(sessions[0].id, 'ses_test_123')
  })

  it('should get a session', async () => {
    const session = await engine.getSession('ses_test_123')
    assert.equal(session.id, 'ses_test_123')
  })

  it('should get messages for a session', async () => {
    const messages = await engine.getMessages('ses_test_123')
    assert.ok(Array.isArray(messages))
    assert.equal(messages.length, 2)
    assert.equal(messages[1].role, 'assistant')
  })

  it('should delete a session', async () => {
    const result = await engine.deleteSession('ses_test_123')
    assert.equal(result.ok, true)
  })
})

describe('Engine — messaging', () => {
  let server, port, engine, receivedBody

  before(async () => {
    ({ server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      if (req.method === 'POST' && req.url === '/session/ses_1/prompt_async') {
        let body = ''
        req.on('data', c => body += c)
        req.on('end', () => {
          receivedBody = JSON.parse(body)
          jsonResponse(res, { ok: true })
        })
        return
      }
      res.writeHead(404).end()
    }))
    engine = new Engine(makeConfig(port))
    await engine.start()
  })

  after(async () => {
    await engine.stop()
    await closeServer(server)
  })

  it('should send async message with correct payload', async () => {
    const result = await engine.sendMessageAsync('ses_1', '你好')
    assert.equal(result.ok, true)
    assert.deepEqual(receivedBody.parts, [{ type: 'text', text: '你好' }])
  })

  it('should send model as nested object', async () => {
    await engine.sendMessageAsync('ses_1', 'test', { model: 'google/gemini-2.5-flash' })
    assert.deepStrictEqual(receivedBody.model, { providerID: 'google', modelID: 'gemini-2.5-flash' })
  })

  it('should include system field when provided', async () => {
    await engine.sendMessageAsync('ses_1', 'test', { system: '你是小缪' })
    assert.equal(receivedBody.system, '你是小缪')
  })
})

describe('Engine — sendAndWait', () => {
  it('should poll and return assistant reply', async () => {
    let statusCallCount = 0
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      if (req.method === 'POST' && req.url.includes('prompt_async')) {
        return jsonResponse(res, { ok: true })
      }
      // /session/status — 批量状态查询
      if (req.method === 'GET' && req.url === '/session/status') {
        statusCallCount++
        if (statusCallCount < 3) {
          return jsonResponse(res, { 'ses_poll': 'generating' })
        }
        return jsonResponse(res, { 'ses_poll': 'idle' })
      }
      // /session/ses_poll/message — 消息列表
      if (req.method === 'GET' && req.url === '/session/ses_poll/message') {
        return jsonResponse(res, [
          { role: 'user', parts: [{ type: 'text', text: 'hi' }] },
          { role: 'assistant', parts: [{ type: 'text', text: '你好呀！' }] },
        ])
      }
      res.writeHead(404).end()
    })

    const engine = new Engine(makeConfig(port))
    await engine.start()
    const result = await engine.sendAndWait('ses_poll', 'hi', { pollIntervalMs: 50, timeoutMs: 5000 })
    assert.equal(result.text, '你好呀！')
    assert.ok(statusCallCount >= 3)
    await engine.stop()
    await closeServer(server)
  })
})

describe('Engine — headers', () => {
  it('should include x-opencode-directory in every request', async () => {
    let receivedHeaders = {}
    const { server, port } = await createMockServer((req, res) => {
      receivedHeaders = req.headers
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      jsonResponse(res, [])
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    await engine.listSessions()
    assert.equal(receivedHeaders['x-opencode-directory'], '/tmp/test-workspace')
    await engine.stop()
    await closeServer(server)
  })
})

describe('Engine — retry behavior', () => {
  it('should retry on 503 then succeed', async () => {
    let attempt = 0
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      attempt++
      if (attempt <= 2) {
        return jsonResponse(res, { error: 'overloaded' }, 503)
      }
      jsonResponse(res, { id: 'ses_ok' })
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    const result = await engine.createSession()
    assert.equal(result.id, 'ses_ok')
    assert.equal(attempt, 3) // 2 failures + 1 success
    await engine.stop()
    await closeServer(server)
  })

  it('should NOT retry on 404', async () => {
    let attempt = 0
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      attempt++
      jsonResponse(res, { error: 'not found' }, 404)
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    await assert.rejects(() => engine.getSession('nonexistent'), err => {
      assert.equal(err.status, 404)
      assert.equal(err.method, 'GET')
      return true
    })
    assert.equal(attempt, 1) // no retry
    await engine.stop()
    await closeServer(server)
  })

  it('should fail after all retries exhausted', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      jsonResponse(res, { error: 'bad' }, 503)
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    await assert.rejects(() => engine.createSession(), /HTTP 503/)
    await engine.stop()
    await closeServer(server)
  })
})

describe('Engine — error context', () => {
  it('should include status/method/path on HTTP errors', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      jsonResponse(res, {}, 400)
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    try {
      await engine.createSession()
      assert.fail('should have thrown')
    } catch (err) {
      assert.equal(err.status, 400)
      assert.equal(err.method, 'POST')
      assert.equal(err.path, '/session')
    }
    await engine.stop()
    await closeServer(server)
  })
})

describe('Engine — process ownership', () => {
  it('should set ownsProcess=false in attach mode', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      res.writeHead(404).end()
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    const h = await engine.health()
    assert.equal(h.ownsProcess, false)
    await engine.stop()
    await closeServer(server)
  })

  it('stop should not kill process in attach mode', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/provider') return jsonResponse(res, {})
      res.writeHead(200).end()
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    await engine.stop()
    // Server should still be alive after stop (not killed)
    const h = await engine.health()
    // After stop, ready=false, but server is still up
    assert.equal(h.ok, true, 'external server should still be running after stop')
    await closeServer(server)
  })
})

describe('Engine — SSE parsing', () => {
  it('should parse standard SSE frames with empty line delimiter', async () => {
    const events = []
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/provider') return jsonResponse(res, {})
      if (req.url === '/event') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        // Standard SSE: each event ends with empty line
        res.write('data: {"type":"session.created","id":"1"}\n\n')
        res.write('data: {"type":"message.updated","id":"2"}\n\n')
        setTimeout(() => res.end(), 100)
        return
      }
      res.writeHead(404).end()
    })

    const engine = new Engine(makeConfig(port))
    await engine.start()
    const { cancel } = engine.subscribeEvents(ev => events.push(ev))
    await new Promise(r => setTimeout(r, 200))
    cancel()

    assert.equal(events.length, 2)
    assert.equal(events[0].type, 'session.created')
    assert.equal(events[1].type, 'message.updated')

    await engine.stop()
    await closeServer(server)
  })

  it('should handle multi-line data fields', async () => {
    const events = []
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/provider') return jsonResponse(res, {})
      if (req.url === '/event') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        // Multi-line data: lines get joined with \n before parsing
        res.write('data: {"type":"multi",\n')
        res.write('data: "value":"test"}\n')
        res.write('\n') // frame end
        setTimeout(() => res.end(), 100)
        return
      }
      res.writeHead(404).end()
    })

    const engine = new Engine(makeConfig(port))
    await engine.start()
    const { cancel } = engine.subscribeEvents(ev => events.push(ev))
    await new Promise(r => setTimeout(r, 200))
    cancel()

    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'multi')
    assert.equal(events[0].value, 'test')

    await engine.stop()
    await closeServer(server)
  })
})

describe('Engine — lifecycle', () => {
  it('should complete start/stop cycle without throwing', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/provider') return jsonResponse(res, {})
      res.writeHead(200).end()
    })
    const engine = new Engine(makeConfig(port))
    await engine.start()
    await engine.stop()
    await closeServer(server)
  })
})

describe('extractText', () => {
  it('should extract text from message parts', () => {
    const msg = {
      parts: [
        { type: 'text', text: 'hello ' },
        { type: 'tool-invocation', toolInvocation: {} },
        { type: 'text', text: 'world' },
      ],
    }
    assert.equal(extractText(msg), 'hello world')
  })

  it('should return empty string for no text parts', () => {
    const msg = { parts: [{ type: 'tool-invocation' }] }
    assert.equal(extractText(msg), '')
  })

  it('should handle missing parts', () => {
    assert.equal(extractText({}), '')
  })
})
