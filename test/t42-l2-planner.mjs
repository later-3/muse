#!/usr/bin/env node

/**
 * T42-6 L2: Planner 真实联调测试（无 Telegram）
 *
 * 打桩 Telegram 层，直接用 MemberClient 与 OpenCode serve 通信。
 * 验证 Planner 全链路：接收任务 → workflow_create → handoff_to_member → 检查产出 → 完成
 *
 * 前置条件：
 *   1. planner + pua 的 opencode.json 已配置（模型 API key 需有效）
 *   2. 端口 4104/4106 空闲（或改下面的 PLANNER_PORT / PUA_PORT）
 *   3. families/later-muse-family/workflow/definitions/ 有 t42-e2e-workflow.json
 *
 * 运行：
 *   cd muse && node test/t42-l2-planner.mjs
 *
 * 退出：
 *   测试结束后自动清理 OpenCode 进程。Ctrl+C 也会清理。
 */

import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { MemberClient } from '../src/family/member-client.mjs'
import { registerMember, unregisterMember } from '../src/family/registry.mjs'
import { loadInstanceState } from '../src/workflow/bridge.mjs'
import { createLogger } from '../src/logger.mjs'

const log = createLogger('l2-test')

// ── Config ──

const MUSE_ROOT = resolve(import.meta.dirname, '..')
const FAMILY = 'later-muse-family'
const FAMILIES_DIR = join(MUSE_ROOT, 'families')
const FAMILY_DIR = join(FAMILIES_DIR, FAMILY)
const PLANNER_DIR = join(FAMILY_DIR, 'members', 'planner')
const PUA_DIR = join(FAMILY_DIR, 'members', 'test-pua')

const PLANNER_PORT = 4104
const PUA_PORT = 4106  // 避开 arch 的 4102

const TIMEOUT_MS = 300_000  // 5 分钟总超时
const POLL_INTERVAL = 3000  // 3 秒轮询

// ── Helpers ──

const children = []

async function startOpenCode(name, memberDir, port) {
  log.info(`启动 ${name} OpenCode serve (port=${port})...`)

  const child = spawn('opencode', ['serve', '--port', String(port)], {
    cwd: memberDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MUSE_HOME: FAMILIES_DIR,
      MUSE_FAMILY: FAMILY,
      MUSE_MEMBER: name,
      MUSE_MEMBER_DIR: memberDir,
      MUSE_ROOT,
      MUSE_ROLE: name === 'planner' ? 'planner' : 'pua',  // memory.mjs gates planner tools on this
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
    if (line) log.info(`[${name}:stderr] ${line}`)
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function cleanup() {
  log.info('清理 OpenCode 进程...')
  for (const child of children) {
    try { child.kill('SIGTERM') } catch { /* ignore */ }
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(1) })
process.on('SIGTERM', () => { cleanup(); process.exit(1) })

// ── Main Test ──

async function main() {
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  T42-6 L2: Planner 真实联调（无 Telegram）')
  console.log('════════════════════════════════════════════════════════\n')

  // 0. 检查前置
  if (!existsSync(PLANNER_DIR)) {
    throw new Error(`planner 目录不存在: ${PLANNER_DIR}`)
  }

  // 拷贝 test fixture 到 workflow definitions
  const defDir = join(FAMILY_DIR, 'workflow', 'definitions')
  const fixtureSrc = join(MUSE_ROOT, 'test', 'fixtures', 't42-e2e-workflow.json')
  const fixtureDst = join(defDir, 't42-e2e-workflow.json')
  if (!existsSync(fixtureDst)) {
    mkdirSync(defDir, { recursive: true })
    cpSync(fixtureSrc, fixtureDst)
    log.info(`已拷贝 t42-e2e-workflow.json → ${defDir}`)
  }

  // 设置环境变量（planner-tools 路径解析需要）
  process.env.MUSE_HOME = FAMILIES_DIR
  process.env.MUSE_FAMILY = FAMILY
  process.env.MUSE_ROOT = MUSE_ROOT

  try {
    // 1. 启动 OpenCode serve
    await startOpenCode('planner', PLANNER_DIR, PLANNER_PORT)
    
    // 检查 pua 目录是否存在
    if (existsSync(PUA_DIR)) {
      await startOpenCode('test-pua', PUA_DIR, PUA_PORT)
      // 注册 pua 到 registry
      registerMember('test-pua', {
        role: 'pua',
        engine: `http://127.0.0.1:${PUA_PORT}`,
        pid: process.pid,
      }, FAMILY_DIR)
      log.info('✅ pua 已注册到 family registry')
    } else {
      log.warn(`⚠ pua 目录不存在 (${PUA_DIR})，跳过 pua 启动`)
      log.warn('  handoff_to_member 将失败，但 Planner 状态机链路仍可测试')
    }

    // 2. 创建 Planner MemberClient
    const planner = new MemberClient(`http://127.0.0.1:${PLANNER_PORT}`, PLANNER_DIR)
    
    // 3. 发送任务给 Planner
    log.info('\n📋 发送任务给 Planner...')
    const sessionId = await planner.createSession()
    log.info(`  session: ${sessionId}`)

    const taskPrompt = [
      '请使用 t42-e2e-workflow.json 工作流来验证你的能力。',
      '',
      '步骤：',
      '1. 调用 workflow_create 创建工作流实例（workflow_id: "t42-e2e-workflow.json"）',
      '2. 调用 workflow_inspect 查看当前状态',
      '3. 如果 pua 在线，调用 handoff_to_member 分派任务给 pua',
      '4. 如果 pua 不在线，直接用 workflow_admin_transition 推进到 review（event: "doc_done"）',
      '5. 用 workflow_admin_transition 完成审核：event="approved", on_behalf_of="user", evidence="L2 测试自动通过"',
      '6. 最后调用 workflow_inspect 确认工作流到达 completed 状态',
      '',
      '请现在开始。',
    ].join('\n')

    await planner.prompt(sessionId, taskPrompt)
    log.info('  ✅ 任务已发送，等待 Planner 处理...\n')

    // 4. 轮询等待 Planner 完成（seenBusy 模式，对齐 Engine.sendAndWait）
    const deadline = Date.now() + TIMEOUT_MS
    let lastStatus = ''
    let pollCount = 0
    let seenBusy = false

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL)
      pollCount++

      // 检查 session 状态
      let sessionStatus = 'unknown'
      try {
        const allStatus = await fetch(`http://127.0.0.1:${PLANNER_PORT}/session/status`, {
          headers: { 'Content-Type': 'application/json', 'x-opencode-directory': PLANNER_DIR },
          signal: AbortSignal.timeout(3000),
        }).then(r => r.json())
        const raw = allStatus?.[sessionId]
        sessionStatus = typeof raw === 'object' ? (raw?.type || 'unknown') : (raw || 'unknown')
      } catch { /* ignore */ }

      if (sessionStatus === 'busy' || sessionStatus === 'retry') {
        seenBusy = true
      }

      // seenBusy 语义：busy 过 → unknown = idle（OpenCode 把 idle session 从 status map 删掉了）
      const isComplete = (sessionStatus === 'idle' || sessionStatus === 'completed')
        || (seenBusy && sessionStatus === 'unknown')

      if (sessionStatus !== lastStatus) {
        log.info(`  [poll #${pollCount}] session: ${sessionStatus} seenBusy=${seenBusy}${isComplete ? ' → COMPLETE' : ''}`)
        lastStatus = sessionStatus
      }

      if (isComplete) {
        log.info('\n📊 Planner 处理完成！获取回复...')
        
        const reply = await planner.fetchLastReply(sessionId)
        
        if (reply) {
          console.log('\n━━━━ Planner 回复 ━━━━')
          console.log(reply.slice(0, 3000))
          if (reply.length > 3000) console.log(`\n... (截断，共 ${reply.length} 字符)`)
          console.log('━━━━━━━━━━━━━━━━━━━━━\n')
        } else {
          // Planner 可能只执行了 tool calls（无文本回复）→ 打印 raw 消息
          log.info('  回复为空（Planner 可能只执行了 MCP 工具调用）')
          log.info('  获取所有消息...')
          try {
            const messages = await fetch(`http://127.0.0.1:${PLANNER_PORT}/session/${sessionId}/message`, {
              headers: { 'Content-Type': 'application/json', 'x-opencode-directory': PLANNER_DIR },
              signal: AbortSignal.timeout(5000),
            }).then(r => r.json())
            const msgList = Array.isArray(messages) ? messages : []
            console.log(`\n━━━━ 消息记录 (${msgList.length} 条) ━━━━`)
            for (const msg of msgList) {
              const role = msg.info?.role || msg.role || '?'
              const parts = msg.parts || []
              const textParts = parts.filter(p => p.type === 'text').map(p => p.text?.slice(0, 200))
              const toolParts = parts.filter(p => p.type === 'tool-invocation' || p.type === 'tool-result')
                .map(p => `${p.toolInvocation?.toolName || p.type}(${p.toolInvocation?.state || ''})`)
              console.log(`  [${role}] text=${textParts.length > 0 ? textParts.join('|').slice(0, 200) : '(无)'} tools=[${toolParts.join(', ')}]`)
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
          } catch (e) {
            log.warn('  获取消息失败:', e.message)
          }
        }
        break
      }

      // 每 30 秒打印一次心跳
      if (pollCount % 10 === 0) {
        log.info(`  [poll #${pollCount}] 仍在处理中 (${Math.round((Date.now() - (deadline - TIMEOUT_MS)) / 1000)}s)`)
      }
    }

    if (Date.now() >= deadline) {
      log.error(`⏰ 超时 (${TIMEOUT_MS / 1000}s)`)
    }

    // 5. 总结
    console.log('\n════════════════════════════════════════════════════════')
    console.log('  L2 测试结束')
    console.log('════════════════════════════════════════════════════════\n')

  } finally {
    cleanup()
  }
}

main().catch(err => {
  console.error('❌ 测试失败:', err.message)
  cleanup()
  process.exit(1)
})
