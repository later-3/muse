/**
 * T11: Memory MCP Server — Unit Tests
 *
 * Tests the handler functions directly, without MCP transport.
 * Uses in-memory SQLite via temporary file.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Memory } from '../core/memory.mjs'
import {
  handleSearchMemory,
  handleSetMemory,
  handleGetUserProfile,
  handleGetRecentEpisodes,
  handleAddEpisode,
  sourcePriority,
  safeParseJson,
} from './memory.mjs'

// --- Test Helpers ---

function createTestMemory() {
  const dir = mkdtempSync(join(tmpdir(), 'muse-mcp-test-'))
  const config = { memory: { dbPath: join(dir, 'test.db'), maxEpisodicDays: 7 } }
  const memory = new Memory(config, 'muse')
  return { memory, dir }
}

function getText(result) {
  return JSON.parse(result.content[0].text)
}

// --- Tests ---

describe('Memory MCP — set_memory', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should store basic memory', () => {
    const result = handleSetMemory(memory, { key: 'user_name', value: 'Later' })
    const data = getText(result)
    assert.equal(data.blocked, false)
    assert.equal(data.old_value, null)
    assert.equal(data.new_value, 'Later')
  })

  it('should store with source/confidence/tags/meta', () => {
    const result = handleSetMemory(memory, {
      key: 'fav_lang',
      value: 'JavaScript',
      category: 'preference',
      source: 'user_stated',
      confidence: 'high',
      tags: ['dev', 'language'],
      meta: { context: 'casual_chat' },
    })
    const data = getText(result)
    assert.equal(data.blocked, false)

    const m = memory.getMemory('fav_lang')
    assert.equal(m.value, 'JavaScript')
    assert.equal(m.category, 'preference')
    assert.equal(m.source, 'user_stated')
    assert.equal(m.confidence, 'high')
    assert.deepEqual(JSON.parse(m.tags), ['dev', 'language'])
  })

  it('should upsert and return old_value', () => {
    handleSetMemory(memory, { key: 'city', value: 'Beijing' })
    const result = handleSetMemory(memory, { key: 'city', value: 'Shanghai' })
    const data = getText(result)
    assert.equal(data.old_value, 'Beijing')
    assert.equal(data.new_value, 'Shanghai')
    assert.equal(data.blocked, false)
  })

  it('should block ai_inferred overriding user_stated', () => {
    handleSetMemory(memory, { key: 'name2', value: 'Later', source: 'user_stated' })
    const result = handleSetMemory(memory, { key: 'name2', value: 'Lateral', source: 'ai_inferred' })
    const data = getText(result)
    assert.equal(data.blocked, true)
    assert.ok(data.reason.includes('ai_inferred cannot override'))

    // Value should NOT have changed
    assert.equal(memory.getMemory('name2').value, 'Later')
  })

  it('should block ai_observed overriding user_stated', () => {
    handleSetMemory(memory, { key: 'food', value: '面条', source: 'user_stated' })
    const result = handleSetMemory(memory, { key: 'food', value: '米饭', source: 'ai_observed' })
    const data = getText(result)
    assert.equal(data.blocked, true)
  })

  it('should allow user_stated to override user_stated', () => {
    handleSetMemory(memory, { key: 'color', value: '蓝色', source: 'user_stated' })
    const result = handleSetMemory(memory, { key: 'color', value: '红色', source: 'user_stated' })
    const data = getText(result)
    assert.equal(data.blocked, false)
    assert.equal(data.new_value, '红色')
  })

  it('should return error for missing key/value', () => {
    const result = handleSetMemory(memory, { key: '', value: '' })
    assert.equal(result.isError, true)
  })
})

describe('Memory MCP — search_memory', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
    // Seed data
    memory.setMemory('user_name', 'Later', { category: 'identity', source: 'user_stated' })
    memory.setMemory('fav_lang', 'JavaScript', { category: 'preference', source: 'user_stated' })
    memory.setMemory('goal_rust', '学 Rust', { category: 'goal', source: 'user_stated' })
    memory.addEpisode('s1', 'user', '今天聊了 JavaScript')
    memory.addEpisode('s1', 'assistant', 'JavaScript 很棒')
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should search semantic memories', () => {
    const result = handleSearchMemory(memory, { query: 'Later', type: 'semantic' })
    const data = getText(result)
    assert.ok(data.total > 0)
    assert.ok(data.semantic.length > 0)
    assert.equal(data.episodic.length, 0)
  })

  it('should search episodic memories', () => {
    const result = handleSearchMemory(memory, { query: 'JavaScript', type: 'episodic' })
    const data = getText(result)
    assert.ok(data.episodic.length > 0)
  })

  it('should search all by default', () => {
    const result = handleSearchMemory(memory, { query: 'JavaScript' })
    const data = getText(result)
    assert.ok(data.semantic.length > 0 || data.episodic.length > 0)
  })

  it('should filter by scope', () => {
    const result = handleSearchMemory(memory, { query: '%', type: 'semantic', scope: 'identity' })
    const data = getText(result)
    for (const item of data.semantic) {
      assert.equal(item.category, 'identity')
    }
  })

  it('should return empty for no matches', () => {
    const result = handleSearchMemory(memory, { query: '不存在的关键词xyz' })
    const data = getText(result)
    assert.equal(data.total, 0)
  })
})

describe('Memory MCP — get_user_profile', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
    memory.setMemory('user_name', 'Later', { category: 'identity', source: 'user_stated', confidence: 'high' })
    memory.setMemory('age', '30', { category: 'identity', source: 'ai_inferred', confidence: 'medium' })
    memory.setMemory('fav_lang', 'JavaScript', { category: 'preference', source: 'user_stated', confidence: 'high' })
    memory.setMemory('low_conf', 'maybe', { category: 'preference', source: 'ai_observed', confidence: 'low' })
    memory.setMemory('learn_rust', '学 Rust', { category: 'goal', source: 'user_stated' })
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should return structured profile', () => {
    const result = handleGetUserProfile(memory, {})
    const data = getText(result)
    assert.ok(data.identity.user_name)
    assert.equal(data.identity.user_name.value, 'Later')
    assert.ok(data.preferences.fav_lang)
    assert.ok(data.goals.length > 0)
    assert.ok(Array.isArray(data.important_threads))
  })

  it('should filter out low confidence from preferences', () => {
    const result = handleGetUserProfile(memory, {})
    const data = getText(result)
    assert.equal(data.preferences.low_conf, undefined)
  })

  it('should always return complete skeleton even if empty', () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'muse-mcp-empty-'))
    const config = { memory: { dbPath: join(dir2, 'empty.db'), maxEpisodicDays: 7 } }
    const emptyMemory = new Memory(config, 'muse')
    emptyMemory.start()

    const result = handleGetUserProfile(emptyMemory, {})
    const data = getText(result)
    assert.deepEqual(data.identity, {})
    assert.deepEqual(data.preferences, {})
    assert.deepEqual(data.goals, [])
    assert.deepEqual(data.current_focus, [])
    assert.deepEqual(data.important_threads, [])

    emptyMemory.stop()
    rmSync(dir2, { recursive: true, force: true })
  })
})

describe('Memory MCP — get_recent_episodes', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
    memory.addEpisode('s1', 'user', 'hello world')
    memory.addEpisode('s1', 'assistant', 'hi there', { summary: '打招呼', tags: ['greeting'] })
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should return recent episodes', () => {
    const result = handleGetRecentEpisodes(memory, { days: 3 })
    const data = getText(result)
    assert.ok(data.count >= 2)
    assert.ok(data.episodes.length >= 2)
  })

  it('should include tags and meta', () => {
    const result = handleGetRecentEpisodes(memory, {})
    const data = getText(result)
    const ep = data.episodes.find(e => e.summary === '打招呼')
    assert.ok(ep)
    assert.deepEqual(ep.tags, ['greeting'])
  })
})

describe('Memory MCP — add_episode', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should add episode and return id', () => {
    const result = handleAddEpisode(memory, {
      summary: '讨论了 Phase 2 计划',
      tags: ['phase2', 'planning'],
      meta: { related_goal: 'build_muse' },
    })
    const data = getText(result)
    assert.ok(data.episode_id > 0)
  })

  it('should return error for missing summary', () => {
    const result = handleAddEpisode(memory, {})
    assert.equal(result.isError, true)
  })
})

describe('Memory MCP — audit / provenance', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should persist audit record on set_memory', () => {
    handleSetMemory(memory, { key: 'aud_test', value: 'v1', source: 'user_stated' })
    const audits = memory.getAuditLog('aud_test')
    assert.ok(audits.length >= 1)
    assert.equal(audits[0].action, 'set_memory')
    assert.equal(audits[0].new_value, 'v1')
    assert.equal(audits[0].source, 'user_stated')
  })

  it('should persist audit on blocked write', () => {
    handleSetMemory(memory, { key: 'aud_block', value: 'real', source: 'user_stated' })
    handleSetMemory(memory, { key: 'aud_block', value: 'guess', source: 'ai_inferred' })
    const audits = memory.getAuditLog('aud_block')
    const blocked = audits.find(a => a.action === 'set_memory_blocked')
    assert.ok(blocked)
    assert.equal(blocked.blocked, 1)
    assert.ok(blocked.reason.includes('ai_inferred cannot override'))
  })

  it('should return provenance in set_memory result', () => {
    const result = handleSetMemory(memory, { key: 'aud_prov', value: 'test', writer: 'hook', session_id: 'sess-123' })
    const data = getText(result)
    assert.ok(data.provenance)
    assert.equal(data.provenance.writer, 'hook')
    assert.equal(data.provenance.session_id, 'sess-123')
  })

  it('should track writer in audit', () => {
    handleSetMemory(memory, { key: 'aud_writer', value: 'bg', writer: 'background', session_id: 'bg-001' })
    const audits = memory.getAuditLog('aud_writer')
    assert.equal(audits[0].writer, 'background')
    assert.equal(audits[0].session_id, 'bg-001')
  })
})

describe('Memory MCP — ai_observed pending model', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should write ai_observed to pending key when existing is high confidence', () => {
    // Set a high confidence value (NOT user_stated, which always blocks ai_observed)
    handleSetMemory(memory, { key: 'obs_test', value: 'original', source: 'ai_inferred', confidence: 'high' })

    // ai_observed should not overwrite, but store as pending
    const result = handleSetMemory(memory, { key: 'obs_test', value: 'observed_val', source: 'ai_observed' })
    const data = getText(result)
    assert.equal(data.pending, true)
    assert.equal(data.pending_key, 'obs_test__pending')

    // Original value preserved
    assert.equal(memory.getMemory('obs_test').value, 'original')
    // Pending value stored separately
    const pending = memory.getMemory('obs_test__pending')
    assert.ok(pending)
    assert.equal(pending.value, 'observed_val')
    assert.equal(pending.confidence, 'low')
    assert.equal(pending.source, 'ai_observed')
  })

  it('should allow ai_observed to write directly if no existing value', () => {
    const result = handleSetMemory(memory, { key: 'obs_new', value: 'fresh', source: 'ai_observed', confidence: 'low' })
    const data = getText(result)
    assert.equal(data.blocked, false)
    assert.equal(data.pending, undefined)
    assert.equal(memory.getMemory('obs_new').value, 'fresh')
  })

  it('should persist pending audit entry', () => {
    const audits = memory.getAuditLog('obs_test')
    const pending = audits.find(a => a.action === 'set_memory_pending')
    assert.ok(pending)
  })

  it('should hide __pending keys from search results', () => {
    // obs_test__pending exists in DB, but search should not return it
    const result = handleSearchMemory(memory, { query: 'observed_val', type: 'semantic' })
    const data = getText(result)
    const pendingHit = data.semantic.find(s => s.key.endsWith('__pending'))
    assert.equal(pendingHit, undefined)
  })
})

describe('Memory MCP — add_episode with caller params', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should use provided session_id and writer', () => {
    const result = handleAddEpisode(memory, {
      summary: 'subagent did something',
      session_id: 'real-sess-42',
      writer: 'subagent',
    })
    const data = getText(result)
    assert.ok(data.episode_id > 0)

    // Verify stored values
    const recent = handleGetRecentEpisodes(memory, { days: 1 })
    const episodes = getText(recent).episodes
    const ep = episodes.find(e => e.summary === 'subagent did something')
    assert.ok(ep)
    assert.equal(ep.session_id, 'real-sess-42')
    assert.equal(ep.writer, 'subagent')
  })

  it('should auto-generate session_id if not provided', () => {
    const result = handleAddEpisode(memory, { summary: 'auto session' })
    const data = getText(result)
    assert.ok(data.episode_id > 0)

    const recent = handleGetRecentEpisodes(memory, { days: 1 })
    const episodes = getText(recent).episodes
    const ep = episodes.find(e => e.summary === 'auto session')
    assert.ok(ep.session_id.startsWith('mcp-'))
  })
})

describe('Memory MCP — get_recent_episodes scope filter', () => {
  let memory, dir

  before(async () => {
    ({ memory, dir } = createTestMemory())
    await memory.start()
    // Episodes with different goals
    memory.addEpisode('s1', 'assistant', '学了 Rust 基础', { summary: '学 Rust', tags: ['rust'], meta: { related_goal: 'learn_rust' } })
    memory.addEpisode('s2', 'assistant', '跑了 5 公里', { summary: '运动', tags: ['health'], meta: { related_goal: 'fitness' } })
    memory.addEpisode('s3', 'assistant', '闲聊了', { summary: '日常', tags: ['chat'] })
  })
  after(async () => {
    await memory.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('should filter episodes by scope (related_goal)', () => {
    const result = handleGetRecentEpisodes(memory, { days: 7, scope: 'learn_rust' })
    const data = getText(result)
    assert.equal(data.count, 1)
    assert.ok(data.episodes[0].meta.related_goal === 'learn_rust')
  })

  it('should return all episodes when no scope', () => {
    const result = handleGetRecentEpisodes(memory, { days: 7 })
    const data = getText(result)
    assert.ok(data.count >= 3)
  })

  it('should return empty for non-matching scope', () => {
    const result = handleGetRecentEpisodes(memory, { days: 7, scope: 'nonexistent' })
    const data = getText(result)
    assert.equal(data.count, 0)
  })
})

describe('Memory MCP — helpers', () => {
  it('sourcePriority should rank correctly', () => {
    assert.ok(sourcePriority('user_stated') > sourcePriority('ai_inferred'))
    assert.ok(sourcePriority('ai_inferred') > sourcePriority('ai_observed'))
  })

  it('safeParseJson should handle invalid input', () => {
    assert.deepEqual(safeParseJson(null, []), [])
    assert.deepEqual(safeParseJson('invalid', {}), {})
    assert.deepEqual(safeParseJson('["a"]', []), ['a'])
  })
})
