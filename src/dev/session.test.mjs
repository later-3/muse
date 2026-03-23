/**
 * T0-1: DevSession — Worktree 残留自动清理测试
 *
 * 覆盖:
 * 1. 路径已存在时自动清理
 * 2. cleanup 某步失败不 throw
 * 3. listOrphanWorktrees 识别孤立目录
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, rm, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { DevSession, WORKTREE_BASE } from './session.mjs'

const execFileAsync = promisify(execFile)

// 获取项目根目录 (假设测试在 muse/src/dev/ 下运行)
const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..')
const TEST_TASK_ID_PREFIX = 'test-t01'

async function cleanupTestWorktree(taskId) {
  const worktreePath = join(PROJECT_ROOT, WORKTREE_BASE, taskId)
  const branch = `dev/${taskId}`

  try {
    // 尝试移除 git worktree
    await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: PROJECT_ROOT,
      timeout: 15_000,
    }).catch(() => {})

    // 确保目录被删除
    await rm(worktreePath, { recursive: true, force: true }).catch(() => {})

    // 尝试删除分支
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: PROJECT_ROOT,
      timeout: 15_000,
    }).catch(() => {})
  } catch {
    // 忽略清理错误
  }
}

async function worktreeExists(taskId) {
  const worktreePath = join(PROJECT_ROOT, WORKTREE_BASE, taskId)
  try {
    await access(worktreePath)
    return true
  } catch {
    return false
  }
}

describe('DevSession T0-1', () => {
  const testTaskIds = []

  after(async () => {
    // 清理所有测试创建的 worktree
    for (const taskId of testTaskIds) {
      await cleanupTestWorktree(taskId)
    }
  })

  describe('路径已存在时自动清理', () => {
    const taskId = `${TEST_TASK_ID_PREFIX}-auto-cleanup`

    before(async () => {
      testTaskIds.push(taskId)
      // 先清理可能存在的残留
      await cleanupTestWorktree(taskId)
    })

    after(async () => {
      await cleanupTestWorktree(taskId)
    })

    it('自动清理已存在的 worktree 并重新创建', async () => {
      const worktreePath = join(PROJECT_ROOT, WORKTREE_BASE, taskId)

      // Setup: 先用 git worktree add 创建残留
      await execFileAsync('git', ['worktree', 'add', worktreePath, '-b', `dev/${taskId}`], {
        cwd: PROJECT_ROOT,
        timeout: 30_000,
      })

      // 确认残留存在
      assert.ok(await worktreeExists(taskId), '残留 worktree 应该存在')

      // 调用 create 应该自动清理并重新创建
      const session = await DevSession.create(PROJECT_ROOT, taskId)

      // Assert: 不抛错，返回 DevSession 实例
      assert.ok(session instanceof DevSession, '应该返回 DevSession 实例')
      assert.equal(session.taskId, taskId, 'taskId 应该匹配')
      assert.ok(await worktreeExists(taskId), 'worktree 应该被重新创建')

      // 清理
      await session.cleanup()
    })
  })

  describe('cleanup 某步失败不 throw', () => {
    const taskId = `${TEST_TASK_ID_PREFIX}-cleanup-fail`

    before(async () => {
      testTaskIds.push(taskId)
      await cleanupTestWorktree(taskId)
    })

    after(async () => {
      await cleanupTestWorktree(taskId)
    })

    it('cleanup 失败时不抛错', async () => {
      // 创建 session
      const session = await DevSession.create(PROJECT_ROOT, taskId)

      // Setup: 手动删除 worktree 目录使 git worktree remove 失败
      await rm(session.worktreePath, { recursive: true, force: true })

      // Assert: cleanup 不抛错
      await assert.doesNotReject(async () => {
        await session.cleanup()
      }, 'cleanup 不应该抛错')

      // 清理分支
      await execFileAsync('git', ['branch', '-D', `dev/${taskId}`], {
        cwd: PROJECT_ROOT,
        timeout: 15_000,
      }).catch(() => {})
    })
  })

  describe('listOrphanWorktrees 识别孤立目录', () => {
    const orphanTaskId = `${TEST_TASK_ID_PREFIX}-orphan`
    const normalTaskId = `${TEST_TASK_ID_PREFIX}-normal`

    before(async () => {
      testTaskIds.push(orphanTaskId, normalTaskId)
      await cleanupTestWorktree(orphanTaskId)
      await cleanupTestWorktree(normalTaskId)
    })

    after(async () => {
      await cleanupTestWorktree(orphanTaskId)
      await cleanupTestWorktree(normalTaskId)
    })

    it('识别孤立目录', async () => {
      const orphanPath = join(PROJECT_ROOT, WORKTREE_BASE, orphanTaskId)
      const normalWorktreePath = join(PROJECT_ROOT, WORKTREE_BASE, normalTaskId)

      // Setup: 手动 mkdir 创建孤立目录（不用 git worktree add）
      await mkdir(orphanPath, { recursive: true })

      // Setup: 用 git worktree add 创建正常 worktree
      await execFileAsync('git', ['worktree', 'add', normalWorktreePath, '-b', `dev/${normalTaskId}`], {
        cwd: PROJECT_ROOT,
        timeout: 30_000,
      })

      // 调用 listOrphanWorktrees
      const orphans = await DevSession.listOrphanWorktrees(PROJECT_ROOT)

      // Assert: 返回数组包含 orphan 目录路径
      assert.ok(Array.isArray(orphans), '应该返回数组')
      assert.ok(orphans.some(p => p.includes(orphanTaskId)), '应该包含孤立目录')
      assert.ok(!orphans.some(p => p.includes(normalTaskId)), '不应该包含正常 worktree')

      // 清理正常 worktree
      await execFileAsync('git', ['worktree', 'remove', normalWorktreePath, '--force'], {
        cwd: PROJECT_ROOT,
        timeout: 15_000,
      }).catch(() => {})
      await execFileAsync('git', ['branch', '-D', `dev/${normalTaskId}`], {
        cwd: PROJECT_ROOT,
        timeout: 15_000,
      }).catch(() => {})
    })
  })
})
