/**
 * Learning Assistant — Backend Server
 * 
 * Provides:
 * - GET /api/context/search?q= — Search local knowledge base
 * - POST /api/notes — Save notes to markdown files
 * - POST /api/tts — Text-to-Speech synthesis
 * 
 * V0: Simple index, no vector database, no complex RAG.
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { createLogger } from '../../../../src/logger.mjs'
import { ContextIndex, ensureNotesDir } from './context-index.mjs'
import { TextToSpeech } from '../../../../src/voice/tts.mjs'
import { createLearningAssistantOCClient, OCAdapterError } from './opencode-adapter.mjs'

const log = createLogger('learning-assistant-server')

/** Global instances */
const contextIndex = new ContextIndex()
const tts = new TextToSpeech()

/** Web root */
const WEB_DIR = join(import.meta.dirname, '..', 'web')

/** Notes directory */
const NOTES_DIR = ensureNotesDir()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

function getServerConfig() {
  return {
    port: parseInt(process.env.LEARNING_ASSISTANT_PORT || '4300', 10),
    host: process.env.LEARNING_ASSISTANT_HOST || '127.0.0.1',
  }
}

// ── HTTP Server ──

const server = createServer(async (req, res) => {
  const { method, url } = req
  const path = url.split('?')[0]
  const query = url.includes('?') ? url.split('?')[1] : ''
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  
  try {
    // Route: GET /api/context/search?q=
    if (method === 'GET' && path === '/api/context/search') {
      const params = new URLSearchParams(query)
      const q = params.get('q') || ''
      await handleSearch(res, q)
      return
    }
    
    // Route: POST /api/notes
    if (method === 'POST' && path === '/api/notes') {
      await handleNotesSave(req, res)
      return
    }
    
    // Route: POST /api/tts
    if (method === 'POST' && path === '/api/tts') {
      await handleTTS(req, res)
      return
    }

    // Route: POST /api/chat
    if (method === 'POST' && path === '/api/chat') {
      await handleChat(req, res)
      return
    }
    
    // Route: GET /health
    if (method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        service: 'learning-assistant',
        indexSize: contextIndex.getAll().length,
      }))
      return
    }

    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      await serveStatic(res, 'index.html')
      return
    }

    if (method === 'GET' && (path === '/app.js' || path === '/style.css')) {
      await serveStatic(res, path.slice(1))
      return
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Not Found' }))
  } catch (e) {
    log.error(`[learning-assistant] Server error: ${e.message}`)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: e.message }))
  }
})

/**
 * Handle GET /api/context/search?q=
 */
async function handleSearch(res, query) {
  log.info(`[learning-assistant] Search: "${query}"`)
  
  if (!query || query.trim().length === 0) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, items: [] }))
    return
  }
  
  const results = contextIndex.search(query)
  
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    ok: true,
    items: results.map(r => ({
      id: r.id,
      title: r.title,
      path: r.path,
      snippet: r.snippet,
    })),
  }))
  
  log.info(`[learning-assistant] Search found ${results.length} results`)
}

/**
 * Handle POST /api/notes
 */
async function handleNotesSave(req, res) {
  const body = await readJsonBody(req)
  
  if (!body) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
    return
  }
  
  const { title, content } = body
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Missing or empty content' }))
    return
  }
  
  // Generate filename
  const filename = sanitizeFilename(title || 'note')
  const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const safeFilename = `${timestamp}-${filename}.md`
  const filePath = join(NOTES_DIR, safeFilename)
  
  // Build markdown content
  const markdownContent = title 
    ? `# ${title}\n\n${content}`
    : content
  
  try {
    writeFileSync(filePath, markdownContent, 'utf-8')
    log.info(`[learning-assistant] Note saved: ${safeFilename}`)
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      path: join('user/projects/learning-assistant/notes', safeFilename),
      filename: safeFilename,
    }))
  } catch (e) {
    log.error(`[learning-assistant] Failed to save note: ${e.message}`)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: `Failed to save note: ${e.message}` }))
  }
}

/**
 * Handle POST /api/tts
 */
async function handleTTS(req, res) {
  const body = await readJsonBody(req)
  
  if (!body) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
    return
  }
  
  const { text, voice } = body
  
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Missing or empty text' }))
    return
  }
  
  log.info(`[learning-assistant] TTS request: "${text.slice(0, 50)}..."`)
  
  try {
    const result = await tts.synthesize(text, { voice })
    
    if (!result.ok) {
      log.error(`[learning-assistant] TTS failed: ${result.error}`)
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: result.error || 'TTS synthesis failed' }))
      return
    }
    
    // Return audio as mp3 (edge-tts returns mp3 internally)
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': result.buffer.length,
    })
    res.end(result.buffer)
    
    log.info(`[learning-assistant] TTS success: ${result.buffer.length} bytes via ${result.engine}`)
  } catch (e) {
    log.error(`[learning-assistant] TTS error: ${e.message}`)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: `TTS error: ${e.message}` }))
  }
}

/**
 * Handle POST /api/chat
 */
async function handleChat(req, res) {
  const body = await readJsonBody(req)

  if (!body) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }))
    return
  }

  const { message, history = [], mode = 'study' } = body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Missing or empty message' }))
    return
  }

  const contextItems = contextIndex.search(message).slice(0, 3)
    .map(item => ({
      id: item.id,
      title: item.title,
      path: item.path,
      snippet: item.snippet,
    }))

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  const controller = {
    enqueue(chunk) {
      res.write(Buffer.from(chunk))
    },
    close() {
      if (!res.writableEnded) res.end()
    },
  }

  try {
    const ocClient = createLearningAssistantOCClient()
    await ocClient.chatStream({ message, history, contextItems, mode }, controller)
  } catch (e) {
    const event = `data: ${JSON.stringify({ type: 'error', message: e.message, code: e.code || 'CHAT_FAILED' })}\n\n`
    res.write(event)
    res.end()
  }
}

/**
 * Read and parse JSON body from request
 */
async function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve(body ? JSON.parse(body) : null)
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // Keep Chinese chars
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

async function serveStatic(res, fileName) {
  const filePath = join(WEB_DIR, fileName)
  const content = await readFile(filePath)
  const mime = MIME[extname(fileName)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime })
  res.end(content)
}

/**
 * Start the server
 */
export async function startServer() {
  const { port, host } = getServerConfig()

  // Build index before starting
  log.info('[learning-assistant] Building context index...')
  await contextIndex.build()
  
  return new Promise((resolve, reject) => {
    server.listen(port, host, (err) => {
      if (err) {
        log.error(`[learning-assistant] Failed to start: ${err.message}`)
        reject(err)
        return
      }
      log.info(`[learning-assistant] Server running at http://${host}:${port}`)
      log.info(`[learning-assistant] Indexed ${contextIndex.getAll().length} documents`)
      resolve(server)
    })
  })
}

/**
 * Stop the server
 */
export async function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      log.info('[learning-assistant] Server stopped')
      resolve()
    })
  })
}

// ── CLI Entry ──

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(err => {
    log.error(`[learning-assistant] Startup failed: ${err.message}`)
    process.exit(1)
  })
}

// Export for testing
export { contextIndex, NOTES_DIR }
