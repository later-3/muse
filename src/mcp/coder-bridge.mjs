/**
 * coder-bridge MCP Server
 *
 * 让 test-pua 通过 MCP 工具操控 test-coder 的 opencode 实例。
 * 内置任务状态机：工具调用时自动更新 state.json。
 *
 * 工具:
 *   coder_get_status    — 检查 coder 是否 idle
 *   coder_create_session — 创建 coder session
 *   coder_send_prompt   — 发任务/修复指令
 *   coder_read_output   — 读最新 assistant 回复
 *   coder_get_diff      — 获取 worktree diff
 *   coder_wait_idle     — 等待 coder 完成（SSE 主通道 + 轮询健康检查兜底）
 *
 * Env: CODER_PORT (默认 4099), CODER_RUNS_DIR (状态产物目录)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// --- Config ---

const CODER_PORT = process.env.CODER_PORT || '4099'
const CODER_BASE = `http://localhost:${CODER_PORT}`
const RUNS_DIR = process.env.CODER_RUNS_DIR || ''

function log(level, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data }
  process.stderr.write(JSON.stringify(entry) + '\n')
}

// --- State Manager ---

async function updateState(taskId, newState, note = '') {
  if (!RUNS_DIR || !taskId) return
  const dir = join(RUNS_DIR, taskId)
  const file = join(dir, 'state.json')

  let state = { task_id: taskId, state: newState, history: [] }
  try {
    const existing = JSON.parse(await readFile(file, 'utf8'))
    state = existing
  } catch { /* first write */ }

  state.state = newState
  state.updated_at = new Date().toISOString()
  state.history.push({ state: newState, at: state.updated_at, note })

  await mkdir(dir, { recursive: true })
  await writeFile(file, JSON.stringify(state, null, 2))
  log('info', `state → ${newState}`, { taskId, note })
}

async function saveArtifact(taskId, filename, data) {
  if (!RUNS_DIR || !taskId) return
  const dir = join(RUNS_DIR, taskId)
  await mkdir(dir, { recursive: true })
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  await writeFile(join(dir, filename), content)
  log('info', `artifact saved: ${filename}`, { taskId })
}

// --- Gate: P11 workflow enforcement ---

async function checkGate(taskId) {
  if (!RUNS_DIR || !taskId) {
    return { pass: false, reason: 'Missing RUNS_DIR or task_id' }
  }
  const dir = join(RUNS_DIR, taskId)
  try {
    await readFile(join(dir, 'task-package.json'), 'utf8')
  } catch {
    return { pass: false, reason: 'task-package.json not found. Complete phase 1 first.' }
  }
  try {
    const state = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'))
    if (!state.user_approved) {
      return { pass: false, reason: 'user_approved is not true. User must approve task spec first.' }
    }
  } catch {
    return { pass: false, reason: 'state.json missing or invalid.' }
  }
  return { pass: true }
}

async function approveTask(taskId) {
  if (!RUNS_DIR || !taskId) return { approved: false, reason: 'Missing RUNS_DIR or task_id' }
  const dir = join(RUNS_DIR, taskId)
  const statePath = join(dir, 'state.json')
  let state = { task_id: taskId, state: 'approved', history: [], user_approved: true }
  try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch {}
  state.user_approved = true
  state.state = 'approved'
  state.updated_at = new Date().toISOString()
  state.history.push({ state: 'approved', at: state.updated_at, note: 'User approved task spec' })
  await mkdir(dir, { recursive: true })
  await writeFile(statePath, JSON.stringify(state, null, 2))
  log('info', 'task approved by user', { taskId })
  return { approved: true, taskId }
}

// --- HTTP Helpers ---

async function coderFetch(path, options = {}) {
  const url = `${CODER_BASE}${path}`
  log('debug', `fetch ${options.method || 'GET'} ${url}`)
  try {
    const resp = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(options.timeout || 15_000),
    })
    return resp
  } catch (err) {
    log('error', `fetch failed: ${url}`, { error: err.message })
    throw new Error(`coder 不可达 (${url}): ${err.message}。请确认 coder 是否在端口 ${CODER_PORT} 运行。`)
  }
}

function ok(text) {
  return { content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text, null, 2) }] }
}

function fail(msg) {
  return { content: [{ type: 'text', text: `❌ ${msg}` }], isError: true }
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'coder_get_status',
    description: '检查 coder 的 session 状态。返回所有 session 的 idle/busy/error 状态。用于判断 coder 是否可用或是否完成了当前任务。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'coder_approve_task',
    description: 'Mark task spec as user-approved. Only call AFTER user explicitly says approved. Sets user_approved=true in state.json, unlocking coder_create_session.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'coder_create_session',
    description: 'Create a coder session. BLOCKED until coder_approve_task is called (user must approve task spec first). Will return error if user_approved is not true.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID (required for gate check)' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'coder_send_prompt',
    description: '向 coder 的 session 发送 prompt（任务包或修复指令）。异步执行，不等待完成。发送后用 coder_wait_idle 等待。',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'coder 的 session ID' },
        text: { type: 'string', description: '要发送的 prompt 文本' },
        task_id: { type: 'string', description: '任务 ID，用于状态记录' },
        is_fix: { type: 'boolean', description: '是否为修复指令（不同的状态转换）', default: false },
      },
      required: ['session_id', 'text'],
    },
  },
  {
    name: 'coder_read_output',
    description: '读取 coder 最新的 assistant 回复。过滤出 assistant 消息中的文本部分并返回。',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'coder 的 session ID' },
        task_id: { type: 'string', description: '任务 ID，用于保存 coder-report' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'coder_get_diff',
    description: '获取 coder worktree 中的文件改动（git diff）。用于审核 coder 改了什么文件。',
    inputSchema: {
      type: 'object',
      properties: {
        worktree_path: { type: 'string', description: 'worktree 的绝对路径' },
      },
      required: ['worktree_path'],
    },
  },
  {
    name: 'coder_wait_idle',
    description: '等待 coder 完成当前任务。使用 SSE 实时监听 coder 的 session.status 事件（主通道），同时每 60s 做健康检查（兜底）。如果 coder 长时间 busy 无进展则报 stuck。',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'coder 的 session ID' },
        timeout_ms: { type: 'number', description: '超时毫秒数（默认 600000 = 10 分钟）', default: 600000 },
        health_check_interval_ms: { type: 'number', description: '健康检查间隔（默认 60000 = 60 秒）', default: 60000 },
        task_id: { type: 'string', description: '任务 ID，用于状态记录' },
      },
      required: ['session_id'],
    },
  },
]

// --- Tool Handlers ---

async function handleGetStatus() {
  log('info', 'coder_get_status: 检查 coder 健康状态')
  const resp = await coderFetch('/session')
  const sessions = await resp.json()

  // 同时获取 session status（idle/busy）
  let sessionStatus = {}
  try {
    const statusResp = await coderFetch('/session/status')
    sessionStatus = await statusResp.json()
  } catch (err) {
    log('warn', 'coder_get_status: 无法获取 session status', { error: err.message })
  }

  const summary = Array.isArray(sessions)
    ? sessions.slice(0, 10).map(s => ({
        id: s.id,
        title: s.title,
        directory: s.directory,
        status: sessionStatus[s.id]?.type || 'idle',
        updated: s.time?.updated,
      }))
    : sessions

  log('info', 'coder_get_status: 完成', { sessionCount: Array.isArray(sessions) ? sessions.length : '?' })
  return ok({ coder_port: CODER_PORT, sessions: summary })
}

async function handleApproveTask(args) {
  const { task_id } = args
  if (!task_id) return fail('task_id is required')
  const result = await approveTask(task_id)
  if (!result.approved) return fail(result.reason)
  return ok({ approved: true, task_id, message: 'Task spec approved. You can now call coder_create_session.' })
}

async function handleCreateSession(args) {
  const { task_id } = args

  // P11 Gate: user must approve before dispatching to coder
  if (!task_id) return fail('task_id is required for gate check')
  const gate = await checkGate(task_id)
  if (!gate.pass) {
    log('warn', 'gate BLOCKED coder_create_session', { taskId: task_id, reason: gate.reason })
    return fail('Gate blocked: ' + gate.reason)
  }

  const resp = await coderFetch('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const session = await resp.json()
  await updateState(task_id, 'dispatched', `session=${session.id}`)

  log('info', 'session created (gate passed)', { sessionId: session.id, taskId: task_id })
  return ok({ session_id: session.id, task_id })
}

async function handleSendPrompt(args) {
  const { session_id, text, task_id, is_fix } = args

  const body = { parts: [{ type: 'text', text }] }
  const resp = await coderFetch(`/session/${session_id}/prompt_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 30_000,
  })

  const httpCode = resp.status
  // prompt_async 返回 204 空 body，不要 JSON.parse
  if (httpCode >= 400) {
    const errText = await resp.text().catch(() => '')
    return fail(`prompt 发送失败 (HTTP ${httpCode}): ${errText}`)
  }

  if (task_id) {
    const state = is_fix ? 'coding' : 'coding'
    const note = is_fix ? `修复指令已发送 (session=${session_id})` : `开发指令已发送 (session=${session_id})`
    await updateState(task_id, state, note)
  }

  log('info', 'prompt sent', { sessionId: session_id, httpCode, isFix: is_fix })
  return ok({ sent: true, http_code: httpCode, session_id })
}

async function handleReadOutput(args) {
  const { session_id, task_id } = args

  const resp = await coderFetch(`/session/${session_id}/message`, { timeout: 30_000 })
  const messages = await resp.json()

  // 过滤 assistant 消息，取最后一条
  const assistantMsgs = messages.filter(m => m.info?.role === 'assistant')
  if (assistantMsgs.length === 0) {
    return ok({ text: '（coder 尚未回复）', total_messages: messages.length })
  }

  const last = assistantMsgs[assistantMsgs.length - 1]
  const textParts = (last.parts || [])
    .filter(p => p.type === 'text')
    .map(p => p.text || p.content || '')
  const text = textParts.join('\n')

  const meta = {
    agent: last.info?.agent,
    model: last.info?.modelID,
    total_messages: messages.length,
    assistant_messages: assistantMsgs.length,
  }

  // 保存 coder report
  if (task_id) {
    await saveArtifact(task_id, 'coder-report.json', { text, meta, saved_at: new Date().toISOString() })
    await updateState(task_id, 'checking', 'coder 输出已读取')
  }

  return ok({ text, meta })
}

async function handleGetDiff(args) {
  const { worktree_path } = args

  try {
    const { stdout: nameOnly } = await execFileAsync('git', ['diff', 'HEAD', '--name-only'], {
      cwd: worktree_path,
      timeout: 15_000,
    })

    const { stdout: stat } = await execFileAsync('git', ['diff', 'HEAD', '--stat'], {
      cwd: worktree_path,
      timeout: 15_000,
    })

    const { stdout: diff } = await execFileAsync('git', ['diff', 'HEAD'], {
      cwd: worktree_path,
      timeout: 30_000,
    })

    const changedFiles = nameOnly.trim().split('\n').filter(Boolean)

    // 检查未跟踪的新文件
    const { stdout: untracked } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: worktree_path,
      timeout: 15_000,
    })
    const untrackedFiles = untracked.trim().split('\n').filter(Boolean)

    return ok({
      changed_files: changedFiles,
      untracked_files: untrackedFiles,
      stat: stat.trim(),
      diff: diff.length > 10000 ? diff.slice(0, 10000) + '\n... (truncated)' : diff,
    })
  } catch (err) {
    return fail(`git diff 失败: ${err.message}`)
  }
}

/**
 * coder_wait_idle — SSE 主通道 + 轮询健康检查兜底
 *
 * 1. SSE 监听 coder 的 /event 流，实时捕获 session.status=idle
 * 2. 每 health_check_interval_ms 做一次健康检查（HTTP GET），确认 coder 没挂
 * 3. 超过 timeout_ms 未收到 idle → 报 stuck/timeout
 */
async function handleWaitIdle(args) {
  const { session_id, timeout_ms = 600_000, health_check_interval_ms = 60_000, task_id } = args
  const startTime = Date.now()
  const elapsed = () => Date.now() - startTime
  const elapsedSec = () => Math.round(elapsed() / 1000)

  log('info', 'wait_idle: 开始等待', { sessionId: session_id, timeoutMs: timeout_ms, mode: 'SSE+healthcheck' })

  return new Promise((resolve) => {
    let settled = false
    let sseConnected = false
    let healthCheckTimer = null
    let timeoutTimer = null
    let abortController = null
    let lastEventTime = Date.now()

    function finish(result) {
      if (settled) return
      settled = true
      if (healthCheckTimer) clearInterval(healthCheckTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (abortController) abortController.abort()
      resolve(result)
    }

    // --- SSE 主通道 ---
    async function connectSSE() {
      const url = `${CODER_BASE}/event`
      log('info', 'wait_idle: SSE 连接中...', { url })

      try {
        abortController = new AbortController()
        const resp = await fetch(url, {
          signal: abortController.signal,
          headers: { 'Accept': 'text/event-stream' },
        })

        if (!resp.ok) {
          log('warn', 'wait_idle: SSE 连接失败，降级为纯轮询', { status: resp.status })
          startPollFallback()
          return
        }

        sseConnected = true
        log('info', 'wait_idle: SSE 已连接', { elapsedSec: elapsedSec() })

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!settled) {
          const { done, value } = await reader.read()
          if (done) {
            log('warn', 'wait_idle: SSE 流结束', { elapsedSec: elapsedSec() })
            if (!settled) startPollFallback()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            lastEventTime = Date.now()

            try {
              const event = JSON.parse(line.slice(6))
              const eventType = event.type || event.properties?.type || ''

              // session.status 事件
              if (eventType === 'session.status' || event.type === 'session.status') {
                const status = event.properties?.status || event.status
                const sid = event.properties?.sessionID || event.sessionID
                log('info', `wait_idle: SSE session.status`, { sid, status: status?.type, targetSid: session_id })

                if (sid === session_id && status?.type === 'idle') {
                  log('info', 'wait_idle: ✅ coder idle（SSE 实时）', { elapsedSec: elapsedSec() })
                  finish(ok({ status: 'idle', elapsed_ms: elapsed(), detected_by: 'sse' }))
                  return
                }
              }

              // session.idle 事件（deprecated 但仍推送）
              if (eventType === 'session.idle') {
                const sid = event.properties?.sessionID || event.sessionID
                if (sid === session_id) {
                  log('info', 'wait_idle: ✅ coder idle（SSE session.idle）', { elapsedSec: elapsedSec() })
                  finish(ok({ status: 'idle', elapsed_ms: elapsed(), detected_by: 'sse_idle' }))
                  return
                }
              }
            } catch {
              // 非 JSON 行，跳过
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return  // 正常取消
        log('warn', 'wait_idle: SSE 异常，降级为纯轮询', { error: err.message, elapsedSec: elapsedSec() })
        if (!settled) startPollFallback()
      }
    }

    // --- 轮询兜底（SSE 失败时启用，或作为健康检查） ---
    function startPollFallback() {
      log('info', 'wait_idle: 启用轮询兜底', { intervalMs: 10_000 })
      const pollTimer = setInterval(async () => {
        if (settled) { clearInterval(pollTimer); return }
        try {
          const resp = await coderFetch(`/session/${session_id}/message`, { timeout: 10_000 })
          const messages = await resp.json()
          const assistantMsgs = messages.filter(m => m.info?.role === 'assistant')
          if (assistantMsgs.length > 0) {
            const last = assistantMsgs[assistantMsgs.length - 1]
            const hasStepFinish = (last.parts || []).some(p => p.type === 'step-finish')
            if (hasStepFinish) {
              log('info', 'wait_idle: ✅ coder idle（轮询兜底）', { elapsedSec: elapsedSec() })
              clearInterval(pollTimer)
              finish(ok({ status: 'idle', elapsed_ms: elapsed(), detected_by: 'poll_fallback' }))
            }
          }
        } catch (err) {
          log('warn', 'wait_idle: 轮询兜底异常', { error: err.message })
        }
      }, 10_000)
    }

    // --- 健康检查（定期确认 coder 没挂） ---
    healthCheckTimer = setInterval(async () => {
      if (settled) return
      const sinceLastEvent = Date.now() - lastEventTime
      log('info', 'wait_idle: 健康检查', {
        elapsedSec: elapsedSec(),
        sseConnected,
        sinceLastEventSec: Math.round(sinceLastEvent / 1000),
      })

      try {
        const resp = await fetch(`${CODER_BASE}/session`, { signal: AbortSignal.timeout(5_000) })
        if (!resp.ok) {
          log('error', 'wait_idle: ⚠️ coder 健康检查失败', { status: resp.status })
        } else {
          log('debug', 'wait_idle: coder 健康')
        }
      } catch (err) {
        log('error', 'wait_idle: ⚠️ coder 不可达！可能已退出', { error: err.message, elapsedSec: elapsedSec() })
        if (task_id) {
          await updateState(task_id, 'aborted', `coder 不可达 (${elapsedSec()}s)`).catch(() => {})
        }
        finish(fail(`coder 不可达，可能已退出。elapsed=${elapsedSec()}s。检查 coder 终端和 trace。`))
      }
    }, health_check_interval_ms)

    // --- 超时 ---
    timeoutTimer = setTimeout(async () => {
      if (settled) return
      log('error', 'wait_idle: ⏰ 超时', { timeoutMs: timeout_ms, elapsedSec: elapsedSec(), sseConnected })
      if (task_id) {
        await updateState(task_id, 'aborted', `coder 超时 (${elapsedSec()}s, sseConnected=${sseConnected})`).catch(() => {})
      }
      finish(fail(`coder 超时 (${elapsedSec()}s)。SSE=${sseConnected ? '已连' : '未连'}。检查 coder trace。`))
    }, timeout_ms)

    // 启动 SSE
    connectSSE()
  })
}

// --- Server Setup ---

const server = new Server(
  { name: 'coder-bridge', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  log('info', `tool call: ${name}`, { args })

  try {
    switch (name) {
      case 'coder_get_status':
        return await handleGetStatus()
      case 'coder_approve_task':
        return await handleApproveTask(args)
      case 'coder_create_session':
        return await handleCreateSession(args)
      case 'coder_send_prompt':
        return await handleSendPrompt(args)
      case 'coder_read_output':
        return await handleReadOutput(args)
      case 'coder_get_diff':
        return await handleGetDiff(args)
      case 'coder_wait_idle':
        return await handleWaitIdle(args)
      default:
        return fail(`未知工具: ${name}`)
    }
  } catch (err) {
    log('error', `tool error: ${name}`, { error: err.message, stack: err.stack })
    return fail(`${name} 失败: ${err.message}`)
  }
})

// --- Start ---

const transport = new StdioServerTransport()
await server.connect(transport)
log('info', 'coder-bridge MCP started', { port: CODER_PORT, runsDir: RUNS_DIR })
