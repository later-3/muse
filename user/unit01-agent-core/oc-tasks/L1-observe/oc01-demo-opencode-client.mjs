/**
 * oc01 Demo: 纯 OpenCode Agent Loop
 *
 * 类比 Anthropic cookbook: 他们用 Python 调 Claude API
 * 我们用 Node.js 调本地 OpenCode REST API
 *
 * 前置: 在 demo-workspace/ 目录下启动 OpenCode server:
 *   cd user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace
 *   opencode serve --port 5555 --print-logs
 *
 * 然后另一个终端跑本脚本:
 *   node user/unit01-agent-core/oc-tasks/L1-observe/oc01-demo-opencode-client.mjs
 */

const PORT = process.env.OC_PORT || 5555
const BASE = `http://127.0.0.1:${PORT}`

// --- 工具函数 ---

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null  // prompt_async 返回 204 空 body
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// --- Main: 三步 Agent Loop ---

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc01 Demo: 纯 OpenCode Agent Loop')
  console.log('   对比: Anthropic client.messages.create()')
  console.log('═══════════════════════════════════════════════')
  console.log('')
  console.log(`🔗 OpenCode Server: ${BASE}`)
  console.log('')

  // ===== Step 1: 创建 Session =====
  console.log('📋 Step 1: 创建 session (= 开一个新对话)')
  const session = await api('POST', '/session', {})
  console.log(`   ✅ id: ${session.id}`)
  console.log(`   📁 workspace: ${session.directory || '(default)'}`)
  console.log('')

  // ===== Step 2: 发消息 =====
  const message = '你好！请用一句话介绍你自己。'
  console.log(`💬 Step 2: 发消息`)
  console.log(`   → "${message}"`)
  await api('POST', `/session/${session.id}/prompt_async`, {
    parts: [{ type: 'text', text: message }],
  })
  console.log('   ✅ prompt_async 已接受 (HTTP 204)')
  console.log('   💡 类比: Anthropic 的 client.messages.create()')
  console.log('')

  // ===== Step 3: 等待 Agent Loop 完成 =====
  console.log('⏳ Step 3: 等待 Agent Loop 完成 (poll /session/status)')
  const startTime = Date.now()

  for (let i = 1; i <= 60; i++) {
    await sleep(1000)
    const allStatus = await api('GET', '/session/status')

    // OpenCode 状态: session 在 map 里 = 还在跑; 不在 = 完成了
    const entry = allStatus?.[session.id]

    if (entry) {
      const statusStr = typeof entry === 'string' ? entry : (entry.status || 'working')
      process.stdout.write(`   ⏳ poll #${i}: ${statusStr} (${Math.round((Date.now()-startTime)/1000)}s)    \r`)
    } else {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`   ✅ 完成! poll #${i}, 耗时 ${elapsed}s                    `)
      break
    }

    if (i === 60) {
      console.log('\n   ❌ 超时 (60s)')
      return
    }
  }
  console.log('')

  // ===== Step 4: 拿回完整消息列表 =====
  console.log('📨 Step 4: 获取完整消息列表 (GET /session/{id}/message)')
  const rawMessages = await api('GET', `/session/${session.id}/message`)

  // OpenCode 返回的是数组，每条消息有 {info: {role, ...}, parts: [...]}
  const messages = rawMessages || []

  if (messages.length === 0) {
    console.log('   ⚠️ 没有消息')
    return
  }

  console.log(`   📊 共 ${messages.length} 条消息`)
  console.log('')

  // ===== 展示完整 Agent Loop 链路 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   🔍 Agent Loop 完整链路')
  console.log('═══════════════════════════════════════════════')

  const toolCalls = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const role = msg.info?.role || '?'
    const parts = msg.parts || []
    const model = msg.info?.model?.modelID || ''
    const icon = role === 'user' ? '👤' : role === 'assistant' ? '🤖' : role === 'tool' ? '🔧' : '❓'

    console.log(`\n  [${i + 1}] ${icon} ${role}${model ? ` (${model})` : ''}`)

    for (const part of parts) {
      if (part.type === 'text' && part.text) {
        console.log(`      📝 ${part.text.slice(0, 200)}`)
      } else if (part.type === 'tool-invocation' || part.type === 'tool_use') {
        const name = part.toolName || part.name || part.id
        toolCalls.push(name)
        console.log(`      🔧 工具调用: ${name}`)
        if (part.input || part.args) {
          console.log(`         参数: ${JSON.stringify(part.input || part.args).slice(0, 150)}`)
        }
      } else if (part.type === 'tool-result' || part.type === 'tool_result') {
        console.log(`      📤 工具返回: ${JSON.stringify(part.text || part.content || '').slice(0, 150)}`)
      } else {
        console.log(`      [${part.type}] ${JSON.stringify(part).slice(0, 100)}`)
      }
    }
  }

  // ===== 总结 =====
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 Agent Loop 分析')
  console.log('═══════════════════════════════════════════════')

  const userMsgs = messages.filter(m => m.info?.role === 'user')
  const aiMsgs = messages.filter(m => m.info?.role === 'assistant')
  const toolMsgs = messages.filter(m => m.info?.role === 'tool')

  console.log(`   👤 用户消息: ${userMsgs.length}`)
  console.log(`   🤖 AI 消息:  ${aiMsgs.length} (= LLM 调用了 ${aiMsgs.length} 轮)`)
  console.log(`   🔧 工具调用: ${toolCalls.length > 0 ? toolCalls.join(', ') : '无'}`)
  console.log(`   🔁 Agent Loop 轮数: ${aiMsgs.length}`)
  console.log('')

  if (toolCalls.length > 0) {
    console.log('   🔄 ReAct 链路:')
    console.log('      User → LLM(Reason) → Tool(Action) → Result(Observe) → LLM(Answer)')
  } else {
    console.log('   🔄 简单对话 (无工具调用):')
    console.log('      User → LLM → Answer')
    console.log('      💡 试试问 "读一下当前目录的文件" 来触发工具调用!')
  }

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   💡 对比 Anthropic cookbook')
  console.log('═══════════════════════════════════════════════')
  console.log('   Anthropic: response = client.messages.create(model, messages)')
  console.log('   OpenCode:  POST /session → POST prompt_async → poll → GET messages')
  console.log('   本质一样:  发消息 → Agent Loop (LLM+工具) → 拿结果')
  console.log('')
  console.log('✅ Demo 完成!')
}

main().catch(e => {
  console.error(`\n❌ 错误: ${e.message}`)
  console.error('')
  console.error('💡 确保 OpenCode server 在跑:')
  console.error('   cd user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace')
  console.error(`   opencode serve --port ${PORT} --print-logs`)
  process.exit(1)
})
