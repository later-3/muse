import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRole, buildSystemPrompt, createTeam } from './exp06-role-prompt.mjs'

describe('exp06: Role Prompt', () => {
  it('should build system prompt with all sections', () => {
    const arch = createRole('arch', {
      backstory: 'Senior architect with 10 years experience',
      goal: 'Design robust, scalable systems',
      constraints: ['No premature optimization', 'Document all decisions'],
      tools: ['read_file', 'write_file'],
    })
    const prompt = buildSystemPrompt(arch, { task: 'Review memory module' })
    assert.ok(prompt.includes('# Role: arch'))
    assert.ok(prompt.includes('Senior architect'))
    assert.ok(prompt.includes('No premature optimization'))
    assert.ok(prompt.includes('Review memory module'))
  })

  it('Muse team: 4 roles with distinct prompts', () => {
    const team = createTeam([
      createRole('pua', { backstory: 'Later的AI伴侣', goal: '陪伴和关心Later', constraints: ['保持温暖的语气'] }),
      createRole('planner', { backstory: '项目经理', goal: '拆解和分配任务', constraints: ['不直接执行', '只分配和监督'] }),
      createRole('coder', { backstory: '开发者', goal: '写高质量代码', constraints: ['遵循ESM规范', '写测试'], tools: ['read_file', 'write_file', 'run_command'] }),
      createRole('reviewer', { backstory: '代码审查员', goal: '确保代码质量', constraints: ['不改代码，只提意见'] }),
    ])

    assert.equal(team.listRoles().length, 4)
    const prompt = team.assignTask('coder', '实现 memory 分层', '基于 SQLite')
    assert.ok(prompt.includes('# Role: coder'))
    assert.ok(prompt.includes('ESM'))
    assert.ok(prompt.includes('memory 分层'))
  })

  it('should throw on unknown role', () => {
    const team = createTeam([createRole('pua', {})])
    assert.throws(() => team.assignTask('unknown', 'task'), /not found/)
  })
})
