/**
 * T35: Goals tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Goals, VALID_STATUSES } from './goals.mjs'

/** Create in-memory DB for testing */
function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  return db
}

describe('Goals', () => {
  let db, goals

  beforeEach(() => {
    db = createTestDb()
    goals = new Goals(db, 'test-agent')
    goals.init()
  })

  afterEach(() => {
    db.close()
  })

  // --- CRUD ---

  it('create creates a goal with defaults', () => {
    const g = goals.create({ title: '学 Rust' })
    assert.ok(g.id.startsWith('goal-'))
    assert.equal(g.title, '学 Rust')
    assert.equal(g.status, 'active')
    assert.equal(g.progress, 0)
    assert.equal(g.category, 'personal')
    assert.equal(g.source, 'user')
    assert.deepEqual(g.notes, [])
  })

  it('create with all fields', () => {
    const g = goals.create({
      title: '减肥',
      description: '到 110 斤',
      deadline: '2026-06-01',
      category: 'health',
      source: 'ai_suggested',
    })
    assert.equal(g.description, '到 110 斤')
    assert.equal(g.deadline, '2026-06-01')
    assert.equal(g.category, 'health')
    assert.equal(g.source, 'ai_suggested')
  })

  it('create throws without title', () => {
    assert.throws(() => goals.create({}), /title is required/)
    assert.throws(() => goals.create({ title: '' }), /title is required/)
    assert.throws(() => goals.create({ title: '  ' }), /title is required/)
  })

  it('get returns goal by id', () => {
    const created = goals.create({ title: '测试' })
    const got = goals.get(created.id)
    assert.equal(got.title, '测试')
  })

  it('get returns null for nonexistent id', () => {
    assert.equal(goals.get('nonexistent'), null)
  })

  it('update patches metadata', () => {
    const g = goals.create({ title: '旧标题' })
    const updated = goals.update(g.id, { title: '新标题', description: '详情' })
    assert.equal(updated.title, '新标题')
    assert.equal(updated.description, '详情')
  })

  it('update throws for nonexistent id', () => {
    assert.throws(() => goals.update('nonexistent', { title: 'x' }), /not found/)
  })

  it('remove deletes goal', () => {
    const g = goals.create({ title: '删我' })
    assert.equal(goals.remove(g.id), true)
    assert.equal(goals.get(g.id), null)
  })

  it('remove returns false for nonexistent', () => {
    assert.equal(goals.remove('nonexistent'), false)
  })

  // --- Query ---

  it('list returns all goals', () => {
    goals.create({ title: 'A' })
    goals.create({ title: 'B' })
    assert.equal(goals.list().length, 2)
  })

  it('list filters by status', () => {
    const g = goals.create({ title: 'A' })
    goals.create({ title: 'B' })
    goals.achieve(g.id)
    assert.equal(goals.list({ status: 'active' }).length, 1)
    assert.equal(goals.list({ status: 'achieved' }).length, 1)
  })

  it('list filters by category', () => {
    goals.create({ title: 'A', category: 'health' })
    goals.create({ title: 'B', category: 'work' })
    assert.equal(goals.list({ category: 'health' }).length, 1)
  })

  it('getActive returns only active goals', () => {
    goals.create({ title: 'A' })
    const g = goals.create({ title: 'B' })
    goals.pause(g.id)
    assert.equal(goals.getActive().length, 1)
  })

  it('getOverdue returns active goals past deadline', () => {
    goals.create({ title: '过期', deadline: '2020-01-01' })
    goals.create({ title: '未过期', deadline: '2030-01-01' })
    goals.create({ title: '无期限' })
    const overdue = goals.getOverdue()
    assert.equal(overdue.length, 1)
    assert.equal(overdue[0].title, '过期')
  })

  // --- Progress ---

  it('updateProgress changes progress', () => {
    const g = goals.create({ title: '学 Rust' })
    const updated = goals.updateProgress(g.id, 50, '第5章')
    assert.equal(updated.progress, 50)
    assert.equal(updated.notes.length, 1)
    assert.equal(updated.notes[0].text, '第5章')
    assert.equal(updated.notes[0].progress, 50)
  })

  it('updateProgress accumulates notes', () => {
    const g = goals.create({ title: '学 Rust' })
    goals.updateProgress(g.id, 30, '第3章')
    goals.updateProgress(g.id, 60, '第6章')
    const updated = goals.get(g.id)
    assert.equal(updated.progress, 60)
    assert.equal(updated.notes.length, 2)
  })

  it('updateProgress rejects invalid progress', () => {
    const g = goals.create({ title: '测试' })
    assert.throws(() => goals.updateProgress(g.id, -1), /Invalid progress/)
    assert.throws(() => goals.updateProgress(g.id, 101), /Invalid progress/)
  })

  // --- Status Machine ---

  it('achieve marks as achieved', () => {
    const g = goals.create({ title: '完成了' })
    const done = goals.achieve(g.id, '终于搞定')
    assert.equal(done.status, 'achieved')
    assert.equal(done.notes[0].text, '终于搞定')
    assert.equal(done.notes[0].status, 'achieved')
  })

  it('abandon marks as abandoned', () => {
    const g = goals.create({ title: '不做了' })
    const abandoned = goals.abandon(g.id, '太难了')
    assert.equal(abandoned.status, 'abandoned')
  })

  it('pause and resume', () => {
    const g = goals.create({ title: '暂停' })
    const paused = goals.pause(g.id)
    assert.equal(paused.status, 'paused')
    const resumed = goals.resume(g.id)
    assert.equal(resumed.status, 'active')
  })

  it('status operations throw for nonexistent', () => {
    assert.throws(() => goals.achieve('nonexistent'), /not found/)
  })

  // --- Agent isolation ---

  it('different agents see different goals', () => {
    const goals2 = new Goals(db, 'other-agent')
    goals2.init()
    goals.create({ title: 'A' })
    goals2.create({ title: 'B' })
    assert.equal(goals.list().length, 1)
    assert.equal(goals2.list().length, 1)
  })

  // --- source field ---

  it('source accepts arbitrary text (Agent-First extensibility)', () => {
    const g = goals.create({ title: '跨Agent', source: 'agent:muse-a' })
    assert.equal(g.source, 'agent:muse-a')
  })
})
