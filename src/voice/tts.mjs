/**
 * T38: Text-to-Speech — edge-tts (联网) + macOS say (本地兜底)
 *
 * 设计: Agent 决策何时用语音回复, 工程层做 TTS 转换
 *
 * 方案选型 (2026-03-16 评测):
 *
 * | 方案           | 速度    | 音质   | 中文   | 依赖         | 备注                      |
 * |----------------|---------|--------|--------|--------------|---------------------------|
 * | edge-tts       | ~2s     | ⭐⭐⭐⭐ | ✅ 优秀 | pip (联网)    | 微软免费通道, 多声音选择   |
 * | macOS say      | <1s     | ⭐⭐    | ✅     | 零 (本地)     | 系统自带, 音质一般         |
 * | Kokoro TTS     | ~1-3s   | ⭐⭐⭐  | ✅     | Python+模型   | 82M 本地神经网络, 中文专项 |
 * | piper          | ~1-2s   | ⭐⭐⭐  | 有限   | 本地模型      | 仓库已归档                 |
 * | Coqui TTS      | ~2-3s   | ⭐⭐⭐  | ✅     | Python+torch  | 已停维护                   |
 * | OpenAI TTS     | ~2-4s   | ⭐⭐⭐⭐⭐| ✅     | API key       | 需要静态 key, 我们是 OAuth |
 *
 * 决策: edge-tts (XiaoyiNeural — 活泼, 匹配小缪 ENFP) + macOS say 兜底
 *
 * 小缪声音: XiaoyiNeural (Female, Lively/活泼)
 * - 备选: XiaoxiaoNeural (Female, Warm/温暖)
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createLogger } from '../logger.mjs'

const log = createLogger('tts')
const execFileAsync = promisify(execFile)

/** TTS 超时 (ms) */
const TTS_TIMEOUT_MS = 15_000
/** macOS say 超时 (ms) */
const SAY_TIMEOUT_MS = 10_000

/**
 * 小缪的声音配置
 * ENFP 性格: 活泼有趣 → XiaoyiNeural
 */
const DEFAULT_VOICE = 'zh-CN-XiaoyiNeural'
const FALLBACK_VOICE = 'Tingting'  // macOS say 中文声音

export class TextToSpeech {
  #voice
  #fallbackVoice
  #tmpDir

  /**
   * @param {object} [opts]
   * @param {string} [opts.voice='zh-CN-XiaoyiNeural'] - edge-tts 声音
   * @param {string} [opts.fallbackVoice='Tingting'] - macOS say 兜底声音
   * @param {string} [opts.tmpDir='/tmp'] - 临时文件目录
   */
  constructor(opts = {}) {
    this.#voice = opts.voice || DEFAULT_VOICE
    this.#fallbackVoice = opts.fallbackVoice || FALLBACK_VOICE
    this.#tmpDir = opts.tmpDir || '/tmp'
  }

  /**
   * 文字转语音 → ogg/opus Buffer (Telegram 可直接发送)
   *
   * 策略: edge-tts → 失败 → macOS say → 失败 → 返回 null
   *
   * @param {string} text - 要合成的文字
   * @param {object} [opts]
   * @param {string} [opts.voice] - 覆盖默认声音
   * @returns {Promise<{ ok: boolean, buffer?: Buffer, engine?: string, error?: string }>}
   */
  async synthesize(text, opts = {}) {
    if (!text || text.trim().length === 0) {
      return { ok: false, error: '空文本' }
    }

    const voice = opts.voice || this.#voice
    const cleanText = text.trim()

    // [1] 尝试 edge-tts (联网, 高音质)
    const edgeResult = await this.#tryEdgeTTS(cleanText, voice)
    if (edgeResult.ok) return edgeResult

    // [2] 降级: macOS say (本地, 零依赖)
    log.warn(`[tts] edge-tts 失败 (${edgeResult.error}), 降级 macOS say`)
    const sayResult = await this.#tryMacOSSay(cleanText)
    if (sayResult.ok) return sayResult

    // [3] 全部失败
    return { ok: false, error: `TTS 全部失败: edge=${edgeResult.error}, say=${sayResult.error}` }
  }

  /**
   * edge-tts: text → mp3 → ffmpeg → ogg/opus
   */
  async #tryEdgeTTS(text, voice) {
    const tmpMp3 = join(this.#tmpDir, `muse-tts-${randomBytes(4).toString('hex')}.mp3`)
    const tmpOgg = tmpMp3.replace('.mp3', '.ogg')

    try {
      const ts = Date.now()

      // edge-tts → mp3
      await execFileAsync('edge-tts', [
        '--text', text,
        '--voice', voice,
        '--write-media', tmpMp3,
      ], { timeout: TTS_TIMEOUT_MS })

      // mp3 → ogg/opus (Telegram 需要 opus 编码)
      await execFileAsync('ffmpeg', [
        '-y', '-i', tmpMp3,
        '-c:a', 'libopus', '-b:a', '48k',
        tmpOgg,
      ], { timeout: SAY_TIMEOUT_MS })

      const buffer = await readFile(tmpOgg)
      const elapsed = Date.now() - ts

      log.info(`[tts] ✅ edge-tts 完成: ${buffer.length}B, voice=${voice} (${elapsed}ms)`)

      // 清理临时文件
      await unlink(tmpMp3).catch(() => {})
      await unlink(tmpOgg).catch(() => {})

      return { ok: true, buffer, engine: 'edge-tts' }
    } catch (e) {
      // 清理
      await unlink(tmpMp3).catch(() => {})
      await unlink(tmpOgg).catch(() => {})

      const errMsg = e.killed ? `超时 (${TTS_TIMEOUT_MS}ms)` : e.message
      log.error(`[tts] ✖ edge-tts 失败: ${errMsg}`)
      return { ok: false, error: errMsg }
    }
  }

  /**
   * macOS say: text → aiff → ffmpeg → ogg/opus
   */
  async #tryMacOSSay(text) {
    const tmpAiff = join(this.#tmpDir, `muse-tts-${randomBytes(4).toString('hex')}.aiff`)
    const tmpOgg = tmpAiff.replace('.aiff', '.ogg')

    try {
      const ts = Date.now()

      // say → aiff
      await execFileAsync('say', [
        '-v', this.#fallbackVoice,
        '-o', tmpAiff,
        text,
      ], { timeout: SAY_TIMEOUT_MS })

      // aiff → ogg/opus
      await execFileAsync('ffmpeg', [
        '-y', '-i', tmpAiff,
        '-c:a', 'libopus', '-b:a', '48k',
        tmpOgg,
      ], { timeout: SAY_TIMEOUT_MS })

      const buffer = await readFile(tmpOgg)
      const elapsed = Date.now() - ts

      log.info(`[tts] ✅ macOS say 完成: ${buffer.length}B, voice=${this.#fallbackVoice} (${elapsed}ms)`)

      await unlink(tmpAiff).catch(() => {})
      await unlink(tmpOgg).catch(() => {})

      return { ok: true, buffer, engine: 'macos-say' }
    } catch (e) {
      await unlink(tmpAiff).catch(() => {})
      await unlink(tmpOgg).catch(() => {})

      const errMsg = e.killed ? '超时' : e.message
      log.error(`[tts] ✖ macOS say 失败: ${errMsg}`)
      return { ok: false, error: errMsg }
    }
  }

  /** 健康检查 */
  health() {
    return {
      ok: true,  // say 总是可用的
      detail: {
        primaryVoice: this.#voice,
        fallbackVoice: this.#fallbackVoice,
        engine: 'edge-tts + macOS say',
      },
    }
  }
}
