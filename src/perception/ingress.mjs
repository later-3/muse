/**
 * T14: Perception Ingress — 感知统一入口
 *
 * 接收标准化的 PerceptionObject，路由到 Orchestrator 或返回不支持提示。
 * T14.5: image 类型会先通过 Channel 下载，再构建包含图片信息的消息发给 AI。
 * T16: 不支持的类型自动记录到 GapJournal。
 */

import { createLogger } from '../logger.mjs'
import { validatePerception, SUPPORTED_TYPES, TYPE_LABELS } from './types.mjs'

const log = createLogger('ingress')

export class PerceptionIngress {
  #orchestrator
  #channel
  #gapJournal
  #stt

  /**
   * @param {object} deps
   * @param {object} deps.orchestrator
   * @param {object} [deps.channel] - TelegramChannel (T14.5: 图片下载通道)
   * @param {object} [deps.gapJournal] - GapJournal (T16: 缺口记录)
   * @param {object} [deps.stt] - SpeechToText (T38: 本地语音转文字)
   */
  constructor({ orchestrator, channel, gapJournal, stt }) {
    this.#orchestrator = orchestrator
    this.#channel = channel || null
    this.#gapJournal = gapJournal || null
    this.#stt = stt || null
  }

  /**
   * 处理一个标准化的感知对象
   *
   * @param {import('./types.mjs').PerceptionObject} perception
   * @param {object} [context] - 附加上下文
   * @param {string} [context.sessionId] - session ID
   * @returns {Promise<{text: string, sessionId: string|null, handled: boolean}>}
   */
  async handle(perception, context = {}) {
    // [1] 校验
    const errors = validatePerception(perception)
    if (errors.length > 0) {
      log.error(`[ingress] PerceptionObject 校验失败: ${errors.join('; ')}`)
      throw new Error(`Invalid PerceptionObject: ${errors.join('; ')}`)
    }

    const { source, type, userId } = perception
    log.info(`[ingress] ▶ 感知 source=${source} type=${type} user=${userId}`)

    // [2] 不支持的类型 → 友好提示 + T16 记录 Gap
    if (!SUPPORTED_TYPES.includes(type)) {
      const label = TYPE_LABELS[type] || type
      log.warn(`[ingress] ✘ 不支持的类型: ${type} (${label}) user=${userId}`)

      // T16: 记录 Gap (有 journal 就写，没有就仅日志)
      if (this.#gapJournal) {
        this.#gapJournal.record({ type, source, userId, reason: 'unsupported', detail: `用户发送了${label}，当前不支持` })
      } else {
        log.info(`[ingress] GAP_RECORD type=${type} source=${source} user=${userId} reason=unsupported`)
      }

      const message = `抱歉，我暂时还不能处理${label}哦～ 😅\n目前我只能处理文字和图片。语音和视频的能力还在成长中！`
      return { text: message, sessionId: null, handled: false }
    }

    // [3] text → 直接转发
    if (type === 'text') {
      log.info(`[ingress] → text 路由到 Orchestrator`)
      const result = await this.#orchestrator.handleMessage(perception.text, {
        source,
        sessionId: context.sessionId,
        timeoutMs: context.timeoutMs,
      })
      return { ...result, handled: true }
    }

    // [4] image → T14.5 感知通道
    if (type === 'image') {
      const message = await this.#buildImageMessage(perception)
      log.info(`[ingress] → image 路由到 Orchestrator: "${message.slice(0, 80)}"`)
      const result = await this.#orchestrator.handleMessage(message, {
        source,
        sessionId: context.sessionId,
        timeoutMs: context.timeoutMs,
      })
      return { ...result, handled: true }
    }

    // [5] T38: audio → 和图片一样: 下载→本地→AI 多模态理解
    if (type === 'audio') {
      const message = await this.#buildAudioMessage(perception)
      log.info(`[ingress] → audio 路由到 Orchestrator: "${message.slice(0, 80)}"`)
      const result = await this.#orchestrator.handleMessage(message, {
        source,
        sessionId: context.sessionId,
        timeoutMs: context.timeoutMs,
      })
      return { ...result, handled: true }
    }

    // [6] 兜底 (不应到达)
    log.error(`[ingress] ✖ 未处理的已支持类型: ${type}`)
    return { text: '出了点问题，请稍后再试。', sessionId: null, handled: false }
  }

  /**
   * T14.5: 构建图片感知消息
   *
   * 工程层负责: 下载图片、构建消息
   * AI 层负责: 理解图片内容、决定如何回应
   *
   * @param {object} perception - PerceptionObject (type=image)
   * @returns {Promise<string>} 发给 AI 的消息文本
   */
  async #buildImageMessage(perception) {
    const { artifact, textFallback, meta } = perception
    const caption = textFallback || ''
    const fileId = artifact?.remoteUrl || meta?.fileId

    // 没有 channel 或没有 fileId → 降级到纯文本
    if (!this.#channel || !fileId) {
      log.warn(`[ingress] image 无 channel 或 fileId，降级到 textFallback`)
      return this.#formatImageFallback(caption, meta)
    }

    // 尝试下载
    const downloadResult = await this.#channel.downloadFile(fileId, {
      userId: perception.userId,
      messageId: meta?.messageId,
    })

    if (downloadResult.ok) {
      return this.#formatImageSuccess(downloadResult.localPath, caption, meta)
    } else {
      return this.#formatImageFailure(downloadResult.error, caption, meta)
    }
  }

  /**
   * 图片下载成功 → 告诉 AI 图片在哪
   */
  #formatImageSuccess(localPath, caption, meta) {
    const parts = [`[图片感知] Later 发来了一张图片。`]
    parts.push(`图片已保存到本地: ${localPath}`)
    if (caption && caption !== '[用户发送了一张图片]') {
      parts.push(`附带说明: "${caption}"`)
    }
    if (meta?.width && meta?.height) {
      parts.push(`尺寸: ${meta.width}×${meta.height}`)
    }
    parts.push(`你可以用 bash 工具查看这张图片，或者直接基于说明回应。`)
    return parts.join('\n')
  }

  /**
   * 图片下载失败 → 告诉 AI 发生了什么，让她决策
   */
  #formatImageFailure(error, caption, meta) {
    const parts = [`[图片感知] Later 发来了一张图片，但下载失败了。`]
    parts.push(`失败原因: ${error}`)
    if (caption && caption !== '[用户发送了一张图片]') {
      parts.push(`图片附带的说明: "${caption}"`)
    }
    if (meta?.width && meta?.height) {
      parts.push(`图片尺寸: ${meta.width}×${meta.height}`)
    }
    parts.push(`请根据已有信息回应 Later，如果需要看图可以告诉他图片暂时无法查看。`)
    return parts.join('\n')
  }

  /**
   * 无下载通道 → 降级提示
   */
  #formatImageFallback(caption, meta) {
    const parts = [`[图片感知] Later 发来了一张图片。`]
    parts.push(`当前没有图片下载通道，无法查看图片内容。`)
    if (caption && caption !== '[用户发送了一张图片]') {
      parts.push(`图片附带的说明: "${caption}"`)
    }
    parts.push(`请根据说明回应 Later。`)
    return parts.join('\n')
  }

  /**
   * T38: 构建音频感知消息
   *
   * 工程层: 下载→本地 whisper STT 转文字 (稳定快速)
   * AI 层: 收到"用户发了语音，这是转换后的文字" + 文件路径供回溯
   *
   * 设计: Agent-First 不是全部给 Agent 处理
   *       本地 STT 很稳, 数据转换正确就用本地
   *       文件保留, AI 需要时可自己回溯解析
   */
  async #buildAudioMessage(perception) {
    const { artifact, meta } = perception
    const fileId = artifact?.remoteUrl || meta?.fileId

    // 没有 channel 或没有 fileId → 降级
    if (!this.#channel || !fileId) {
      log.warn(`[ingress] audio 无 channel 或 fileId，降级`)
      return this.#formatAudioFallback(meta)
    }

    // [1] 下载音频文件 (.ogg)
    const downloadResult = await this.#channel.downloadFile(fileId, {
      userId: perception.userId,
      messageId: meta?.messageId,
    }, { ext: '.ogg' })

    if (!downloadResult.ok) {
      return this.#formatAudioFailure(downloadResult.error, meta)
    }

    // [2] 本地 STT 转文字
    if (this.#stt) {
      const sttResult = await this.#stt.transcribe(downloadResult.localPath)
      if (sttResult.ok && sttResult.text) {
        return this.#formatAudioWithTranscript(
          sttResult.text, downloadResult.localPath, meta, sttResult.duration
        )
      }
      log.warn(`[ingress] STT 转录失败: ${sttResult.error}, 降级为无文字模式`)
    }

    // [3] STT 未可用或失败 → 只告诉 AI 文件路径
    return this.#formatAudioSuccess(downloadResult.localPath, meta)
  }

  /**
   * 音频转录成功 → 告诉 AI 原始文字 + 文件路径(回溯用)
   */
  #formatAudioWithTranscript(text, localPath, meta, durationMs) {
    const parts = [`[语音感知] Later 发来了一条语音消息。`]
    parts.push(`语音内容 (本地转录): "${text}"`)
    parts.push(`原始音频: ${localPath}`)
    if (meta?.duration) parts.push(`时长: ${meta.duration}秒`)
    if (durationMs) parts.push(`(转录耗时: ${(durationMs / 1000).toFixed(1)}秒)`)
    parts.push(`请基于语音内容回应 Later。如有疑问可回溯原始音频文件。`)
    return parts.join('\n')
  }

  /**
   * 音频下载成功但无 STT → 告诉 AI 音频在哪
   */
  #formatAudioSuccess(localPath, meta) {
    const parts = [`[语音感知] Later 发来了一条语音消息。`]
    parts.push(`音频已保存到本地: ${localPath}`)
    if (meta?.duration) parts.push(`时长: ${meta.duration}秒`)
    parts.push(`请你听取这段音频来理解 Later 说的话，然后回应他。`)
    return parts.join('\n')
  }

  /**
   * 音频下载失败
   */
  #formatAudioFailure(error, meta) {
    const parts = [`[语音感知] Later 发来了一条语音消息，但下载失败了。`]
    parts.push(`失败原因: ${error}`)
    if (meta?.duration) parts.push(`语音时长: ${meta.duration}秒`)
    parts.push(`请告诉 Later 语音暂时无法收听，请他用文字重新发送。`)
    return parts.join('\n')
  }

  /**
   * 无下载通道 → 降级
   */
  #formatAudioFallback(meta) {
    const parts = [`[语音感知] Later 发来了一条语音消息。`]
    parts.push(`当前没有音频下载通道，无法收听。`)
    if (meta?.duration) parts.push(`语音时长: ${meta.duration}秒`)
    parts.push(`请告诉 Later 语音暂时无法收听，请他用文字重新发送。`)
    return parts.join('\n')
  }
}
