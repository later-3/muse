/**
 * L2 测试: Session 生命周期 + 调用链验证
 *
 * 运行: node --test user/unit01-agent-core/oc-tasks/L2-understand/test-l2-understand.mjs
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, extractReplyText } from '../L1-observe/opencode-client.mjs'

const PORT = process.env.OC_PORT || 5555
const client = createClient(PORT)

async function isServerRunning() {
  try { await fetch(`http://127.0.0.1:${PORT}/session/status`); return true }
  catch { return false }
}

describe('L2-understand: Session 生命周期', async () => {
  const running = await isServerRunning()
  if (!running) {
    it.skip('⏭️  OpenCode server 未运行', () => {})
    return
  }

  it('新 session 应有 id 和 directory', async () => {
    const session = await client.createSession()
    assert.ok(session.id.startsWith('ses_'))
    assert.ok(session.directory, 'session 应有 workspace 路径')
  })

  it('Session 完成后从 status map 移除, 但本身保留', { timeout: 30_000 }, async () => {
    const session = await client.createSession()
    await client.sendMessage(session.id, '回复 OK')
    await client.waitForCompletion(session.id)

    // 完成后 status map 里没有了
    const status = await fetch(`${client.base}/session/status`).then(r => r.json())
    assert.ok(!status[session.id], 'session 不应在 status map 里')

    // 但 session 本身还在
    const info = await client.getSession(session.id)
    assert.equal(info.id, session.id, 'session 应可以通过 id 获取')
  })

  it('多轮对话: 同一 session 保留上下文', { timeout: 60_000 }, async () => {
    const session = await client.createSession()

    // 第一轮: 记住数字
    await client.sendMessage(session.id, '记住数字 77。只回复"记住了"')
    await client.waitForCompletion(session.id)

    // 第二轮: 问数字
    await client.sendMessage(session.id, '我让你记住的数字是多少？只回复数字')
    await client.waitForCompletion(session.id)

    const msgs = await client.getMessages(session.id)
    const reply = extractReplyText(msgs)
    assert.ok(reply.includes('77'), `应记住 77, 实际回复: "${reply.slice(0, 50)}"`)
  })
})

describe('L2-understand: API 端点探索', async () => {
  const running = await isServerRunning()
  if (!running) {
    it.skip('⏭️  OpenCode server 未运行', () => {})
    return
  }

  it('GET /session 返回数组', async () => {
    const sessions = await client.listSessions()
    assert.ok(Array.isArray(sessions))
  })

  it('GET /session/status 返回对象', async () => {
    const status = await fetch(`${client.base}/session/status`).then(r => r.json())
    assert.equal(typeof status, 'object')
  })

  it('GET /config 应返回配置信息', async () => {
    const config = await fetch(`${client.base}/config`).then(r => r.json())
    assert.ok(config, '应返回配置对象')
  })
})
