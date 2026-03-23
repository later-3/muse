#!/usr/bin/env node
/**
 * opencode-trace: trace-reader CLI
 *
 * Muse 自诊断工具 — 快速查看 OpenCode 内部发生了什么。
 *
 * 用法:
 *   node muse/src/plugin/trace-reader.mjs                     # 最近 10 条 session trace
 *   node muse/src/plugin/trace-reader.mjs --session ses_xxx   # 指定 session
 *   node muse/src/plugin/trace-reader.mjs --errors            # 只看出错的 session
 *   node muse/src/plugin/trace-reader.mjs --tail              # 实时 tail 今日 events
 *   node muse/src/plugin/trace-reader.mjs --tools             # 最近工具调用列表
 *   node muse/src/plugin/trace-reader.mjs --date 2026-03-18   # 指定日期的日志
 *
 * logDir 来源（同 plugin）:
 *   MUSE_TRACE_DIR env var 或 ./data/hook-logs (fallback)
 *
 * 日志按日归档：{logDir}/YYYY-MM-DD/{events,messages,tool-calls,tool-starts}.jsonl
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

// --- logDir 解析 ---
const logDir = process.env.MUSE_TRACE_DIR || join(ROOT, 'data', 'hook-logs')
const tracesDir = join(logDir, 'traces')

// --- 参数解析 ---
const args = process.argv.slice(2)
const flags = {
  session: args.find(a => a.startsWith('--session='))?.split('=')[1]
    || (args.indexOf('--session') >= 0 ? args[args.indexOf('--session') + 1] : null),
  date: args.find(a => a.startsWith('--date='))?.split('=')[1]
    || (args.indexOf('--date') >= 0 ? args[args.indexOf('--date') + 1] : null),
  errors: args.includes('--errors'),
  tail:   args.includes('--tail'),
  tools:  args.includes('--tools'),
  help:   args.includes('--help') || args.includes('-h'),
}

// --- 辅助函数 ---

/** 获取今日日期字符串 YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10)
}

/** 列出所有日期子目录，按日期升序 */
function listDateDirs() {
  if (!existsSync(logDir)) return []
  return readdirSync(logDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(d => d.name)
}

/** 读取指定日期目录下的 JSONL 文件（不指定日期则读所有日期） */
function readDailyJsonl(filename, { date = null, limit = 200 } = {}) {
  const dates = date ? [date] : listDateDirs()
  const lines = []
  for (const d of dates) {
    const filePath = join(logDir, d, filename)
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath, 'utf-8').trim()
    if (!content) continue
    for (const line of content.split('\n').filter(Boolean)) {
      try { lines.push(JSON.parse(line)) } catch { /* skip */ }
    }
  }
  return lines.slice(-limit)
}

function readTraces(sessionId = null) {
  if (!existsSync(tracesDir)) return []
  const files = readdirSync(tracesDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => !sessionId || f.includes(sessionId))
    .sort()
  return files.flatMap(f => {
    try {
      return readFileSync(join(tracesDir, f), 'utf-8')
        .trim().split('\n').filter(Boolean)
        .map(l => JSON.parse(l))
    } catch { return [] }
  })
}

function fmtMs(ms) {
  if (!ms) return '?ms'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function fmtTime(ts) {
  if (!ts) return '?'
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19)
}

// --- 模式处理 ---

if (flags.help) {
  console.log(`
opencode-trace reader — Muse 内部链路诊断

用法:
  node trace-reader.mjs                       最近 10 条 session trace
  node trace-reader.mjs --session <id>        指定 session
  node trace-reader.mjs --errors              只看出错的 session
  node trace-reader.mjs --tools               最近工具调用记录（所有日期）
  node trace-reader.mjs --tools --date 2026-03-18  指定日期的工具调用
  node trace-reader.mjs --tail                实时 tail 今日 events
  node trace-reader.mjs --help                显示此帮助

logDir: ${logDir}
日期目录: ${listDateDirs().join(', ') || '(无)'}
  `)
  process.exit(0)
}

if (flags.tail) {
  // 实时 tail 今日 events
  const dateDir = join(logDir, today())
  const eventsPath = join(dateDir, 'events.jsonl')

  if (!existsSync(eventsPath)) {
    console.log(`[trace-reader] 今日还没有 events: ${eventsPath}`)
    console.log(`[trace-reader] 可用日期: ${listDateDirs().join(', ') || '(无)'}`)
    process.exit(1)
  }
  console.log(`[trace-reader] 实时监听 ${eventsPath} (Ctrl+C 退出)\n`)

  const history = readDailyJsonl('events.jsonl', { date: today(), limit: 10 })
  history.forEach(e => {
    console.log(`${fmtTime(e.ts)} [${e.type}] ${e.sid ? `sid=${e.sid.slice(-8)}` : ''} ${e.error ? `❌ ${e.error.slice(0, 80)}` : ''}`)
  })
  console.log('--- 实时 ---')

  let lastSize = readFileSync(eventsPath).length
  setInterval(() => {
    try {
      const content = readFileSync(eventsPath, 'utf-8')
      if (content.length > lastSize) {
        const newPart = content.slice(lastSize)
        lastSize = content.length
        newPart.trim().split('\n').filter(Boolean).forEach(l => {
          try {
            const e = JSON.parse(l)
            const icon = e.type === 'session.error' ? '❌' : e.type === 'session.idle' ? '✅' : '→'
            console.log(`${fmtTime(e.ts)} ${icon} [${e.type}] ${e.sid ? `sid=${e.sid.slice(-8)}` : ''} ${e.tool ? `tool=${e.tool}` : ''} ${e.error ? e.error.slice(0, 60) : ''}`)
          } catch { /* skip */ }
        })
      }
    } catch { /* 文件可能正在写 */ }
  }, 500)
  process.on('SIGINT', () => { console.log('\n[trace-reader] 退出'); process.exit(0) })

} else if (flags.tools) {
  // 工具调用视图
  const tools = readDailyJsonl('tool-calls.jsonl', { date: flags.date, limit: 50 })
  if (!tools.length) { console.log('暂无工具调用记录'); process.exit(0) }

  const dateInfo = flags.date ? ` [${flags.date}]` : ` [全部日期: ${listDateDirs().join(', ')}]`
  console.log(`\n最近 ${tools.length} 条工具调用${dateInfo}:\n`)
  tools.forEach(t => {
    const status = t.error ? `❌ ${t.error.slice(0, 40)}` : '✅'
    const dur = t.durationMs !== undefined ? ` ${fmtMs(t.durationMs)}` : ''
    const summary = t.outputSummary ? `  → ${t.outputSummary.slice(0, 60)}` : ''
    console.log(`${fmtTime(t.ts)}  ${t.tool?.padEnd(30)}${dur}  ${status}${summary}`)
  })

} else {
  // Session trace 视图（默认）
  let traces = readTraces(flags.session)
  if (flags.errors) traces = traces.filter(t => t.status === 'error')
  traces = traces.slice(-10)

  if (!traces.length) {
    console.log(`暂无 trace 记录 (${tracesDir})`)
    console.log('提示: 与 Muse 交互后再运行此命令')
    process.exit(0)
  }

  console.log(`\n最近 ${traces.length} 条 session trace:\n${'─'.repeat(60)}`)
  traces.forEach(t => {
    const status = t.status === 'error' ? '❌ ERROR' : '✅'
    console.log(`\n${status}  Session: ${t.sessionId?.slice(-16) || '?'}`)
    console.log(`   时间: ${fmtTime(t.startedAt)}  耗时: ${fmtMs(t.totalMs)}`)
    console.log(`   Agent: ${t.agent}  Model: ${t.model}`)
    if (t.tools?.length) {
      console.log(`   工具链 (${t.tools.length}):`)
      t.tools.forEach((tool, i) => {
        const dur = tool.durationMs !== undefined ? ` ${fmtMs(tool.durationMs)}` : ''
        const err = tool.error ? ` ❌ ${tool.error.slice(0, 40)}` : ''
        console.log(`     ${i + 1}. ${tool.tool}${dur}${err}`)
      })
    } else {
      console.log(`   工具链: (无工具调用)`)
    }
    if (t.error) console.log(`   错误: ${t.error}`)
  })
  console.log(`\n${'─'.repeat(60)}`)
}
