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
  const p = join(TMP_LOG_DIR, filename)
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
}

// Small delay to let appendFile flush
const tick = () => new Promise(r => setTimeout(r, 50))

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
    const hasMusePlugin = config.plugin.some(p => p.includes('muse/plugin'))
    assert.ok(hasMusePlugin, 'plugin 应包含 muse/plugin')
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
    await tick()

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
    await tick()

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
    await tick()

    const logs = readLog('tool-calls.jsonl')
    assert.equal(logs.length, 1)
    assert.equal(logs[0].tool, 'set_memory')
    assert.equal(logs[0].sid, 's1')
    assert.equal(logs[0].title, 'Memory set')
    assert.equal(logs[0].outputLen, 2) // 'ok'.length
    // 不应包含 args (敏感数据)
    assert.equal(logs[0].args, undefined)
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
    await tick()

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
