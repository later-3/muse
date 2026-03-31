/**
 * oc03 Demo: Agent Loop 实时观察器
 *
 * oc01: 看到消息发出→回来 (黑盒)
 * oc02: 完成后拿 trace 分析 (事后)
 * oc03: 实时观察 Agent Loop 的每一步 (在线)
 *
 * 做法: 发消息后每秒 poll messages, 观察新消息出现的时序
 * 这就是 Muse 的 Plugin Hook 的简化版 — 不需要写 hook, 用 poll 就能观察
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 * 运行: node user/unit01-agent-core/oc-tasks/L1-observe/oc03-demo-loop-observer.mjs
 */

import { createClient, extractToolCalls } from './opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc03 Demo: Agent Loop 实时观察器')
  console.log('   目标: 实时看到 LLM 在想什么、调什么工具')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  // Step 1: 创建 session
  const session = await client.createSession()
  console.log(`📋 Session: ${session.id}`)

  // Step 2: 发消息
  const message = '请读取当前目录的 opencode.json，告诉我配置了什么模型。'
  console.log(`💬 发消息: "${message}"`)
  await client.sendMessage(session.id, message)
  console.log('   ✅ 已发送')
  console.log('')

  // Step 3: 实时观察 — 每 500ms poll messages, 观察新消息出现
  console.log('═══════════════════════════════════════════════')
  console.log('   👁️  实时观察 Agent Loop')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  const startTime = Date.now()
  let lastMessageCount = 0
  let lastPartCount = 0
  let done = false
  const events = []  // 记录每个事件的时间

  for (let tick = 0; tick < 120 && !done; tick++) {
    await new Promise(r => setTimeout(r, 500))

    // 检查是否完成
    const allStatus = await client.getMessages(session.id).catch(() => null)
    const statusCheck = await fetch(`${client.base}/session/status`)
      .then(r => r.json()).catch(() => ({}))

    const isActive = !!statusCheck[session.id]
    const messages = allStatus || []
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // 检测新消息
    if (messages.length > lastMessageCount) {
      for (let i = lastMessageCount; i < messages.length; i++) {
        const msg = messages[i]
        const role = msg.info?.role || '?'
        const icon = role === 'user' ? '👤' : role === 'assistant' ? '🤖' : '❓'
        const model = msg.info?.model?.modelID || ''

        events.push({ time: elapsed, type: 'new_message', role, model })
        console.log(`  [${elapsed}s] 📨 新消息 #${i + 1}: ${icon} ${role} ${model ? `(${model})` : ''}`)
      }
      lastMessageCount = messages.length
    }

    // 检测新 parts (在最后一条消息里, 工具调用会逐个出现)
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      const parts = lastMsg.parts || []
      if (parts.length > lastPartCount) {
        for (let i = lastPartCount; i < parts.length; i++) {
          const part = parts[i]
          if (part.type === 'tool-invocation' || part.type === 'tool_use') {
            const name = part.toolName || part.name || ''
            const state = part.state || ''
            events.push({ time: elapsed, type: 'tool_call', name, state })
            console.log(`  [${elapsed}s] 🔧 工具调用: ${name} [${state}]`)
          } else if (part.type === 'text' && part.text && i > 0) {
            events.push({ time: elapsed, type: 'text_part' })
            console.log(`  [${elapsed}s] 📝 文本输出: ${part.text.slice(0, 80)}...`)
          } else if (part.type === 'step-start') {
            events.push({ time: elapsed, type: 'step_start' })
            console.log(`  [${elapsed}s] ▶️  Step 开始`)
          } else if (part.type === 'step-finish') {
            const reason = part.reason || ''
            events.push({ time: elapsed, type: 'step_finish', reason })
            console.log(`  [${elapsed}s] ⏹️  Step 结束 (${reason})`)
          }
        }
        lastPartCount = parts.length
      }
    }

    // 检查完成
    if (!isActive && tick > 2) {
      events.push({ time: elapsed, type: 'done' })
      console.log(`  [${elapsed}s] ✅ Agent Loop 完成`)
      done = true
    }
  }

  // ===== 事件时间线 =====
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 事件时间线')
  console.log('═══════════════════════════════════════════════')
  for (const e of events) {
    const icon = e.type === 'new_message' ? '📨'
      : e.type === 'tool_call' ? '🔧'
      : e.type === 'step_start' ? '▶️ '
      : e.type === 'step_finish' ? '⏹️ '
      : e.type === 'text_part' ? '📝'
      : e.type === 'done' ? '✅' : '❓'
    console.log(`   ${e.time}s  ${icon}  ${e.type}${e.name ? ` (${e.name})` : ''}${e.role ? ` [${e.role}]` : ''}`)
  }

  // ===== 最终回复 =====
  const messages = await client.getMessages(session.id)
  const lastAssistant = messages.filter(m => m.info?.role === 'assistant').pop()
  if (lastAssistant) {
    const text = (lastAssistant.parts || [])
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('\n')
    console.log('')
    console.log('═══════════════════════════════════════════════')
    console.log('   🤖 最终回复')
    console.log('═══════════════════════════════════════════════')
    console.log(text.slice(0, 500))
  }

  console.log('')
  console.log('✅ oc03 Demo 完成!')
  console.log('')
  console.log('💡 对比 Muse Plugin Hook:')
  console.log('   Hook: 事件驱动, 每个动作实时触发回调')
  console.log('   本 Demo: poll 驱动, 每 500ms 检查新消息')
  console.log('   本质一样: 观察 Agent Loop 的每一步')
}

main().catch(e => {
  console.error(`\n❌ ${e.message}`)
  console.error('💡 确保 opencode serve --port 5555 在 demo-workspace/ 下跑着')
  process.exit(1)
})
