/**
 * T38: Speech-to-Text — 本地 whisper.cpp 方案
 *
 * 设计: 工程层用 whisper-cli 本地转文字 → 稳定快速
 *       大脑收到: "用户发了语音，这是转换后的文字"
 *       音频文件保留供大脑回溯
 *
 * 依赖: brew install whisper-cpp + ggml 模型文件
 * 输入: ogg/opus (Telegram 语音格式)
 * 流程: ogg → ffmpeg → wav (16kHz mono) → whisper-cli → text
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('stt')
const execFileAsync = promisify(execFile)

/** whisper-cli 超时 (ms) */
const WHISPER_TIMEOUT_MS = 30_000
/** ffmpeg 转换超时 (ms) */
const FFMPEG_TIMEOUT_MS = 10_000

export class SpeechToText {
  #modelPath
  #language
  #whisperBin

  /**
   * @param {object} opts
   * @param {string} opts.modelPath - ggml 模型文件路径
   * @param {string} [opts.language='zh'] - 语言 (zh/en/auto)
   * @param {string} [opts.whisperBin='whisper-cli'] - whisper-cli 路径
   */
  constructor(opts = {}) {
    this.#modelPath = opts.modelPath || ''
    this.#language = opts.language || 'zh'
    this.#whisperBin = opts.whisperBin || 'whisper-cli'
  }

  /**
   * 转录音频文件 (ogg → wav → whisper-cli → text)
   *
   * @param {string} audioPath - 本地音频文件路径 (.ogg)
   * @returns {Promise<{ok: boolean, text?: string, duration?: number, error?: string}>}
   */
  async transcribe(audioPath) {
    const ts = Date.now()

    // [0] 检查模型文件
    if (!this.#modelPath || !existsSync(this.#modelPath)) {
      return { ok: false, error: `模型文件不存在: ${this.#modelPath}` }
    }

    if (!existsSync(audioPath)) {
      return { ok: false, error: `音频文件不存在: ${audioPath}` }
    }

    try {
      // [1] ogg → wav (whisper-cli 需要 16kHz mono WAV)
      const wavPath = audioPath.replace(/\.[^.]+$/, '.wav')
      log.info(`[stt] ▶ 转换: ${audioPath} → WAV`)

      await execFileAsync('ffmpeg', [
        '-y', '-i', audioPath,
        '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath,
      ], { timeout: FFMPEG_TIMEOUT_MS })

      // [2] whisper-cli 转录
      log.info(`[stt] ▶ 转录中 (model=${this.#modelPath.split('/').pop()}, lang=${this.#language})`)

      const { stdout, stderr } = await execFileAsync(this.#whisperBin, [
        '-m', this.#modelPath,
        '-l', this.#language,
        '-f', wavPath,
        '--no-timestamps',
        '-t', '4',  // 使用 4 线程
      ], { timeout: WHISPER_TIMEOUT_MS })

      // [3] 提取文字 (whisper 输出: timing 信息到 stderr, 文本到 stdout)
      const text = stdout.trim()
      const elapsed = Date.now() - ts

      if (!text) {
        log.warn(`[stt] ⚠ 转录为空 (${elapsed}ms)`)
        return { ok: false, error: '转录结果为空', duration: elapsed }
      }

      log.info(`[stt] ✅ 转录完成: "${text.slice(0, 80)}" (${elapsed}ms)`)

      // 从 stderr 提取 total time
      const timeMatch = stderr.match(/total time =\s+([\d.]+)\s*ms/)
      const whisperMs = timeMatch ? parseFloat(timeMatch[1]) : elapsed

      return { ok: true, text, duration: whisperMs }

    } catch (e) {
      const elapsed = Date.now() - ts
      const errMsg = e.killed ? `转录超时 (${WHISPER_TIMEOUT_MS}ms)` : e.message
      log.error(`[stt] ✖ 转录失败 (${elapsed}ms): ${errMsg}`)
      return { ok: false, error: errMsg, duration: elapsed }
    }
  }

  /** 健康检查 */
  health() {
    return {
      ok: !!this.#modelPath && existsSync(this.#modelPath),
      detail: {
        model: this.#modelPath,
        language: this.#language,
        bin: this.#whisperBin,
      },
    }
  }
}
