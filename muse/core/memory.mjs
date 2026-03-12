import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { createLogger } from '../logger.mjs'

const log = createLogger('memory')

// --- Constants ---

/** searchEpisodes limit 上界，防止大 limit 放大 IO */
const MAX_SEARCH_LIMIT = 100

/** 粗略 token 估算: 字符数 / 4 (Phase 2 换 tiktoken) */
function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

// --- SQL ---

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS semantic_memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL DEFAULT 'muse',
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    category   TEXT DEFAULT 'general',
    source     TEXT DEFAULT 'auto',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, key)
  );
  CREATE INDEX IF NOT EXISTS idx_semantic_agent ON semantic_memory(agent_id);
  CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memory(agent_id, category);

  CREATE TABLE IF NOT EXISTS episodic_memory (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id      TEXT NOT NULL DEFAULT 'muse',
    session_id    TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content       TEXT NOT NULL,
    summary       TEXT,
    token_count   INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memory(agent_id);
  CREATE INDEX IF NOT EXISTS idx_episodic_agent_session ON episodic_memory(agent_id, session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_episodic_time ON episodic_memory(agent_id, created_at);
`

// --- Prepared Statement Queries ---
// Extracted as constants to avoid inline SQL strings scattered in methods

const SQL = {
  // Semantic
  upsert: `
    INSERT INTO semantic_memory (agent_id, key, value, category, source, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(agent_id, key)
    DO UPDATE SET value = excluded.value,
                  category = excluded.category,
                  source = excluded.source,
                  updated_at = datetime('now')`,
  get: 'SELECT * FROM semantic_memory WHERE agent_id = ? AND key = ?',
  delete: 'DELETE FROM semantic_memory WHERE agent_id = ? AND key = ?',
  listAll: 'SELECT * FROM semantic_memory WHERE agent_id = ? ORDER BY updated_at DESC, id DESC',
  listByCategory: 'SELECT * FROM semantic_memory WHERE agent_id = ? AND category = ? ORDER BY updated_at DESC, id DESC',
  search: 'SELECT * FROM semantic_memory WHERE agent_id = ? AND (key LIKE ? OR value LIKE ?) ORDER BY updated_at DESC, id DESC',

  // Episodic
  addEpisode: `
    INSERT INTO episodic_memory (agent_id, session_id, role, content, summary, token_count)
    VALUES (?, ?, ?, ?, ?, ?)`,
  updateSummary: 'UPDATE episodic_memory SET summary = ? WHERE id = ? AND agent_id = ?',
  recentEpisodes: `
    SELECT * FROM episodic_memory
    WHERE agent_id = ? AND created_at >= datetime('now', ?)
    ORDER BY created_at DESC, id DESC`,
  sessionEpisodes: `
    SELECT * FROM episodic_memory
    WHERE agent_id = ? AND session_id = ?
    ORDER BY created_at ASC, id ASC`,
  searchEpisodes: `
    SELECT * FROM episodic_memory
    WHERE agent_id = ? AND (content LIKE ? OR summary LIKE ?)
    ORDER BY created_at DESC, id DESC
    LIMIT ?`,
  recentSummaries: `
    SELECT id, session_id, summary, created_at FROM episodic_memory
    WHERE agent_id = ?
      AND summary IS NOT NULL
      AND role = 'assistant'
      AND created_at >= datetime('now', ?)
    ORDER BY created_at DESC, id DESC`,
  stats: `
    SELECT
      COUNT(*) as totalMessages,
      COUNT(DISTINCT session_id) as totalSessions,
      COALESCE(SUM(token_count), 0) as totalTokens,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM episodic_memory WHERE agent_id = ?`,

  // Health
  semanticCount: 'SELECT COUNT(*) as count FROM semantic_memory WHERE agent_id = ?',
  episodicCount: 'SELECT COUNT(*) as count FROM episodic_memory WHERE agent_id = ?',
  ping: 'SELECT 1',
}

// --- Memory Class ---

export class Memory {
  #db = null
  #config
  #agentId
  #stmts = {}  // 缓存 prepared statements

  constructor(config, agentId = 'muse') {
    this.#config = config
    this.#agentId = agentId
  }

  // --- 生命周期 ---

  async start() {
    // 幂等保护: 已启动则先关闭旧连接，避免资源泄漏
    if (this.#db) {
      this.#db.close()
      this.#db = null
      this.#stmts = {}
    }

    const dbPath = this.#config.memory.dbPath
    mkdirSync(dirname(dbPath), { recursive: true })

    this.#db = new Database(dbPath)
    this.#db.pragma('journal_mode = WAL')
    this.#db.pragma('busy_timeout = 5000')
    this.#db.exec(SCHEMA_SQL)
    this.#prepareStatements()

    log.info(`记忆系统已启动: ${dbPath}`)
  }

  async stop() {
    if (this.#db) {
      this.#db.close()
      this.#db = null
      this.#stmts = {}
    }
    log.info('记忆系统已关闭')
  }

  async health() {
    if (!this.#db) return { ok: false, detail: 'not connected' }
    try {
      this.#db.prepare(SQL.ping).get()
      const semanticCount = this.#db.prepare(SQL.semanticCount).get(this.#agentId).count
      const episodicCount = this.#db.prepare(SQL.episodicCount).get(this.#agentId).count
      return {
        ok: true,
        detail: { semanticCount, episodicCount, agentId: this.#agentId },
      }
    } catch (e) {
      return { ok: false, detail: e.message }
    }
  }

  // --- 语义记忆 (KV) ---

  /** 设置语义记忆 (upsert): 同 key 自动覆盖 */
  setMemory(key, value, category = 'general', source = 'auto') {
    this.#ensureConnected()
    this.#stmts.upsert.run(this.#agentId, key, value, category, source)
  }

  /** 获取单条语义记忆，不存在返回 null */
  getMemory(key) {
    this.#ensureConnected()
    return this.#stmts.get.get(this.#agentId, key) ?? null
  }

  /** 删除单条语义记忆，返回是否有删除 */
  deleteMemory(key) {
    this.#ensureConnected()
    return this.#stmts.delete.run(this.#agentId, key).changes > 0
  }

  /** 列出语义记忆 (可选分类筛选), 按 updated_at DESC */
  listMemories(category = null) {
    this.#ensureConnected()
    if (category) {
      return this.#stmts.listByCategory.all(this.#agentId, category)
    }
    return this.#stmts.listAll.all(this.#agentId)
  }

  /** 按关键词搜索语义记忆 (key + value 模糊匹配) */
  searchMemories(keyword) {
    this.#ensureConnected()
    const pattern = `%${keyword}%`
    return this.#stmts.search.all(this.#agentId, pattern, pattern)
  }

  // --- 情景记忆 ---

  /** 添加一条对话记录，返回插入行 ID */
  addEpisode(sessionId, role, content, summary = null) {
    this.#ensureConnected()
    const tokenCount = estimateTokens(content)
    const info = this.#stmts.addEpisode.run(
      this.#agentId, sessionId, role, content, summary, tokenCount,
    )
    return info.lastInsertRowid
  }

  /**
   * 回填消息级摘要
   * T05 异步生成摘要后通过此方法写回，返回是否更新成功
   */
  updateEpisodeSummary(episodeId, summary) {
    this.#ensureConnected()
    return this.#stmts.updateSummary.run(summary, episodeId, this.#agentId).changes > 0
  }

  /** 获取最近 N 天的对话记录，默认取 config.maxEpisodicDays */
  getRecentEpisodes(days = null) {
    this.#ensureConnected()
    const maxDays = days ?? this.#config.memory.maxEpisodicDays
    return this.#stmts.recentEpisodes.all(this.#agentId, `-${maxDays} days`)
  }

  /** 获取特定 session 的对话记录，按时间 ASC */
  getSessionEpisodes(sessionId) {
    this.#ensureConnected()
    return this.#stmts.sessionEpisodes.all(this.#agentId, sessionId)
  }

  /** 按关键词搜索情景记忆 (content + summary 模糊匹配) */
  searchEpisodes(keyword, limit = 20) {
    this.#ensureConnected()
    const safeLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT)
    const pattern = `%${keyword}%`
    return this.#stmts.searchEpisodes.all(this.#agentId, pattern, pattern, safeLimit)
  }

  /**
   * 获取最近 N 天的消息级摘要
   * 返回有摘要的 assistant 消息，同一 session 可能有多条
   * 注意：这是消息级摘要，不是会话级摘要
   */
  getRecentSummaries(days = 3) {
    this.#ensureConnected()
    return this.#stmts.recentSummaries.all(this.#agentId, `-${days} days`)
  }

  /** 获取情景记忆统计 (空表时 totalTokens = 0, earliest/latest = null) */
  getEpisodicStats() {
    this.#ensureConnected()
    return this.#stmts.stats.get(this.#agentId)
  }

  // --- 内部 ---

  /** 防御性检查: stop 后调用任何方法都抛明确错误 */
  #ensureConnected() {
    if (!this.#db) throw new Error('Memory not started — call start() first')
  }

  /** 预编译 prepared statements，提升重复查询性能 */
  #prepareStatements() {
    this.#stmts = {
      upsert: this.#db.prepare(SQL.upsert),
      get: this.#db.prepare(SQL.get),
      delete: this.#db.prepare(SQL.delete),
      listAll: this.#db.prepare(SQL.listAll),
      listByCategory: this.#db.prepare(SQL.listByCategory),
      search: this.#db.prepare(SQL.search),
      addEpisode: this.#db.prepare(SQL.addEpisode),
      updateSummary: this.#db.prepare(SQL.updateSummary),
      recentEpisodes: this.#db.prepare(SQL.recentEpisodes),
      sessionEpisodes: this.#db.prepare(SQL.sessionEpisodes),
      searchEpisodes: this.#db.prepare(SQL.searchEpisodes),
      recentSummaries: this.#db.prepare(SQL.recentSummaries),
      stats: this.#db.prepare(SQL.stats),
    }
  }
}

export { MAX_SEARCH_LIMIT, estimateTokens }
