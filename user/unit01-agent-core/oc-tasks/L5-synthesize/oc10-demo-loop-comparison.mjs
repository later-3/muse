/**
 * oc10 Demo: Agent Loop 实现对比
 *
 * Bloom L5 (综合): 对比 3 种 Agent Loop 实现，提炼设计模式
 *
 * 学到什么:
 *   1. 三种 Agent Loop 的核心差异
 *   2. 同步 vs 异步 Loop 的 trade-off
 *   3. 为什么 OpenCode 选择了异步 poll 而不是 streaming
 *   4. 动手验证: 同一个任务用同步和异步分别实现
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient, buildLoopSummary, extractReplyText } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc10: Agent Loop 实现对比')
  console.log('   Bloom L5: 综合 3 种架构的设计取舍')
  console.log('═══════════════════════════════════════════════\n')

  // ===== 方式 A: 伪同步 (Anthropic cookbook 风格) =====
  console.log('🅰️  方式 A: 伪同步 — Anthropic cookbook 风格')
  console.log('   代码: response = client.messages.create(model, messages)')
  console.log('   特点: 调用方阻塞等待, SDK 内部处理 streaming')
  console.log('')
  console.log('   while True:')
  console.log('     response = call_llm(messages)')
  console.log('     if response.has_tool_calls:')
  console.log('       results = execute_tools(response.tool_calls)')
  console.log('       messages.append(results)')
  console.log('       continue  # 下一轮')
  console.log('     else:')
  console.log('       break  # 完成')
  console.log('')

  // ===== 方式 B: 异步 poll (OpenCode 风格) =====
  console.log('🅱️  方式 B: 异步 poll — OpenCode 风格')
  console.log('   代码: POST prompt_async → poll status → GET messages')
  console.log('   特点: 非阻塞, Agent Loop 在服务端跑, 客户端只管等')
  console.log('')

  // 实际跑一次验证
  console.log('   实际运行:')
  const session = await client.createSession()
  const start = Date.now()
  await client.sendMessage(session.id, '1+1等于多少？只回复数字。')
  const { elapsed, polls } = await client.waitForCompletion(session.id)
  const msgs = await client.getMessages(session.id)
  const summary = buildLoopSummary(msgs)
  console.log(`   耗时: ${elapsed}s, poll次数: ${polls}, LLM轮数: ${summary.loopRounds}`)
  console.log(`   回复: "${extractReplyText(msgs).slice(0, 30)}"`)
  console.log('')

  // ===== 方式 C: 事件驱动 (Muse Plugin Hook 风格) =====  
  console.log('🅲  方式 C: 事件驱动 — Muse Plugin Hook 风格')
  console.log('   代码: plugin.on("tool.start", cb); plugin.on("message.complete", cb)')
  console.log('   特点: 实时回调, 可以拦截/修改/记录每一步')
  console.log('')

  // ===== 对比表 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 三种 Agent Loop 对比')
  console.log('═══════════════════════════════════════════════\n')

  const rows = [
    ['', '同步(A)', '异步Poll(B)', '事件驱动(C)'],
    ['代表', 'Anthropic SDK', 'OpenCode serve', 'Muse Plugin'],
    ['调用方', '阻塞等待', '非阻塞轮询', '回调通知'],
    ['Agent Loop位置', '客户端', '服务端', '服务端+Hook'],
    ['实时性', '❌ 等完才知道', '⏳ 每秒check', '✅ 毫秒级'],
    ['工具可见', '✅ 直接看', '❌ 完成后看', '✅ 实时看'],
    ['扩展性', '低(要改Loop)', '中(只管API)', '高(插件化)'],
    ['适合场景', '快速原型', '无状态服务', '监控/审计'],
  ]

  for (let i = 0; i < rows.length; i++) {
    const formatted = rows[i].map((c, j) => c.padEnd(j === 0 ? 14 : 14)).join(' │ ')
    console.log(`   ${formatted}`)
    if (i === 0) console.log(`   ${'─'.repeat(14)} ┼ ${'─'.repeat(14)} ┼ ${'─'.repeat(14)} ┼ ${'─'.repeat(14)}`)
  }

  console.log('')
  console.log('   💡 关键洞察:')
  console.log('   • Muse 选择 B+C: 用 OpenCode serve (异步) + Plugin Hook (事件)')
  console.log('   • Anthropic 默认 A: SDK 封装同步 loop, 最简单但最不灵活')
  console.log('   • 选哪种取决于: 你需要实时性(C) 还是简单性(A)?')
  console.log('')
  console.log('   🔗 对应理论:')
  console.log('   • 01a §一: while(true){LLM→工具→观察} = 方式 A 的直接实现')
  console.log('   • 01e: ReAct = Thought→Action→Observation, 三种方式都实现了, 只是可见度不同')
  console.log('')
  console.log('✅ oc10 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
