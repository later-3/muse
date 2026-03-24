/**
 * T43: Standalone Web Cockpit — 独立家族管理服务
 *
 * 不依赖任何 member 的生命周期，独立 node 进程。
 * 通过 Family Registry + member 目录扫描发现所有成员。
 *
 * 启动方式:
 *   MUSE_HOME=./families MUSE_FAMILY=later-muse-family node src/web/standalone.mjs
 *   或: ./start-cockpit.sh [family-name]
 *
 * 端口: 4200 (可通过 COCKPIT_PORT 覆盖)
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { readRegistry, getRegistryPath } from '../family/registry.mjs'

const PORT = parseInt(process.env.COCKPIT_PORT || '4200', 10)
const HOST = process.env.COCKPIT_HOST || '127.0.0.1'

// ── MIME types ──

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
}

// ── Paths ──

function getFamilyRoot() {
  const home = process.env.MUSE_HOME
  const family = process.env.MUSE_FAMILY
  if (!home || !family) return null
  return join(home, family)
}

function getMembersDir() {
  const root = getFamilyRoot()
  return root ? join(root, 'members') : null
}

function getCockpitDir() {
  return join(import.meta.dirname, 'cockpit')
}

// ── Member Discovery ──

/**
 * 扫描 member 目录 + 合并 registry 状态
 * @returns {Array<{ name, role, status, engine?, port?, pid?, registeredAt? }>}
 */
function discoverMembers() {
  const membersDir = getMembersDir()
  if (!membersDir || !existsSync(membersDir)) return []

  // 1. 扫描 member 目录 → 所有已配置成员
  const memberDirs = readdirSync(membersDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)

  const configuredMembers = {}
  for (const name of memberDirs) {
    const configPath = join(membersDir, name, 'config.json')
    if (!existsSync(configPath)) continue
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'))
      configuredMembers[name] = {
        name,
        role: cfg.role || 'unknown',
        port: cfg.engine?.port || cfg.web?.port || null,
        status: 'offline',
      }
    } catch { /* skip malformed config */ }
  }

  // 2. 读 registry → 哪些在线
  const registryPath = getRegistryPath()
  if (registryPath) {
    try {
      const reg = readRegistry(registryPath)
      for (const [name, m] of Object.entries(reg.members)) {
        if (configuredMembers[name]) {
          configuredMembers[name].status = m.status || 'offline'
          configuredMembers[name].engine = m.engine || null
          configuredMembers[name].pid = m.pid || null
          configuredMembers[name].registeredAt = m.registeredAt || null
        }
      }
    } catch { /* registry 不可读，降级用 offline */ }
  }

  return Object.values(configuredMembers)
}

/**
 * 读取 member 配置（config.json + identity.json）
 */
function readMemberConfig(name) {
  const membersDir = getMembersDir()
  if (!membersDir) return null

  const memberDir = join(membersDir, name)
  if (!existsSync(memberDir)) return null

  const result = { name }

  // config.json
  const cfgPath = join(memberDir, 'config.json')
  if (existsSync(cfgPath)) {
    try { result.config = JSON.parse(readFileSync(cfgPath, 'utf-8')) } catch { /* skip */ }
  }

  // data/identity.json
  const idPath = join(memberDir, 'data', 'identity.json')
  if (existsSync(idPath)) {
    try { result.identity = JSON.parse(readFileSync(idPath, 'utf-8')) } catch { /* skip */ }
  }

  return result
}

// ── Health Check Proxy ──

async function proxyHealthCheck(engineUrl) {
  try {
    const resp = await fetch(`${engineUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return { ok: resp.ok, status: resp.status, data: await resp.json() }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── Workflow Instances ──

function listWorkflowInstances() {
  const root = getFamilyRoot()
  if (!root) return { active: [], archived: [] }

  const result = { active: [], archived: [] }

  // Active instances
  const instancesDir = join(root, 'workflow', 'instances')
  if (existsSync(instancesDir)) {
    for (const d of readdirSync(instancesDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const statePath = join(instancesDir, d.name, 'state.json')
      if (!existsSync(statePath)) continue
      try {
        const state = JSON.parse(readFileSync(statePath, 'utf-8'))
        result.active.push({
          instanceId: d.name,
          workflowId: state.workflowId,
          taskId: state.taskId,
          status: state.smState?.status || 'unknown',
          currentNode: state.smState?.current_node,
          bindings: (state.bindings || []).map(b => ({ role: b.role, memberName: b.memberName })),
        })
      } catch { /* skip */ }
    }
  }

  // Archived instances
  const archiveDir = join(root, 'workflow', 'archive')
  if (existsSync(archiveDir)) {
    for (const month of readdirSync(archiveDir, { withFileTypes: true })) {
      if (!month.isDirectory()) continue
      const monthDir = join(archiveDir, month.name)
      for (const d of readdirSync(monthDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        const statePath = join(monthDir, d.name, 'state.json')
        if (!existsSync(statePath)) continue
        try {
          const state = JSON.parse(readFileSync(statePath, 'utf-8'))
          result.archived.push({
            instanceId: d.name,
            workflowId: state.workflowId,
            status: state.smState?.status || 'unknown',
            month: month.name,
          })
        } catch { /* skip */ }
      }
    }
  }

  return result
}

// ── T46: Config Management Functions ──

/**
 * 读取 member 身份 (data/identity.json)
 */
function readMemberIdentity(name) {
  const membersDir = getMembersDir()
  if (!membersDir) return null

  const idPath = join(membersDir, name, 'data', 'identity.json')
  if (!existsSync(idPath)) return null

  try {
    return JSON.parse(readFileSync(idPath, 'utf-8'))
  } catch { return null }
}

/**
 * 写入 member 身份 (data/identity.json)
 * 合并更新，不覆盖未传字段
 */
function writeMemberIdentity(name, updates) {
  const membersDir = getMembersDir()
  if (!membersDir) return { error: 'MUSE_HOME not set', status: 500 }

  const memberDir = join(membersDir, name)
  if (!existsSync(memberDir)) return { error: `Member "${name}" not found`, status: 404 }

  const dataDir = join(memberDir, 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

  const idPath = join(dataDir, 'identity.json')
  let existing = {}
  if (existsSync(idPath)) {
    try { existing = JSON.parse(readFileSync(idPath, 'utf-8')) } catch { /* start fresh */ }
  }

  // Deep merge identity and psychology sections
  if (updates.identity) {
    existing.identity = { ...(existing.identity || {}), ...updates.identity }
  }
  if (updates.psychology) {
    existing.psychology = {
      ...(existing.psychology || {}),
      ...updates.psychology,
      traits: { ...(existing.psychology?.traits || {}), ...(updates.psychology?.traits || {}) },
    }
  }
  // Merge top-level metadata
  if (updates.id) existing.id = updates.id
  if (updates.schemaVersion) existing.schemaVersion = updates.schemaVersion
  existing.updatedAt = new Date().toISOString()

  writeFileSync(idPath, JSON.stringify(existing, null, 2) + '\n')

  return { ok: true, identity: existing }
}

/**
 * 读取 member 模型配置 (opencode.json → model/small_model)
 */
function readMemberModel(name) {
  const membersDir = getMembersDir()
  if (!membersDir) return null

  const ocPath = join(membersDir, name, 'opencode.json')
  if (!existsSync(ocPath)) return null

  try {
    const oc = JSON.parse(readFileSync(ocPath, 'utf-8'))
    return {
      model: oc.model || null,
      small_model: oc.small_model || null,
    }
  } catch { return null }
}

/**
 * 写入 member 模型配置 (opencode.json → model/small_model)
 * 只修改 model 字段，保留其他配置
 */
function writeMemberModel(name, updates) {
  const membersDir = getMembersDir()
  if (!membersDir) return { error: 'MUSE_HOME not set', status: 500 }

  const ocPath = join(membersDir, name, 'opencode.json')
  if (!existsSync(ocPath)) return { error: `Member "${name}" opencode.json not found`, status: 404 }

  let oc
  try { oc = JSON.parse(readFileSync(ocPath, 'utf-8')) } catch {
    return { error: 'Failed to parse opencode.json', status: 500 }
  }

  if (updates.model) oc.model = updates.model
  if (updates.small_model) oc.small_model = updates.small_model

  writeFileSync(ocPath, JSON.stringify(oc, null, 2) + '\n')

  return {
    ok: true,
    model: oc.model,
    small_model: oc.small_model,
    requiresRestart: true,
  }
}

// ── HTTP Handler ──

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function sendError(res, message, status = 400) {
  sendJSON(res, { error: message }, status)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString()
}

function serveStatic(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendError(res, 'Not found', 404)
    return
  }
  const ext = extname(filePath)
  const mime = MIME[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime })
  res.end(readFileSync(filePath))
}

/**
 * 路由匹配辅助
 * @param {string} pattern - "/api/member/:name/health"
 * @param {string} url - "/api/member/nvwa/health"
 * @returns {{ params: object } | null}
 */
function matchRoute(pattern, url) {
  const patternParts = pattern.split('/')
  const urlParts = url.split('/')
  if (patternParts.length !== urlParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(urlParts[i])
    } else if (patternParts[i] !== urlParts[i]) {
      return null
    }
  }
  return { params }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname
  const method = req.method

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  // ── API Routes ──

  // GET /api/family/members
  if (method === 'GET' && path === '/api/family/members') {
    const members = discoverMembers()
    sendJSON(res, { family: process.env.MUSE_FAMILY, members })
    return
  }

  // GET /api/member/:name/health
  const healthMatch = matchRoute('/api/member/:name/health', path)
  if (method === 'GET' && healthMatch) {
    const { name } = healthMatch.params
    const members = discoverMembers()
    const member = members.find(m => m.name === name)
    if (!member) return sendError(res, `Member "${name}" not found`, 404)
    if (member.status !== 'online' || !member.engine) {
      return sendJSON(res, { name, status: 'offline' })
    }
    const health = await proxyHealthCheck(member.engine)
    sendJSON(res, { name, ...health })
    return
  }

  // GET /api/member/:name/config
  const configMatch = matchRoute('/api/member/:name/config', path)
  if (method === 'GET' && configMatch) {
    const { name } = configMatch.params
    const cfg = readMemberConfig(name)
    if (!cfg) return sendError(res, `Member "${name}" not found`, 404)
    sendJSON(res, cfg)
    return
  }

  // POST /api/member/:name/restart
  const restartMatch = matchRoute('/api/member/:name/restart', path)
  if (method === 'POST' && restartMatch) {
    const { name } = restartMatch.params
    const members = discoverMembers()
    const member = members.find(m => m.name === name)
    if (!member) return sendError(res, `Member "${name}" not found`, 404)

    // Kill existing process if online
    if (member.pid) {
      try { process.kill(member.pid, 'SIGTERM') } catch { /* already dead */ }
    }

    // Restart via start.sh — must pass family env to child
    const { spawn } = await import('node:child_process')
    const museRoot = join(import.meta.dirname, '..', '..')
    const family = process.env.MUSE_FAMILY || ''
    const child = spawn('bash', ['start.sh', family, name], {
      cwd: museRoot,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, FAMILY: family, MUSE_FAMILY: family },
    })
    child.unref()

    sendJSON(res, { name, action: 'restart', newPid: child.pid })
    return
  }

  // GET /api/workflow/instances
  if (method === 'GET' && path === '/api/workflow/instances') {
    const instances = listWorkflowInstances()
    sendJSON(res, instances)
    return
  }

  // ── T45: OpenCode Proxy Routes ──

  // Helper: proxy to member's OpenCode API
  async function proxyToOpenCode(memberName, ocPath, reqMethod, body) {
    const members = discoverMembers()
    const member = members.find(m => m.name === memberName)
    if (!member) return { error: `Member "${memberName}" not found`, status: 404 }
    if (member.status !== 'online' || !member.engine) {
      return { error: `Member "${memberName}" is offline`, status: 503 }
    }
    try {
      const ocUrl = `${member.engine.replace(/\/$/, '')}${ocPath}`
      const fetchOpts = {
        method: reqMethod,
        headers: { 'Content-Type': 'application/json' },
      }
      if (body && (reqMethod === 'POST' || reqMethod === 'PUT')) {
        fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      const resp = await fetch(ocUrl, fetchOpts)
      const data = await resp.json().catch(() => null)
      return { data, status: resp.status, headers: resp.headers }
    } catch (e) {
      return { error: e.message, status: 502 }
    }
  }

  // GET /api/member/:name/oc/session
  const ocSessionListMatch = matchRoute('/api/member/:name/oc/session', path)
  if (method === 'GET' && ocSessionListMatch) {
    const { name } = ocSessionListMatch.params
    const result = await proxyToOpenCode(name, '/session', 'GET')
    if (result.error) return sendError(res, result.error, result.status)
    sendJSON(res, result.data, result.status)
    return
  }

  // POST /api/member/:name/oc/session
  if (method === 'POST' && ocSessionListMatch) {
    const { name } = ocSessionListMatch.params
    const body = await readBody(req)
    const result = await proxyToOpenCode(name, '/session', 'POST', body)
    if (result.error) return sendError(res, result.error, result.status)
    sendJSON(res, result.data, result.status)
    return
  }

  // GET /api/member/:name/oc/session/:sid
  const ocSessionGetMatch = matchRoute('/api/member/:name/oc/session/:sid', path)
  if (method === 'GET' && ocSessionGetMatch) {
    const { name, sid } = ocSessionGetMatch.params
    const result = await proxyToOpenCode(name, `/session/${sid}`, 'GET')
    if (result.error) return sendError(res, result.error, result.status)
    sendJSON(res, result.data, result.status)
    return
  }

  // POST /api/member/:name/oc/session/:sid/prompt_async
  const ocPromptMatch = matchRoute('/api/member/:name/oc/session/:sid/prompt_async', path)
  if (method === 'POST' && ocPromptMatch) {
    const { name, sid } = ocPromptMatch.params
    const body = await readBody(req)
    const result = await proxyToOpenCode(name, `/session/${sid}/prompt_async`, 'POST', body)
    if (result.error) return sendError(res, result.error, result.status)
    // prompt_async returns 204 No Content
    res.writeHead(result.status || 204, { 'Access-Control-Allow-Origin': '*' })
    res.end()
    return
  }

  // GET /api/member/:name/oc/session/:sid/message
  const ocMessageMatch = matchRoute('/api/member/:name/oc/session/:sid/message', path)
  if (method === 'GET' && ocMessageMatch) {
    const { name, sid } = ocMessageMatch.params
    const result = await proxyToOpenCode(name, `/session/${sid}/message`, 'GET')
    if (result.error) return sendError(res, result.error, result.status)
    sendJSON(res, result.data, result.status)
    return
  }

  // ── T46: Config Management Routes ──

  // GET /api/member/:name/identity
  const identityGetMatch = matchRoute('/api/member/:name/identity', path)
  if (method === 'GET' && identityGetMatch) {
    const { name } = identityGetMatch.params
    const identity = readMemberIdentity(name)
    if (!identity) return sendError(res, `Member "${name}" not found or no identity`, 404)
    sendJSON(res, identity)
    return
  }

  // PUT /api/member/:name/identity
  if (method === 'PUT' && identityGetMatch) {
    const { name } = identityGetMatch.params
    const body = JSON.parse(await readBody(req))
    const result = writeMemberIdentity(name, body)
    if (result.error) return sendError(res, result.error, result.status || 400)
    sendJSON(res, result)
    return
  }

  // GET /api/member/:name/model
  const modelGetMatch = matchRoute('/api/member/:name/model', path)
  if (method === 'GET' && modelGetMatch) {
    const { name } = modelGetMatch.params
    const model = readMemberModel(name)
    if (!model) return sendError(res, `Member "${name}" not found or no opencode.json`, 404)
    sendJSON(res, model)
    return
  }

  // PUT /api/member/:name/model
  if (method === 'PUT' && modelGetMatch) {
    const { name } = modelGetMatch.params
    const body = JSON.parse(await readBody(req))
    const result = writeMemberModel(name, body)
    if (result.error) return sendError(res, result.error, result.status || 400)
    sendJSON(res, result)
    return
  }

  // ── Static Files ──
  const cockpitDir = getCockpitDir()
  if (method === 'GET') {
    let filePath
    if (path === '/' || path === '/index.html') {
      filePath = join(cockpitDir, 'index.html')
    } else if (!path.startsWith('/api/')) {
      filePath = join(cockpitDir, path)
    }

    if (filePath) {
      // Security: prevent directory traversal
      if (!filePath.startsWith(cockpitDir)) {
        return sendError(res, 'Forbidden', 403)
      }
      serveStatic(res, filePath)
      return
    }
  }

  sendError(res, 'Not found', 404)
}

// ── Server lifecycle ──

const server = createServer(handleRequest)

// Only start the server when run directly (not when imported by tests)
import { pathToFileURL } from 'node:url'
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  server.listen(PORT, HOST, () => {
    const familyRoot = getFamilyRoot()
    console.log(`
┌─────────────────────────────────────────┐
│  🌸 Muse Cockpit — Family Dashboard    │
├─────────────────────────────────────────┤
│  URL:    http://${HOST}:${PORT}           │
│  Family: ${process.env.MUSE_FAMILY || '(not set)'}
│  Home:   ${process.env.MUSE_HOME || '(not set)'}
│  Root:   ${familyRoot || '(not found)'}
└─────────────────────────────────────────┘
`)
  })

  process.on('SIGINT', () => {
    console.log('\n🌸 Cockpit shutting down...')
    server.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    server.close()
    process.exit(0)
  })
}

// ── Exports for testing ──
export { discoverMembers, readMemberConfig, listWorkflowInstances, matchRoute, handleRequest }
export { readMemberIdentity, writeMemberIdentity, readMemberModel, writeMemberModel }
export { server }
