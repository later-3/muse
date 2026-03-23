/**
 * T10.5: Muse Plugin — Unit Tests
 *
 * 测试:
 *  1. Plugin 导出格式
 *  2. event hook 白名单 + 降级
 *  3. tool-audit 记录格式
 *  4. system-prompt 只注入动态信息
 *  5. message-hook 记录元信息
 *  6. 所有 hook 异常降级
 *  7. opencode.json 注册
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const TMP_LOG_DIR = join(__dirname, '__test-hook-logs__')

// --- Setup / Teardown ---

function setupLogDir() {
  rmSync(TMP_LOG_DIR, { recursive: true, force: true })
  mkdirSync(TMP_LOG_DIR, { recursive: true })
}

function cleanLogDir() {
  rmSync(TMP_LOG_DIR, { recursive: true, force: true })
}

function readLog(filename) {
  // 日志按日归档到 YYYY-MM-DD/ 子目录
  const date = new Date().toISOString().slice(0, 10)
  const p = join(TMP_LOG_DIR, date, filename)
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
}

// Hooks 使用 appendFileSync，无需等待 flush

// --- Tests ---

describe('T10.5: Plugin 导出格式', () => {
  it('default export 是 async function', async () => {
    const mod = await import('./index.mjs')
    assert.equal(typeof mod.default, 'function')
  })

  it('调用后返回 Hooks 对象', async () => {
    const mod = await import('./index.mjs')
    const hooks = await mod.default({ directory: TMP_LOG_DIR, project: {}, worktree: '' })
    assert.equal(typeof hooks.event, 'function', 'event hook')
    assert.equal(typeof hooks['chat.message'], 'function', 'chat.message hook')
    assert.equal(typeof hooks['tool.execute.after'], 'function', 'tool.execute.after hook')
    assert.equal(typeof hooks['experimental.chat.system.transform'], 'function', 'system.transform hook')
  })
})

describe('T10.5: opencode.json 注册', () => {
  it('opencode.json 包含 plugin 字段', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'opencode.json'), 'utf-8'))
    assert.ok(Array.isArray(config.plugin), 'plugin 应为数组')
    const hasMusePlugin = config.plugin.some(p => p.includes('plugin/index.mjs'))
    assert.ok(hasMusePlugin, 'plugin 应包含 plugin/index.mjs')
  })
})

describe('T10.5: event hook (白名单过滤)', () => {
  beforeEach(setupLogDir)
  afterEach(cleanLogDir)

  it('白名单事件被记录', async () => {
    const { createEventLogger } = await import('./hooks/event-logger.mjs')
    const hook = createEventLogger({ logDir: TMP_LOG_DIR })

    await hook({ event: { type: 'session.created', properties: { sessionID: 'test-1' } } })
    await hook({ event: { type: 'session.error', properties: { sessionID: 'test-2', error: 'boom' } } })


    const logs = readLog('events.jsonl')
    assert.equal(logs.length, 2)
    assert.equal(logs[0].type, 'session.created')
    assert.equal(logs[0].sid, 'test-1')
    assert.equal(logs[1].type, 'session.error')
    assert.ok(logs[1].error.includes('boom'))
  })

  it('高频事件被过滤', async () => {
    const { createEventLogger } = await import('./hooks/event-logger.mjs')
    const hook = createEventLogger({ logDir: TMP_LOG_DIR })

    await hook({ event: { type: 'message.partDelta', properties: {} } })
    await hook({ event: { type: 'message.updated', properties: {} } })
    await hook({ event: { type: 'session.updated', properties: {} } })


    const logs = readLog('events.jsonl')
    assert.equal(logs.length, 0, '高频事件不应被记录')
  })

  it('undefined event 不 throw', async () => {
    const { createEventLogger } = await import('./hooks/event-logger.mjs')
    const hook = createEventLogger({ logDir: TMP_LOG_DIR })

    // 不应抛错
    await hook({ event: undefined })
    await hook({ event: null })
    await hook({})
  })
})

describe('T10.5: tool-audit hook', () => {
  beforeEach(setupLogDir)
  afterEach(cleanLogDir)

  it('记录工具调用元信息', async () => {
    const { createToolAudit } = await import('./hooks/tool-audit.mjs')
    const hook = createToolAudit({ logDir: TMP_LOG_DIR })

    await hook(
      { tool: 'set_memory', sessionID: 's1', callID: 'c1', args: { key: 'secret' } },
      { title: 'Memory set', output: 'ok', metadata: {} },
    )

    const logs = readLog('tool-calls.jsonl')
    assert.equal(logs.length, 1)
    assert.equal(logs[0].tool, 'set_memory')
    assert.equal(logs[0].sid, 's1')
    assert.equal(logs[0].title, 'Memory set')
    assert.equal(logs[0].outputLen, 2) // 'ok'.length
    // 不应包含 args (敏感数据)
    assert.equal(logs[0].args, undefined)
  })

  it('记录 durationMs（start hook + audit hook 联动）', async () => {
    const { createToolStartHook, createToolAudit } = await import('./hooks/tool-audit.mjs')
    const startHook = createToolStartHook({ logDir: TMP_LOG_DIR })
    const auditHook = createToolAudit({ logDir: TMP_LOG_DIR })

    // 模拟 before → after
    await startHook({ tool: 'grep', sessionID: 's1', callID: 'c2' })
    await new Promise(r => setTimeout(r, 10)) // 模拟执行耗时
    await auditHook(
      { tool: 'grep', sessionID: 's1', callID: 'c2' },
      { title: 'grep result', output: 'found 3 lines', metadata: {} },
    )

    const logs = readLog('tool-calls.jsonl')
    assert.equal(logs.length, 1)
    assert.ok(typeof logs[0].durationMs === 'number', 'durationMs 应为数字')
    assert.ok(logs[0].durationMs >= 0, 'durationMs 应 >= 0')
    // callID 使用后应从 pending map 清除（不重复计算）
  })

  it('记录工具调用错误 error 字段', async () => {
    const { createToolAudit } = await import('./hooks/tool-audit.mjs')
    const hook = createToolAudit({ logDir: TMP_LOG_DIR })

    await hook(
      { tool: 'write_file', sessionID: 's2', callID: 'c3', args: {} },
      { title: 'write failed', output: '', metadata: {}, error: 'EACCES: permission denied' },
    )

    const logs = readLog('tool-calls.jsonl')
    assert.equal(logs.length, 1)
    assert.ok(logs[0].error?.includes('EACCES'), '应记录 error 字段')
  })

  it('outputLen 对象类型输出正确计算（非 0）', async () => {
    const { createToolAudit } = await import('./hooks/tool-audit.mjs')
    const hook = createToolAudit({ logDir: TMP_LOG_DIR })

    await hook(
      { tool: 'send_photo', sessionID: 's3', callID: 'c4', args: {} },
      { title: 'photo sent', output: { message_id: 123, ok: true }, metadata: {} },
    )

    const logs = readLog('tool-calls.jsonl')
    assert.equal(logs.length, 1)
    assert.ok(logs[0].outputLen > 0, 'outputLen 对象类型应 > 0')
    assert.ok(logs[0].outputSummary?.includes('message_id'), 'outputSummary 应包含对象内容')
  })

  it('tool-starts.jsonl 写入', async () => {
    const { createToolStartHook } = await import('./hooks/tool-audit.mjs')
    const hook = createToolStartHook({ logDir: TMP_LOG_DIR })

    await hook({ tool: 'search_image', sessionID: 's4', callID: 'c5' })

    const logs = readLog('tool-starts.jsonl')
    assert.equal(logs.length, 1)
    assert.equal(logs[0].tool, 'search_image')
    assert.equal(logs[0].sid, 's4')
    assert.equal(logs[0].callID, 'c5')
    assert.ok(typeof logs[0].ts === 'number', 'ts 应为数字')
  })
})

describe('T10.5: system-prompt hook', () => {
  it('注入动态上下文到 system 数组', async () => {
    const { createSystemPrompt } = await import('./hooks/system-prompt.mjs')
    const hook = createSystemPrompt()

    const output = { system: ['existing prompt'] }
    await hook({ model: {} }, output)

    assert.equal(output.system.length, 2, '应新增一个元素')
    assert.ok(output.system[1].includes('Muse 动态上下文'), '应包含动态上下文标记')
    assert.ok(output.system[1].includes('当前时间'), '应包含当前时间')
    // 不应包含人格相关内容
    assert.ok(!output.system[1].includes('小缪'), '不应包含人格名字')
    assert.ok(!output.system[1].includes('ENFP'), '不应包含 MBTI')
  })

  it('不覆盖已有 system 内容', async () => {
    const { createSystemPrompt } = await import('./hooks/system-prompt.mjs')
    const hook = createSystemPrompt()

    const output = { system: ['you are a helpful assistant'] }
    await hook({}, output)

    assert.equal(output.system[0], 'you are a helpful assistant', '已有内容不应被修改')
  })
})

describe('T10.5: message hook', () => {
  beforeEach(setupLogDir)
  afterEach(cleanLogDir)

  it('记录消息元信息', async () => {
    const { createMessageHook } = await import('./hooks/message-hook.mjs')
    const hook = createMessageHook({ logDir: TMP_LOG_DIR })

    await hook(
      { sessionID: 's1', agent: 'muse', model: { modelID: 'gpt-5' } },
      { message: {}, parts: [] },
    )

    const logs = readLog('messages.jsonl')
    assert.equal(logs.length, 1)
    assert.equal(logs[0].sid, 's1')
    assert.equal(logs[0].agent, 'muse')
    assert.equal(logs[0].model, 'gpt-5')
  })
})

describe('T10.5: 所有 hook 异常降级', () => {
  it('event hook 异常不 throw', async () => {
    const { createEventLogger } = await import('./hooks/event-logger.mjs')
    // logDir 不存在 → appendFile 会失败 → 不应 throw
    const hook = createEventLogger({ logDir: '/nonexistent/path' })
    await hook({ event: { type: 'session.created', properties: {} } })
  })

  it('tool-audit hook 异常不 throw', async () => {
    const { createToolAudit } = await import('./hooks/tool-audit.mjs')
    const hook = createToolAudit({ logDir: '/nonexistent/path' })
    await hook(
      { tool: 'x', sessionID: 's', callID: 'c', args: {} },
      { title: '', output: '', metadata: {} },
    )
  })

  it('system-prompt hook 异常不 throw', async () => {
    const { createSystemPrompt } = await import('./hooks/system-prompt.mjs')
    const hook = createSystemPrompt()
    // 传入 null output → 不应 throw
    await hook({}, null)
  })
})

describe('P1: TraceAggregator — session 粒度聚合', () => {
  beforeEach(setupLogDir)
  afterEach(cleanLogDir)

  it('session 完整链路写入 trace 文件', async () => {
    const { TraceAggregator } = await import('./hooks/trace-aggregator.mjs')
    const agg = new TraceAggregator({ logDir: TMP_LOG_DIR })

    agg.onSessionCreated('ses_abc', { agent: 'build', model: 'gemini-2.5-pro' })
    agg.onToolCall('ses_abc', { tool: 'read_file', durationMs: 12 })
    agg.onToolCall('ses_abc', { tool: 'write_file', durationMs: 45 })
    agg.onSessionComplete('ses_abc', { status: 'completed' })

    const tracePath = join(TMP_LOG_DIR, 'traces', 'ses_abc.json')
    assert.ok(existsSync(tracePath), 'trace 文件应存在')
    const trace = JSON.parse(readFileSync(tracePath, 'utf-8').trim())
    assert.equal(trace.sessionId, 'ses_abc')
    assert.equal(trace.agent, 'build')
    assert.equal(trace.model, 'gemini-2.5-pro')
    assert.equal(trace.status, 'completed')
    assert.equal(trace.tools.length, 2)
    assert.equal(trace.tools[0].tool, 'read_file')
    assert.equal(trace.tools[0].durationMs, 12)
    assert.ok(typeof trace.totalMs === 'number', 'totalMs 应为数字')
  })

  it('error session 记录错误信息', async () => {
    const { TraceAggregator } = await import('./hooks/trace-aggregator.mjs')
    const agg = new TraceAggregator({ logDir: TMP_LOG_DIR })

    agg.onSessionCreated('ses_err', {})
    agg.onSessionComplete('ses_err', { status: 'error', error: 'ECONNREFUSED: MCP server down' })

    const tracePath = join(TMP_LOG_DIR, 'traces', 'ses_err.json')
    const trace = JSON.parse(readFileSync(tracePath, 'utf-8').trim())
    assert.equal(trace.status, 'error')
    assert.ok(trace.error?.includes('ECONNREFUSED'), '应记录错误原因')
  })

  it('未知 session 的工具调用不 throw', async () => {
    const { TraceAggregator } = await import('./hooks/trace-aggregator.mjs')
    const agg = new TraceAggregator({ logDir: TMP_LOG_DIR })
    // 没有 onSessionCreated → 不应 throw
    agg.onToolCall('ses_unknown', { tool: 'grep', durationMs: 5 })
    agg.onSessionComplete('ses_unknown', { status: 'completed' })
    // 不应有文件（session 未被追踪）
    const tracePath = join(TMP_LOG_DIR, 'traces', 'ses_unknown.json')
    assert.ok(!existsSync(tracePath), '未追踪的 session 不应写文件')
  })

  it('complete 后 pending 清零', async () => {
    const { TraceAggregator } = await import('./hooks/trace-aggregator.mjs')
    const agg = new TraceAggregator({ logDir: TMP_LOG_DIR })
    agg.onSessionCreated('ses_x', {})
    assert.equal(agg.pendingCount, 1)
    agg.onSessionComplete('ses_x', { status: 'completed' })
    assert.equal(agg.pendingCount, 0)
  })
})
