/**
 * oc04 Demo: Session 生命周期走读
 *
 * Bloom L2 (理解): 不只是会调 API，而是理解 Session 的完整生命周期
 *
 * 学到什么:
 *   1. Session 的 4 个阶段: 创建 → 活跃 → 完成 → 可复用(多轮)
 *   2. 多轮对话: 同一个 session 发多条消息 = 上下文保留
 *   3. Session 元数据: title 会自动更新
 *   4. Session 清理: 完成后从 status map 移除，但 session 本身还在
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient, extractReplyText } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc04: Session 生命周期走读')
  console.log('   Bloom L2: 理解 Session 完整生命周期')
  console.log('═══════════════════════════════════════════════\n')

  // ===== Phase 1: 创建 =====
  console.log('📋 Phase 1: 创建 Session')
  const session = await client.createSession()
  console.log(`   id: ${session.id}`)
  console.log(`   title: ${session.title}`)
  console.log(`   workspace: ${session.directory}`)
  console.log(`   💡 Session 刚创建时 title 是默认的，没有消息\n`)

  // ===== Phase 2: 第一轮对话 =====
  console.log('💬 Phase 2: 第一轮对话 — Session 变为活跃')
  await client.sendMessage(session.id, '记住这个数字: 42。只回复"已记住"。')
  console.log('   已发送第一条消息')

  // 观察 status 变化
  await new Promise(r => setTimeout(r, 500))
  const statusDuring = await fetch(`${client.base}/session/status`).then(r => r.json())
  const isActive = !!statusDuring[session.id]
  console.log(`   活跃状态: ${isActive ? '✅ busy (在 status map 里)' : '⏳ 可能已完成'}`)

  await client.waitForCompletion(session.id)
  const msgs1 = await client.getMessages(session.id)
  console.log(`   回复: "${extractReplyText(msgs1).slice(0, 50)}"`)
  console.log(`   消息数: ${msgs1.length}\n`)

  // ===== Phase 3: 第二轮 — 验证上下文保留 =====
  console.log('💬 Phase 3: 第二轮对话 — 验证多轮上下文保留')
  await client.sendMessage(session.id, '我让你记住的数字是多少？只回复数字。')
  await client.waitForCompletion(session.id)
  const msgs2 = await client.getMessages(session.id)
  const reply2 = extractReplyText(msgs2)
  console.log(`   回复: "${reply2.slice(0, 50)}"`)
  console.log(`   消息数: ${msgs2.length} (应该 > ${msgs1.length})`)

  const remembers42 = reply2.includes('42')
  console.log(`   记住了 42? ${remembers42 ? '✅ 是!' : '❌ 没有 (可能模型较弱)'}`)
  console.log(`   💡 同一个 session 多次发消息 = 多轮对话，上下文保留\n`)

  // ===== Phase 4: Session 完成后的状态 =====
  console.log('📊 Phase 4: 完成后的 Session 状态')
  const statusAfter = await fetch(`${client.base}/session/status`).then(r => r.json())
  const inMap = !!statusAfter[session.id]
  console.log(`   在 status map 里? ${inMap ? '是 (还在跑)' : '❌ 不在 (已完成)'}`)

  const sessionInfo = await client.getSession(session.id)
  console.log(`   但 session 本身还在: title="${sessionInfo.title}"`)
  console.log(`   💡 完成后从 status map 移除，但 session 数据保留\n`)

  // ===== 总结 =====
  console.log('═══════════════════════════════════════════════')
  console.log('   📊 Session 生命周期总结')
  console.log('═══════════════════════════════════════════════')
  console.log('   1. 创建: POST /session → 空 session, 默认 title')
  console.log('   2. 活跃: POST prompt_async → status=busy, 在 map 里')
  console.log('   3. 完成: status map 移除, 但 session 保留')
  console.log('   4. 多轮: 同一 session 再次 prompt → 上下文会保留')
  console.log('')
  console.log('   💡 Muse 的 #userSessions Map 就是做这个事:')
  console.log('      userId → sessionId, 让同一用户的消息走同一 session')
  console.log('')
  console.log('✅ oc04 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
