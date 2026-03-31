/**
 * oc02 Demo: 全链路追踪 — 用工具调用触发完整 ReAct 循环
 *
 * oc01 只看到简单对话 (User → LLM → Answer)
 * oc02 要看到完整 Agent Loop: User → LLM(Reason) → Tool(Action) → Result(Observe) → LLM(Answer)
 *
 * 做法: 发一条需要工具的消息, 然后分析完整链路
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 * 运行: node user/unit01-agent-core/oc-tasks/L1-observe/oc02-demo-trace-analysis.mjs
 */

import { createClient, extractToolCalls, buildLoopSummary } from './opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc02 Demo: 全链路追踪 (Trace Analysis)')
  console.log('   目标: 看到完整 ReAct 循环')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  // Step 1: 创建 session
  const session = await client.createSession()
  console.log(`📋 Session: ${session.id}`)
  console.log('')

  // Step 2: 发一条需要工具的消息 (读目录 → 触发 glob/read 工具)
  const message = '请列出当前目录下的所有文件，并简要说明每个文件的用途。'
  console.log(`💬 发消息: "${message}"`)
  await client.sendMessage(session.id, message)
  console.log('   ✅ 已发送')
  console.log('')

  // Step 3: 等待完成
  console.log('⏳ 等待 Agent Loop...')
  const { elapsed, polls } = await client.waitForCompletion(session.id)
  console.log(`   ✅ 完成 (${elapsed}s, ${polls} polls)`)
  console.log('')

  // Step 4: 获取完整消息链
  const messages = await client.getMessages(session.id)
  console.log(`📨 共 ${messages.length} 条消息`)
  console.log('')

  // ===== 核心: 全链路追踪 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   🔍 全链路追踪 (每条消息的角色 + 内容)')
  console.log('═══════════════════════════════════════════════')

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const role = msg.info?.role || '?'
    const model = msg.info?.model?.modelID || ''
    const time = msg.info?.time?.created || 0
    const icon = role === 'user' ? '👤' : role === 'assistant' ? '🤖' : '❓'

    console.log(`\n┌─ [${i + 1}] ${icon} ${role} ${model ? `(${model})` : ''} ${time ? `@${new Date(time).toLocaleTimeString()}` : ''}`)

    for (const part of (msg.parts || [])) {
      if (part.type === 'text' && part.text) {
        console.log(`│  📝 ${part.text.slice(0, 300)}`)
      } else if (part.type === 'tool-invocation' || part.type === 'tool_use') {
        const name = part.toolName || part.name || part.id
        const state = part.state || ''
        console.log(`│  🔧 工具调用: ${name} [${state}]`)
        if (part.input || part.args) {
          console.log(`│     参数: ${JSON.stringify(part.input || part.args).slice(0, 200)}`)
        }
        if (part.output) {
          console.log(`│     输出: ${JSON.stringify(part.output).slice(0, 200)}`)
        }
      } else if (part.type === 'tool-result' || part.type === 'tool_result') {
        console.log(`│  📤 工具结果: ${JSON.stringify(part.text || part.content || '').slice(0, 200)}`)
      } else if (part.type === 'step-start' || part.type === 'step-finish') {
        // 跳过 step 标记
      } else {
        console.log(`│  [${part.type}]`)
      }
    }
    console.log('└─')
  }

  // ===== 工具调用时间线 =====
  const tools = extractToolCalls(messages)
  if (tools.length > 0) {
    console.log('')
    console.log('═══════════════════════════════════════════════')
    console.log('   🔧 工具调用时间线')
    console.log('═══════════════════════════════════════════════')
    tools.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} [${t.state}]`)
      if (Object.keys(t.args).length > 0) {
        console.log(`      ${JSON.stringify(t.args).slice(0, 150)}`)
      }
    })
  }

  // ===== Agent Loop 分析 =====
  const summary = buildLoopSummary(messages)
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 Agent Loop 分析')
  console.log('═══════════════════════════════════════════════')
  console.log(`   🤖 模型: ${summary.model}`)
  console.log(`   📨 总消息: ${summary.totalMessages}`)
  console.log(`   👤 用户: ${summary.userMessages}`)
  console.log(`   🤖 AI: ${summary.aiMessages} (= LLM 调了 ${summary.loopRounds} 轮)`)
  console.log(`   🔧 工具调用: ${summary.toolCalls.length} 次`)
  console.log('')

  if (summary.toolCalls.length > 0) {
    console.log('   🔄 ReAct 链路:')
    console.log('      User → LLM(Reason) → Tool(Action) → Result(Observe) → LLM(Answer)')
    console.log('      ☝️ 这就是 oc01 里 Muse 日志里看不到的 "busy 14秒" 内部细节!')
  } else {
    console.log('   💡 没有工具调用 — 可能因为 opencode.json 里 permission 设为 deny')
    console.log('   💡 要看到工具调用, 修改 demo-workspace/opencode.json:')
    console.log('      "bash": "allow", "read": "allow", "glob": "allow"')
  }

  console.log('')
  console.log('✅ oc02 Demo 完成!')
}

main().catch(e => {
  console.error(`\n❌ ${e.message}`)
  console.error('💡 确保 opencode serve --port 5555 在 demo-workspace/ 下跑着')
  process.exit(1)
})
