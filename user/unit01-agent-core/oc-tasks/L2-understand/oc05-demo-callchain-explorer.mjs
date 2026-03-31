/**
 * oc05 Demo: OpenCode ↔ Muse 调用链走读
 *
 * Bloom L2 (理解): 理解 Muse 如何封装 OpenCode API
 *
 * 学到什么:
 *   1. OpenCode 的完整 API 端点列表
 *   2. 每个端点返回什么数据结构
 *   3. Muse engine.mjs 如何映射这些端点
 *   4. 哪些 API 是 Muse 用到的, 哪些是 Muse 没用的
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function probe(name, fn) {
  try {
    const result = await fn()
    return { name, ok: true, result }
  } catch (e) {
    return { name, ok: false, error: e.message }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc05: OpenCode API 端点探索')
  console.log('   Bloom L2: 理解 Muse↔OpenCode 调用链')
  console.log('═══════════════════════════════════════════════\n')

  // 先创建一个 session 用于测试
  const session = await client.createSession()
  const sid = session.id
  console.log(`📋 测试 Session: ${sid}\n`)

  // 探测所有已知 API 端点
  const endpoints = [
    { name: 'GET /session', fn: () => fetch(`${client.base}/session`).then(r => r.json()), muse: '✅ listSessions' },
    { name: 'POST /session', fn: () => fetch(`${client.base}/session`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r => r.json()), muse: '✅ createSession' },
    { name: 'GET /session/{id}', fn: () => fetch(`${client.base}/session/${sid}`).then(r => r.json()), muse: '✅ getSession' },
    { name: 'GET /session/status', fn: () => fetch(`${client.base}/session/status`).then(r => r.json()), muse: '✅ poll 用' },
    { name: 'GET /session/{id}/message', fn: () => fetch(`${client.base}/session/${sid}/message`).then(r => r.json()), muse: '✅ 获取回复' },
    { name: 'POST prompt_async', fn: () => fetch(`${client.base}/session/${sid}/prompt_async`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parts:[{type:'text',text:'test'}]})}).then(r => ({status:r.status})), muse: '✅ sendMessageAsync' },
    { name: 'GET /config', fn: () => fetch(`${client.base}/config`).then(r => r.json()), muse: '❌ Muse没用' },
    { name: 'GET /provider', fn: () => fetch(`${client.base}/provider`).then(r => r.json()), muse: '❌ Muse没用' },
    { name: 'GET /model', fn: () => fetch(`${client.base}/model`).then(r => r.json()), muse: '❌ Muse没用' },
  ]

  console.log('═══════════════════════════════════════════════')
  console.log('   🔍 API 端点探测结果')
  console.log('═══════════════════════════════════════════════\n')

  for (const ep of endpoints) {
    try {
      const result = await ep.fn()
      const preview = JSON.stringify(result).slice(0, 80)
      console.log(`  ✅ ${ep.name}`)
      console.log(`     Muse映射: ${ep.muse}`)
      console.log(`     返回: ${preview}...\n`)
    } catch (e) {
      console.log(`  ❌ ${ep.name} → ${e.message}\n`)
    }
  }

  // 等待刚才的 prompt 完成
  await client.waitForCompletion(sid)

  // ===== 调用链对比 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 Muse ↔ OpenCode 调用链映射')
  console.log('═══════════════════════════════════════════════\n')

  console.log('  Telegram消息进来:')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │ telegram.mjs                                 │')
  console.log('  │   #userSessions.get(userId) → sessionId?     │')
  console.log('  │   orchestrator.handleMessage(text, {sessionId})│')
  console.log('  └──────────────────┬───────────────────────────┘')
  console.log('                     ↓')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │ orchestrator.mjs                             │')
  console.log('  │   #resolveSession(ctx)                       │')
  console.log('  │     有 sessionId → 复用                      │')
  console.log('  │     无 → engine.createSession() ←── POST /session')
  console.log('  │   engine.sendAndWait(sid, text)              │')
  console.log('  └──────────────────┬───────────────────────────┘')
  console.log('                     ↓')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │ engine.mjs (sendAndWait)                     │')
  console.log('  │   1. sendMessageAsync(sid, text)             │')
  console.log('  │      ←── POST /session/{id}/prompt_async     │')
  console.log('  │   2. while(busy) poll                        │')
  console.log('  │      ←── GET /session/status                 │')
  console.log('  │   3. getMessages(sid)                        │')
  console.log('  │      ←── GET /session/{id}/message           │')
  console.log('  └──────────────────────────────────────────────┘')
  console.log('')

  // ===== Muse 没用到的 API =====
  console.log('  💡 Muse 没用到的 OpenCode API:')
  console.log('     GET /config   → 可以拿到模型配置、权限等')
  console.log('     GET /provider → 可以看已配置的 AI 供应商')
  console.log('     GET /model    → 可以列出支持的模型列表')
  console.log('     这些对调试和监控很有用!\n')

  console.log('✅ oc05 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
