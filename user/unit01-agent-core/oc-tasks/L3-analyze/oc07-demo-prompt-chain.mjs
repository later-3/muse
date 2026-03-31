/**
 * oc07 Demo: Prompt Chain 分析
 *
 * Bloom L3 (分析): 分析 OpenCode + Muse 如何组装 System Prompt
 *
 * 学到什么:
 *   1. System Prompt 是 Agent 行为的核心控制器
 *   2. OpenCode 的 prompt 由 AGENTS.md + 内置指令组成
 *   3. Muse 通过 orchestrator 不注入额外内容 (T12/T13 去包装化)
 *   4. Prompt Chain 设计: 分层注入 vs 单层注入的对比
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc07: Prompt Chain 分析')
  console.log('   Bloom L3: 分析 System Prompt 组装方式')
  console.log('═══════════════════════════════════════════════\n')

  // ===== 实验 1: System Prompt 的影响 =====
  console.log('🧪 实验 1: 默认 system prompt 下的行为')
  const session1 = await client.createSession()
  await client.sendMessage(session1.id, '你的角色是什么？你有什么限制？简短回答。')
  await client.waitForCompletion(session1.id)
  const msgs1 = await client.getMessages(session1.id)
  const reply1 = msgs1.filter(m => m.info?.role === 'assistant').pop()
  const text1 = (reply1?.parts || []).filter(p => p.type === 'text').map(p => p.text).join('\n')
  console.log(`   回复: ${text1.slice(0, 200)}...\n`)

  // ===== 实验 2: 通过工作区的 AGENTS.md 注入人格 =====
  console.log('🧪 实验 2: Prompt Chain 剖析\n')
  console.log('   OpenCode 的 Prompt Chain 分层:')
  console.log('   ┌─────────────────────────────────────────┐')
  console.log('   │ Layer 0: LLM Provider 默认行为          │')
  console.log('   │   (模型自带的训练指令)                   │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Layer 1: OpenCode 内置 System Prompt    │')
  console.log('   │   "You are an AI coding assistant..."   │')
  console.log('   │   工具使用说明                           │')
  console.log('   │   输出格式约束                           │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Layer 2: AGENTS.md / .agents/ (工作区)  │')
  console.log('   │   项目特定规则                           │')
  console.log('   │   人格注入 (Muse 的 T12)                │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Layer 3: 用户消息 (User prompt)         │')
  console.log('   │   "请列出当前目录的文件"                 │')
  console.log('   └─────────────────────────────────────────┘\n')

  // ===== 实验 3: Muse 的 T12/T13 去包装化 =====
  console.log('🧪 实验 3: Muse 的 Prompt 策略\n')
  console.log('   Muse T13 前 (旧设计):')
  console.log('   ┌────────────────────────────────────────┐')
  console.log('   │ orchestrator.mjs 包了一层:              │')
  console.log('   │   原始消息 + 意图分类 + 记忆注入 + 后处理│')
  console.log('   │   → 发给 OpenCode 的是加工过的 prompt   │')
  console.log('   └────────────────────────────────────────┘')
  console.log('')
  console.log('   Muse T13 后 (现设计):')
  console.log('   ┌────────────────────────────────────────┐')
  console.log('   │ orchestrator.mjs 什么都不做:            │')
  console.log('   │   [直接转发] ← 不注入额外内容          │')
  console.log('   │   人格: AGENTS.md 原生注入 (Layer 2)    │')
  console.log('   │   记忆: AI 自主调 MCP (不需要注入)      │')
  console.log('   │   审计: Hook 自动观察 (不需要包装)      │')
  console.log('   └────────────────────────────────────────┘\n')

  // ===== 分析: 对比两种设计 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 Prompt Chain 设计对比')
  console.log('═══════════════════════════════════════════════\n')

  const comparison = [
    ['', '包装式 (T13前)', '透传式 (T13后)'],
    ['Prompt 来源', 'orchestrator 注入', 'AGENTS.md 原生'],
    ['记忆注入', '手动拼接到 prompt', 'AI 自主调 MCP'],
    ['上下文窗口', '浪费 (重复注入)', '高效 (按需获取)'],
    ['可预测性', '低 (注入逻辑复杂)', '高 (所见即所得)'],
    ['调试难度', '难 (要看注入了什么)', '易 (直接看 AGENTS.md)'],
  ]

  const colWidths = [14, 20, 20]
  for (const row of comparison) {
    const formatted = row.map((cell, i) => cell.padEnd(colWidths[i])).join(' │ ')
    console.log(`   ${formatted}`)
    if (row === comparison[0]) {
      console.log(`   ${'─'.repeat(14)} ┼ ${'─'.repeat(20)} ┼ ${'─'.repeat(20)}`)
    }
  }

  console.log('\n   💡 这就是 Anthropic BEA 说的:')
  console.log('      "Keep your agent\'s system prompt simple and focused"')
  console.log('      Muse 的 T13 瘦身就是遵循这个原则!\n')

  console.log('✅ oc07 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
