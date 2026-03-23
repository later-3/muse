/**
 * T14.5: TelegramChannel + Ingress image routing 测试
 */

import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { TelegramChannel } from './telegram-channel.mjs'
import { PerceptionIngress } from './ingress.mjs'
import { createPerception } from './types.mjs'

// ─── TelegramChannel 单元测试 ───

describe('TelegramChannel', () => {
  let channel
  let mockBot

  beforeEach(() => {
    mockBot = {
      telegram: {
        getFileLink: mock.fn(),
      },
    }
    channel = new TelegramChannel({ bot: mockBot, imageDir: '/tmp/muse-test-images' })
  })

  it('downloadFile 成功时返回 ok + localPath', async () => {
    // mock getFileLink → 返回 URL
    const fakeUrl = 'https://api.telegram.org/file/bot123/photos/test.jpg'
    mockBot.telegram.getFileLink.mock.mockImplementation(async () => new URL(fakeUrl))

    // mock fetch → 返回小图片
    const originalFetch = global.fetch
    const fakeBuffer = Buffer.alloc(100, 0xff) // 100 bytes
    global.fetch = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => fakeBuffer.buffer,
    }))

    try {
      const result = await channel.downloadFile('AgACAgItest123', { userId: '42' })

      assert.equal(result.ok, true)
      assert.ok(result.localPath.startsWith('/tmp/muse-test-images/'))
      assert.ok(result.localPath.endsWith('.jpg'))
      assert.equal(result.size, 100)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('downloadFile HTTP 失败时返回 ok=false', async () => {
    mockBot.telegram.getFileLink.mock.mockImplementation(async () => new URL('https://example.com/fail'))

    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => ({ ok: false, status: 404 }))

    try {
      const result = await channel.downloadFile('bad_file_id')
      assert.equal(result.ok, false)
      assert.ok(result.error.includes('404'))
    } finally {
      global.fetch = originalFetch
    }
  })

  it('downloadFile getFileLink 抛错时返回 ok=false', async () => {
    mockBot.telegram.getFileLink.mock.mockImplementation(async () => {
      throw new Error('Bad Request: file_id invalid')
    })

    const result = await channel.downloadFile('invalid_id')
    assert.equal(result.ok, false)
    assert.ok(result.error.includes('file_id invalid'))
  })
})

// ─── Ingress image 路由测试 ───

describe('PerceptionIngress — image handling (T14.5)', () => {
  let ingress
  let mockOrchestrator
  let mockChannel

  beforeEach(() => {
    mockOrchestrator = {
      handleMessage: mock.fn(async (text) => ({
        text: `AI 回复了: ${text.slice(0, 30)}`,
        sessionId: 'sess-123',
      })),
    }
    mockChannel = {
      downloadFile: mock.fn(),
    }
    ingress = new PerceptionIngress({
      orchestrator: mockOrchestrator,
      channel: mockChannel,
    })
  })

  it('image + 下载成功 → 消息包含图片路径', async () => {
    mockChannel.downloadFile.mock.mockImplementation(async () => ({
      ok: true,
      localPath: '/tmp/images/test.jpg',
      size: 5000,
    }))

    const perception = createPerception('telegram', 'image', 'user1', {
      artifact: { kind: 'photo', mime: 'image/jpeg', remoteUrl: 'file_id_123' },
      textFallback: '看看这个',
      meta: { fileId: 'file_id_123', width: 800, height: 600 },
    })

    const result = await ingress.handle(perception, { sessionId: 'sess-1' })

    assert.equal(result.handled, true)
    // AI 收到的消息应包含图片路径
    const sentMessage = mockOrchestrator.handleMessage.mock.calls[0].arguments[0]
    assert.ok(sentMessage.includes('/tmp/images/test.jpg'), '消息应包含图片本地路径')
    assert.ok(sentMessage.includes('看看这个'), '消息应包含 caption')
    assert.ok(sentMessage.includes('800×600'), '消息应包含尺寸')
  })

  it('image + 下载失败 → 消息包含失败原因', async () => {
    mockChannel.downloadFile.mock.mockImplementation(async () => ({
      ok: false,
      error: '下载超时 (30000ms)',
    }))

    const perception = createPerception('telegram', 'image', 'user1', {
      artifact: { kind: 'photo', mime: 'image/jpeg', remoteUrl: 'file_id_bad' },
      textFallback: '这张图不错',
      meta: { fileId: 'file_id_bad' },
    })

    const result = await ingress.handle(perception, { sessionId: 'sess-1' })

    assert.equal(result.handled, true)
    const sentMessage = mockOrchestrator.handleMessage.mock.calls[0].arguments[0]
    assert.ok(sentMessage.includes('下载失败'), '消息应说明下载失败')
    assert.ok(sentMessage.includes('下载超时'), '消息应包含失败原因')
    assert.ok(sentMessage.includes('这张图不错'), '消息应包含 caption')
  })

  it('image + 无 channel → 降级到纯文本提示', async () => {
    // 无 channel 的 ingress
    const fallbackIngress = new PerceptionIngress({
      orchestrator: mockOrchestrator,
      channel: null,
    })

    const perception = createPerception('telegram', 'image', 'user1', {
      textFallback: '帮我看这个',
      meta: {},
    })

    const result = await fallbackIngress.handle(perception, { sessionId: 'sess-1' })

    assert.equal(result.handled, true)
    const sentMessage = mockOrchestrator.handleMessage.mock.calls[0].arguments[0]
    assert.ok(sentMessage.includes('没有图片下载通道'), '消息应说明无通道')
    assert.ok(sentMessage.includes('帮我看这个'), '消息应包含 caption')
  })

  // text 仍然正常工作 (回归)
  it('text 消息仍然正常路由 (回归)', async () => {
    const perception = createPerception('telegram', 'text', 'user1', {
      text: '你好小缪',
    })

    const result = await ingress.handle(perception, { sessionId: 'sess-1' })

    assert.equal(result.handled, true)
    const sentMessage = mockOrchestrator.handleMessage.mock.calls[0].arguments[0]
    assert.equal(sentMessage, '你好小缪')
  })
})

// ─── 系统级接线测试: 共享 bot → Channel → Ingress → Orchestrator ───

describe('T14.5 系统级接线 — shared bot wiring', () => {
  it('共享 bot 实例同时驱动 Channel 和 TelegramSense', async () => {
    // 模拟共享 bot (和 index.mjs 做法一致)
    const sharedBot = {
      telegram: {
        getFileLink: mock.fn(async () => new URL('https://example.com/file.jpg')),
      },
    }

    // 用共享 bot 构建 channel (和 index.mjs 一样)
    const channel = new TelegramChannel({ bot: sharedBot, imageDir: '/tmp/muse-wiring-test' })

    // 用真实 channel 构建 ingress
    const mockOrch = {
      handleMessage: mock.fn(async (text) => ({
        text: 'AI 回复',
        sessionId: 'wiring-sess',
      })),
    }
    const ingress = new PerceptionIngress({ orchestrator: mockOrch, channel })

    // mock fetch
    const originalFetch = global.fetch
    global.fetch = mock.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.alloc(50).buffer,
    }))

    try {
      // 构造 photo perception (和 TelegramSense.fromPhotoMessage 输出一致)
      const perception = createPerception('telegram', 'image', 'user42', {
        artifact: { kind: 'photo', mime: 'image/jpeg', remoteUrl: 'shared_file_id' },
        textFallback: '系统级测试图片',
        meta: { fileId: 'shared_file_id', width: 640, height: 480 },
      })

      const result = await ingress.handle(perception)

      // 验证完整链路
      assert.equal(result.handled, true)
      // bot.telegram.getFileLink 被 channel 调用 (证明共享 bot 生效)
      assert.equal(sharedBot.telegram.getFileLink.mock.callCount(), 1)
      assert.equal(sharedBot.telegram.getFileLink.mock.calls[0].arguments[0], 'shared_file_id')
      // Orchestrator 收到的消息包含下载成功的图片路径
      const sentMsg = mockOrch.handleMessage.mock.calls[0].arguments[0]
      assert.ok(sentMsg.includes('/tmp/muse-wiring-test/'), '消息应包含本地路径')
      assert.ok(sentMsg.includes('系统级测试图片'), '消息应包含 caption')
    } finally {
      global.fetch = originalFetch
    }
  })
})
