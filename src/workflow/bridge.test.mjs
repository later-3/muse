/**
 * T39-1.3: WorkflowBridge 单元测试
 *
 * 覆盖：
 * - session-index CRUD: indexSession / lookupInstance / removeSessionIndex
 * - rebuildIndex: 从 state.json 重建
 * - per-instance: saveInstanceState / loadInstanceState
 * - artifact 路径: getArtifactDir / getArtifactPath
 * - 共享: 两个 member 访问同一 instanceId
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { mkdirSync, writeFileSync, existsSync, unlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getWorkflowRoot,
  getSessionIndexPath,
  getInstanceDir,
  getStatePath,
  getArtifactDir,
  getArtifactPath,
  readSessionIndex,
  indexSession,
  lookupInstance,
  removeSessionIndex,
  rebuildIndex,
  saveInstanceState,
  loadInstanceState,
} from './bridge.mjs'

describe('T39-1.3: WorkflowBridge', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'muse-bridge-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  describe('路径', () => {
    it('getWorkflowRoot 使用传入的 workflowRoot', () => {
      assert.equal(getWorkflowRoot(tmpDir), tmpDir)
    })

    it('getInstanceDir 返回 instances 子目录', () => {
      const dir = getInstanceDir('inst-1', tmpDir)
      assert.ok(dir.includes('instances/inst-1'))
    })

    it('getArtifactDir 返回 artifacts 子目录', () => {
      const dir = getArtifactDir('inst-1', tmpDir)
      assert.ok(dir.includes('inst-1/artifacts'))
    })

    it('getArtifactPath 返回完整文件路径', () => {
      const p = getArtifactPath('inst-1', 'report.md', tmpDir)
      assert.ok(p.endsWith('artifacts/report.md'))
    })
  })

  describe('session-index CRUD', () => {
    it('indexSession → lookupInstance 返回 instanceId', () => {
      indexSession('ses_abc', 'inst-1', tmpDir)
      assert.equal(lookupInstance('ses_abc', tmpDir), 'inst-1')
    })

    it('多个 session 映射到不同 instance', () => {
      indexSession('ses_1', 'inst-1', tmpDir)
      indexSession('ses_2', 'inst-2', tmpDir)
      assert.equal(lookupInstance('ses_1', tmpDir), 'inst-1')
      assert.equal(lookupInstance('ses_2', tmpDir), 'inst-2')
    })

    it('removeSessionIndex 删除映射', () => {
      indexSession('ses_abc', 'inst-1', tmpDir)
      removeSessionIndex('ses_abc', tmpDir)
      assert.equal(lookupInstance('ses_abc', tmpDir), null)
    })

    it('不存在的 session 返回 null', () => {
      assert.equal(lookupInstance('non_existent', tmpDir), null)
    })

    it('空目录也能正常读取', () => {
      const index = readSessionIndex(tmpDir)
      assert.deepEqual(index, {})
    })
  })

  describe('rebuildIndex', () => {
    it('从 state.json 的 bindings 和 handoff 重建', () => {
      // 创建两个 instance 的 state.json
      const inst1Dir = join(tmpDir, 'instances', 'inst-1')
      const inst2Dir = join(tmpDir, 'instances', 'inst-2')
      mkdirSync(inst1Dir, { recursive: true })
      mkdirSync(inst2Dir, { recursive: true })

      writeFileSync(join(inst1Dir, 'state.json'), JSON.stringify({
        bindings: [{ role: 'orchestrator', sessionId: 'ses_aaa' }],
        handoff: { targetSession: 'ses_bbb' },
      }), 'utf-8')

      writeFileSync(join(inst2Dir, 'state.json'), JSON.stringify({
        bindings: [{ role: 'arch', sessionId: 'ses_ccc' }],
      }), 'utf-8')

      const index = rebuildIndex(tmpDir)

      assert.equal(index['ses_aaa'], 'inst-1')
      assert.equal(index['ses_bbb'], 'inst-1')
      assert.equal(index['ses_ccc'], 'inst-2')
    })

    it('session-index.json 丢失后可恢复', () => {
      // 先建索引
      indexSession('ses_old', 'inst-1', tmpDir)
      // 创建 state.json
      const instDir = join(tmpDir, 'instances', 'inst-1')
      mkdirSync(instDir, { recursive: true })
      writeFileSync(join(instDir, 'state.json'), JSON.stringify({
        bindings: [{ role: 'role', sessionId: 'ses_old' }],
      }), 'utf-8')

      // 删除 session-index.json
      const indexPath = getSessionIndexPath(tmpDir)
      try { unlinkSync(indexPath) } catch { /* ignore */ }

      // 重建
      rebuildIndex(tmpDir)

      // 验证恢复
      assert.equal(lookupInstance('ses_old', tmpDir), 'inst-1')
    })

    it('无 instances 目录返回空', () => {
      const index = rebuildIndex(tmpDir)
      assert.deepEqual(index, {})
    })
  })

  describe('per-instance state', () => {
    it('save → load 往返一致', () => {
      const state = {
        workflowId: 'wf-dev',
        instanceId: 'inst-1',
        bindings: [{ role: 'orchestrator', sessionId: 'ses_111' }],
        handoff: null,
      }
      saveInstanceState('inst-1', state, tmpDir)
      const loaded = loadInstanceState('inst-1', tmpDir)

      assert.equal(loaded.workflowId, 'wf-dev')
      assert.equal(loaded.instanceId, 'inst-1')
      assert.equal(loaded.bindings[0].sessionId, 'ses_111')
      assert.ok(loaded.savedAt) // 自动加 savedAt
    })

    it('不存在的 instance 返回 null', () => {
      assert.equal(loadInstanceState('nonexistent', tmpDir), null)
    })

    it('state.json 写到正确路径', () => {
      saveInstanceState('inst-abc', { test: true }, tmpDir)
      const statePath = getStatePath('inst-abc', tmpDir)
      assert.ok(existsSync(statePath))
    })
  })

  describe('共享 artifact', () => {
    it('两个 member 访问同一 instanceId 返回同一路径', () => {
      // 模拟两个 member 用同一个 workflowRoot
      const dir1 = getArtifactDir('inst-shared', tmpDir)
      const dir2 = getArtifactDir('inst-shared', tmpDir)
      assert.equal(dir1, dir2)
    })

    it('getArtifactPath 可跨 muse 读同一文件', () => {
      // 写 artifact
      const artDir = getArtifactDir('inst-shared', tmpDir)
      mkdirSync(artDir, { recursive: true })
      const filePath = getArtifactPath('inst-shared', 'report.md', tmpDir)
      writeFileSync(filePath, '# Report', 'utf-8')

      // 读
      const content = readFileSync(filePath, 'utf-8')
      assert.equal(content, '# Report')
    })
  })

  // ── 跨进程恢复场景（真机联调暴露的 bug）──

  describe('restoreAllFromBridge 跨进程恢复', () => {
    /** 创建一个最小工作流定义文件 */
    function writeMinimalWorkflow(dir) {
      const wfPath = join(dir, 'test-wf.json')
      writeFileSync(wfPath, JSON.stringify({
        id: 'test-wf', name: 'Test', version: '1.0', initial: 'step1',
        participants: [{ role: 'pua' }, { role: 'arch' }],
        nodes: {
          step1: { type: 'action', participant: 'pua', capabilities: [], transitions: { go: { target: 'step2', actor: 'agent' } } },
          step2: { type: 'action', participant: 'arch', capabilities: [], transitions: {} },
        },
      }))
      return wfPath
    }

    it('已存在实例 + 新增 handoff session → 增量同步 binding', async () => {
      // 模拟真实场景：arch 端先恢复了旧 bindings，后来 pua 写了新 binding

      const { restoreAllFromBridge } = await import('./bridge.mjs')
      const { setRegistry, getRegistry } = await import('./registry.mjs')

      // 准备 env
      const origHome = process.env.MUSE_HOME
      const origFamily = process.env.MUSE_FAMILY
      const origRoot = process.env.MUSE_ROOT
      process.env.MUSE_HOME = tmpDir
      process.env.MUSE_FAMILY = 'test-fam'
      process.env.MUSE_ROOT = tmpDir

      try {
        // Step 1: 写工作流定义
        const famDir = join(tmpDir, 'test-fam')
        mkdirSync(famDir, { recursive: true })
        const wfPath = writeMinimalWorkflow(famDir)

        // Step 2: 写 state.json（只有 pua 的旧 binding，无 handoff session）
        const instanceId = 'wf_test_incr_sync'
        const state1 = {
          workflowPath: wfPath,
          workflowId: 'test-wf',
          instanceId,
          bindings: [{ role: 'pua', sessionId: 'ses_pua_111' }],
          smState: {
            workflow_id: 'test-wf', instance_id: instanceId,
            current_node: 'step1', task_id: 'task-1', status: 'running',
            history: [], artifacts: {},
          },
        }
        saveInstanceState(instanceId, state1)
        indexSession('ses_pua_111', instanceId)

        // Step 3: 首次恢复 — ses_pua_111 绑定进 registry
        setRegistry(null)
        await restoreAllFromBridge()
        let reg = getRegistry()
        assert.ok(reg.getBySession('ses_pua_111'), '首次恢复应绑定 ses_pua_111')
        assert.equal(reg.getBySession('ses_arch_222'), null, '首次恢复时 ses_arch_222 不存在')

        // Step 4: 模拟 pua 写入 handoff session（跨进程写 state.json）
        const state2 = loadInstanceState(instanceId)
        state2.bindings.push({ role: 'arch', sessionId: 'ses_arch_222' })
        state2.handoff = { status: 'pending', targetSession: 'ses_arch_222' }
        saveInstanceState(instanceId, state2)
        indexSession('ses_arch_222', instanceId)

        // Step 5: 二次恢复 — 应增量同步 ses_arch_222
        await restoreAllFromBridge()
        reg = getRegistry()
        assert.ok(reg.getBySession('ses_arch_222'),
          '二次恢复应增量同步 handoff session ses_arch_222')
        // 旧 session 仍然在
        assert.ok(reg.getBySession('ses_pua_111'),
          '旧 session 应仍然在')
      } finally {
        process.env.MUSE_HOME = origHome
        process.env.MUSE_FAMILY = origFamily
        process.env.MUSE_ROOT = origRoot
        setRegistry(null)
      }
    })

    it('已存在实例 + bindings 无变化 → 不重复绑定', async () => {
      const { restoreAllFromBridge } = await import('./bridge.mjs')
      const { setRegistry, getRegistry } = await import('./registry.mjs')

      const origHome = process.env.MUSE_HOME
      const origFamily = process.env.MUSE_FAMILY
      const origRoot = process.env.MUSE_ROOT
      process.env.MUSE_HOME = tmpDir
      process.env.MUSE_FAMILY = 'test-fam'
      process.env.MUSE_ROOT = tmpDir

      try {
        const famDir = join(tmpDir, 'test-fam')
        mkdirSync(famDir, { recursive: true })
        const wfPath = writeMinimalWorkflow(famDir)

        const instanceId = 'wf_test_no_dup'
        saveInstanceState(instanceId, {
          workflowPath: wfPath, workflowId: 'test-wf', instanceId,
          bindings: [{ role: 'pua', sessionId: 'ses_pua_333' }],
          smState: {
            workflow_id: 'test-wf', instance_id: instanceId,
            current_node: 'step1', task_id: 'task-2', status: 'running',
            history: [], artifacts: {},
          },
        })

        setRegistry(null)
        await restoreAllFromBridge()
        const reg = getRegistry()
        assert.ok(reg.getBySession('ses_pua_333'))

        // 再次恢复 — bindings 没变化，不应出错
        await restoreAllFromBridge()
        assert.ok(reg.getBySession('ses_pua_333'), '多次恢复应幂等')
      } finally {
        process.env.MUSE_HOME = origHome
        process.env.MUSE_FAMILY = origFamily
        process.env.MUSE_ROOT = origRoot
        setRegistry(null)
      }
    })
  })
})
