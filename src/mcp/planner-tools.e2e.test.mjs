/**
 * T42-6: Planner E2E Validation Tests
 *
 * 9 个场景覆盖 Planner 驱动工作流的完整链路：
 *   6.1 Happy Path — create → inspect → admin_transition → done
 *   6.2 迭代返工 — rejected → rollback → re-submit
 *   6.3 双驱动防护 — 执行者 transition 被 GateEnforcer 拦截
 *   6.4 User Gate — 无 evidence → ⛔
 *   6.5 用户审核 + evidence — evidence 写入 history.meta
 *   6.6 Rollback — 已访问节点成功 / 未访问节点拒绝
 *   6.7 持久化恢复 — toState → fromState 状态一致 + meta 保留
 *   6.8 handoff_to_member — mock 在线成员 + 3-step ACK + bindings 验证
 *   6.9 read_artifact — 写产出物到 artifact 目录 + Planner 成功读取
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'

import {
  handleWorkflowCreate,
  handleWorkflowAdminTransition,
  handleWorkflowInspect,
  handleWorkflowRollback,
  handleHandoffToMember,
  handleReadArtifact,
} from './planner-tools.mjs'
import { GateEnforcer } from '../workflow/gate-enforcer.mjs'
import { loadWorkflowFromFile } from '../workflow/definition.mjs'
import { StateMachine } from '../workflow/state-machine.mjs'
import { loadInstanceState, saveInstanceState, getArtifactDir } from '../workflow/bridge.mjs'
import { registerMember, unregisterMember } from '../family/registry.mjs'

// ── Test Helpers ──

const FIXTURE_PATH = resolve(import.meta.dirname, '../../test/fixtures/t42-e2e-workflow.json')

/**
 * 设置临时环境：创建 tmp dir，拷贝 fixture，设置 env vars
 * @returns {{ tmpDir: string, cleanup: () => void }}
 */
function setupEnv() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'planner-e2e-'))
  const defDir = join(tmpDir, 'test-family', 'workflow', 'definitions')
  mkdirSync(defDir, { recursive: true })
  cpSync(FIXTURE_PATH, join(defDir, 't42-e2e-workflow.json'))

  process.env.MUSE_HOME = tmpDir
  process.env.MUSE_FAMILY = 'test-family'

  return {
    tmpDir,
    cleanup: () => {
      delete process.env.MUSE_HOME
      delete process.env.MUSE_FAMILY
      rmSync(tmpDir, { recursive: true, force: true })
    },
  }
}

/** 快捷创建 planner 实例 */
async function createInstance() {
  const result = await handleWorkflowCreate('planner-session', {
    workflow_id: 't42-e2e-workflow.json',
  })
  return JSON.parse(result.content[0].text)
}

/** 快捷 admin transition */
async function adminTransition(instanceId, event, opts = {}) {
  const result = await handleWorkflowAdminTransition('planner-session', {
    instance_id: instanceId,
    event,
    ...opts,
  })
  const text = result.content[0].text
  let data = null
  try { data = JSON.parse(text) } catch { /* error responses are plain text */ }
  return { raw: result, data, text }
}

/** 快捷 inspect */
async function inspect(instanceId) {
  const result = await handleWorkflowInspect('planner-session', {
    instance_id: instanceId,
  })
  return JSON.parse(result.content[0].text)
}

// ── 6.1 Happy Path ──

describe('6.1 Happy Path', () => {
  let instanceId
  let env

  before(() => { env = setupEnv() })
  after(() => { env.cleanup() })

  it('workflow_create 创建 driver=planner 实例', async () => {
    const data = await createInstance()
    assert.equal(data.success, true)
    assert.equal(data.driver, 'planner')
    assert.equal(data.current_node, 'write_doc')
    assert.ok(data.instance_id)
    instanceId = data.instance_id
  })

  it('workflow_inspect 返回全局视图', async () => {
    const data = await inspect(instanceId)
    assert.equal(data.status, 'running')
    assert.equal(data.current_node, 'write_doc')
    assert.equal(data.nodes.length, 3)
    assert.ok(data.nodes.find(n => n.id === 'write_doc' && n.is_current))
  })

  it('admin_transition(doc_done) 推进到 review', async () => {
    const { data } = await adminTransition(instanceId, 'doc_done', { reason: 'pua 完成文档' })
    assert.equal(data.success, true)
  })

  it('admin_transition(approved) 越过 user gate 完成工作流', async () => {
    const { data } = await adminTransition(instanceId, 'approved', {
      on_behalf_of: 'user',
      evidence: 'Later 说: 通过',
    })
    assert.equal(data.success, true)
  })

  it('inspect 确认终态 completed', async () => {
    const data = await inspect(instanceId)
    assert.equal(data.current_node, 'done')
    assert.equal(data.status, 'completed')
  })
})

// ── 6.2 迭代返工 ──

describe('6.2 Iteration', () => {
  let instanceId
  let env

  before(async () => {
    env = setupEnv()
    const data = await createInstance()
    instanceId = data.instance_id
    // 推进到 review
    await adminTransition(instanceId, 'doc_done', { reason: '初次完成' })
  })
  after(() => { env.cleanup() })

  it('用户拒绝 → admin_transition(rejected) 回到 write_doc', async () => {
    const { data } = await adminTransition(instanceId, 'rejected', {
      on_behalf_of: 'user',
      evidence: 'Later 说: 内容太少，补充细节',
    })
    assert.equal(data.success, true)
  })

  it('inspect 确认回到 write_doc + history 包含 rejected', async () => {
    const data = await inspect(instanceId)
    assert.equal(data.current_node, 'write_doc')
    assert.ok(data.history.some(h => h.event === 'rejected'))
  })

  it('再次推进到 review → approved → done', async () => {
    await adminTransition(instanceId, 'doc_done', { reason: '返工后完成' })
    const { data } = await adminTransition(instanceId, 'approved', {
      on_behalf_of: 'user',
      evidence: 'Later 说: 这次通过',
    })
    assert.equal(data.success, true)

    const state = await inspect(instanceId)
    assert.equal(state.status, 'completed')
  })
})

// ── 6.3 双驱动防护 ──

describe('6.3 Dual-Drive Protection', () => {
  it('driver=planner 时拦截执行者 workflow_transition', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: { id: 'write_doc', capabilities: ['code_read', 'code_write', 'workflow_control'] },
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('planner') || result.reason.includes('Planner'))
  })

  it('driver=self 时不拦截执行者 workflow_transition', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: { id: 'write_doc', capabilities: ['code_read', 'code_write', 'workflow_control'] },
      participantStatus: 'active',
      driver: 'self',
    })
    assert.equal(result.allowed, true)
  })
})

// ── 6.4 User Gate 拒绝 ──

describe('6.4 User Gate', () => {
  let instanceId
  let env

  before(async () => {
    env = setupEnv()
    const data = await createInstance()
    instanceId = data.instance_id
    await adminTransition(instanceId, 'doc_done', { reason: '完成' })
    // 现在在 review 节点，approved transition 的 actor=user
  })
  after(() => { env.cleanup() })

  it('on_behalf_of=planner → ⛔ 拒绝', async () => {
    const { raw } = await adminTransition(instanceId, 'approved', {
      on_behalf_of: 'planner',
    })
    const text = raw.content[0].text
    assert.ok(text.includes('⛔'))
    assert.ok(text.includes('user'))
  })

  it('on_behalf_of=user + 空 evidence → ⛔ 拒绝', async () => {
    const { raw } = await adminTransition(instanceId, 'approved', {
      on_behalf_of: 'user',
      evidence: '',
    })
    const text = raw.content[0].text
    assert.ok(text.includes('⛔'))
    assert.ok(text.includes('evidence'))
  })

  it('不传 on_behalf_of → ⛔ 拒绝', async () => {
    const { raw } = await adminTransition(instanceId, 'approved')
    const text = raw.content[0].text
    assert.ok(text.includes('⛔'))
  })
})

// ── 6.5 用户审核 + evidence ──

describe('6.5 User Review with Evidence', () => {
  let instanceId
  let env

  before(async () => {
    env = setupEnv()
    const data = await createInstance()
    instanceId = data.instance_id
    await adminTransition(instanceId, 'doc_done', { reason: '完成' })
  })
  after(() => { env.cleanup() })

  it('on_behalf_of=user + evidence → 通过，meta 记录正确', async () => {
    const evidence = 'Later 原话: "文档写得不错，通过"'
    await adminTransition(instanceId, 'approved', {
      on_behalf_of: 'user',
      evidence,
    })

    const data = await inspect(instanceId)

    // 找到 approved transition 的 history 记录
    const approvedEntry = data.history.find(h => h.event === 'approved')
    assert.ok(approvedEntry, 'history 中有 approved 记录')
    assert.equal(approvedEntry.meta.on_behalf_of, 'user')
    assert.equal(approvedEntry.meta.evidence, evidence)
  })
})

// ── 6.6 Rollback ──

describe('6.6 Rollback', () => {
  let instanceId
  let env

  before(async () => {
    env = setupEnv()
    const data = await createInstance()
    instanceId = data.instance_id
    // 推进到 review
    await adminTransition(instanceId, 'doc_done', { reason: '完成' })
  })
  after(() => { env.cleanup() })

  it('rollback 到 write_doc （已访问节点）→ 成功', async () => {
    const result = await handleWorkflowRollback('planner-session', {
      instance_id: instanceId,
      target_node: 'write_doc',
      reason: '产出质量不合格，需要返工',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })

  it('inspect 确认回到 write_doc + history 有 rollback', async () => {
    const data = await inspect(instanceId)
    assert.equal(data.current_node, 'write_doc')
    assert.ok(data.history.some(h => h.event === 'rollback'))
  })

  it('rollback 到未访问节点 done → 拒绝', async () => {
    const result = await handleWorkflowRollback('planner-session', {
      instance_id: instanceId,
      target_node: 'done',
      reason: '测试',
    })
    const text = result.content[0].text
    assert.ok(text.includes('失败') || text.includes('未访问'))
  })
})

// ── 6.7 持久化恢复 ──

describe('6.7 Persistence', () => {
  let env

  before(() => { env = setupEnv() })
  after(() => { env.cleanup() })

  it('toState → 重建 → 状态一致 + meta 保留', async () => {
    // 1. 创建实例
    const createData = await createInstance()
    const instanceId = createData.instance_id

    // 2. 带 meta 推进到 review
    await adminTransition(instanceId, 'doc_done', {
      reason: '完成',
      on_behalf_of: 'planner',
    })

    // 3. 读取持久化状态
    const saved = loadInstanceState(instanceId)
    assert.ok(saved, '持久化状态存在')
    assert.ok(saved.smState, 'smState 存在')
    assert.equal(saved.smState.current_node, 'review')

    // 4. 从持久化恢复
    const definition = await loadWorkflowFromFile(saved.workflowPath)
    const restored = StateMachine.fromState(definition, saved.smState)
    assert.equal(restored.getCurrentNode()?.id, 'review')

    // 5. 验证 history.meta 保留
    const state = restored.toState()
    const docDone = state.history.find(h => h.event === 'doc_done')
    assert.ok(docDone?.meta, 'doc_done history 包含 meta')
    assert.equal(docDone.meta.on_behalf_of, 'planner')
  })
})

// ── 6.8 handoff_to_member + mock 成员 ──

describe('6.8 handoff_to_member 执行链路', () => {
  let env
  let instanceId
  let mockServer
  let mockPort

  before(async () => {
    env = setupEnv()

    // 1. 启动 mock HTTP server 模拟执行者 OpenCode
    mockServer = createServer((req, res) => {
      // POST /session → 返回 sessionId
      if (req.method === 'POST' && req.url === '/session') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id: 'mock-session-001' }))
        return
      }
      // POST /session/:id/prompt_async → 204
      if (req.method === 'POST' && req.url?.includes('/prompt_async')) {
        res.writeHead(204)
        res.end()

        // 异步注入 ACK：模拟 target hook 写 acked
        setTimeout(() => {
          if (!instanceId) return
          const state = loadInstanceState(instanceId)
          if (state?.handoff?.status === 'pending') {
            state.handoff.status = 'acked'
            saveInstanceState(instanceId, state)
          }
        }, 200)
        return
      }
      res.writeHead(404)
      res.end()
    })

    await new Promise(resolve => {
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = mockServer.address().port
        resolve()
      })
    })

    registerMember('mock-pua', {
      role: 'pua',
      engine: `http://127.0.0.1:${mockPort}`,
      pid: process.pid,
      directory: process.env.MUSE_ROOT,
    }, join(env.tmpDir, 'test-family'))

    // 3. 创建工作流实例
    const data = await createInstance()
    instanceId = data.instance_id
  })

  after(async () => {
    if (mockServer) await new Promise(r => mockServer.close(r))
    env.cleanup()
  })

  it('handoff_to_member 成功触发 3-step ACK', async () => {
    const result = await handleHandoffToMember('planner-session', {
      instance_id: instanceId,
      role: 'pua',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
    assert.equal(data.target_role, 'pua')
    assert.equal(data.target_member, 'mock-pua')
    assert.equal(data.handoff_status, 'triggered')
  })

  it('bridge 状态包含 bindings 和 handoff 记录', () => {
    const state = loadInstanceState(instanceId)
    assert.ok(state, '实例状态存在')

    // bindings 含 mock-session-001
    const binding = state.bindings.find(b => b.sessionId === 'mock-session-001')
    assert.ok(binding, 'bindings 中有 targetSession')
    assert.equal(binding.role, 'pua')

    // handoff 状态
    assert.ok(state.handoff, 'handoff 记录存在')
    assert.equal(state.handoff.target, 'pua')
    assert.equal(state.handoff.targetSession, 'mock-session-001')
    assert.equal(state.handoff.source, 'planner')
    // status 应为 executing（ACK 已通过，prompt 已发送）
    assert.ok(['acked', 'executing'].includes(state.handoff.status),
      `handoff.status 应为 acked 或 executing，实际: ${state.handoff.status}`)
  })
})

// ── 6.9 read_artifact 成功链路 ──

describe('6.9 read_artifact 成功链路', () => {
  let env
  let instanceId

  before(async () => {
    env = setupEnv()
    const data = await createInstance()
    instanceId = data.instance_id
  })
  after(() => { env.cleanup() })

  it('Planner 能读取执行者产出的 artifact', async () => {
    // 1. 模拟执行者写入产出物
    const artDir = getArtifactDir(instanceId)
    assert.ok(artDir, 'artifact 目录可解析')
    mkdirSync(artDir, { recursive: true })

    const content = '# 测试文档\n\n这是 pua 的产出物。\n'
    writeFileSync(join(artDir, 'test-output.md'), content)

    // 2. Planner 读取 artifact
    const result = await handleReadArtifact('planner-session', {
      instance_id: instanceId,
      name: 'test-output.md',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.name, 'test-output.md')
    assert.equal(data.instance_id, instanceId)
    assert.equal(data.content, content)
    assert.equal(data.size, content.length)
  })

  it('读取不存在的 artifact → 报错', async () => {
    const result = await handleReadArtifact('planner-session', {
      instance_id: instanceId,
      name: 'nonexistent.md',
    })
    const text = result.content[0].text
    assert.ok(text.includes('失败') || text.includes('ENOENT'))
  })
})
