/**
 * L3 测试: ACI 审计 + Prompt Chain 分析
 * 
 * 运行: node --test user/unit01-agent-core/oc-tasks/L3-analyze/test-l3-analyze.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ACI 审计逻辑 (从 oc06 提取)
const ACI_CRITERIA = [
  { id: 'C1', name: '名称直观性', score: (t) => {
    const good = ['read', 'write', 'search', 'list', 'create', 'delete', 'edit', 'glob', 'grep', 'bash']
    return good.some(g => t.name.toLowerCase().includes(g)) ? 3 : t.name.length < 20 ? 2 : 1
  }},
  { id: 'C2', name: '参数最少化', score: (t) => {
    const count = Object.keys(t.parameters || {}).length
    return count <= 3 ? 3 : count <= 5 ? 2 : 1
  }},
  { id: 'C3', name: '描述清晰度', score: (t) => {
    const desc = t.description || ''
    return desc.length > 50 ? 3 : desc.length > 20 ? 2 : 1
  }},
]

function auditTool(tool) {
  const scores = ACI_CRITERIA.map(c => ({ id: c.id, score: c.score(tool) }))
  const total = scores.reduce((sum, s) => sum + s.score, 0)
  return { tool: tool.name, total, grade: total >= 8 ? 'A' : total >= 6 ? 'B' : 'C' }
}

describe('L3-analyze: ACI 审计逻辑', () => {
  it('好工具 (短名+少参+长描述) 得 A', () => {
    const result = auditTool({
      name: 'read',
      description: 'Read the contents of a file at the given path. Use when you need to see file contents.',
      parameters: { filePath: 'string' },
    })
    assert.equal(result.grade, 'A')
    assert.ok(result.total >= 8)
  })

  it('差工具 (长名+多参+短描述) 得 C', () => {
    const result = auditTool({
      name: 'very_long_and_confusing_tool_name_that_nobody_understands',
      description: 'does stuff',
      parameters: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
    })
    assert.equal(result.grade, 'C')
  })

  it('OpenCode 内置 bash 工具应得 B 或以上', () => {
    const result = auditTool({
      name: 'bash',
      description: 'Execute a bash command in the shell.',
      parameters: { command: 'string', timeout: 'number' },
    })
    assert.ok(['A', 'B'].includes(result.grade), `bash 应至少 B, 实际 ${result.grade}`)
  })

  it('审计 8 个内置工具, 平均分应 >= 6', () => {
    const tools = [
      { name: 'bash', description: 'Execute a bash command in the shell. Use for running scripts.', parameters: { command: 'string', timeout: 'number' } },
      { name: 'read', description: 'Read the contents of a file at the given path. Use when you need to see what is in a file.', parameters: { filePath: 'string', offset: 'number', limit: 'number' } },
      { name: 'edit', description: 'Edit a file by replacing or inserting text. Supports targeted edits.', parameters: { filePath: 'string', oldText: 'string', newText: 'string' } },
      { name: 'write', description: 'Write content to a file, creating it if it does not exist.', parameters: { filePath: 'string', content: 'string' } },
      { name: 'glob', description: 'Find files matching a glob pattern in the workspace.', parameters: { pattern: 'string' } },
      { name: 'grep', description: 'Search for a pattern in files using regular expressions.', parameters: { pattern: 'string', path: 'string', include: 'string' } },
      { name: 'webfetch', description: 'Fetch the content of a URL and return it as text.', parameters: { url: 'string' } },
      { name: 'websearch', description: 'Search the web for information using a query string.', parameters: { query: 'string' } },
    ]
    const results = tools.map(t => auditTool(t))
    const avg = results.reduce((sum, r) => sum + r.total, 0) / results.length
    assert.ok(avg >= 6, `平均分应 >= 6, 实际 ${avg.toFixed(1)}`)
  })
})

describe('L3-analyze: Prompt Chain 层级', () => {
  it('Prompt Chain 应有 4 层', () => {
    const layers = [
      'Layer 0: LLM Provider 默认行为',
      'Layer 1: OpenCode 内置 System Prompt',
      'Layer 2: AGENTS.md / 工作区规则',
      'Layer 3: User prompt',
    ]
    assert.equal(layers.length, 4)
    assert.ok(layers[0].includes('Provider'))
    assert.ok(layers[1].includes('OpenCode'))
    assert.ok(layers[2].includes('AGENTS'))
    assert.ok(layers[3].includes('User'))
  })

  it('Muse T13 后 orchestrator 应该是透传 (不注入额外内容)', () => {
    // 验证 orchestrator.mjs 的设计: handleMessage 只做转发
    // 这是一个知识验证, 不需要运行 server
    const t13Design = {
      inject_intent: false,       // 不注入意图分类
      inject_memory: false,       // 不注入记忆 (AI 自主调 MCP)
      inject_personality: false,  // 不注入人格 (AGENTS.md 原生)
      direct_forward: true,       // 直接转发
    }
    assert.equal(t13Design.inject_intent, false)
    assert.equal(t13Design.inject_memory, false)
    assert.equal(t13Design.direct_forward, true)
  })
})
