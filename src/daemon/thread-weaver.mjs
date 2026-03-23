/**
 * T36: ThreadWeaver — AI-powered episode classification daemon
 *
 * Periodically classifies unclassified episodes into threads.
 * Triggered by Pulse (1h interval), not on every conversation.
 *
 * Flow:
 *   1. Query unclassified episodes
 *   2. Query existing threads
 *   3. Ask AI to classify → JSON response
 *   4. Parse + create new threads + link episodes + refresh stats
 */
import { createLogger } from '../logger.mjs'

const log = createLogger('thread-weaver')

const WEAVE_PROMPT = `你是一个对话主题分析助手。
请分析以下未归类的对话片段，为每条对话指定归属的主题线。

现有主题线:
{existingThreads}

未归类对话:
{episodes}

请输出 JSON 数组 (不要加 markdown 代码块):
[
  {{ "episode_id": 数字, "thread_id": "已有主题ID" | "new", "thread_title": "新主题名称(仅 new 时需要)", "category": "分类(仅 new 时需要)" }}
]

规则:
- 优先归入已有主题线
- 相关度不够时才创建新主题
- category 可选: health, work, learning, travel, personal, general
- 不要创建过于细分的主题，宁可合并`

export class ThreadWeaver {
  #threads
  #engine

  constructor({ threads, engine }) {
    this.#threads = threads
    this.#engine = engine
  }

  /**
   * Classify unclassified episodes into threads (batch)
   * @returns {{ classified: number, newThreads: number }}
   */
  async weave() {
    const unclassified = this.#threads.getUnclassified(100)
    if (unclassified.length === 0) {
      log.debug('无未归类 episode，跳过')
      return { classified: 0, newThreads: 0 }
    }

    log.info(`开始 Thread 归类: ${unclassified.length} 条未归类 episode`)

    const existingThreads = this.#threads.list({ limit: 50 })
    const prompt = this.#buildPrompt(unclassified, existingThreads)

    let session
    try {
      session = await this.#engine.createSession()
    } catch (e) {
      log.warn(`创建 AI session 失败: ${e.message}`)
      return { classified: 0, newThreads: 0 }
    }

    let result
    try {
      result = await this.#engine.sendAndWait(session.id, prompt, {
        system: '你是对话主题分析助手。只输出 JSON 数组，不加任何解释。',
        timeoutMs: 30_000,
      })
    } catch (e) {
      log.warn(`AI 归类请求失败: ${e.message}`)
      return { classified: 0, newThreads: 0 }
    }

    const assignments = this.#parseResponse(result.text)
    if (assignments.length === 0) {
      log.warn('AI 返回无有效归类结果')
      return { classified: 0, newThreads: 0 }
    }

    // Execute: create new threads + link episodes
    const threadMap = new Map()  // 'new:title' → created thread id
    let classified = 0
    let newThreads = 0

    for (const a of assignments) {
      try {
        let threadId = a.thread_id
        if (threadId === 'new' && a.thread_title) {
          const mapKey = `new:${a.thread_title}`
          if (!threadMap.has(mapKey)) {
            const t = this.#threads.create({
              title: a.thread_title,
              category: a.category || 'general',
            })
            threadMap.set(mapKey, t.id)
            newThreads++
          }
          threadId = threadMap.get(mapKey)
        }
        if (threadId && threadId !== 'new') {
          this.#threads.linkEpisode(a.episode_id, threadId)
          this.#threads.refreshStats(threadId)
          classified++
        }
      } catch (e) {
        log.warn(`归类 episode ${a.episode_id} 失败: ${e.message}`)
      }
    }

    log.info(`归类完成: ${classified} 条 → ${existingThreads.length + newThreads} 个 thread (新建 ${newThreads})`)
    return { classified, newThreads }
  }

  /**
   * Generate/update summary for a thread
   */
  async summarize(threadId) {
    const thread = this.#threads.get(threadId)
    if (!thread) {
      log.warn(`Thread not found: ${threadId}`)
      return null
    }

    const episodes = this.#threads.getEpisodes(threadId, 20)
    if (episodes.length === 0) return thread

    const session = await this.#engine.createSession()
    const episodeText = episodes.map(e =>
      `[${e.created_at}] ${e.content}`,
    ).join('\n')

    const result = await this.#engine.sendAndWait(session.id,
      `以下是主题 "${thread.title}" 下的对话记录:\n${episodeText}\n\n请生成一句简洁的主题摘要 (不超过 50 字)。`,
      { system: '你是摘要助手。只输出摘要文本，不加解释。', timeoutMs: 15_000 },
    )

    if (result.text?.trim()) {
      this.#threads.update(threadId, { summary: result.text.trim() })
      log.debug(`Thread 摘要更新: ${threadId}`)
    }
    return this.#threads.get(threadId)
  }

  // --- Internal ---

  #buildPrompt(episodes, existingThreads) {
    const threadList = existingThreads.length > 0
      ? existingThreads.map(t => `- id="${t.id}" title="${t.title}" category=${t.category}`).join('\n')
      : '(暂无主题线)'

    const episodeList = episodes.map(e =>
      `- id=${e.id} content="${e.content.slice(0, 100)}" time=${e.created_at}`,
    ).join('\n')

    return WEAVE_PROMPT
      .replace('{existingThreads}', threadList)
      .replace('{episodes}', episodeList)
  }

  #parseResponse(text) {
    if (!text?.trim()) return []
    try {
      // Strip markdown code block if present
      let cleaned = text.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      }
      const parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed)) return []
      // Validate each entry
      return parsed.filter(a =>
        typeof a.episode_id === 'number' &&
        typeof a.thread_id === 'string',
      )
    } catch (e) {
      log.warn(`AI 返回解析失败: ${e.message}`)
      return []
    }
  }
}
