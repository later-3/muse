/**
 * T10: Skill System — Unit + Integration Tests
 *
 * Tests:
 *  - Skill file structure validation (frontmatter, dirs)
 *  - Custom Tool export format
 *  - OpenCode Skill discovery (integration)
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const SKILLS_DIR = join(ROOT, '.agents', 'skills')
const TOOLS_DIR = join(ROOT, '.agents', 'tools')

// --- Helpers ---

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null
  const yaml = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length > 0) {
      yaml[key.trim()] = rest.join(':').trim()
    }
  }
  return yaml
}

// --- Tests ---

describe('T10: Skill 文件结构验证', () => {

  const REQUIRED_SKILLS = ['memory-companion', 'daily-chat']

  for (const skillName of REQUIRED_SKILLS) {
    describe(`Skill: ${skillName}`, () => {
      const skillDir = join(SKILLS_DIR, skillName)
      const skillMdPath = join(skillDir, 'SKILL.md')

      it('SKILL.md 文件存在', () => {
        assert.ok(existsSync(skillMdPath), `${skillMdPath} 不存在`)
      })

      it('frontmatter 包含 name 字段', () => {
        const content = readFileSync(skillMdPath, 'utf-8')
        const fm = parseYamlFrontmatter(content)
        assert.ok(fm, 'SKILL.md 缺少 YAML frontmatter')
        assert.ok(fm.name, 'frontmatter 缺少 name 字段')
      })

      it('frontmatter name 与目录名一致', () => {
        const content = readFileSync(skillMdPath, 'utf-8')
        const fm = parseYamlFrontmatter(content)
        assert.equal(fm.name, skillName, `name "${fm.name}" 应与目录名 "${skillName}" 一致`)
      })

      it('frontmatter 包含 description 字段', () => {
        const content = readFileSync(skillMdPath, 'utf-8')
        const fm = parseYamlFrontmatter(content)
        assert.ok(fm.description, 'frontmatter 缺少 description 字段')
      })

      it('description 长度 ≤ 100 字', () => {
        const content = readFileSync(skillMdPath, 'utf-8')
        const fm = parseYamlFrontmatter(content)
        assert.ok(fm.description.length <= 100,
          `description 长度 ${fm.description.length} 超过 100 字: "${fm.description}"`)
      })

      it('包含核心规则段落', () => {
        const content = readFileSync(skillMdPath, 'utf-8')
        assert.ok(
          content.includes('MUST') || content.includes('必须'),
          'SKILL.md 应包含 MUST 规则'
        )
      })
    })
  }
})

describe('T10: CONVENTION.md 验证', () => {
  it('skills/CONVENTION.md 存在', () => {
    assert.ok(existsSync(join(SKILLS_DIR, 'CONVENTION.md')))
  })

  it('skills/README.md 存在', () => {
    assert.ok(existsSync(join(SKILLS_DIR, 'README.md')))
  })

  it('tools/CONVENTION.md 存在', () => {
    assert.ok(existsSync(join(TOOLS_DIR, 'CONVENTION.md')))
  })
})

describe('T10: Custom Tool 格式验证', () => {
  it('format-datetime.js 存在', () => {
    assert.ok(existsSync(join(TOOLS_DIR, 'format-datetime.js')))
  })

  it('导出包含 name/description/parameters/execute', async () => {
    const mod = await import(join(TOOLS_DIR, 'format-datetime.js'))
    const tool = mod.default
    assert.ok(tool.name, '缺少 name')
    assert.ok(tool.description, '缺少 description')
    assert.ok(tool.parameters, '缺少 parameters')
    assert.ok(typeof tool.execute === 'function', 'execute 不是函数')
  })

  it('execute 能正确格式化相对时间', async () => {
    const mod = await import(join(TOOLS_DIR, 'format-datetime.js'))
    const result = await mod.default.execute({
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      format: 'relative',
    })
    assert.ok(result.formatted, '缺少 formatted 字段')
    assert.ok(result.formatted.includes('分钟前'), `预期 "X 分钟前", 得到 "${result.formatted}"`)
  })

  it('execute 能正确格式化完整时间', async () => {
    const mod = await import(join(TOOLS_DIR, 'format-datetime.js'))
    const result = await mod.default.execute({
      timestamp: '2026-03-13T10:30:00+08:00',
      format: 'full',
    })
    assert.ok(result.formatted.includes('2026'), `预期包含 "2026", 得到 "${result.formatted}"`)
    assert.ok(result.formatted.includes('10:30'), `预期包含 "10:30", 得到 "${result.formatted}"`)
  })

  it('execute 处理无效时间', async () => {
    const mod = await import(join(TOOLS_DIR, 'format-datetime.js'))
    const result = await mod.default.execute({
      timestamp: 'not-a-date',
      format: 'relative',
    })
    assert.ok(result.error, '应返回 error 字段')
  })
})
