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
