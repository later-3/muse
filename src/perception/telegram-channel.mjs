/**
 * T14.5: Telegram Channel — I/O 层
 *
 * 负责 Telegram 的物理 I/O 操作 (下载文件等)。
 * TelegramSense 保持纯函数 (感知层)，Channel 做脏活 (通道层)。
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('telegram-channel')

/** 默认图片存储目录 */
const DEFAULT_IMAGE_DIR = './data/images'

/** 下载超时 (ms) */
const DOWNLOAD_TIMEOUT_MS = 30_000

/** 最大文件大小 (20MB — Telegram Bot API 限制) */
const MAX_FILE_SIZE = 20 * 1024 * 1024

export class TelegramChannel {
  #bot
  #imageDir

  /**
   * @param {object} options
   * @param {object} options.bot - Telegraf bot 实例 (用 bot.telegram 调 API)
   * @param {string} [options.imageDir] - 图片存储目录
   */
  constructor({ bot, imageDir }) {
    this.#bot = bot
    this.#imageDir = imageDir || DEFAULT_IMAGE_DIR
  }

  /**
   * 下载 Telegram 文件到本地
   *
   * @param {string} fileId - Telegram file_id
   * @param {object} [meta] - 可选元数据 (userId, messageId 等，用于命名)
   * @param {object} [opts] - 可选参数
   * @param {string} [opts.ext] - 文件扩展名 (默认 '.jpg')
   * @returns {Promise<{ok: true, localPath: string, size: number} | {ok: false, error: string}>}
   */
  async downloadFile(fileId, meta = {}, opts = {}) {
    const ts = Date.now()

    try {
      // [1] 获取文件链接 (不记录 URL — 含 bot token)
      log.info(`[channel] ▶ 开始下载 fileId=${fileId.slice(0, 20)}...`)
      const fileLink = await this.#bot.telegram.getFileLink(fileId)
      const url = fileLink.href || fileLink.toString()

      // [2] 下载文件 — 使用 Telegraf 的 HTTP agent (复用 bot 的网络通道)
      const fetchOpts = {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      }
      // Telegraf 的 agent 可能配了 proxy/自定义 DNS，复用它确保一致性
      const botAgent = this.#bot.telegram?.options?.agent
      if (botAgent) {
        fetchOpts.agent = botAgent
      }

      const res = await fetch(url, fetchOpts)

      if (!res.ok) {
        const errMsg = `Telegram 文件下载失败: HTTP ${res.status}`
        log.error(`[channel] ✖ ${errMsg}`)
        return { ok: false, error: errMsg }
      }

      const buffer = Buffer.from(await res.arrayBuffer())

      // [3] 大小检查
      if (buffer.length > MAX_FILE_SIZE) {
        const errMsg = `文件过大: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (限制 ${MAX_FILE_SIZE / 1024 / 1024}MB)`
        log.warn(`[channel] ✖ ${errMsg}`)
        return { ok: false, error: errMsg }
      }

      // [4] 存储到本地
      const ext = opts.ext || '.jpg'
      const filename = this.#generateFilename(fileId, meta, ext)
      const localPath = join(this.#imageDir, filename)

      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, buffer)

      const elapsed = Date.now() - ts
      log.info(`[channel] ✅ 下载完成: ${localPath} (${(buffer.length / 1024).toFixed(1)}KB, ${elapsed}ms)`)

      return { ok: true, localPath, size: buffer.length }
    } catch (e) {
      const elapsed = Date.now() - ts
      const cause = e.cause ? ` cause=${e.cause.code || e.cause.message || e.cause}` : ''
      const errMsg = e.name === 'TimeoutError'
        ? `下载超时 (${DOWNLOAD_TIMEOUT_MS}ms)`
        : `下载失败: ${e.message}${cause}`

      log.error(`[channel] ✖ ${errMsg} (${elapsed}ms)`)
      return { ok: false, error: errMsg }
    }
  }

  /**
   * 生成本地文件名
   * 格式: {timestamp}_{userId}_{fileId前8位}.{ext}
   */
  #generateFilename(fileId, meta, ext = '.jpg') {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const userId = meta.userId || 'unknown'
    const shortId = fileId.slice(-8)
    return `${ts}_${userId}_${shortId}${ext}`
  }

  /**
   * T38: 发送语音消息
   *
   * @param {string} chatId - Telegram chat ID
   * @param {Buffer} audioBuffer - ogg/opus 音频数据
   * @param {object} [opts]
   * @param {string} [opts.caption] - 附带文字
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async sendVoice(chatId, audioBuffer, opts = {}) {
    const { caption } = opts
    log.info(`[channel] ▶ 发送语音: chatId=${chatId} size=${audioBuffer.length}B`)
    try {
      await this.#bot.telegram.sendVoice(chatId, { source: audioBuffer }, { caption })
      log.info(`[channel] ✅ 语音发送成功`)
      return { ok: true }
    } catch (e) {
      log.error(`[channel] ✖ 语音发送失败: ${e.message}`)
      return { ok: false, error: e.message }
    }
  }

  /**
   * 发送图片
   *
   * @param {string} chatId - Telegram chat ID
   * @param {Buffer|string} photoSource - 图片数据 (Buffer) 或 URL/file_id (string)
   * @param {object} [opts]
   * @param {string} [opts.caption] - 附带文字
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async sendPhoto(chatId, photoSource, opts = {}) {
    const { caption } = opts
    const isBuffer = Buffer.isBuffer(photoSource)
    log.info(`[channel] ▶ 发送图片: chatId=${chatId} type=${isBuffer ? 'buffer' : 'url'} ${isBuffer ? `size=${photoSource.length}B` : ''}`)
    try {
      const source = isBuffer ? { source: photoSource } : photoSource
      await this.#bot.telegram.sendPhoto(chatId, source, { caption })
      log.info(`[channel] ✅ 图片发送成功`)
      return { ok: true }
    } catch (e) {
      log.error(`[channel] ✖ 图片发送失败: ${e.message}`)
      return { ok: false, error: e.message }
    }
  }
}

export { DEFAULT_IMAGE_DIR, DOWNLOAD_TIMEOUT_MS, MAX_FILE_SIZE }
