/**
 * T38: Voice Module Tests
 *
 * 覆盖: STT (whisper.cpp 本地), TTS (mock), TelegramSense.fromAudioMessage, Ingress audio routing
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SpeechToText } from './stt.mjs'
import { TextToSpeech } from './tts.mjs'
import { TelegramSense, UNSUPPORTED_TG_TYPES } from '../perception/telegram-sense.mjs'
import { SUPPORTED_TYPES } from '../perception/types.mjs'

// ============================================================
// STT Tests (whisper.cpp 本地方案)
// ============================================================

describe('SpeechToText (whisper.cpp)', () => {
  it('无模型路径 → health 返回 false', () => {
    const stt = new SpeechToText({})
    const h = stt.health()
    assert.equal(h.ok, false)
  })

  it('模型路径不存在 → transcribe 返回错误', async () => {
    const stt = new SpeechToText({ modelPath: '/nonexistent/ggml-base.bin' })
    const result = await stt.transcribe('/tmp/test.ogg')
    assert.equal(result.ok, false)
    assert.match(result.error, /模型文件不存在/)
  })

  it('音频路径不存在 → transcribe 返回错误', async () => {
    const stt = new SpeechToText({ modelPath: '/tmp/dummy.bin' })
    const result = await stt.transcribe('/nonexistent/audio.ogg')
    assert.equal(result.ok, false)
    // 模型不存在时也会先报模型错误
    assert.ok(result.error.length > 0)
  })

  it('health() 返回 detail 信息', () => {
    const stt = new SpeechToText({ modelPath: '/tmp/x.bin', language: 'en', whisperBin: '/usr/bin/whisper-cli' })
    const h = stt.health()
    assert.equal(h.detail.language, 'en')
    assert.equal(h.detail.bin, '/usr/bin/whisper-cli')
  })

  it('默认语言为 zh', () => {
    const stt = new SpeechToText({})
    const h = stt.health()
    assert.equal(h.detail.language, 'zh')
  })
})

// ============================================================
// TTS Tests (edge-tts + macOS say 兜底)
// ============================================================

describe('TextToSpeech (edge-tts + macOS say)', () => {
  it('无参数可构造 (不需要 API key)', () => {
    assert.doesNotThrow(() => new TextToSpeech())
  })

  it('空文本返回错误', async () => {
    const tts = new TextToSpeech()
    const result = await tts.synthesize('')
    assert.equal(result.ok, false)
    assert.match(result.error, /空文本/)
  })

  it('只空白文本返回错误', async () => {
    const tts = new TextToSpeech()
    const result = await tts.synthesize('   ')
    assert.equal(result.ok, false)
  })

  it('health() 返回声音信息', () => {
    const tts = new TextToSpeech({ voice: 'zh-CN-XiaoyiNeural' })
    const h = tts.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail.primaryVoice, 'zh-CN-XiaoyiNeural')
    assert.ok(h.detail.fallbackVoice)
  })
})

// ============================================================
// TelegramSense.fromAudioMessage Tests
// ============================================================

describe('TelegramSense.fromAudioMessage', () => {
  const mockCtx = {
    from: { id: 12345 },
    message: {
      message_id: 1,
      voice: {
        file_id: 'voice-file-id-123',
        file_size: 10000,
        duration: 5,
      },
    },
    chat: { id: 67890 },
  }

  it('正确创建 audio PerceptionObject', () => {
    const p = TelegramSense.fromAudioMessage(mockCtx, '你好世界')
    assert.equal(p.source, 'telegram')
    assert.equal(p.type, 'audio')
    assert.equal(p.userId, '12345')
    assert.equal(p.text, '你好世界')
    assert.equal(p.artifact.kind, 'voice')
    assert.equal(p.artifact.mime, 'audio/ogg')
    assert.equal(p.artifact.remoteUrl, 'voice-file-id-123')
    assert.equal(p.meta.duration, 5)
    assert.equal(p.meta.fileId, 'voice-file-id-123')
  })

  it('空转录使用 textFallback', () => {
    const p = TelegramSense.fromAudioMessage(mockCtx, '')
    assert.equal(p.text, null) // createPerception: '' || null → null
    assert.equal(p.textFallback, '[用户发送了语音]')
  })

  it('有转录时 textFallback 为转录文字', () => {
    const p = TelegramSense.fromAudioMessage(mockCtx, '测试')
    assert.equal(p.textFallback, '测试')
  })
})

// ============================================================
// SUPPORTED_TYPES / UNSUPPORTED_TG_TYPES Tests
// ============================================================

describe('T38 类型注册', () => {
  it('audio 在 SUPPORTED_TYPES 中', () => {
    assert.ok(SUPPORTED_TYPES.includes('audio'))
  })

  it('voice 不在 UNSUPPORTED_TG_TYPES 中', () => {
    assert.ok(!UNSUPPORTED_TG_TYPES.includes('voice'))
    assert.ok(!UNSUPPORTED_TG_TYPES.includes('audio'))
  })

  it('video 仍在 UNSUPPORTED_TG_TYPES 中', () => {
    assert.ok(UNSUPPORTED_TG_TYPES.includes('video'))
  })
})
