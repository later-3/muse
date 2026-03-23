/**
 * T36: ThreadWeaver tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Threads } from '../core/threads.mjs'
import { ThreadWeaver } from './thread-weaver.mjs'

/** Create in-memory DB with episodic_memory table */
function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
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

function addEpisode(db, content) {
  return db.prepare(
    `INSERT INTO episodic_memory (agent_id, session_id, role, content) VALUES ('test-agent', 's1', 'user', ?)`,
  ).run(content).lastInsertRowid
}

function createMockEngine(responseText) {
  return {
    createSession: async () => ({ id: 'mock-sess' }),
    sendAndWait: async () => ({ text: responseText }),
  }
}

describe('ThreadWeaver', () => {
  let db, threads

  beforeEach(() => {
    db = createTestDb()
    threads = new Threads(db, 'test-agent')
    threads.init()
  })

  afterEach(() => {
    db.close()
  })

  it('weave skips when no unclassified episodes', async () => {
    const weaver = new ThreadWeaver({ threads, engine: createMockEngine('') })
    const result = await weaver.weave()
    assert.equal(result.classified, 0)
    assert.equal(result.newThreads, 0)
  })

  it('weave classifies episodes into existing thread', async () => {
    const t = threads.create({ title: '健康-跑步', category: 'health' })
    const ep1 = addEpisode(db, '今天跑了5km')
    const ep2 = addEpisode(db, '膝盖有点疼')

    const aiResponse = JSON.stringify([
      { episode_id: Number(ep1), thread_id: t.id },
      { episode_id: Number(ep2), thread_id: t.id },
    ])

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine(aiResponse) })
    const result = await weaver.weave()
    assert.equal(result.classified, 2)
    assert.equal(result.newThreads, 0)

    const episodes = threads.getEpisodes(t.id)
    assert.equal(episodes.length, 2)
  })

  it('weave creates new thread when AI says "new"', async () => {
    const ep1 = addEpisode(db, '学了 Rust 第一章')

    const aiResponse = JSON.stringify([
      { episode_id: Number(ep1), thread_id: 'new', thread_title: '学 Rust', category: 'learning' },
    ])

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine(aiResponse) })
    const result = await weaver.weave()
    assert.equal(result.classified, 1)
    assert.equal(result.newThreads, 1)

    const allThreads = threads.list()
    assert.equal(allThreads.length, 1)
    assert.equal(allThreads[0].title, '学 Rust')
    assert.equal(allThreads[0].category, 'learning')
  })

  it('weave deduplicates new threads by title', async () => {
    const ep1 = addEpisode(db, '减肥计划')
    const ep2 = addEpisode(db, '今天少吃了')

    const aiResponse = JSON.stringify([
      { episode_id: Number(ep1), thread_id: 'new', thread_title: '减肥', category: 'health' },
      { episode_id: Number(ep2), thread_id: 'new', thread_title: '减肥', category: 'health' },
    ])

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine(aiResponse) })
    const result = await weaver.weave()
    assert.equal(result.newThreads, 1, 'should only create one thread')
    assert.equal(result.classified, 2)
  })

  it('weave handles AI returning markdown code block', async () => {
    const ep1 = addEpisode(db, '在看 Rust book')
    const t = threads.create({ title: '学习' })

    const aiResponse = '```json\n' + JSON.stringify([
      { episode_id: Number(ep1), thread_id: t.id },
    ]) + '\n```'

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine(aiResponse) })
    const result = await weaver.weave()
    assert.equal(result.classified, 1)
  })

  it('weave degrades on invalid JSON', async () => {
    addEpisode(db, '测试')

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine('not json') })
    const result = await weaver.weave()
    assert.equal(result.classified, 0)
    assert.equal(result.newThreads, 0)
  })

  it('weave degrades on empty AI response', async () => {
    addEpisode(db, '测试')

    const weaver = new ThreadWeaver({ threads, engine: createMockEngine('') })
    const result = await weaver.weave()
    assert.equal(result.classified, 0)
  })

  it('weave degrades on engine createSession failure', async () => {
    addEpisode(db, '测试')

    const engine = {
      createSession: async () => { throw new Error('engine down') },
    }
    const weaver = new ThreadWeaver({ threads, engine })
    const result = await weaver.weave()
    assert.equal(result.classified, 0)
  })

  it('weave degrades on engine sendAndWait failure', async () => {
    addEpisode(db, '测试')

    const engine = {
      createSession: async () => ({ id: 's' }),
      sendAndWait: async () => { throw new Error('timeout') },
    }
    const weaver = new ThreadWeaver({ threads, engine })
    const result = await weaver.weave()
    assert.equal(result.classified, 0)
  })

  // --- summarize ---

  it('summarize updates thread summary', async () => {
    const t = threads.create({ title: '测试' })
    const ep = addEpisode(db, '一些内容')
    threads.linkEpisode(ep, t.id)

    const engine = {
      createSession: async () => ({ id: 's' }),
      sendAndWait: async () => ({ text: '用户在测试' }),
    }
    const weaver = new ThreadWeaver({ threads, engine })
    const updated = await weaver.summarize(t.id)
    assert.equal(updated.summary, '用户在测试')
  })

  it('summarize returns null for nonexistent thread', async () => {
    const weaver = new ThreadWeaver({ threads, engine: createMockEngine('') })
    const result = await weaver.summarize('nonexistent')
    assert.equal(result, null)
  })
})
