/**
 * T37: DevStore — 开发任务持久化
 *
 * 复用 Memory SQLite DB，与 Goals/Threads 模式一致。
 * Muse 重启后 dev_status / approve_dev / Web 列表仍有可靠状态。
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('dev-store')

/** DevTask 状态枚举 */
export const DEV_STATUS = {
  PLANNING: 'planning',
  DEVELOPING: 'developing',
  TESTING: 'testing',
  REVIEW: 'review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MERGED: 'merged',
  FAILED: 'failed',
}

export class DevStore {
  #db
  #agentId

  /**
   * @param {import('better-sqlite3').Database} db - SQLite 数据库实例
   * @param {string} [agentId='muse']
   */
  constructor(db, agentId = 'muse') {
    this.#db = db
    this.#agentId = agentId
  }

  /** 建表 */
  init() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS dev_tasks (
        id              TEXT PRIMARY KEY,
        agent_id        TEXT NOT NULL DEFAULT 'muse',
        status          TEXT NOT NULL DEFAULT 'planning',
        description     TEXT,
        gap_json        TEXT,
        plan_json       TEXT,
        worktree_path   TEXT,
        worktree_branch TEXT,
        session_id      TEXT,
        diff_json       TEXT,
        test_json       TEXT,
        review_json     TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    log.info('[store] ✅ dev_tasks 表已就绪')
  }

  /**
   * 创建开发任务
   * @param {object} task
   * @param {string} task.description - 任务描述
   * @param {object} [task.gap] - 来自 GapJournal 的缺口
   * @returns {object} devTask
   */
  create(task) {
    const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()

    this.#db.prepare(`
      INSERT INTO dev_tasks (id, agent_id, status, description, gap_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      this.#agentId,
      DEV_STATUS.PLANNING,
      task.description || '',
      task.gap ? JSON.stringify(task.gap) : null,
      now,
      now,
    )

    log.info(`[store] ✅ 创建开发任务: ${id}`)
    return this.get(id)
  }

  /**
   * 获取单个任务
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const row = this.#db.prepare('SELECT * FROM dev_tasks WHERE id = ?').get(id)
    return row ? DevStore.#deserialize(row) : null
  }

  /**
   * 更新任务状态
   * @param {string} id
   * @param {string} status - 新状态
   * @param {object} [patch] - 额外更新字段
   * @returns {object|null}
   */
  updateStatus(id, status, patch = {}) {
    const sets = ['status = ?', 'updated_at = ?']
    const values = [status, new Date().toISOString()]

    // 允许更新的 JSON 字段
    const jsonFields = ['plan_json', 'diff_json', 'test_json', 'review_json']
    for (const field of jsonFields) {
      const key = field.replace('_json', '')
      if (patch[key] !== undefined) {
        sets.push(`${field} = ?`)
        values.push(JSON.stringify(patch[key]))
      }
    }

    // 允许更新的普通字段
    const plainFields = ['worktree_path', 'worktree_branch', 'session_id']
    for (const field of plainFields) {
      if (patch[field] !== undefined) {
        sets.push(`${field} = ?`)
        values.push(patch[field])
      }
    }

    values.push(id)
    this.#db.prepare(`UPDATE dev_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values)

    log.info(`[store] 📝 任务 ${id} → ${status}`)
    return this.get(id)
  }

  /**
   * 列出任务
   * @param {object} [filter]
   * @param {string} [filter.status]
   * @param {number} [filter.limit=50]
   * @returns {object[]}
   */
  list(filter = {}) {
    let sql = 'SELECT * FROM dev_tasks WHERE agent_id = ?'
    const params = [this.#agentId]

    if (filter.status) {
      sql += ' AND status = ?'
      params.push(filter.status)
    }

    sql += ' ORDER BY created_at DESC'

    if (filter.limit) {
      sql += ' LIMIT ?'
      params.push(filter.limit)
    } else {
      sql += ' LIMIT 50'
    }

    return this.#db.prepare(sql).all(...params).map(DevStore.#deserialize)
  }

  /**
   * 反序列化 — 解析 JSON 字段
   */
  static #deserialize(row) {
    return {
      ...row,
      gap: row.gap_json ? JSON.parse(row.gap_json) : null,
      plan: row.plan_json ? JSON.parse(row.plan_json) : null,
      diff: row.diff_json ? JSON.parse(row.diff_json) : null,
      test: row.test_json ? JSON.parse(row.test_json) : null,
      review: row.review_json ? JSON.parse(row.review_json) : null,
    }
  }
}
