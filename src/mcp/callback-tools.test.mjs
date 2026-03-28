/**
 * callback-tools.test.mjs — notify_planner MCP 工具单元测试
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── 测试环境设置 ──

let tmpDir
before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'callback-tools-'))
  // 设置环境变量
  process.env.MUSE_HOME = tmpDir
  process.env.MUSE_FAMILY = 'test-family'
  process.env.MUSE_ROOT = tmpDir
  // 创建 registry 目录
  mkdirSync(join(tmpDir, 'test-family'), { recursive: true })
})

after(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.MUSE_HOME
  delete process.env.MUSE_FAMILY
  delete process.env.MUSE_ROOT
})

// ── 工厂函数 ──

function makeRegistry(members = {}) {
  const registryPath = join(tmpDir, 'test-family', 'registry.json')
  writeFileSync(registryPath, JSON.stringify({ version: 1, members }))
}

function makeInstanceState(instanceId, state) {
  const dir = join(tmpDir, 'test-family', 'workflow', 'instances', instanceId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state))
}

// ── 导入被测模块 ──

const { CALLBACK_TOOLS, handleNotifyPlanner } = await import('./callback-tools.mjs')

// ── Tests ──

describe('CALLBACK_TOOLS 定义', () => {
  it('包含 notify_planner', () => {
    const names = CALLBACK_TOOLS.map(t => t.name)
    assert.ok(names.includes('notify_planner'))
  })

  it('notify_planner schema 有必填参数', () => {
    const tool = CALLBACK_TOOLS.find(t => t.name === 'notify_planner')
    assert.ok(tool)
    const required = tool.inputSchema.required
    assert.ok(required.includes('instance_id'))
    assert.ok(required.includes('status'))
    assert.ok(required.includes('summary'))
  })
})

describe('handleNotifyPlanner', () => {
  it('缺少参数 → 报错', async () => {
    const result = await handleNotifyPlanner('ses_001', {})
    assert.ok(result.content[0].text.includes('缺少必要参数'))
  })

  it('instance_id 不存在 → 报错', async () => {
    const result = await handleNotifyPlanner('ses_001', {
      instance_id: 'nonexistent-instance',
      status: 'done',
      summary: '测试完成',
    })
    assert.ok(result.content[0].text.includes('不存在'))
  })

  it('无 plannerSession → 报错', async () => {
    const instanceId = 'wf_no_session_test'
    makeInstanceState(instanceId, {
      workflowId: 'test-wf',
      instanceId,
      smState: { current_node: 'pua_brief' },
      // 没有 plannerSession
    })
    const result = await handleNotifyPlanner('ses_001', {
      instance_id: instanceId,
      status: 'done',
      summary: '测试完成',
    })
    assert.ok(result.content[0].text.includes('无 plannerSession'))
  })

  it('Planner 不在线 → 报错', async () => {
    const instanceId = 'wf_no_planner_test'
    makeInstanceState(instanceId, {
      workflowId: 'test-wf',
      instanceId,
      plannerSession: 'ses_planner_001',
      smState: { current_node: 'pua_brief' },
    })
    // registry 不包含 planner 角色
    makeRegistry({})
    const result = await handleNotifyPlanner('ses_001', {
      instance_id: instanceId,
      status: 'done',
      summary: '测试完成',
    })
    assert.ok(result.content[0].text.includes('不在线'))
  })
})
