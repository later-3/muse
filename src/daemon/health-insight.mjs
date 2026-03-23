/**
 * T34: HealthInsight — AI-powered health report analysis
 *
 * Reads recent selfCheck reports from HealthHistory, calls AI to
 * analyze trends and reasons, produces structured insight.
 *
 * Independent module — does NOT modify HealthHistory.
 * Insight storage: pulse/health-insight/ directory.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('health-insight')

const MIN_REPORTS = 3
const AI_TIMEOUT_MS = 30_000

/**
 * Build the AI analysis prompt from reports
 * @param {Array} reports — recent selfCheck reports (newest first)
 * @returns {string}
 */
function buildPrompt(reports) {
  const summaries = reports.map((r, i) => {
    const modules = r.system
      ? Object.entries(r.system).map(([k, v]) => `${k}=${v.status || '?'}`).join(', ')
      : 'N/A'
    return `#${i + 1} [${r.timestamp}] overall=${r.overall} modules: ${modules}`
  }).join('\n')

  return `以下是最近 ${reports.length} 次体检报告（最新在前）：
${summaries}

请分析并输出 JSON（不要输出其他内容）：
{
  "status": "stable" 或 "improving" 或 "degrading",
  "reason": "简短原因分析（1-2句）",
  "suggestion": "建议措施（1句）"
}`
}

const SYSTEM_PROMPT = '你是 Muse 的自检系统。只基于数据分析，不要编造。用简短的自然语言回答。'

/**
 * Parse AI response, extract JSON
 * @param {string} text — raw AI reply
 * @returns {object|null}
 */
function parseInsightResponse(text) {
  if (!text) return null

  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.status || !parsed.reason) return null
    // Validate status enum
    if (!['stable', 'improving', 'degrading'].includes(parsed.status)) {
      parsed.status = 'stable'
    }
    return parsed
  } catch {
    return null
  }
}

export class HealthInsight {
  #insightDir
  #engine

  /**
   * @param {object} opts
   * @param {string} opts.insightDir — directory to store insight files
   * @param {object} opts.engine — Engine instance (createSession + sendAndWait)
   */
  constructor({ insightDir, engine }) {
    this.#insightDir = insightDir
    this.#engine = engine
  }

  /**
   * Generate AI insight from recent health reports
   * @param {Array} reports — from HealthHistory.list() (newest first)
   * @returns {Promise<{status: string, reason: string, suggestion: string, timestamp: string}|null>}
   *          null if reports insufficient or AI fails
   */
  async generate(reports) {
    if (!reports || reports.length < MIN_REPORTS) {
      log.debug(`报告不足, 跳过 AI 解读 (${reports?.length || 0}/${MIN_REPORTS})`)
      return null
    }

    // Build prompt
    const prompt = buildPrompt(reports)

    // Call AI
    const session = await this.#engine.createSession()
    log.info(`创建 AI Session: ${session.id} (health-insight)`)

    const result = await this.#engine.sendAndWait(session.id, prompt, {
      system: SYSTEM_PROMPT,
      timeoutMs: AI_TIMEOUT_MS,
    })

    // Parse response
    const insight = parseInsightResponse(result.text)
    if (!insight) {
      log.warn(`AI 返回格式错误, 降级跳过: "${result.text?.slice(0, 100)}"`)
      return null
    }

    // Add timestamp and save
    const now = new Date()
    insight.timestamp = now.toISOString()
    insight.reportCount = reports.length

    this.#save(insight, now)
    log.info(`生成健康洞察: status=${insight.status}`)

    return insight
  }

  /**
   * Get the most recent insight
   * @returns {object|null}
   */
  getLatest() {
    if (!existsSync(this.#insightDir)) return null

    const files = readdirSync(this.#insightDir)
      .filter(f => f.startsWith('insight-') && f.endsWith('.json'))
      .sort()
      .reverse()

    if (files.length === 0) return null

    try {
      return JSON.parse(readFileSync(join(this.#insightDir, files[0]), 'utf-8'))
    } catch (e) {
      log.warn(`读取洞察文件失败: ${files[0]} ${e.message}`)
      return null
    }
  }

  /**
   * Save insight to disk
   */
  #save(insight, date) {
    if (!existsSync(this.#insightDir)) {
      mkdirSync(this.#insightDir, { recursive: true })
    }

    const safeName = date.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
    const filename = `insight-${safeName}.json`
    writeFileSync(
      join(this.#insightDir, filename),
      JSON.stringify(insight, null, 2) + '\n',
    )
  }
}

// Export for testing
export { buildPrompt, parseInsightResponse, MIN_REPORTS }
