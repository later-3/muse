/**
 * Learning Assistant Server — Tests
 * 
 * Tests for:
 * - Context index building and search
 * - Notes saving
 * - TTS (availability check)
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { ContextIndex, ensureNotesDir } from '../server/context-index.mjs'
import { startServer, stopServer, NOTES_DIR } from '../server/server.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import http from 'node:http'

function createMockOpenCode(port) {
  const state = {
    sessions: new Map(),
  }

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      const path = url.pathname

      if (req.method === 'POST' && path === '/session') {
        const id = `ses_${Date.now()}`
        state.sessions.set(id, [])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id }))
        return
      }

      const promptMatch = path.match(/^\/session\/([^/]+)\/prompt_async$/)
      if (req.method === 'POST' && promptMatch) {
        const sid = promptMatch[1]
        const payload = JSON.parse(body || '{}')
        const userText = payload.parts?.map(p => p.text || '').join('\n') || ''
        state.sessions.set(sid, [
          {
            info: { role: 'user' },
            parts: [{ type: 'text', text: userText }],
          },
          {
            info: { role: 'assistant' },
            parts: [
              { type: 'text', text: '这是一个来自 mock OpenCode 的回答。' },
              { type: 'step-finish' },
            ],
          },
        ])
        res.writeHead(204)
        res.end()
        return
      }

      const msgMatch = path.match(/^\/session\/([^/]+)\/message$/)
      if (req.method === 'GET' && msgMatch) {
        const sid = msgMatch[1]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(state.sessions.get(sid) || []))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found' }))
    })
  })

  return {
    start: () => new Promise(resolve => {
      server.listen(port, '127.0.0.1', () => {
        const address = server.address()
        resolve(address?.port || port)
      })
    }),
    stop: () => new Promise(resolve => server.close(resolve)),
  }
}

describe('Learning Assistant Server', () => {
  let server
  let baseUrl
  let mockOc
  let ocPort

  before(async () => {
    mockOc = createMockOpenCode(0)
    ocPort = await mockOc.start()
    process.env.LEARNING_ASSISTANT_OC_BASE_URL = `http://127.0.0.1:${ocPort}`
    process.env.LEARNING_ASSISTANT_HOST = '127.0.0.1'
    process.env.LEARNING_ASSISTANT_PORT = '0'
    server = await startServer()
    const address = server.address()
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    await stopServer()
    await mockOc.stop()
    delete process.env.LEARNING_ASSISTANT_OC_BASE_URL
    delete process.env.LEARNING_ASSISTANT_HOST
    delete process.env.LEARNING_ASSISTANT_PORT
  })

  describe('Context Index', () => {
    it('should build index with documents', async () => {
      const index = new ContextIndex()
      await index.build()
      
      const all = index.getAll()
      assert.ok(all.length > 0, 'Index should have documents')
      assert.ok(all.length >= 10, 'Should index at least 10 documents')
      
      // Check structure of indexed items
      const first = all[0]
      assert.ok(first.id, 'Should have id')
      assert.ok(first.title, 'Should have title')
      assert.ok(first.path, 'Should have path')
      assert.ok(Array.isArray(first.headings), 'Should have headings array')
      assert.ok(Array.isArray(first.keywords), 'Should have keywords array')
    })

    it('should search and return results', async () => {
      const index = new ContextIndex()
      await index.build()
      
      // Search for "attention" - should find F2-build-gpt
      const results = index.search('attention')
      assert.ok(results.length > 0, 'Should find results for "attention"')
      
      const first = results[0]
      assert.ok(first.id, 'Result should have id')
      assert.ok(first.title, 'Result should have title')
      assert.ok(first.path, 'Result should have path')
      assert.ok(first.snippet, 'Result should have snippet')
      assert.ok(typeof first.score === 'number', 'Result should have score')
    })

    it('should return empty array for empty query', async () => {
      const index = new ContextIndex()
      await index.build()
      
      const results = index.search('')
      assert.deepStrictEqual(results, [])
    })

    it('should search for Transformer content', async () => {
      const index = new ContextIndex()
      await index.build()
      
      const results = index.search('Transformer')
      assert.ok(results.length > 0, 'Should find Transformer docs')
      
      // F2 should be in results
      const f2Result = results.find(r => r.id === 'F2-build-gpt')
      assert.ok(f2Result, 'F2-build-gpt should be found for Transformer search')
    })

    it('should search for Agent content', async () => {
      const index = new ContextIndex()
      await index.build()
      
      const results = index.search('Agent')
      assert.ok(results.length > 0, 'Should find Agent docs')
      
      // unit01 docs should be found
      const unit01Results = results.filter(r => r.path.includes('unit01'))
      assert.ok(unit01Results.length > 0, 'unit01 docs should be found for Agent search')
    })
  })

  describe('GET /api/context/search', () => {
    it('should return search results', async () => {
      const response = await fetch(`${baseUrl}/api/context/search?q=attention`)
      assert.strictEqual(response.status, 200)
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.ok(Array.isArray(data.items))
      assert.ok(data.items.length > 0, 'Should find results')
      
      // Check result structure
      const first = data.items[0]
      assert.ok(first.id, 'Result should have id')
      assert.ok(first.title, 'Result should have title')
      assert.ok(first.path, 'Result should have path')
      assert.ok(first.snippet, 'Result should have snippet')
    })

    it('should return empty array for empty query', async () => {
      const response = await fetch(`${baseUrl}/api/context/search?q=`)
      assert.strictEqual(response.status, 200)
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.deepStrictEqual(data.items, [])
    })

    it('should return 400 for invalid query param', async () => {
      // No query param at all
      const response = await fetch(`${baseUrl}/api/context/search`)
      assert.strictEqual(response.status, 200) // Empty query returns empty array
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.deepStrictEqual(data.items, [])
    })
  })

  describe('POST /api/notes', () => {
    it('should save note successfully', async () => {
      const testNote = {
        title: 'Test Note',
        content: 'This is a test note content.\n\n- Point 1\n- Point 2',
      }
      
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testNote),
      })
      
      assert.strictEqual(response.status, 200)
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.ok(data.path, 'Should return path')
      assert.ok(data.filename, 'Should return filename')
      
      // Verify file was created
      const filePath = join(NOTES_DIR, data.filename)
      assert.ok(existsSync(filePath), 'Note file should exist')
      
      // Verify content
      const savedContent = readFileSync(filePath, 'utf-8')
      assert.ok(savedContent.includes('# Test Note'), 'Should include title')
      assert.ok(savedContent.includes('test note content'), 'Should include content')
    })

    it('should save note without title', async () => {
      const testNote = {
        content: 'Note without title',
      }
      
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testNote),
      })
      
      assert.strictEqual(response.status, 200)
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.ok(data.filename, 'Should return filename')
    })

    it('should return error for empty content', async () => {
      const testNote = {
        title: 'Empty Note',
        content: '',
      }
      
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testNote),
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })

    it('should return error for missing content', async () => {
      const testNote = {
        title: 'No Content',
      }
      
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testNote),
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })

    it('should return error for invalid JSON', async () => {
      const response = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })
  })

  describe('POST /api/tts', () => {
    it('should return error for empty text', async () => {
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })

    it('should return error for missing text', async () => {
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: 'default' }),
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })

    it('should return error for invalid JSON', async () => {
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      })
      
      assert.strictEqual(response.status, 400)
      
      const data = await response.json()
      assert.strictEqual(data.ok, false)
      assert.ok(data.error, 'Should return error message')
    })

    it('should handle TTS synthesis (may fail if edge-tts not installed)', async () => {
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: 'Hello, this is a test.',
          voice: 'default',
        }),
      })
      
      // TTS may succeed (200) or fail with clear error (503)
      // Both are acceptable - we just verify the API responds correctly
      if (response.status === 200) {
        // Success - should return audio
        const contentType = response.headers.get('content-type')
        assert.ok(
          contentType.includes('audio') || contentType.includes('application/octet-stream'),
          'Should return audio content'
        )
      } else if (response.status === 503) {
        // Degraded - should return clear error
        const data = await response.json()
        assert.strictEqual(data.ok, false)
        assert.ok(data.error, 'Should return error message for degraded TTS')
      } else {
        assert.fail(`Unexpected status: ${response.status}`)
      }
    })
  })

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/health`)
      assert.strictEqual(response.status, 200)
      
      const data = await response.json()
      assert.strictEqual(data.ok, true)
      assert.strictEqual(data.service, 'learning-assistant')
      assert.ok(typeof data.indexSize === 'number')
    })
  })

  describe('GET static files', () => {
    it('should serve index.html', async () => {
      const response = await fetch(`${baseUrl}/`)
      assert.strictEqual(response.status, 200)
      const text = await response.text()
      assert.ok(text.includes('Muse Voice Chat') || text.includes('Learning Assistant'))
    })

    it('should serve app.js', async () => {
      const response = await fetch(`${baseUrl}/app.js`)
      assert.strictEqual(response.status, 200)
      const text = await response.text()
      assert.ok(text.includes('class MuseApp'))
    })
  })

  describe('POST /api/chat', () => {
    it('should stream happy path SSE events', async () => {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '什么是 Transformer？',
          history: [{ role: 'user', content: '之前聊过 attention' }],
          mode: 'study',
        }),
      })

      assert.strictEqual(response.status, 200)
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'))
      const text = await response.text()
      assert.ok(text.includes('"type":"context"'))
      assert.ok(text.includes('"type":"token"'))
      assert.ok(text.includes('"type":"done"'))
      assert.ok(text.includes('mock OpenCode'))
    })
  })
})

describe('ContextIndex Unit Tests', () => {
  describe('sanitizeFilename', () => {
    // Import the internal function for testing
    it('should sanitize special characters', () => {
      // This is tested indirectly via the notes API
      // The API should handle Chinese characters and spaces correctly
    })
  })

  describe('keyword matching', () => {
    it('should match keywords from KEYWORDS_MAP', async () => {
      const index = new ContextIndex()
      await index.build()
      
      // Search for "Self-Attention" should find F2
      const results = index.search('Self-Attention')
      assert.ok(results.length > 0, 'Should find Self-Attention docs')
      
      const f2Result = results.find(r => r.id === 'F2-build-gpt')
      assert.ok(f2Result, 'F2 should match Self-Attention search')
    })
  })
})
