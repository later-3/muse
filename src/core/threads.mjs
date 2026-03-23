/**
 * T36: Threads — Life Threads (structured topic tracking)
 *
 * Stores threads in Memory's SQLite DB (same file, dedicated table).
 * Agent-First: MCP tools are the core interface for AI to query threads.
 * ThreadWeaver (daemon) handles batch classification.
 *
 * A Thread groups related episodes by topic (health, work, learning, travel, ...).
 * Thread titles are AI-generated (emergent, not pre-set).
 */
import { createLogger } from '../logger.mjs'

const log = createLogger('threads')

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS threads (
    id            TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL DEFAULT 'muse',
    title         TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    summary       TEXT,
    episode_count INTEGER DEFAULT 0,
    first_at      TEXT,
    last_at       TEXT,
    goal_id       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_threads_agent ON threads(agent_id, last_at DESC);
`

const MIGRATION_SQL = [
  `ALTER TABLE episodic_memory ADD COLUMN thread_id TEXT`,
]

const SQL = {
  insert: `INSERT INTO threads (id, agent_id, title, category, summary, goal_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
  get: 'SELECT * FROM threads WHERE id = ? AND agent_id = ?',
  update: `UPDATE threads SET title = COALESCE(?, title), category = COALESCE(?, category),
           summary = COALESCE(?, summary), goal_id = COALESCE(?, goal_id),
           updated_at = datetime('now') WHERE id = ? AND agent_id = ?`,
  listAll: 'SELECT * FROM threads WHERE agent_id = ? ORDER BY last_at DESC LIMIT ?',
  listByCategory: 'SELECT * FROM threads WHERE agent_id = ? AND category = ? ORDER BY last_at DESC LIMIT ?',
  linkEpisode: 'UPDATE episodic_memory SET thread_id = ? WHERE id = ? AND agent_id = ?',
  getEpisodes: `SELECT * FROM episodic_memory WHERE agent_id = ? AND thread_id = ?
                ORDER BY created_at DESC LIMIT ?`,
  getUnclassified: `SELECT * FROM episodic_memory WHERE agent_id = ? AND thread_id IS NULL
                    AND role = 'user' ORDER BY created_at DESC LIMIT ?`,
  refreshStats: `UPDATE threads SET
    episode_count = (SELECT COUNT(*) FROM episodic_memory WHERE thread_id = threads.id AND agent_id = ?),
    first_at = (SELECT MIN(created_at) FROM episodic_memory WHERE thread_id = threads.id AND agent_id = ?),
    last_at = (SELECT MAX(created_at) FROM episodic_memory WHERE thread_id = threads.id AND agent_id = ?),
    updated_at = datetime('now')
    WHERE id = ? AND agent_id = ?`,
}

function generateId() {
  return `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export class Threads {
  #db
  #agentId
  #stmts = {}

  /**
   * @param {object} db — better-sqlite3 Database instance (shared with Memory)
   * @param {string} agentId
   */
  constructor(db, agentId = 'muse') {
    this.#db = db
    this.#agentId = agentId
  }

  /** Create threads table + migrate episodic_memory (idempotent) */
  init() {
    this.#db.exec(SCHEMA_SQL)
    // Migration: add thread_id to episodic_memory
    for (const sql of MIGRATION_SQL) {
      try {
        this.#db.exec(sql)
      } catch (e) {
        if (!e.message.includes('duplicate column')) {
          log.warn(`迁移跳过: ${e.message}`)
        }
      }
    }
    this.#prepareStatements()
    log.info('Threads 系统已初始化')
  }

  // --- CRUD ---

  create({ title, category, summary, goalId } = {}) {
    if (!title?.trim()) throw new Error('title is required')
    const id = generateId()
    this.#stmts.insert.run(id, this.#agentId, title.trim(), category || 'general', summary || null, goalId || null)
    const thread = this.get(id)
    log.info(`新建 Thread: ${title} (id=${id}, category=${category || 'general'})`)
    return thread
  }

  get(id) {
    return this.#stmts.get.get(id, this.#agentId) || null
  }

  update(id, patch = {}) {
    const existing = this.get(id)
    if (!existing) throw new Error(`Thread not found: ${id}`)
    this.#stmts.update.run(
      patch.title || null, patch.category || null,
      patch.summary || null, patch.goalId || null,
      id, this.#agentId,
    )
    return this.get(id)
  }

  list({ category, limit = 20 } = {}) {
    if (category) return this.#stmts.listByCategory.all(this.#agentId, category, limit)
    return this.#stmts.listAll.all(this.#agentId, limit)
  }

  // --- Episode 关联 ---

  linkEpisode(episodeId, threadId) {
    const changes = this.#stmts.linkEpisode.run(threadId, episodeId, this.#agentId).changes
    return changes > 0
  }

  getEpisodes(threadId, limit = 50) {
    return this.#stmts.getEpisodes.all(this.#agentId, threadId, limit)
  }

  getUnclassified(limit = 100) {
    return this.#stmts.getUnclassified.all(this.#agentId, limit)
  }

  // --- 统计 ---

  refreshStats(threadId) {
    this.#stmts.refreshStats.run(this.#agentId, this.#agentId, this.#agentId, threadId, this.#agentId)
    return this.get(threadId)
  }

  // --- Internal ---

  #prepareStatements() {
    this.#stmts = {}
    for (const [key, sql] of Object.entries(SQL)) {
      this.#stmts[key] = this.#db.prepare(sql)
    }
  }
}

export { generateId }
