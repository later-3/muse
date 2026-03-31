/**
 * oc06 Demo: ACI (Agent-Computer Interface) 审计
 *
 * Bloom L3 (分析): 用 Anthropic 的 ACI 设计原则审计 OpenCode 的工具
 *
 * 学到什么:
 *   1. ACI 三原则: 简洁描述 / 参数最少化 / 错误信息清晰
 *   2. OpenCode 的工具设计是否符合这些原则
 *   3. 好工具设计 vs 坏工具设计的对比
 *   4. 如何评估 MCP 工具的质量
 *
 * 参考: Anthropic "Building Effective Agents" - Tool Design 章节
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

// Anthropic ACI 审计标准
const ACI_CRITERIA = [
  { id: 'C1', name: '名称直观性', desc: '工具名是否一看就知道干什么', score: (t) => {
    const good = ['read', 'write', 'search', 'list', 'create', 'delete', 'edit', 'glob', 'grep', 'bash']
    return good.some(g => t.name.toLowerCase().includes(g)) ? 3 : t.name.length < 20 ? 2 : 1
  }},
  { id: 'C2', name: '参数最少化', desc: '是否只有必需参数，没有冗余', score: (t) => {
    const count = Object.keys(t.parameters || {}).length
    return count <= 3 ? 3 : count <= 5 ? 2 : 1
  }},
  { id: 'C3', name: '描述清晰度', desc: '描述是否告诉 LLM 何时该用这个工具', score: (t) => {
    const desc = t.description || ''
    return desc.length > 50 ? 3 : desc.length > 20 ? 2 : 1
  }},
]

function auditTool(tool) {
  const scores = ACI_CRITERIA.map(c => ({
    id: c.id, name: c.name, score: c.score(tool), max: 3
  }))
  const total = scores.reduce((sum, s) => sum + s.score, 0)
  const maxTotal = scores.length * 3
  return { tool: tool.name, scores, total, maxTotal, grade: total >= 8 ? 'A' : total >= 6 ? 'B' : 'C' }
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc06: ACI 审计 (Agent-Computer Interface)')
  console.log('   Bloom L3: 分析 OpenCode 的工具设计质量')
  console.log('═══════════════════════════════════════════════\n')

  // 获取 OpenCode 的工具列表 — 通过让 AI 列出它的工具来间接获取
  // 或者直接检查 session 的消息中包含的 tool 调用
  console.log('📋 获取 OpenCode 内置工具信息...\n')

  // OpenCode 内置工具（从源码和文档已知）
  const builtinTools = [
    { name: 'bash', description: 'Execute a bash command in the shell. Use for running scripts, installing packages, or system operations.', parameters: { command: 'string', timeout: 'number' } },
    { name: 'read', description: 'Read the contents of a file at the given path. Use when you need to see what is in a file, including text files and images.', parameters: { filePath: 'string', offset: 'number', limit: 'number' } },
    { name: 'edit', description: 'Edit a file by replacing or inserting text. Supports targeted edits with old/new text pairs.', parameters: { filePath: 'string', oldText: 'string', newText: 'string' } },
    { name: 'write', description: 'Write content to a file, creating it if it does not exist.', parameters: { filePath: 'string', content: 'string' } },
    { name: 'glob', description: 'Find files matching a glob pattern in the workspace.', parameters: { pattern: 'string' } },
    { name: 'grep', description: 'Search for a pattern in files using regular expressions.', parameters: { pattern: 'string', path: 'string', include: 'string' } },
    { name: 'webfetch', description: 'Fetch the content of a URL and return it as text.', parameters: { url: 'string' } },
    { name: 'websearch', description: 'Search the web for information using a query string.', parameters: { query: 'string' } },
  ]

  // 审计
  console.log('═══════════════════════════════════════════════')
  console.log('   🔍 ACI 审计结果')
  console.log('═══════════════════════════════════════════════\n')

  const results = builtinTools.map(t => auditTool(t))

  for (const r of results) {
    console.log(`  ${r.grade === 'A' ? '🟢' : r.grade === 'B' ? '🟡' : '🔴'} ${r.tool} — 评级: ${r.grade} (${r.total}/${r.maxTotal})`)
    for (const s of r.scores) {
      const bar = '█'.repeat(s.score) + '░'.repeat(s.max - s.score)
      console.log(`     ${s.id} ${s.name}: ${bar} ${s.score}/${s.max}`)
    }
    console.log('')
  }

  // 统计
  const grades = { A: 0, B: 0, C: 0 }
  results.forEach(r => grades[r.grade]++)

  console.log('═══════════════════════════════════════════════')
  console.log('   📊 ACI 审计总结')
  console.log('═══════════════════════════════════════════════')
  console.log(`   🟢 A 级: ${grades.A} 个工具 (优秀)`)
  console.log(`   🟡 B 级: ${grades.B} 个工具 (良好)`)
  console.log(`   🔴 C 级: ${grades.C} 个工具 (需改进)`)
  console.log('')
  console.log('   ACI 三原则 (来自 Anthropic BEA):')
  console.log('   C1: 名称直观 — 工具名一看就知道干什么')
  console.log('   C2: 参数最少 — 只暴露必需参数')
  console.log('   C3: 描述清晰 — LLM 知道何时该用这个工具')
  console.log('')
  console.log('   💡 这个审计方法同样适用于 Muse 的 MCP 工具!')
  console.log('   💡 oc09 (主线任务) 会基于此审计结果改进 Muse 的工具设计')
  console.log('')
  console.log('✅ oc06 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
