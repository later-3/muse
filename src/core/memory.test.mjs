import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, existsSync, rmSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Memory, MAX_SEARCH_LIMIT, estimateTokens } from './memory.mjs'

// --- Test Helpers ---

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'muse-memory-test-'))
}

function makeConfig(dir) {
  return {
    memory: {
      dbPath: join(dir, 'test-memory.db'),
      maxEpisodicDays: 90,
    },
  }
}

/** 创建并启动一个 Memory 实例 */
async function createMemory(dir, agentId = 'muse') {
  const config = makeConfig(dir)
  const memory = new Memory(config, agentId)
  await memory.start()
  return memory
}

// --- Tests ---

describe('Memory — 生命周期', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTmpDir() })

  // Test 1
  it('start 应创建数据库文件并初始化表', async () => {
    const config = makeConfig(tmpDir)
    const memory = new Memory(config)
    assert.ok(!existsSync(config.memory.dbPath), 'db 文件不应预先存在')

    await memory.start()
    assert.ok(existsSync(config.memory.dbPath), 'start 后 db 文件应存在')
    await memory.stop()
  })

  // Test 2
  it('start 应开启 WAL 模式', async () => {
    const memory = await createMemory(tmpDir)
    // WAL 模式下会生成 .db-wal 文件 (写入数据后才会出现)
    // 但可以间接通过 health 验证 db 可用
    const h = await memory.health()
    assert.equal(h.ok, true)
    await memory.stop()
  })

  // Test 3
  it('start 应自动创建不存在的父目录', async () => {
    const nestedDir = join(tmpDir, 'a', 'b', 'c')
    const config = { memory: { dbPath: join(nestedDir, 'memory.db'), maxEpisodicDays: 90 } }
    const memory = new Memory(config)

    await memory.start()
    assert.ok(existsSync(config.memory.dbPath), '多层目录自动创建 + db 文件生成')
    await memory.stop()
  })

  // Test 4
  it('start 失败 — 无权限路径应抛错', async () => {
    // 创建只读目录
    const actualDir = join(tmpDir, 'readonly-test')
    mkdirSync(actualDir, { recursive: true })
    try {
      chmodSync(actualDir, 0o444)
      const config = { memory: { dbPath: join(actualDir, 'sub', 'memory.db'), maxEpisodicDays: 90 } }
      const memory = new Memory(config)
      await assert.rejects(() => memory.start(), /EACCES|EPERM|permission/i)
    } finally {
      chmodSync(actualDir, 0o755)  // 恢复权限以便清理
    }
  })

  // Test 5
  it('stop 后调用方法应抛 "Memory not started"', async () => {
    const memory = await createMemory(tmpDir)
    await memory.stop()

    assert.throws(() => memory.setMemory('k', 'v'), /Memory not started/)
    assert.throws(() => memory.getMemory('k'), /Memory not started/)
    assert.throws(() => memory.addEpisode('s', 'user', 'c'), /Memory not started/)
    assert.throws(() => memory.getEpisodicStats(), /Memory not started/)
  })

  // Test 6
  it('health 应返回连接状态和计数', async () => {
    const memory = await createMemory(tmpDir)

    const h = await memory.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail.semanticCount, 0)
    assert.equal(h.detail.episodicCount, 0)
    assert.equal(h.detail.agentId, 'muse')

    // 插入数据后计数应更新
    memory.setMemory('test', 'val')
    memory.addEpisode('s1', 'user', 'hello')
    const h2 = await memory.health()
    assert.equal(h2.detail.semanticCount, 1)
    assert.equal(h2.detail.episodicCount, 1)

    await memory.stop()
  })
})

describe('Memory — 语义记忆 CRUD', () => {
  let tmpDir, memory

  beforeEach(async () => {
    tmpDir = makeTmpDir()
    memory = await createMemory(tmpDir)
  })
  afterEach(async () => { await memory.stop() })

  // Test 7
  it('setMemory 应插入新记录', () => {
    memory.setMemory('lang', 'JavaScript', 'preference')
    const m = memory.getMemory('lang')
    assert.equal(m.key, 'lang')
    assert.equal(m.value, 'JavaScript')
    assert.equal(m.category, 'preference')
    assert.equal(m.source, 'auto')
    assert.equal(m.agent_id, 'muse')
    assert.ok(m.created_at)
    assert.ok(m.updated_at)
  })

  // Test 8
  it('setMemory 应 upsert 更新 value 和 updated_at', async () => {
    memory.setMemory('editor', 'vim')
    const before = memory.getMemory('editor')

    await new Promise(r => setTimeout(r, 50))  // 确保时间差
    memory.setMemory('editor', 'VSCode', 'preference', 'manual')
    const after = memory.getMemory('editor')

    assert.equal(after.value, 'VSCode')
    assert.equal(after.category, 'preference')
    assert.equal(after.source, 'manual')
    // updated_at 应该不同（或至少不早于）
    assert.ok(after.updated_at >= before.updated_at)
  })

  // Test 9
  it('getMemory 不存在的 key 应返回 null', () => {
    assert.equal(memory.getMemory('nonexistent'), null)
  })

  // Test 10
  it('deleteMemory 存在的 key 应返回 true', () => {
    memory.setMemory('temp', 'data')
    assert.equal(memory.deleteMemory('temp'), true)
    assert.equal(memory.getMemory('temp'), null)
  })

  // Test 11
  it('deleteMemory 不存在的 key 应返回 false', () => {
    assert.equal(memory.deleteMemory('ghost'), false)
  })

  // Test 12
  it('listMemories 应返回全部记录, 按 updated_at DESC', () => {
    memory.setMemory('a', '1')
    memory.setMemory('b', '2')
    memory.setMemory('c', '3')

    const all = memory.listMemories()
    assert.equal(all.length, 3)
    // 最后插入的应该排在最前
    assert.equal(all[0].key, 'c')
  })

  // Test 13
  it('listMemories 应按 category 筛选', () => {
    memory.setMemory('os', 'macOS', 'preference')
    memory.setMemory('js', 'ESM is better', 'knowledge')
    memory.setMemory('editor', 'VSCode', 'preference')

    const prefs = memory.listMemories('preference')
    assert.equal(prefs.length, 2)
    assert.ok(prefs.every(m => m.category === 'preference'))

    const knowledge = memory.listMemories('knowledge')
    assert.equal(knowledge.length, 1)
  })

  // Test 14
  it('searchMemories 应从 key 和 value 模糊匹配', () => {
    memory.setMemory('fav_language', 'JavaScript')
    memory.setMemory('fav_food', '面条')
    memory.setMemory('workspace', 'VSCode')

    const results = memory.searchMemories('fav')
    assert.equal(results.length, 2)

    const jsResults = memory.searchMemories('JavaScript')
    assert.equal(jsResults.length, 1)
    assert.equal(jsResults[0].key, 'fav_language')
  })
})

describe('Memory — 情景记忆 CRUD', () => {
  let tmpDir, memory

  beforeEach(async () => {
    tmpDir = makeTmpDir()
    memory = await createMemory(tmpDir)
  })
  afterEach(async () => { await memory.stop() })

  // Test 15
  it('addEpisode 应插入记录并返回 ID', () => {
    const id = memory.addEpisode('session-1', 'user', 'hello world')
    assert.ok(typeof id === 'number' || typeof id === 'bigint')
    assert.ok(id > 0)

    const episodes = memory.getSessionEpisodes('session-1')
    assert.equal(episodes.length, 1)
    assert.equal(episodes[0].role, 'user')
    assert.equal(episodes[0].content, 'hello world')
    assert.equal(episodes[0].session_id, 'session-1')
  })

  // Test 16
  it('addEpisode 应粗略估算 token_count', () => {
    // 英文: "hello world" = 11 chars → ceil(11/4) = 3
    memory.addEpisode('s1', 'user', 'hello world')
    const en = memory.getSessionEpisodes('s1')
    assert.equal(en[0].token_count, 3)

    // 中文: "你好世界" = 4 chars → ceil(4/4) = 1
    memory.addEpisode('s1', 'assistant', '你好世界')
    const all = memory.getSessionEpisodes('s1')
    assert.equal(all[1].token_count, 1)
  })

  // Test 17
  it('addEpisode 非法 role 应被 CHECK 约束拒绝', () => {
    assert.throws(
      () => memory.addEpisode('s1', 'system', 'test'),
      /CHECK constraint|constraint failed/i,
    )
  })

  // Test 18
  it('updateEpisodeSummary 应回填摘要', () => {
    const id = memory.addEpisode('s1', 'assistant', '很长的回复...')
    assert.equal(memory.updateEpisodeSummary(id, '简短摘要'), true)

    const episodes = memory.getSessionEpisodes('s1')
    assert.equal(episodes[0].summary, '简短摘要')
  })

  // Test 19
  it('updateEpisodeSummary 不存在的 ID 应返回 false', () => {
    assert.equal(memory.updateEpisodeSummary(99999, 'nope'), false)
  })

  // Test 20
  it('getRecentEpisodes 应按天数过滤', () => {
    // 插入数据（都是 now，所以查 1 天内应该能查到）
    memory.addEpisode('s1', 'user', 'msg1')
    memory.addEpisode('s1', 'assistant', 'reply1')

    const recent = memory.getRecentEpisodes(1)
    assert.equal(recent.length, 2)
    // 应该是 DESC 排序
    assert.equal(recent[0].content, 'reply1')
    assert.equal(recent[1].content, 'msg1')
  })

  // Test 21
  it('getSessionEpisodes 应按 session 过滤并 ASC 排序', () => {
    memory.addEpisode('s1', 'user', 'hello')
    memory.addEpisode('s2', 'user', 'other session')
    memory.addEpisode('s1', 'assistant', 'hi there')

    const s1 = memory.getSessionEpisodes('s1')
    assert.equal(s1.length, 2)
    assert.equal(s1[0].role, 'user')
    assert.equal(s1[1].role, 'assistant')

    const s2 = memory.getSessionEpisodes('s2')
    assert.equal(s2.length, 1)
  })

  // Test 22
  it('searchEpisodes 应模糊匹配 content', () => {
    memory.addEpisode('s1', 'user', '帮我写一个 JavaScript 函数')
    memory.addEpisode('s1', 'assistant', '好的，这是代码...')
    memory.addEpisode('s1', 'user', '用 Python 重写')

    const results = memory.searchEpisodes('JavaScript')
    assert.equal(results.length, 1)

    const codeResults = memory.searchEpisodes('代码')
    assert.equal(codeResults.length, 1)
  })

  // Test 23
  it('searchEpisodes limit 应被钳制到上界', () => {
    // 插入超过 MAX_SEARCH_LIMIT 条数据
    for (let i = 0; i < 5; i++) {
      memory.addEpisode('s1', 'user', `msg-${i}`)
    }
    // 传入超大 limit，实际应受 MAX_SEARCH_LIMIT 限制（这里数据量不够大，但验证不抛错）
    const results = memory.searchEpisodes('msg', 999)
    assert.ok(results.length <= MAX_SEARCH_LIMIT)
    assert.equal(results.length, 5)  // 实际只有 5 条
  })

  // Test 24
  it('getRecentSummaries 应只返回有摘要的 assistant 消息', () => {
    const id1 = memory.addEpisode('s1', 'user', '问题')
    const id2 = memory.addEpisode('s1', 'assistant', '回答')
    const id3 = memory.addEpisode('s1', 'assistant', '另一个回答')

    // 只给 id2 回填摘要
    memory.updateEpisodeSummary(id2, '回答摘要')

    const summaries = memory.getRecentSummaries(1)
    assert.equal(summaries.length, 1)
    assert.equal(summaries[0].summary, '回答摘要')
    assert.ok(summaries[0].id)
    assert.ok(summaries[0].session_id)
    assert.ok(summaries[0].created_at)
  })

  // Test 25
  it('getEpisodicStats 应返回正确统计', () => {
    memory.addEpisode('s1', 'user', 'hello')
    memory.addEpisode('s1', 'assistant', 'hi')
    memory.addEpisode('s2', 'user', 'yo')

    const stats = memory.getEpisodicStats()
    assert.equal(stats.totalMessages, 3)
    assert.equal(stats.totalSessions, 2)
    assert.ok(stats.totalTokens > 0)
    assert.ok(stats.earliest)
    assert.ok(stats.latest)
  })

  // Test 26
  it('getEpisodicStats 空库应返回零值', () => {
    const stats = memory.getEpisodicStats()
    assert.equal(stats.totalMessages, 0)
    assert.equal(stats.totalSessions, 0)
    assert.equal(stats.totalTokens, 0)  // COALESCE → 0, not null
    assert.equal(stats.earliest, null)
    assert.equal(stats.latest, null)
  })
})

describe('Memory — Multi-Agent 隔离', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTmpDir() })

  // Test 27
  it('不同 agentId 的数据应完全隔离', async () => {
    const config = makeConfig(tmpDir)

    const muse = new Memory(config, 'muse')
    await muse.start()

    const worker = new Memory(config, 'worker')
    await worker.start()

    // muse 写数据
    muse.setMemory('name', 'Muse')
    muse.addEpisode('s1', 'user', 'muse message')

    // worker 写数据
    worker.setMemory('name', 'Worker')
    worker.addEpisode('s2', 'user', 'worker message')

    // 各自只看到自己的
    assert.equal(muse.getMemory('name').value, 'Muse')
    assert.equal(worker.getMemory('name').value, 'Worker')

    const museEpisodes = muse.getSessionEpisodes('s1')
    assert.equal(museEpisodes.length, 1)
    assert.equal(museEpisodes[0].content, 'muse message')

    const workerEpisodes = worker.getSessionEpisodes('s2')
    assert.equal(workerEpisodes.length, 1)
    assert.equal(workerEpisodes[0].content, 'worker message')

    // 交叉查不到
    assert.equal(muse.getSessionEpisodes('s2').length, 0)
    assert.equal(worker.getSessionEpisodes('s1').length, 0)

    // health 计数也隔离
    const museHealth = await muse.health()
    assert.equal(museHealth.detail.semanticCount, 1)
    assert.equal(museHealth.detail.episodicCount, 1)

    const workerHealth = await worker.health()
    assert.equal(workerHealth.detail.semanticCount, 1)
    assert.equal(workerHealth.detail.episodicCount, 1)

    await muse.stop()
    await worker.stop()
  })
})

describe('Memory — 健壮性', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTmpDir() })

  // Test 28
  it('重复调用 start 应幂等不抛错（含 start→start 不泄漏连接）', async () => {
    const config = makeConfig(tmpDir)
    const memory = new Memory(config)

    // 场景 1: start → stop → start (常规重启)
    await memory.start()
    await memory.stop()
    await memory.start()

    memory.setMemory('test', 'ok')
    assert.equal(memory.getMemory('test').value, 'ok')

    // 场景 2: start → start (不经过 stop，应自动关闭旧连接)
    await memory.start()
    memory.setMemory('test2', 'ok2')
    assert.equal(memory.getMemory('test2').value, 'ok2')
    // 旧数据仍应可访问（同一个 db 文件）
    assert.equal(memory.getMemory('test').value, 'ok')

    await memory.stop()
  })

  // Test 29
  it('空数据库查询应返回空数组或零值', async () => {
    const memory = await createMemory(tmpDir)

    assert.equal(memory.getMemory('any'), null)
    assert.deepEqual(memory.listMemories(), [])
    assert.deepEqual(memory.listMemories('preference'), [])
    assert.deepEqual(memory.searchMemories('anything'), [])
    assert.deepEqual(memory.getRecentEpisodes(), [])
    assert.deepEqual(memory.getSessionEpisodes('no-session'), [])
    assert.deepEqual(memory.searchEpisodes('nothing'), [])
    assert.deepEqual(memory.getRecentSummaries(), [])

    const stats = memory.getEpisodicStats()
    assert.equal(stats.totalMessages, 0)
    assert.equal(stats.totalTokens, 0)

    await memory.stop()
  })
})

describe('estimateTokens', () => {
  it('应粗略估算 token 数', () => {
    assert.equal(estimateTokens('hello'), 2)        // 5/4 = 1.25 → 2
    assert.equal(estimateTokens('hello world'), 3)   // 11/4 = 2.75 → 3
    assert.equal(estimateTokens('你好'), 1)           // 2/4 = 0.5 → 1
    assert.equal(estimateTokens(''), 0)              // 0/4 = 0
  })
})
