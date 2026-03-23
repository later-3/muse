import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  createPerception,
  validatePerception,
  PERCEPTION_TYPES,
  SUPPORTED_TYPES,
  TYPE_LABELS,
} from './types.mjs'
import { TelegramSense, UNSUPPORTED_TG_TYPES } from './telegram-sense.mjs'
import { PerceptionIngress } from './ingress.mjs'

// --- Mock Factories ---

function mockTextCtx(text = '你好', userId = '123') {
  return {
    from: { id: Number(userId), first_name: 'Test', last_name: 'User' },
    chat: { id: 456 },
    message: { text, message_id: 1 },
  }
}

function mockPhotoCtx(caption = '', userId = '123') {
  return {
    from: { id: Number(userId), first_name: 'Test', last_name: 'User' },
    chat: { id: 456 },
    message: {
      message_id: 2,
      caption: caption || undefined,
      photo: [
        { file_id: 'small_id', file_size: 1000, width: 90, height: 90 },
        { file_id: 'medium_id', file_size: 5000, width: 320, height: 320 },
        { file_id: 'large_id', file_size: 20000, width: 800, height: 600 },
      ],
    },
  }
}

function mockUnsupportedCtx(userId = '123') {
  return {
    from: { id: Number(userId), first_name: 'Test', last_name: 'User' },
    chat: { id: 456 },
    message: { message_id: 3 },
  }
}

function createMockOrchestrator(reply = 'mock reply') {
  let lastText = ''
  let lastContext = {}
  return {
    handleMessage: async (text, ctx) => {
      lastText = text
      lastContext = ctx
      return { text: reply, sessionId: 'mock-session-1' }
    },
    get _lastText() { return lastText },
    get _lastContext() { return lastContext },
  }
}

// --- types.mjs Tests ---

describe('T14: PerceptionObject 类型系统', () => {
  it('PERCEPTION_TYPES 包含 6 种类型', () => {
    assert.equal(PERCEPTION_TYPES.length, 6)
    assert.ok(PERCEPTION_TYPES.includes('text'))
    assert.ok(PERCEPTION_TYPES.includes('image'))
    assert.ok(PERCEPTION_TYPES.includes('audio'))
    assert.ok(PERCEPTION_TYPES.includes('video'))
    assert.ok(PERCEPTION_TYPES.includes('file'))
    assert.ok(PERCEPTION_TYPES.includes('event'))
  })

  it('SUPPORTED_TYPES 是 PERCEPTION_TYPES 的子集', () => {
    for (const t of SUPPORTED_TYPES) {
      assert.ok(PERCEPTION_TYPES.includes(t), `${t} should be a valid type`)
    }
  })

  it('TYPE_LABELS 覆盖所有类型', () => {
    for (const t of PERCEPTION_TYPES) {
      assert.ok(TYPE_LABELS[t], `${t} should have a label`)
    }
  })
})

describe('T14: createPerception()', () => {
  it('创建完整的 PerceptionObject', () => {
    const p = createPerception('telegram', 'text', '123', { text: '你好' })
    assert.equal(p.source, 'telegram')
    assert.equal(p.type, 'text')
    assert.equal(p.userId, '123')
    assert.equal(p.text, '你好')
    assert.ok(p.timestamp)
    assert.equal(p.artifact, null)
    assert.equal(p.textFallback, null)
    assert.deepEqual(p.meta, {})
  })

  it('创建带 artifact 的对象', () => {
    const p = createPerception('telegram', 'image', '123', {
      artifact: { kind: 'photo', mime: 'image/jpeg' },
      textFallback: '一张照片',
    })
    assert.equal(p.type, 'image')
    assert.equal(p.artifact.kind, 'photo')
    assert.equal(p.textFallback, '一张照片')
  })

  it('创建带 meta 的对象', () => {
    const p = createPerception('telegram', 'text', '123', {
      text: '你好',
      meta: { chatId: '456', userName: 'Test' },
    })
    assert.equal(p.meta.chatId, '456')
    assert.equal(p.meta.userName, 'Test')
  })
})

describe('T14: validatePerception()', () => {
  it('合法对象 → 空错误', () => {
    const p = createPerception('telegram', 'text', '123', { text: '你好' })
    const errors = validatePerception(p)
    assert.equal(errors.length, 0)
  })

  it('null → 错误', () => {
    const errors = validatePerception(null)
    assert.ok(errors.length > 0)
  })

  it('缺 source → 错误', () => {
    const p = { type: 'text', userId: '123', text: '你好' }
    const errors = validatePerception(p)
    assert.ok(errors.some(e => e.includes('source')))
  })

  it('非法 type → 错误', () => {
    const p = createPerception('telegram', 'unknown_type', '123', { text: '你好' })
    const errors = validatePerception(p)
    assert.ok(errors.some(e => e.includes('type')))
  })

  it('type=text 缺 text → 错误', () => {
    const p = createPerception('telegram', 'text', '123', {})
    const errors = validatePerception(p)
    assert.ok(errors.some(e => e.includes('text is required')))
  })

  it('type=image 没有 artifact 和 textFallback → 错误', () => {
    const p = createPerception('telegram', 'image', '123', {})
    const errors = validatePerception(p)
    assert.ok(errors.some(e => e.includes('artifact or textFallback')))
  })

  it('type=image 有 textFallback → 合法', () => {
    const p = createPerception('telegram', 'image', '123', { textFallback: '图片' })
    const errors = validatePerception(p)
    assert.equal(errors.length, 0)
  })
})

// --- telegram-sense.mjs Tests ---

describe('T14: TelegramSense', () => {
  it('fromTextMessage → type=text + 正确字段', () => {
    const ctx = mockTextCtx('你好世界', '789')
    const p = TelegramSense.fromTextMessage(ctx)

    assert.equal(p.source, 'telegram')
    assert.equal(p.type, 'text')
    assert.equal(p.userId, '789')
    assert.equal(p.text, '你好世界')
    assert.equal(p.meta.chatId, '456')
    assert.ok(p.meta.userName.includes('Test'))
  })

  it('fromPhotoMessage → type=image + 取最大 photo', () => {
    const ctx = mockPhotoCtx('这是一只猫')
    const p = TelegramSense.fromPhotoMessage(ctx)

    assert.equal(p.type, 'image')
    assert.equal(p.artifact.kind, 'photo')
    assert.equal(p.artifact.remoteUrl, 'large_id', '应取最大尺寸')
    assert.equal(p.textFallback, '这是一只猫')
    assert.equal(p.meta.fileId, 'large_id')
    assert.equal(p.meta.width, 800)
  })

  it('fromPhotoMessage 无 caption → 默认 fallback', () => {
    const ctx = mockPhotoCtx('')
    const p = TelegramSense.fromPhotoMessage(ctx)

    assert.equal(p.textFallback, '[用户发送了一张图片]')
  })

  it('fromUnsupportedMessage → 正确映射类型', () => {
    const ctx = mockUnsupportedCtx()
    const p = TelegramSense.fromUnsupportedMessage(ctx, 'voice')

    assert.equal(p.type, 'audio')
    assert.ok(p.textFallback.includes('语音'))
  })

  it('UNSUPPORTED_TG_TYPES 包含正确类型', () => {
    assert.ok(UNSUPPORTED_TG_TYPES.includes('voice'))
    assert.ok(UNSUPPORTED_TG_TYPES.includes('audio'))
    assert.ok(UNSUPPORTED_TG_TYPES.includes('video'))
    assert.ok(UNSUPPORTED_TG_TYPES.includes('document'))
    assert.ok(UNSUPPORTED_TG_TYPES.includes('sticker'))
  })
})

// --- ingress.mjs Tests ---

describe('T14: PerceptionIngress', () => {
  it('text → 转发到 Orchestrator', async () => {
    const orch = createMockOrchestrator('AI回复')
    const ingress = new PerceptionIngress({ orchestrator: orch })

    const p = createPerception('telegram', 'text', '123', { text: '你好' })
    const result = await ingress.handle(p, { sessionId: 'test-session' })

    assert.equal(result.text, 'AI回复')
    assert.equal(result.handled, true)
    assert.equal(orch._lastText, '你好')
    assert.equal(orch._lastContext.source, 'telegram')
  })

  it('image → T14.5 感知消息转发到 Orchestrator (无 channel 降级)', async () => {
    const orch = createMockOrchestrator('收到图片')
    const ingress = new PerceptionIngress({ orchestrator: orch })

    const p = createPerception('telegram', 'image', '123', {
      artifact: { kind: 'photo', mime: 'image/jpeg' },
      textFallback: '这是一只猫',
    })
    const result = await ingress.handle(p)

    assert.equal(result.text, '收到图片')
    assert.equal(result.handled, true)
    // T14.5: 无 channel 时降级消息包含 caption
    assert.ok(orch._lastText.includes('这是一只猫'), 'AI 应收到 caption')
    assert.ok(orch._lastText.includes('图片'), 'AI 应知道这是图片')
  })

  it('audio → 友好提示，不调 Orchestrator', async () => {
    const orch = createMockOrchestrator()
    const ingress = new PerceptionIngress({ orchestrator: orch })

    const p = createPerception('telegram', 'audio', '123', { textFallback: '语音' })
    const result = await ingress.handle(p)

    assert.equal(result.handled, false)
    assert.equal(result.sessionId, null)
    assert.ok(result.text.includes('暂时还不能处理'))
    assert.ok(result.text.includes('语音'))
    assert.equal(orch._lastText, '', 'Orchestrator 不应被调用')
  })

  it('video → 友好提示', async () => {
    const orch = createMockOrchestrator()
    const ingress = new PerceptionIngress({ orchestrator: orch })

    const p = createPerception('telegram', 'video', '123', { textFallback: '视频' })
    const result = await ingress.handle(p)

    assert.equal(result.handled, false)
    assert.ok(result.text.includes('视频'))
  })

  it('非法 PerceptionObject → throw', async () => {
    const ingress = new PerceptionIngress({ orchestrator: createMockOrchestrator() })

    await assert.rejects(
      () => ingress.handle({ type: 'text' }),
      /Invalid PerceptionObject/,
    )
  })
})
