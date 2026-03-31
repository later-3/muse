/**
 * oc01-03 测试用例 — 验证 OpenCode REST API 客户端
 * 
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 * 运行: node --test user/unit01-agent-core/oc-tasks/L1-observe/test-opencode-demos.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, extractToolCalls, extractReplyText, buildLoopSummary } from './opencode-client.mjs'

const PORT = process.env.OC_PORT || 5555
const client = createClient(PORT)

// 检查 server 是否在跑
async function isServerRunning() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/session/status`)
    return true
  } catch { return false }
}

describe('OpenCode Client (纯函数)', () => {
  it('extractToolCalls: 空消息返回空数组', () => {
    assert.deepEqual(extractToolCalls([]), [])
  })

  it('extractToolCalls: 提取 tool-invocation', () => {
    const messages = [{
      info: { role: 'assistant' },
      parts: [
        { type: 'tool-invocation', toolName: 'read_file', state: 'completed', args: { path: 'test.txt' } },
        { type: 'text', text: '文件内容...' },
      ]
    }]
    const tools = extractToolCalls(messages)
    assert.equal(tools.length, 1)
    assert.equal(tools[0].name, 'read_file')
    assert.equal(tools[0].state, 'completed')
  })

  it('extractReplyText: 提取最后一条 assistant 的文本', () => {
    const messages = [
      { info: { role: 'user' }, parts: [{ type: 'text', text: '你好' }] },
      { info: { role: 'assistant' }, parts: [{ type: 'text', text: '你好！' }, { type: 'text', text: '有什么需要帮助的？' }] },
    ]
    const reply = extractReplyText(messages)
    assert.equal(reply, '你好！\n有什么需要帮助的？')
  })

  it('extractReplyText: 无 assistant 消息返回空', () => {
    const messages = [{ info: { role: 'user' }, parts: [{ type: 'text', text: '你好' }] }]
    assert.equal(extractReplyText(messages), '')
  })

  it('buildLoopSummary: 统计正确', () => {
    const messages = [
      { info: { role: 'user', model: { modelID: 'test-model' } }, parts: [{ type: 'text', text: '...' }] },
      { info: { role: 'assistant' }, parts: [
        { type: 'tool-invocation', toolName: 'glob', state: 'completed' },
        { type: 'text', text: '这是结果' },
      ]},
      { info: { role: 'assistant' }, parts: [{ type: 'text', text: '总结' }] },
    ]
    const summary = buildLoopSummary(messages)
    assert.equal(summary.totalMessages, 3)
    assert.equal(summary.userMessages, 1)
    assert.equal(summary.aiMessages, 2)
    assert.equal(summary.toolCalls.length, 1)
    assert.equal(summary.loopRounds, 2)
    assert.equal(summary.model, 'test-model')
  })
})

describe('OpenCode Server API (需要 server 在跑)', async () => {
  const running = await isServerRunning()
  if (!running) {
    it.skip('⏭️  OpenCode server 未运行, 跳过集成测试', () => {})
    return
  }

  it('POST /session 创建 session', async () => {
    const session = await client.createSession()
    assert.ok(session.id, 'session 应有 id')
    assert.ok(session.id.startsWith('ses_'), `id 应以 ses_ 开头, 实际: ${session.id}`)
  })

  it('GET /session 列出 sessions', async () => {
    const sessions = await client.listSessions()
    assert.ok(Array.isArray(sessions), '应返回数组')
    assert.ok(sessions.length > 0, '应至少有 1 个 session')
  })

  it('完整 Agent Loop: 发消息→等待→拿回复', { timeout: 30_000 }, async () => {
    const session = await client.createSession()
    await client.sendMessage(session.id, '回复两个字: OK')
    const { elapsed } = await client.waitForCompletion(session.id)
    assert.ok(elapsed < 30, `应在 30s 内完成, 实际 ${elapsed}s`)

    const messages = await client.getMessages(session.id)
    assert.ok(messages.length >= 2, `应至少有 2 条消息 (user+assistant), 实际 ${messages.length}`)

    const reply = extractReplyText(messages)
    assert.ok(reply.length > 0, '应有回复文本')
    console.log(`      回复: "${reply.slice(0, 50)}" (${elapsed}s)`)
  })
})
