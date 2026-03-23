/**
 * T36: Threads tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Threads } from './threads.mjs'

/** Create in-memory DB with episodic_memory table (simulating Memory) */
function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  // Create episodic_memory table (same as Memory's SCHEMA_SQL)
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodic_memory (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id      TEXT NOT NULL DEFAULT 'muse',
      session_id    TEXT NOT NULL,
      role          TEXT NOT NULL,
      content       TEXT NOT NULL,
      summary       TEXT,
      token_count   INTEGER DEFAULT 0,
      tags          TEXT DEFAULT '[]',
      meta          TEXT DEFAULT '{}',
      writer        TEXT DEFAULT 'main_session',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return db
}

/** Insert a fake episode */
function addEpisode(db, agentId, content, sessionId = 's1') {
  return db.prepare(
    `INSERT INTO episodic_memory (agent_id, session_id, role, content) VALUES (?, ?, 'user', ?)`,
  ).run(agentId, sessionId, content).lastInsertRowid
}

describe('Threads', () => {
  let db, threads

  beforeEach(() => {
    db = createTestDb()
    threads = new Threads(db, 'test-agent')
    threads.init()
  })

  afterEach(() => {
    db.close()
  })

  // --- CRUD ---

  it('create creates a thread with defaults', () => {
    const t = threads.create({ title: '健康-跑步' })
    assert.ok(t.id.startsWith('thread-'))
    assert.equal(t.title, '健康-跑步')
    assert.equal(t.category, 'general')
    assert.equal(t.episode_count, 0)
    assert.equal(t.goal_id, null)
  })

  it('create with all fields', () => {
    const t = threads.create({
      title: '学 Rust',
      category: 'learning',
      summary: '用户在学 Rust',
      goalId: 'goal-123',
    })
    assert.equal(t.category, 'learning')
    assert.equal(t.summary, '用户在学 Rust')
    assert.equal(t.goal_id, 'goal-123')
  })

  it('create throws without title', () => {
    assert.throws(() => threads.create({}), /title is required/)
  })

  it('get returns thread by id', () => {
    const created = threads.create({ title: '测试' })
    const got = threads.get(created.id)
    assert.equal(got.title, '测试')
  })

  it('get returns null for nonexistent', () => {
    assert.equal(threads.get('nonexistent'), null)
  })

  it('update patches metadata', () => {
    const t = threads.create({ title: '旧标题' })
    const updated = threads.update(t.id, { title: '新标题', category: 'work' })
    assert.equal(updated.title, '新标题')
    assert.equal(updated.category, 'work')
  })

  it('update throws for nonexistent', () => {
    assert.throws(() => threads.update('nonexistent', { title: 'x' }), /not found/)
  })

  // --- Query ---

  it('list returns all threads', () => {
    threads.create({ title: 'A' })
    threads.create({ title: 'B' })
    assert.equal(threads.list().length, 2)
  })

  it('list filters by category', () => {
    threads.create({ title: 'A', category: 'health' })
    threads.create({ title: 'B', category: 'work' })
    assert.equal(threads.list({ category: 'health' }).length, 1)
  })

  it('list respects limit', () => {
    threads.create({ title: 'A' })
    threads.create({ title: 'B' })
    threads.create({ title: 'C' })
    assert.equal(threads.list({ limit: 2 }).length, 2)
  })

  // --- Episode 关联 ---

  it('linkEpisode associates episode with thread', () => {
    const t = threads.create({ title: '测试主题' })
    const epId = addEpisode(db, 'test-agent', '我开始跑步了')
    assert.equal(threads.linkEpisode(epId, t.id), true)
    const episodes = threads.getEpisodes(t.id)
    assert.equal(episodes.length, 1)
    assert.equal(episodes[0].content, '我开始跑步了')
  })

  it('getUnclassified returns episodes without thread_id', () => {
    addEpisode(db, 'test-agent', '未归类 1')
    addEpisode(db, 'test-agent', '未归类 2')
    const unclassified = threads.getUnclassified()
    assert.equal(unclassified.length, 2)
  })

  it('getUnclassified excludes classified episodes', () => {
    const t = threads.create({ title: '已分组' })
    const ep1 = addEpisode(db, 'test-agent', '已归类')
    addEpisode(db, 'test-agent', '未归类')
    threads.linkEpisode(ep1, t.id)
    assert.equal(threads.getUnclassified().length, 1)
  })

  // --- 统计 ---

  it('refreshStats updates episode_count and time range', () => {
    const t = threads.create({ title: '统计测试' })
    const ep1 = addEpisode(db, 'test-agent', '第一条')
    const ep2 = addEpisode(db, 'test-agent', '第二条')
    threads.linkEpisode(ep1, t.id)
    threads.linkEpisode(ep2, t.id)
    const refreshed = threads.refreshStats(t.id)
    assert.equal(refreshed.episode_count, 2)
    assert.ok(refreshed.first_at)
    assert.ok(refreshed.last_at)
  })

  // --- Agent 隔离 ---

  it('different agents see different threads', () => {
    const threads2 = new Threads(db, 'other-agent')
    threads2.init()
    threads.create({ title: 'A' })
    threads2.create({ title: 'B' })
    assert.equal(threads.list().length, 1)
    assert.equal(threads2.list().length, 1)
  })

  // --- E2E ---

  it('E2E: create thread → link episodes → refreshStats → getEpisodes', () => {
    const t = threads.create({ title: '健康-跑步', category: 'health' })
    const ep1 = addEpisode(db, 'test-agent', '我开始跑步了')
    const ep2 = addEpisode(db, 'test-agent', '今天跑了5km')
    const ep3 = addEpisode(db, 'test-agent', '膝盖有点疼')

    threads.linkEpisode(ep1, t.id)
    threads.linkEpisode(ep2, t.id)
    threads.linkEpisode(ep3, t.id)

    const stats = threads.refreshStats(t.id)
    assert.equal(stats.episode_count, 3)

    const episodes = threads.getEpisodes(t.id)
    assert.equal(episodes.length, 3)

    // Unclassified should be empty now
    assert.equal(threads.getUnclassified().length, 0)
  })
})
