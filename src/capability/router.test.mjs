/**
 * T17: Execution Router 测试
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ROUTE_LAYERS, classifyRoute, ExecutionLog, extractToolCalls, GAP_FAILURE_TYPES, loadMcpServerNames } from './router.mjs'
import { GapJournal } from './gap-journal.mjs'

// ─── R1: 路由层定义 ───

describe('T17: ROUTE_LAYERS', () => {
  it('有 8 个层级', () => {
    assert.equal(ROUTE_LAYERS.length, 8)
  })

  it('每层都有 level/id/label/desc', () => {
    for (const layer of ROUTE_LAYERS) {
      assert.ok(layer.level, `层 ${layer.id} 缺 level`)
      assert.ok(layer.id, '缺 id')
      assert.ok(layer.label, `层 ${layer.id} 缺 label`)
      assert.ok(layer.desc, `层 ${layer.id} 缺 desc`)
    }
  })

  it('层级从 1 到 8 连续', () => {
    const levels = ROUTE_LAYERS.map(l => l.level)
    assert.deepEqual(levels, [1, 2, 3, 4, 5, 6, 7, 8])
  })
})

// ─── R3: classifyRoute ───

describe('T17: classifyRoute()', () => {
  it('null/undefined → llm', () => {
    assert.equal(classifyRoute(null), 'llm')
    assert.equal(classifyRoute(undefined), 'llm')
    assert.equal(classifyRoute(''), 'llm')
  })

  it('内置工具 → builtin', () => {
    assert.equal(classifyRoute('bash'), 'builtin')
    assert.equal(classifyRoute('read'), 'builtin')
    assert.equal(classifyRoute('write'), 'builtin')
    assert.equal(classifyRoute('edit'), 'builtin')
    assert.equal(classifyRoute('webfetch'), 'builtin')
    assert.equal(classifyRoute('websearch'), 'builtin')
    assert.equal(classifyRoute('look_at'), 'builtin')
  })

  it('task → subagent', () => {
    assert.equal(classifyRoute('task'), 'subagent')
  })

  it('MCP: config 驱动 — {serverName}_ 前缀', () => {
    const servers = ['memory-server', 'websearch']
    assert.equal(classifyRoute('memory-server_set_memory', servers), 'mcp')
    assert.equal(classifyRoute('memory-server_search_memory', servers), 'mcp')
    assert.equal(classifyRoute('websearch_web_search_exa', servers), 'mcp')
  })

  it('MCP: 无 config 时不会误判', () => {
    // 不传 mcpServerNames → 不后备下划线规则
    assert.equal(classifyRoute('memory-server_set_memory'), 'unknown')
  })

  it('custom-tool 后缀 → custom', () => {
    assert.equal(classifyRoute('calculator-tool'), 'custom')
  })

  it('未知工具 → unknown', () => {
    assert.equal(classifyRoute('someweirddthing'), 'unknown')
    assert.equal(classifyRoute('mystery'), 'unknown')
  })

  it('大小写不敏感', () => {
    assert.equal(classifyRoute('Bash'), 'builtin')
    assert.equal(classifyRoute('TASK'), 'subagent')
    assert.equal(classifyRoute('Memory-Server_set_memory', ['memory-server']), 'mcp')
  })
})

// ─── R2: ExecutionLog ───

describe('T17: ExecutionLog', () => {
  it('record 记录并返回 entry', () => {
    const log = new ExecutionLog()
    const entry = log.record({ tools: ['bash'], routes: ['builtin'], success: true, elapsed: 500 })

    assert.ok(entry.id.startsWith('exec-'))
    assert.deepEqual(entry.tools, ['bash'])
    assert.deepEqual(entry.routes, ['builtin'])
    assert.equal(entry.success, true)
  })

  it('list 返回全部，支持 route 筛选', () => {
    const log = new ExecutionLog()
    log.record({ tools: ['bash'], routes: ['builtin'] })
    log.record({ tools: ['mcp__memory'], routes: ['mcp'] })
    log.record({ tools: ['task'], routes: ['subagent'] })

    assert.equal(log.list().length, 3)
    assert.equal(log.list({ route: 'mcp' }).length, 1)
    assert.equal(log.list({ route: 'builtin' }).length, 1)
  })

  it('stats 返回统计 + 成功率', () => {
    const log = new ExecutionLog()
    log.record({ tools: ['bash'], routes: ['builtin'], success: true })
    log.record({ tools: ['bash'], routes: ['builtin'], success: true })
    log.record({ tools: [], routes: [], success: false })

    const stats = log.stats()
    assert.equal(stats.total, 3)
    assert.equal(stats.byRoute.builtin, 2)
    assert.equal(stats.byRoute.llm, 1)
    assert.equal(stats.successRate, 67)
  })

  it('summary 空 → 友好提示', () => {
    const log = new ExecutionLog()
    assert.ok(log.summary().includes('暂无'))
  })

  it('summary 有记录 → 包含统计', () => {
    const log = new ExecutionLog()
    log.record({ tools: ['bash'], routes: ['builtin'] })
    const summary = log.summary()
    assert.ok(summary.includes('builtin'))
    assert.ok(summary.includes('100%'))
  })
})

// ─── R4: Gap 联动 ───

describe('T17: ExecutionLog → Gap 联动', () => {
  it('missing_capability → 写 Gap', () => {
    const journal = new GapJournal()
    const log = new ExecutionLog({ gapJournal: journal })

    log.record({
      tools: [], routes: [],
      success: false, failureType: 'missing_capability',
      detail: '没有语音转写能力',
    })

    assert.equal(journal.list().length, 1)
    assert.equal(journal.list()[0].type, 'missing_capability')
  })

  it('execution_error → 不写 Gap (只记日志)', () => {
    const journal = new GapJournal()
    const log = new ExecutionLog({ gapJournal: journal })

    log.record({
      tools: ['bash'], routes: ['builtin'],
      success: false, failureType: 'execution_error',
      detail: 'bash 返回 1',
    })

    assert.equal(journal.list().length, 0, 'execution_error 不应写 Gap')
    assert.equal(log.list().length, 1, '但应记在 ExecutionLog')
  })

  it('route_unavailable → 写 Gap', () => {
    const journal = new GapJournal()
    const log = new ExecutionLog({ gapJournal: journal })

    log.record({
      tools: ['mcp__weather'], routes: ['mcp'],
      success: false, failureType: 'route_unavailable',
      detail: 'MCP 服务不可达',
    })

    assert.equal(journal.list().length, 1)
    assert.equal(journal.list()[0].type, 'route_unavailable')
  })

  it('无 gapJournal 时不崩溃', () => {
    const log = new ExecutionLog()
    log.record({ tools: [], routes: [], success: false, failureType: 'missing_capability' })
    assert.equal(log.list().length, 1)
  })
})

// ─── extractToolCalls ───

describe('T17: extractToolCalls()', () => {
  it('提取 type=tool 的 tool 字段 (真实 OpenCode 格式)', () => {
    const messages = [
      {
        info: { role: 'assistant' },
        parts: [
          { type: 'text', text: '让我来看看...' },
          { type: 'tool', tool: 'bash', callID: 'c1', state: {} },
          { type: 'tool', tool: 'read', callID: 'c2', state: {} },
        ],
      },
    ]
    const tools = extractToolCalls(messages)
    assert.deepEqual(tools, ['bash', 'read'])
  })

  it('去重', () => {
    const messages = [
      {
        parts: [
          { type: 'tool', tool: 'bash', callID: 'c1' },
          { type: 'tool', tool: 'bash', callID: 'c2' },
        ],
      },
    ]
    assert.deepEqual(extractToolCalls(messages), ['bash'])
  })

  it('空/无效输入 → 空数组', () => {
    assert.deepEqual(extractToolCalls(null), [])
    assert.deepEqual(extractToolCalls([]), [])
    assert.deepEqual(extractToolCalls([{ parts: [] }]), [])
  })

  it('真实 MCP 工具名格式', () => {
    const messages = [
      { parts: [{ type: 'tool', tool: 'websearch_web_search_exa' }] },
    ]
    assert.deepEqual(extractToolCalls(messages), ['websearch_web_search_exa'])
  })
})
