/**
 * T35: Goals — Structured goal tracking
 *
 * Stores goals in Memory's SQLite DB (same file, dedicated table).
 * Agent-First: MCP tools are the core interface for AI to CRUD goals.
 *
 * Status lifecycle: active → achieved / abandoned / paused
 *                   paused → active (resume)
 */
import { createLogger } from '../logger.mjs'

const log = createLogger('goals')

const VALID_STATUSES = ['active', 'achieved', 'abandoned', 'paused']

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS goals (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL DEFAULT 'muse',
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    progress    INTEGER DEFAULT 0,
    deadline    TEXT,
    category    TEXT DEFAULT 'personal',
    source      TEXT DEFAULT 'user',
    notes       TEXT DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_goals_agent_status ON goals(agent_id, status);
`

const SQL = {
  insert: `INSERT INTO goals (id, agent_id, title, description, status, progress, deadline, category, source, notes)
           VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?, '[]')`,
  get: 'SELECT * FROM goals WHERE id = ? AND agent_id = ?',
  update: `UPDATE goals SET title = COALESCE(?, title), description = COALESCE(?, description),
           deadline = COALESCE(?, deadline), category = COALESCE(?, category),
           updated_at = datetime('now') WHERE id = ? AND agent_id = ?`,
  updateProgress: `UPDATE goals SET progress = ?, notes = ?, updated_at = datetime('now')
                   WHERE id = ? AND agent_id = ?`,
  updateStatus: `UPDATE goals SET status = ?, notes = ?, updated_at = datetime('now')
                 WHERE id = ? AND agent_id = ?`,
  remove: 'DELETE FROM goals WHERE id = ? AND agent_id = ?',
  listAll: 'SELECT * FROM goals WHERE agent_id = ? ORDER BY updated_at DESC',
  listByStatus: 'SELECT * FROM goals WHERE agent_id = ? AND status = ? ORDER BY updated_at DESC',
  listByCategory: 'SELECT * FROM goals WHERE agent_id = ? AND category = ? ORDER BY updated_at DESC',
  listActive: "SELECT * FROM goals WHERE agent_id = ? AND status = 'active' ORDER BY updated_at DESC",
  listOverdue: `SELECT * FROM goals WHERE agent_id = ? AND status = 'active'
                AND deadline IS NOT NULL AND deadline < datetime('now')
                ORDER BY deadline ASC`,
}

function generateId() {
  return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function parseNotes(notesStr) {
  try { return JSON.parse(notesStr || '[]') } catch { return [] }
}

function formatGoal(row) {
  if (!row) return null
  return {
    ...row,
    notes: parseNotes(row.notes),
  }
}

export class Goals {
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

  /** Create goals table (idempotent) */
  init() {
    this.#db.exec(SCHEMA_SQL)
    this.#prepareStatements()
    log.info('Goals 系统已初始化')
  }

  // --- CRUD ---

  /**
   * Create a new goal
   * @param {object} opts
   * @returns {object} created goal
   */
  create({ title, description, deadline, category, source } = {}) {
    if (!title?.trim()) throw new Error('title is required')
    const id = generateId()
    this.#stmts.insert.run(
      id, this.#agentId, title.trim(),
      description || null, deadline || null,
      category || 'personal', source || 'user',
    )
    const goal = formatGoal(this.#stmts.get.get(id, this.#agentId))
    log.info(`创建目标: ${title} (id=${id}, source=${source || 'user'})`)
    return goal
  }

  /** Get a goal by ID */
  get(id) {
    return formatGoal(this.#stmts.get.get(id, this.#agentId))
  }

  /** Update goal metadata (title, description, deadline, category) */
  update(id, patch = {}) {
    const existing = this.get(id)
    if (!existing) throw new Error(`Goal not found: ${id}`)
    this.#stmts.update.run(
      patch.title || null, patch.description || null,
      patch.deadline || null, patch.category || null,
      id, this.#agentId,
    )
    return this.get(id)
  }

  /** Delete a goal */
  remove(id) {
    return this.#stmts.remove.run(id, this.#agentId).changes > 0
  }

  // --- Query ---

  /** List goals with optional filters */
  list({ status, category } = {}) {
    if (status) return this.#stmts.listByStatus.all(this.#agentId, status).map(formatGoal)
    if (category) return this.#stmts.listByCategory.all(this.#agentId, category).map(formatGoal)
    return this.#stmts.listAll.all(this.#agentId).map(formatGoal)
  }

  /** Active goals only */
  getActive() {
    return this.#stmts.listActive.all(this.#agentId).map(formatGoal)
  }

  /** Active goals past deadline */
  getOverdue() {
    return this.#stmts.listOverdue.all(this.#agentId).map(formatGoal)
  }

  // --- Progress & Status ---

  /**
   * Update progress (0-100) with optional note
   */
  updateProgress(id, progress, note) {
    const existing = this.get(id)
    if (!existing) throw new Error(`Goal not found: ${id}`)
    if (progress < 0 || progress > 100) throw new Error(`Invalid progress: ${progress}`)

    const notes = existing.notes || []
    if (note) {
      notes.push({ text: note, progress, at: new Date().toISOString() })
    }

    const oldProgress = existing.progress
    this.#stmts.updateProgress.run(progress, JSON.stringify(notes), id, this.#agentId)
    log.info(`目标进度: ${existing.title} ${oldProgress}→${progress}%`)
    return this.get(id)
  }

  /** Mark goal as achieved */
  achieve(id, note) {
    return this.#changeStatus(id, 'achieved', note)
  }

  /** Mark goal as abandoned */
  abandon(id, reason) {
    return this.#changeStatus(id, 'abandoned', reason)
  }

  /** Pause goal */
  pause(id) {
    return this.#changeStatus(id, 'paused')
  }

  /** Resume paused goal */
  resume(id) {
    return this.#changeStatus(id, 'active')
  }

  // --- Internal ---

  #changeStatus(id, newStatus, note) {
    const existing = this.get(id)
    if (!existing) throw new Error(`Goal not found: ${id}`)
    if (!VALID_STATUSES.includes(newStatus)) throw new Error(`Invalid status: ${newStatus}`)

    const notes = existing.notes || []
    if (note) {
      notes.push({ text: note, status: newStatus, at: new Date().toISOString() })
    }

    const oldStatus = existing.status
    this.#stmts.updateStatus.run(newStatus, JSON.stringify(notes), id, this.#agentId)
    log.info(`目标状态: ${existing.title} ${oldStatus}→${newStatus}`)
    return this.get(id)
  }

  #prepareStatements() {
    this.#stmts = {}
    for (const [key, sql] of Object.entries(SQL)) {
      this.#stmts[key] = this.#db.prepare(sql)
    }
  }
}

export { VALID_STATUSES, generateId }
