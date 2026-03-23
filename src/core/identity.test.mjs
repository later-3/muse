import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Identity, deepMerge, createDefaultIdentity, VALID_TRAITS, TRAIT_LABELS } from './identity.mjs'

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'muse-identity-test-'))
}

function makeConfig(dir) {
  return { identity: { path: join(dir, 'identity.json') } }
}

function writeIdentity(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

describe('Identity', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  // Test 1: 默认加载
  it('should create default identity.json when file does not exist', async () => {
    const config = makeConfig(tmpDir)
    const identity = new Identity(config)
    await identity.start()

    assert.ok(identity.data)
    assert.equal(identity.data.identity.name, '小缪')
    assert.equal(identity.data.identity.nickname, '缪缪')
    assert.equal(identity.data.identity.owner, 'Later')

    // File should exist now
    const written = JSON.parse(readFileSync(config.identity.path, 'utf-8'))
    assert.equal(written.identity.name, '小缪')

    await identity.stop()
  })

  // Test 2: 正常加载
  it('should load existing identity.json', async () => {
    const config = makeConfig(tmpDir)
    const custom = createDefaultIdentity()
    custom.identity.name = '小助'
    custom.identity.nickname = '助助'
    writeIdentity(config.identity.path, custom)

    const identity = new Identity(config)
    await identity.start()

    assert.equal(identity.data.identity.name, '小助')
    assert.equal(identity.data.identity.nickname, '助助')

    await identity.stop()
  })

  // Test 3: schema 校验 — traits 超范围
  it('should reject trait values outside 0-1', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.psychology.traits.humor = 1.5
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /Trait "humor" must be 0-1/)
  })

  // Test 3b: schema 校验 — name 缺失
  it('should reject missing identity.name', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.identity.name = ''
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /identity\.name is required/)
  })

  // Test 3c: schema 校验 — unknown trait
  it('should reject unknown trait keys', async () => {
    const config = makeConfig(tmpDir)
    const bad = createDefaultIdentity()
    bad.psychology.traits.aggression = 0.5
    writeIdentity(config.identity.path, bad)

    const identity = new Identity(config)
    await assert.rejects(() => identity.start(), /Unknown trait: "aggression"/)
  })

  // Test 4: prompt 4 层结构
  it('should generate prompt with 4 layers', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('小缪'), 'should contain name')
    assert.ok(prompt.includes('## 风格'), 'should have style layer')
    assert.ok(prompt.includes('## 行为规则'), 'should have rules layer')
    assert.ok(prompt.includes('## 安全边界'), 'should have safety layer')
    assert.ok(prompt.includes('Later'), 'should contain owner')

    await identity.stop()
  })

  // Test 5: traits 高值
  it('should map high trait values to labels', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits.humor = 0.9
    data.psychology.traits.warmth = 0.8
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.ok(labels.includes('幽默风趣'), `labels should include 幽默风趣, got: ${labels}`)
    assert.ok(labels.includes('温暖贴心'), `labels should include 温暖贴心, got: ${labels}`)

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('幽默风趣'))

    await identity.stop()
  })

  // Test 6: traits 低值
  it('should map low trait values to labels', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits.humor = 0.2
    data.psychology.traits.warmth = 0.1
    data.psychology.traits.verbosity = 0.3
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.ok(labels.includes('严肃正式'), `labels should include 严肃正式, got: ${labels}`)
    assert.ok(labels.includes('理性客观'), `labels should include 理性客观, got: ${labels}`)
    assert.ok(labels.includes('言简意赅'), `labels should include 言简意赅, got: ${labels}`)

    await identity.stop()
  })

  // Test 7: traits 中值 — 不输出
  it('should not output labels for mid-range traits', async () => {
    const config = makeConfig(tmpDir)
    const data = createDefaultIdentity()
    data.psychology.traits = { humor: 0.5, warmth: 0.5, initiative: 0.5, precision: 0.5, verbosity: 0.5 }
    writeIdentity(config.identity.path, data)

    const identity = new Identity(config)
    await identity.start()

    const labels = identity.resolveTraitLabels()
    assert.equal(labels.length, 0, 'all mid-range traits should produce no labels')

    await identity.stop()
  })

  // Test 8: 深合并更新
  it('should deep merge updates without losing nested fields', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    // Only update humor, other traits should survive
    await identity.update({ psychology: { traits: { humor: 0.3 } } })

    assert.equal(identity.data.psychology.traits.humor, 0.3)
    assert.equal(identity.data.psychology.traits.warmth, 0.7, 'warmth should be preserved')
    assert.equal(identity.data.psychology.traits.precision, 0.7, 'precision should be preserved')
    assert.equal(identity.data.psychology.mbti, 'ENFP', 'mbti should be preserved')
    assert.equal(identity.data.identity.name, '小缪', 'name should be preserved')

    await identity.stop()
  })

  // Test 9: 原子写入 + updatedAt
  it('should atomically write and update timestamp', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const before = identity.data.updatedAt
    await new Promise(r => setTimeout(r, 10)) // ensure time difference
    await identity.update({ identity: { name: '小助' } })

    // File should be complete and valid
    const written = JSON.parse(readFileSync(config.identity.path, 'utf-8'))
    assert.equal(written.identity.name, '小助')
    assert.notEqual(written.updatedAt, before, 'updatedAt should change')

    await identity.stop()
  })

  // Test 10: last-known-good 回退 via reloadFromDisk
  it('should keep last-known-good when reload fails and recover on valid file', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()
    assert.equal(identity.data.identity.name, '小缪')

    // Step 1: Corrupt file
    writeFileSync(config.identity.path, '{ invalid json !!!', 'utf-8')

    // Step 2: Reload should fail, but keep old data
    const failResult = identity.reloadFromDisk()
    assert.equal(failResult, false, 'reload should return false on bad file')
    assert.equal(identity.data.identity.name, '小缪', 'should retain last good config')

    // Step 3: Write valid file back, reload should succeed
    const fixed = createDefaultIdentity()
    fixed.identity.name = '小助'
    writeIdentity(config.identity.path, fixed)
    const okResult = identity.reloadFromDisk()
    assert.equal(okResult, true, 'reload should return true on valid file')
    assert.equal(identity.data.identity.name, '小助', 'should load new config')

    await identity.stop()
  })

  // Test 11: stop 清理
  it('should clean up on stop', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()
    // Should not throw
    await identity.stop()
  })

  // Test 12: health
  it('should return health status', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())

    const identity = new Identity(config)
    await identity.start()

    const h = await identity.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail, '小缪')

    await identity.stop()
  })
})

describe('deepMerge', () => {
  it('should deep merge nested objects', () => {
    const target = { a: { b: 1, c: 2 }, d: 3 }
    const source = { a: { b: 10 } }
    const result = deepMerge(target, source)
    assert.equal(result.a.b, 10)
    assert.equal(result.a.c, 2, 'c should be preserved')
    assert.equal(result.d, 3)
  })

  it('should replace arrays entirely', () => {
    const target = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }
    const result = deepMerge(target, source)
    assert.deepEqual(result.arr, [4, 5])
  })

  it('should add new keys', () => {
    const target = { a: 1 }
    const source = { b: 2 }
    const result = deepMerge(target, source)
    assert.equal(result.a, 1)
    assert.equal(result.b, 2)
  })
})

// --- T12: Persona Block + AGENTS.md Merge ---

describe('T12: generatePersonaBlock()', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  it('should generate persona block with all sections', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const block = identity.generatePersonaBlock()
    assert.ok(block.includes('<!-- PERSONA_START -->'), 'should have start marker')
    assert.ok(block.includes('<!-- PERSONA_END -->'), 'should have end marker')
    assert.ok(block.includes('## 身份'), 'should have identity section')
    assert.ok(block.includes('## 性格'), 'should have personality section')
    assert.ok(block.includes('## 行为规则'), 'should have rules section')
    assert.ok(block.includes('## 安全边界'), 'should have safety section')
    assert.ok(block.includes('## 能力提醒'), 'should have capability section')

    await identity.stop()
  })

  it('should correctly map identity.json fields', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const block = identity.generatePersonaBlock()
    assert.ok(block.includes('小缪'), 'should contain name')
    assert.ok(block.includes('缪缪'), 'should contain nickname')
    assert.ok(block.includes('Later'), 'should contain owner')
    assert.ok(block.includes('ENFP'), 'should contain MBTI')
    assert.ok(block.includes('幽默风趣'), 'should contain trait label')
    assert.ok(block.includes('嘿～'), 'should contain catchphrase')

    await identity.stop()
  })

  it('should not contain dynamic info (no time, no context)', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const block = identity.generatePersonaBlock()
    assert.ok(!block.includes('当前时间'), 'should not contain time')
    assert.ok(!block.includes('Muse 动态上下文'), 'should not contain dynamic context')

    await identity.stop()
  })

  it('should use capability categories, not hand-written tool lists', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const block = identity.generatePersonaBlock()
    // Should NOT list specific tool names
    assert.ok(!block.includes('set_memory'), 'should not list specific MCP tool names')
    assert.ok(!block.includes('search_memory'), 'should not list specific MCP tool names')
    // Should use capability categories
    assert.ok(block.includes('记忆工具'), 'should mention memory capability')
    assert.ok(block.includes('场景策略'), 'should mention strategy capability')

    await identity.stop()
  })
})

describe('T12: mergePersonaToAgentsMd()', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = makeTmpDir()
  })

  it('should create AGENTS.md when none exists', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const result = await identity.mergePersonaToAgentsMd(tmpDir)
    assert.ok(result.merged)

    const content = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')
    assert.ok(content.includes('<!-- PERSONA_START -->'))
    assert.ok(content.includes('小缪'))
    assert.ok(content.includes('<!-- PERSONA_END -->'))

    await identity.stop()
  })

  it('should preserve existing project rules when inserting persona', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    // Write a fake AGENTS.md with project rules (no persona markers)
    const projectRules = '# Muse Project\n\n## 开发规范\n\n- ESM only\n- 测试必须\n\n## 踩坑提醒\n\n- BUG-001\n'
    writeFileSync(join(tmpDir, 'AGENTS.md'), projectRules, 'utf-8')

    await identity.mergePersonaToAgentsMd(tmpDir)

    const content = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')
    // Persona inserted at top
    assert.ok(content.indexOf('<!-- PERSONA_START -->') < content.indexOf('ESM only'), 'persona before rules')
    // Project rules preserved
    assert.ok(content.includes('## 开发规范'), 'project rules preserved')
    assert.ok(content.includes('ESM only'), 'project rules detail preserved')
    assert.ok(content.includes('## 踩坑提醒'), 'pitfall notes preserved')
    assert.ok(content.includes('BUG-001'), 'pitfall detail preserved')

    await identity.stop()
  })

  it('should replace existing persona block on second merge', async () => {
    const config = makeConfig(tmpDir)
    writeIdentity(config.identity.path, createDefaultIdentity())
    const identity = new Identity(config)
    await identity.start()

    const projectRules = '# Muse Project\n\n## 开发规范\n\n- ESM only\n'
    writeFileSync(join(tmpDir, 'AGENTS.md'), projectRules, 'utf-8')

    // First merge — inserts persona
    await identity.mergePersonaToAgentsMd(tmpDir)
    const firstContent = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')
    assert.ok(firstContent.includes('小缪'))

    // Update identity and re-merge
    await identity.update({ identity: { name: '小助', nickname: '助助' } })
    await identity.mergePersonaToAgentsMd(tmpDir)

    const secondContent = readFileSync(join(tmpDir, 'AGENTS.md'), 'utf-8')
    assert.ok(secondContent.includes('小助'), 'should have new name')
    assert.ok(!secondContent.includes('小缪'), 'should not have old name')
    assert.ok(secondContent.includes('ESM only'), 'project rules still preserved')

    // Only one pair of markers
    const startCount = (secondContent.match(/<!-- PERSONA_START -->/g) || []).length
    assert.equal(startCount, 1, 'should have exactly one PERSONA_START')

    await identity.stop()
  })
})

// --- T41-1: 成员身份独立化验证 ---

describe('T41-1: 成员 identity.json 独立化', () => {
  it('pua: Identity 用 data/identity.json 路径加载后名字为阿普', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'pua-t41-'))
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(tmpDir, 'data'), { recursive: true })
    writeFileSync(join(tmpDir, 'data', 'identity.json'), JSON.stringify({
      id: 'pua',
      schemaVersion: '1.0',
      updatedAt: new Date().toISOString(),
      identity: { name: '阿普', nickname: 'pua', bio: 'Muse 家族的项目经理，专注于需求理解和任务整理', owner: 'Later' },
      psychology: { mbti: 'ENTJ', traits: { humor: 0.4, warmth: 0.5, initiative: 0.8, precision: 0.9, verbosity: 0.4 } },
      linguistics: { style: '严谨直接', formality: 'casual-professional', catchphrases: ['好的，我来梳理一下'], forbidden_words: [], language: 'zh-CN' },
      motivations: { core_drive: '帮 Later 整理任务', values: ['严谨', '清晰', '交付'] },
      boundaries: { never_do: ['假装是人类', '替 Later 做架构决策'], always_do: ['不清楚先问', '输出结构化文档'] }
    }), 'utf-8')

    const config = { identity: { path: join(tmpDir, 'data', 'identity.json') }, familyHome: '' }
    const identity = new Identity(config)
    await identity.start()

    assert.strictEqual(identity.data.identity.name, '阿普', 'pua 名字应为阿普，不是小缪')
    assert.strictEqual(identity.data.identity.nickname, 'pua')
    assert.strictEqual(identity.data.psychology.mbti, 'ENTJ')

    // 确认 system prompt 里出现的是 阿普 而不是 小缪
    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('阿普'), 'system prompt 应含阿普')
    assert.ok(!prompt.includes('小缪'), 'system prompt 不应含小缪')

    await identity.stop()
  })

  it('arch: Identity 用 data/identity.json 路径加载后名字为阿奇', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'arch-t41-'))
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(tmpDir, 'data'), { recursive: true })
    writeFileSync(join(tmpDir, 'data', 'identity.json'), JSON.stringify({
      id: 'arch',
      schemaVersion: '1.0',
      updatedAt: new Date().toISOString(),
      identity: { name: '阿奇', nickname: 'arch', bio: 'Muse 家族的首席架构师，精通前后端和 Agent 设计', owner: 'Later' },
      psychology: { mbti: 'INTJ', traits: { humor: 0.3, warmth: 0.4, initiative: 0.6, precision: 0.95, verbosity: 0.5 } },
      linguistics: { style: '理性精准，言简意赅', formality: 'casual-professional', catchphrases: ['让我看一下现有代码'], forbidden_words: [], language: 'zh-CN' },
      motivations: { core_drive: '确保改动有清晰设计和验收', values: ['严谨', '简洁', '可验证'] },
      boundaries: { never_do: ['假装是人类', '修改代码'], always_do: ['先读代码再设计', '方案具体到文件级'] }
    }), 'utf-8')

    const config = { identity: { path: join(tmpDir, 'data', 'identity.json') }, familyHome: '' }
    const identity = new Identity(config)
    await identity.start()

    assert.strictEqual(identity.data.identity.name, '阿奇', 'arch 名字应为阿奇，不是小缪')
    assert.strictEqual(identity.data.identity.nickname, 'arch')
    assert.strictEqual(identity.data.psychology.mbti, 'INTJ')

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('阿奇'), 'system prompt 应含阿奇')
    assert.ok(!prompt.includes('小缪'), 'system prompt 不应含小缪')

    await identity.stop()
  })

  it('role=pua: identity.json 缺失时按角色 fallback，不默认为小缪', async () => {
    // 这是可复现修复的核心：新机器拉代码后，pua 首次运行不再叫小缪
    const tmpDir = mkdtempSync(join(tmpdir(), 'pua-role-fallback-'))
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(tmpDir, 'data'), { recursive: true })
    // 注意：这里故意不写 identity.json，测试 role fallback 路径

    const config = { identity: { path: join(tmpDir, 'data', 'identity.json'), role: 'pua' }, familyHome: '' }
    const identity = new Identity(config)
    await identity.start()

    assert.strictEqual(identity.data.identity.name, '阿普', 'role=pua 时 fallback 应为阿普，不是小缪')
    assert.strictEqual(identity.data.identity.nickname, 'pua')
    assert.strictEqual(identity.data.psychology.mbti, 'ENTJ')

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('阿普'), 'system prompt 应含阿普')
    assert.ok(!prompt.includes('小缪'), 'system prompt fallback 时不应含小缪')

    await identity.stop()
  })

  it('role=architect: identity.json 缺失时按角色 fallback，名字为阿奇', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'arch-role-fallback-'))
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(tmpDir, 'data'), { recursive: true })
    // 故意不写 identity.json

    const config = { identity: { path: join(tmpDir, 'data', 'identity.json'), role: 'architect' }, familyHome: '' }
    const identity = new Identity(config)
    await identity.start()

    assert.strictEqual(identity.data.identity.name, '阿奇', 'role=architect 时 fallback 应为阿奇')
    assert.strictEqual(identity.data.psychology.mbti, 'INTJ')

    await identity.stop()
  })

  it('role=coder: identity.json 缺失时按角色 fallback，名字为阿可', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'coder-role-fallback-'))
    const { mkdirSync } = await import('node:fs')
    mkdirSync(join(tmpDir, 'data'), { recursive: true })
    // 故意不写 identity.json，测试 role=coder fallback

    const config = { identity: { path: join(tmpDir, 'data', 'identity.json'), role: 'coder' }, familyHome: '' }
    const identity = new Identity(config)
    await identity.start()

    assert.strictEqual(identity.data.identity.name, '阿可', 'role=coder 时 fallback 应为阿可，不是小缪')
    assert.strictEqual(identity.data.psychology.mbti, 'ISTP')

    const prompt = identity.buildSystemPrompt()
    assert.ok(prompt.includes('阿可'), 'system prompt 应含阿可')
    assert.ok(!prompt.includes('小缪'), 'system prompt 不应含小缪')

    await identity.stop()
  })
})

