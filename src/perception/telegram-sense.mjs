/**
 * T14: Telegram Sense Adapter
 *
 * 将 Telegraf ctx 转为标准 PerceptionObject。
 * 纯函数，无副作用，可直接单测。
 */

import { createPerception, TYPE_LABELS } from './types.mjs'

/**
 * Telegraf 消息类型 → PerceptionObject type 映射
 */
const TG_TYPE_MAP = {
  text: 'text',
  photo: 'image',
  voice: 'audio',
  audio: 'audio',
  video: 'video',
  video_note: 'video',
  document: 'file',
  sticker: 'image',
}

/**
 * 从 Telegraf ctx 提取通用元数据
 * TG-GROUP-001: 增强群聊相关字段
 */
function extractMeta(ctx, extra = {}) {
  const chatType = ctx.chat?.type || 'private'
  const chatTitle = ctx.chat?.title || null
  return {
    chatId: String(ctx.chat.id),
    userName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    messageId: ctx.message.message_id,
    chatType,
    chatTitle,
    isGroup: chatType !== 'private',
    senderUsername: ctx.from?.username || null,
    ...extra
  }
}

export class TelegramSense {
  /**
   * 文本消息 → PerceptionObject (type=text)
   */
  static fromTextMessage(ctx) {
    return createPerception('telegram', 'text', String(ctx.from.id), {
      text: ctx.message.text,
      meta: extractMeta(ctx),
    })
  }

  /**
   * 图片消息 → PerceptionObject (type=image)
   * 取 photo 数组最大尺寸，caption → textFallback
   */
  static fromPhotoMessage(ctx) {
    const photos = ctx.message.photo
    const largest = photos[photos.length - 1]

    return createPerception('telegram', 'image', String(ctx.from.id), {
      artifact: {
        kind: 'photo',
        mime: 'image/jpeg',
        remoteUrl: largest.file_id,
      },
      textFallback: ctx.message.caption || '[用户发送了一张图片]',
      meta: {
        ...extractMeta(ctx),
        fileId: largest.file_id,
        fileSize: largest.file_size,
        width: largest.width,
        height: largest.height,
      },
    })
  }

  /**
   * T38: 语音消息 → PerceptionObject (type=audio)
   * STT 转录的文字作为 text，保留原始语音 artifact
   *
   * @param {object} ctx - Telegraf context
   * @param {string} transcribedText - STT 转录结果
   */
  static fromAudioMessage(ctx, transcribedText) {
    const voice = ctx.message.voice || ctx.message.audio
    return createPerception('telegram', 'audio', String(ctx.from.id), {
      text: transcribedText,
      artifact: {
        kind: 'voice',
        mime: 'audio/ogg',
        remoteUrl: voice.file_id,
      },
      textFallback: transcribedText || '[用户发送了语音]',
      meta: {
        ...extractMeta(ctx),
        fileId: voice.file_id,
        fileSize: voice.file_size,
        duration: voice.duration,
      },
    })
  }

  /**
   * 不支持的消息类型 → PerceptionObject
   * @param {object} ctx - Telegraf context
   * @param {string} tgType - Telegraf 事件类型 (video/document/sticker)
   */
  static fromUnsupportedMessage(ctx, tgType) {
    const type = TG_TYPE_MAP[tgType] || 'file'
    const label = TYPE_LABELS[type] || tgType

    return createPerception('telegram', type, String(ctx.from.id), {
      textFallback: `[用户发送了${label}，我暂时无法处理]`,
      meta: extractMeta(ctx),
    })
  }

  /**
   * 获取 Telegraf 类型到 Perception 类型的映射
   */
  static mapType(tgType) {
    return TG_TYPE_MAP[tgType] || 'file'
  }
}

/** 需要注册 handler 的不支持类型列表 — T38: voice/audio 已从此移除 */
export const UNSUPPORTED_TG_TYPES = ['video', 'video_note', 'document', 'sticker']
