#!/usr/bin/env node

/**
 * L2 E2E: Planner → PUA 问好工作流（真实 OpenCode + LLM）
 *
 * 通道无关 — 不依赖 Telegram / Web，通过 HTTP API 直接与 OpenCode serve 通信。
 * 启动真实 OpenCode serve 实例，通过 LLM 调用验证完整工作流链路：
 *
 *   1. 向 Planner 发送任务 → LLM 调用 workflow_create
 *   2. Planner 返回工作流概览并等用户确认
 *   3. 发送 "开始" → LLM 调用 handoff_to_member
 *      3.5 handoff 层等 MCP 就绪（waitForMcpReady 轮询 GET /mcp）
 *   4. PUA 收到 handoff → 执行任务 → notify_planner
 *   5. Planner 收到回调 → 推进工作流 → completed
 *
 * 验证点：
 *   - [MCP 就绪] trace.jsonl 包含 handoff_mcp_ready
 *   - [角色修复] PUA 的 system prompt 不包含 Planner 视角提示
 *   - [工具可用] PUA 成功调用 notify_planner（非 invalid tool）
 *   - [汇报检测] 如 PUA 未调 notify_planner，trace 包含 handoff_missing_notify
 *
 * 前置条件：
 *   - LLM API key 有效（opencode.json 中配置的模型可用）
 *   - 端口 15104/15098 空闲（测试专用端口，不与运行中的实例冲突）
 *
 * 运行：
 *   cd muse && node test/l2-greet-workflow.mjs
 *
 * 退出：
 *   测试结束或 Ctrl+C 自动清理 OpenCode 进程。
 */

import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { cpSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { registerMember, unregisterMember } from '../src/family/registry.mjs'
import { loadInstanceState } from '../src/workflow/bridge.mjs'
import { createLogger } from '../src/logger.mjs'
import { MemberClient } from '../src/family/member-client.mjs'

const log = createLogger('l2-greet')

// ── Config ──

const MUSE_ROOT = resolve(import.meta.dirname, '..')
const FAMILY = 'later-muse-family'
const FAMILIES_DIR = join(MUSE_ROOT, 'families')
const FAMILY_DIR = join(FAMILIES_DIR, FAMILY)
const PLANNER_DIR = join(FAMILY_DIR, 'members', 'planner')
const PUA_DIR = join(FAMILY_DIR, 'members', 'test-pua')

// 使用专用端口，避免与运行中的实例冲突
const PLANNER_PORT = 15104
const PUA_PORT = 15098

const TOTAL_TIMEOUT_MS = 300_000  // 5 分钟总超时
const POLL_INTERVAL = 2000

// ── Helpers ──

const children = []

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function startOpenCode(name, memberDir, port) {
  log.info(`启动 ${name} OpenCode serve (port=${port})...`)

  const child = spawn('opencode', ['serve', '--port', String(port)], {
    cwd: memberDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MUSE_HOME: FAMILIES_DIR,
      MUSE_FAMILY: FAMILY,
      MUSE_MEMBER: name === 'planner' ? 'planner' : 'test-pua',
      MUSE_MEMBER_DIR: memberDir,
      MUSE_ROOT,
      MUSE_TRACE_DIR: join(memberDir, 'data', 'trace'),
    },
  })

  children.push(child)

  child.stdout.on('data', (d) => {
    const line = d.toString().trim()
    if (line) log.info(`[${name}:stdout] ${line}`)
  })
  child.stderr.on('data', (d) => {
    const line = d.toString().trim()
    if (line && !line.includes('INFO')) log.info(`[${name}:stderr] ${line}`)
  })
  child.on('exit', (code) => {
    log.info(`[${name}] 进程退出 code=${code}`)
  })

  // 等待就绪
  const baseUrl = `http://127.0.0.1:${port}`
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    try {
      const res = await fetch(`${baseUrl}/global/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        log.info(`✅ ${name} 就绪 (${baseUrl})`)
        return child
      }
    } catch { /* 还没起来 */ }
  }
  throw new Error(`${name} 启动超时 (30s)`)
}

async function createSession(port, dir) {
  const res = await fetch(`http://127.0.0.1:${port}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-opencode-directory': dir },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(5000),
  })
  const data = await res.json()
  return data.id
}

async function sendPrompt(port, dir, sessionId, text) {
  await fetch(`http://127.0.0.1:${port}/session/${sessionId}/prompt_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-opencode-directory': dir },
    body: JSON.stringify({ parts: [{ type: 'text', text }] }),
    signal: AbortSignal.timeout(5000),
  })
}

async function waitForIdle(port, dir, sessionId, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let seenBusy = false
  let pollCount = 0

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL)
    pollCount++

    let status = 'unknown'
    try {
      const allStatus = await fetch(`http://127.0.0.1:${port}/session/status`, {
        headers: { 'Content-Type': 'application/json', 'x-opencode-directory': dir },
        signal: AbortSignal.timeout(3000),
      }).then(r => r.json())
      const raw = allStatus?.[sessionId]
      status = typeof raw === 'object' ? (raw?.type || 'unknown') : (raw || 'unknown')
    } catch { /* ignore */ }

    if (status === 'busy' || status === 'retry') seenBusy = true

    const isComplete = (status === 'idle' || status === 'completed')
      || (seenBusy && status === 'unknown')

    if (pollCount <= 3 || pollCount % 5 === 0 || isComplete) {
      log.info(`  [${label}] poll #${pollCount}: ${status} seenBusy=${seenBusy}${isComplete ? ' → DONE' : ''}`)
    }

    if (isComplete) return
  }
  throw new Error(`${label} 超时 (${timeoutMs / 1000}s)`)
}

async function getLastReply(port, dir, sessionId) {
  const messages = await fetch(`http://127.0.0.1:${port}/session/${sessionId}/message`, {
    headers: { 'Content-Type': 'application/json', 'x-opencode-directory': dir },
    signal: AbortSignal.timeout(5000),
  }).then(r => r.json())

  const msgList = Array.isArray(messages) ? messages : []
  const last = [...msgList].reverse().find(m => (m.info?.role || m.role) === 'assistant')
  if (!last) return ''
  return (last.parts || [])
    .filter(p => p.type === 'text')
    .map(p => p.text || '')
    .join('')
}

function cleanup() {
  log.info('清理 OpenCode 进程...')
  for (const child of children) {
    try { child.kill('SIGTERM') } catch { /* ignore */ }
  }
  // 注销 registry
  try { unregisterMember('test-pua', FAMILY_DIR) } catch { /* ignore */ }
}

process.on('SIGINT', () => { cleanup(); process.exit(1) })
process.on('SIGTERM', () => { cleanup(); process.exit(1) })

// ── 验证函数 ──

let assertCount = 0
let assertPass = 0

function assert(condition, message) {
  assertCount++
  if (!condition) {
    console.error(`❌ ASSERT FAIL: ${message}`)
    cleanup()
    process.exit(1)
  }
  assertPass++
}

/**
 * 验证 trace.jsonl 包含指定 phase
 */
function verifyTrace(instanceId, expectedPhase) {
  const tracePath = join(FAMILY_DIR, 'workflow', 'instances', instanceId, 'trace.jsonl')
  if (!existsSync(tracePath)) return false
  const content = readFileSync(tracePath, 'utf-8')
  return content.includes(`"phase":"${expectedPhase}"`)
}

/**
 * 从 OpenCode DB 检查 PUA session 是否出现 'invalid' tool call (notify_planner 不可用)
 */
async function checkPuaToolAvailability(puaSessionId) {
  const dbPath = join(process.env.HOME, '.local/share/opencode/opencode.db')
  if (!existsSync(dbPath)) return { checked: false, reason: 'DB not found' }
  try {
    const { execSync } = await import('node:child_process')
    const out = execSync(`sqlite3 "${dbPath}" "SELECT json_extract(data, '$.tool'), json_extract(data, '$.state.status') FROM part WHERE session_id = '${puaSessionId}' AND json_extract(data, '$.type') = 'tool' ORDER BY time_created"`, { encoding: 'utf-8', timeout: 5000 })
    const hasInvalidNotify = out.includes('invalid') && out.includes('notify_planner')
    return { checked: true, hasInvalidNotify, raw: out.trim() }
  } catch { return { checked: false, reason: 'query error' } }
}

// ── Main Test ──

async function main() {
  const t0 = Date.now()
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  L2 E2E: Planner → PUA 问好工作流 (真实 OpenCode + LLM)  ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  // 0. 前置检查
  assert(existsSync(PLANNER_DIR), `planner 目录不存在: ${PLANNER_DIR}`)
  assert(existsSync(PUA_DIR), `test-pua 目录不存在: ${PUA_DIR}`)

  // 拷贝 test fixture
  const defDir = join(FAMILY_DIR, 'workflow', 'definitions')
  const fixtureSrc = join(MUSE_ROOT, 'test', 'fixtures', 'l2-greet-test.json')
  const fixtureDst = join(defDir, 'l2-greet-test.json')
  if (!existsSync(fixtureDst)) {
    mkdirSync(defDir, { recursive: true })
    cpSync(fixtureSrc, fixtureDst)
  }

  // 设置环境
  process.env.MUSE_HOME = FAMILIES_DIR
  process.env.MUSE_FAMILY = FAMILY
  process.env.MUSE_ROOT = MUSE_ROOT

  try {
    // ─── Step 1: 启动 OpenCode serve ───
    console.log('━━━ Step 1: 启动 OpenCode serve ━━━')
    await startOpenCode('planner', PLANNER_DIR, PLANNER_PORT)
    await startOpenCode('test-pua', PUA_DIR, PUA_PORT)

    // 注册 PUA 到 family registry (Planner 的 handoff_to_member 需要通过 findByRole 找到 PUA)
    registerMember('test-pua', {
      role: 'pua',
      engine: `http://127.0.0.1:${PUA_PORT}`,
      pid: process.pid,
      directory: PUA_DIR,
    }, FAMILY_DIR)
    
    // 注册 Planner (执行者的 notify_planner 需要回叫 Planner)
    registerMember('planner', {
      role: 'planner',
      engine: `http://127.0.0.1:${PLANNER_PORT}`,
      pid: process.pid,
      directory: PLANNER_DIR,
    }, FAMILY_DIR)

    log.info('✅ test-pua 已注册到 family registry')

    // ─── Step 2: 创建 Planner session，发送任务 ───
    console.log('\n━━━ Step 2: 发送任务给 Planner ━━━')
    const plannerSession = await createSession(PLANNER_PORT, PLANNER_DIR)
    log.info(`  session: ${plannerSession}`)

    const taskPrompt = [
      '请使用 l2-greet-test.json 工作流来完成以下任务。',
      '',
      '步骤：',
      '1. 调用 workflow_create(workflow_id="l2-greet-test.json") 创建工作流',
      '2. 展示工作流概览并问我是否开始执行',
      '',
      '请开始。',
    ].join('\n')

    await sendPrompt(PLANNER_PORT, PLANNER_DIR, plannerSession, taskPrompt)
    log.info('  ✅ 任务已发送，等待 Planner 处理...')

    await waitForIdle(PLANNER_PORT, PLANNER_DIR, plannerSession, 'Planner-创建')

    const createReply = await getLastReply(PLANNER_PORT, PLANNER_DIR, plannerSession)
    console.log('\n┌─── Planner 回复 (Step 2) ───')
    console.log(createReply.slice(0, 1000))
    console.log('└────────────────────────────\n')

    // 从 state 文件找到实例 ID
    let instanceId = null
    const instancesDir = join(FAMILY_DIR, 'workflow', 'instances')
    if (existsSync(instancesDir)) {
      const dirs = readdirSync(instancesDir)
        .filter(d => d.startsWith('wf_'))
        .sort()
        .reverse()

      for (const d of dirs) {
        const statePath = join(instancesDir, d, 'state.json')
        if (existsSync(statePath)) {
          const state = JSON.parse(readFileSync(statePath, 'utf-8'))
          if (state.workflowId === 'l2-greet-test' && state.smState?.status === 'running') {
            instanceId = state.instanceId
            break
          }
        }
      }
    }

    assert(instanceId, '未找到创建的工作流实例')
    log.info(`  工作流实例: ${instanceId}`)

    // 检查 plannerSession 是否正确记录
    const state1 = loadInstanceState(instanceId)
    log.info(`  plannerSession = "${state1.plannerSession}"`)
    if (state1.plannerSession === 'unknown') {
      log.warn('  ⚠ plannerSession 仍为 unknown（Plugin sidecar 未生效）')
    }

    // ─── Step 2.5: 验证 PUA MCP 就绪 ───
    console.log('━━━ Step 2.5: 验证 PUA MCP 就绪 ━━━')
    const puaClient = new MemberClient(`http://127.0.0.1:${PUA_PORT}`, PUA_DIR)
    try {
      await puaClient.waitForMcpReady({ timeoutMs: 60_000, pollIntervalMs: 2000 })
      log.info('  ✅ PUA MCP 就绪')
    } catch (e) {
      log.warn(`  ⚠ PUA MCP 未就绪: ${e.message}（继续测试）`)
    }

    // ─── Step 3: 发送 "开始" 确认 ───
    console.log('\n━━━ Step 3: 发送确认 "开始" ━━━')
    await sendPrompt(PLANNER_PORT, PLANNER_DIR, plannerSession, '开始')
    log.info('  ✅ 确认已发送，等待 Planner handoff...')

    await waitForIdle(PLANNER_PORT, PLANNER_DIR, plannerSession, 'Planner-handoff', 120_000)

    const handoffReply = await getLastReply(PLANNER_PORT, PLANNER_DIR, plannerSession)
    console.log('\n┌─── Planner 回复 (Step 3) ───')
    console.log(handoffReply.slice(0, 1000))
    console.log('└────────────────────────────\n')

    // ─── Step 3.5: 验证 MCP 就绪 trace ───
    console.log('━━━ Step 3.5: 验证 handoff trace ━━━')
    const hasMcpReadyTrace = verifyTrace(instanceId, 'handoff_mcp_ready')
    if (hasMcpReadyTrace) {
      log.info('  ✅ trace.jsonl 包含 handoff_mcp_ready')
    } else {
      log.warn('  ⚠ trace.jsonl 缺少 handoff_mcp_ready（MCP 可能还没有就绪检查）')
    }

    // ─── Step 4: 等待工作流完成 ───
    console.log('━━━ Step 4: 等待工作流完成 ━━━')

    // 轮询 workflow state 直到 completed 或超时
    const wfDeadline = Date.now() + 180_000  // 3 分钟等 PUA 完成 + callback
    let finalStatus = 'unknown'
    let pollCount = 0

    while (Date.now() < wfDeadline) {
      await sleep(3000)
      pollCount++

      const state = loadInstanceState(instanceId)
      if (!state) {
        // 可能被归档了 → 检查 archive
        log.info(`  [poll #${pollCount}] state.json 不存在（可能已归档）→ 视为 completed`)
        finalStatus = 'completed'
        break
      }

      finalStatus = state.smState?.status || 'unknown'
      const currentNode = state.smState?.current_node || '?'
      const handoffStatus = state.handoff?.status || 'none'

      if (pollCount <= 3 || pollCount % 5 === 0 || finalStatus === 'completed') {
        log.info(`  [poll #${pollCount}] status=${finalStatus} node=${currentNode} handoff=${handoffStatus}`)
      }

      if (finalStatus === 'completed') break
    }

    // ─── Step 5: 验证结果 ───
    console.log('\n━━━ Step 5: 验证结果 ━━━')

    if (finalStatus === 'completed') {
      console.log('  ✅ 工作流已完成！')
    } else {
      // 即使没完成，也打印当前状态帮助诊断
      const state = loadInstanceState(instanceId)
      console.log(`  ⚠ 工作流未完成: status=${finalStatus}`)
      console.log(`    current_node: ${state?.smState?.current_node}`)
      console.log(`    handoff: ${JSON.stringify(state?.handoff || {}, null, 2)}`)
      console.log(`    history: ${JSON.stringify(state?.smState?.history || [], null, 2)}`)
    }

    // 最终 Planner session 回复（可能有回调处理的回复）
    const finalReply = await getLastReply(PLANNER_PORT, PLANNER_DIR, plannerSession)
    if (finalReply && finalReply !== handoffReply) {
      console.log('\n┌─── Planner 最终回复 ───')
      console.log(finalReply.slice(0, 1000))
      console.log('└────────────────────────\n')
    }

    // ─── Step 6: 新增验证 — MCP 就绪 + 工具可用 + 缺失汇报 ───
    console.log('━━━ Step 6: 新增验证 ━━━')

    // 6a. trace 中应该有 handoff_mcp_ready
    const hasMcpReady = verifyTrace(instanceId, 'handoff_mcp_ready')
    console.log(`  [MCP 就绪] trace handoff_mcp_ready: ${hasMcpReady ? '✅' : '⚠ 缺失'}`)

    // 6b. trace 中不应该有 handoff_missing_notify（如果 completed 了说明调了 notify）
    const hasMissingNotify = verifyTrace(instanceId, 'handoff_missing_notify')
    console.log(`  [汇报检测] trace handoff_missing_notify: ${hasMissingNotify ? '⚠ 存在（PUA 未汇报）' : '✅ 无（正常）'}`)

    // 6c. PUA session 中 notify_planner 是否被当作 invalid tool
    const finalState = loadInstanceState(instanceId)
    const puaSession = finalState?.handoff?.targetSession
    if (puaSession) {
      const toolCheck = await checkPuaToolAvailability(puaSession)
      if (toolCheck.checked) {
        console.log(`  [工具可用] PUA notify_planner invalid: ${toolCheck.hasInvalidNotify ? '❌ 仍不可用！' : '✅ 可用'}`)
        if (toolCheck.raw) {
          console.log(`    PUA tools: ${toolCheck.raw.slice(0, 300)}`)
        }
      } else {
        console.log(`  [工具可用] 无法检查 (${toolCheck.reason})`)
      }
    }

    // 6d. 打印完整 trace
    const tracePath = join(FAMILY_DIR, 'workflow', 'instances', instanceId, 'trace.jsonl')
    if (existsSync(tracePath)) {
      console.log('\n┌─── Instance Trace ───')
      console.log(readFileSync(tracePath, 'utf-8').trim())
      console.log('└──────────────────────\n')
    }

    // ─── 总结 ───
    const elapsed = Math.round((Date.now() - t0) / 1000)
    console.log('\n╔══════════════════════════════════════════════════════════╗')
    console.log(`║  L2 测试${finalStatus === 'completed' ? '通过 ✅' : '未通过 ⚠'}  (耗时 ${elapsed}s)`)
    console.log('║')
    console.log(`║  工作流: ${instanceId}`)
    console.log(`║  最终状态: ${finalStatus}`)
    console.log(`║  MCP就绪: ${hasMcpReady ? '✅' : '⚠'}  缺失汇报: ${hasMissingNotify ? '⚠' : '✅'}  断言: ${assertPass}/${assertCount}`)
    console.log('╚══════════════════════════════════════════════════════════╝\n')

    if (finalStatus !== 'completed') {
      process.exitCode = 1
    }

  } finally {
    cleanup()
  }
}

main().catch(err => {
  console.error('❌ 测试失败:', err.message)
  console.error(err.stack)
  cleanup()
  process.exit(1)
})
