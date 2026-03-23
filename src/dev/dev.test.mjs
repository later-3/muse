/**
 * T37: Dev Module Tests
 *
 * 覆盖: DevGuard (纯函数) + DevStore (SQLite) + DevSession (git) + TaskOrchestrator (编排)
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { DevGuard, ALLOWED_DIRS, BLOCKED_FILES, MAX_DIFF_LINES } from './guard.mjs'
import { DevStore, DEV_STATUS } from './store.mjs'

// ============================================================
// DevGuard Tests
// ============================================================

describe('DevGuard', () => {

  describe('isAllowedPath', () => {
    it('允许 muse/ 内的文件', () => {
      assert.ok(DevGuard.isAllowedPath('muse/dev/guard.mjs'))
      assert.ok(DevGuard.isAllowedPath('muse/core/engine.mjs'))
    })

    it('拒绝 muse/ 外的文件', () => {
      assert.ok(!DevGuard.isAllowedPath('package.json'))
      assert.ok(!DevGuard.isAllowedPath('phase3/README.md'))
      assert.ok(!DevGuard.isAllowedPath('.env'))
    })

    it('处理前导 / 的路径', () => {
      assert.ok(DevGuard.isAllowedPath('/muse/dev/guard.mjs'))
    })
  })

  describe('isBlockedFile', () => {
    it('拒绝 .env', () => {
      assert.ok(DevGuard.isBlockedFile('.env'))
      assert.ok(DevGuard.isBlockedFile('muse/.env'))
    })

    it('拒绝 opencode.json', () => {
      assert.ok(DevGuard.isBlockedFile('opencode.json'))
    })

    it('拒绝 start.sh', () => {
      assert.ok(DevGuard.isBlockedFile('start.sh'))
    })

    it('允许普通文件', () => {
      assert.ok(!DevGuard.isBlockedFile('muse/dev/guard.mjs'))
      assert.ok(!DevGuard.isBlockedFile('muse/core/engine.mjs'))
    })
  })

  describe('validatePlan', () => {
    it('通过合法方案', () => {
      const result = DevGuard.validatePlan({
        files: ['muse/dev/guard.mjs', 'muse/dev/store.mjs'],
        estimatedLines: 100,
      })
      assert.ok(result.ok)
    })

    it('拒绝无 files 的方案', () => {
      const result = DevGuard.validatePlan({})
      assert.ok(!result.ok)
      assert.match(result.reason, /files/)
    })

    it('拒绝包含白名单外文件的方案', () => {
      const result = DevGuard.validatePlan({
        files: ['muse/dev/guard.mjs', 'package.json'],
      })
      assert.ok(!result.ok)
      assert.match(result.reason, /package\.json/)
    })

    it('拒绝包含黑名单文件的方案', () => {
      const result = DevGuard.validatePlan({
        files: ['muse/.env'],
      })
      assert.ok(!result.ok)
      assert.match(result.reason, /黑名单/)
    })

    it('拒绝超行数限制的方案', () => {
      const result = DevGuard.validatePlan({
        files: ['muse/dev/big.mjs'],
        estimatedLines: MAX_DIFF_LINES + 1,
      })
      assert.ok(!result.ok)
      assert.match(result.reason, /超过限制/)
    })
  })

  describe('parseGitDiff', () => {
    it('解析标准 diff', () => {
      const diff = [
        'diff --git a/muse/dev/guard.mjs b/muse/dev/guard.mjs',
        '--- a/muse/dev/guard.mjs',
        '+++ b/muse/dev/guard.mjs',
        '+const a = 1',
        '+const b = 2',
        '-const c = 3',
        ' unchanged line',
      ].join('\n')

      const stats = DevGuard.parseGitDiff(diff)
      assert.deepEqual(stats.files, ['muse/dev/guard.mjs'])
      assert.equal(stats.linesAdded, 2)
      assert.equal(stats.linesRemoved, 1)
    })

    it('解析多文件 diff', () => {
      const diff = [
        'diff --git a/muse/a.mjs b/muse/a.mjs',
        '+line1',
        'diff --git a/muse/b.mjs b/muse/b.mjs',
        '+line2',
        '-line3',
      ].join('\n')

      const stats = DevGuard.parseGitDiff(diff)
      assert.equal(stats.files.length, 2)
      assert.equal(stats.linesAdded, 2)
      assert.equal(stats.linesRemoved, 1)
    })

    it('处理空输入', () => {
      const stats = DevGuard.parseGitDiff('')
      assert.equal(stats.files.length, 0)
      assert.equal(stats.linesAdded, 0)
    })

    it('处理 null/undefined', () => {
      assert.deepEqual(DevGuard.parseGitDiff(null), { files: [], linesAdded: 0, linesRemoved: 0 })
      assert.deepEqual(DevGuard.parseGitDiff(undefined), { files: [], linesAdded: 0, linesRemoved: 0 })
    })
  })

  describe('validateDiff', () => {
    it('通过合法 diff', () => {
      const diff = [
        'diff --git a/muse/dev/guard.mjs b/muse/dev/guard.mjs',
        '+const a = 1',
      ].join('\n')

      const result = DevGuard.validateDiff(diff)
      assert.ok(result.ok)
      assert.equal(result.stats.linesAdded, 1)
    })

    it('拒绝包含白名单外文件的 diff', () => {
      const diff = [
        'diff --git a/package.json b/package.json',
        '+new dep',
      ].join('\n')

      const result = DevGuard.validateDiff(diff)
      assert.ok(!result.ok)
      assert.match(result.reason, /package\.json/)
    })

    it('拒绝超行数限制的 diff', () => {
      const lines = ['diff --git a/muse/big.mjs b/muse/big.mjs']
      for (let i = 0; i < MAX_DIFF_LINES + 1; i++) {
        lines.push(`+line ${i}`)
      }

      const result = DevGuard.validateDiff(lines.join('\n'))
      assert.ok(!result.ok)
      assert.match(result.reason, /超过限制/)
    })
  })
})

// ============================================================
// DevStore Tests
// ============================================================

describe('DevStore', () => {
  let db, store

  before(() => {
    db = new Database(':memory:')
    store = new DevStore(db)
    store.init()
  })

  after(() => {
    db.close()
  })

  it('创建任务', () => {
    const task = store.create({ description: '测试任务' })
    assert.ok(task.id.startsWith('dev-'))
    assert.equal(task.status, DEV_STATUS.PLANNING)
    assert.equal(task.description, '测试任务')
  })

  it('获取任务', () => {
    const created = store.create({ description: '获取测试' })
    const found = store.get(created.id)
    assert.equal(found.id, created.id)
    assert.equal(found.description, '获取测试')
  })

  it('不存在的任务返回 null', () => {
    assert.equal(store.get('nonexistent'), null)
  })

  it('更新任务状态', () => {
    const task = store.create({ description: '更新测试' })
    store.updateStatus(task.id, DEV_STATUS.DEVELOPING, {
      worktree_path: '/tmp/test',
      worktree_branch: 'dev/test',
    })

    const updated = store.get(task.id)
    assert.equal(updated.status, DEV_STATUS.DEVELOPING)
    assert.equal(updated.worktree_path, '/tmp/test')
    assert.equal(updated.worktree_branch, 'dev/test')
  })

  it('更新 JSON 字段', () => {
    const task = store.create({ description: 'JSON 测试' })
    store.updateStatus(task.id, DEV_STATUS.REVIEW, {
      plan: { files: ['muse/a.mjs'], summary: 'test' },
      diff: { linesAdded: 10, linesRemoved: 5 },
      test: { ok: true, exitCode: 0 },
      review: { approved: true, summary: 'LGTM' },
    })

    const updated = store.get(task.id)
    assert.deepEqual(updated.plan, { files: ['muse/a.mjs'], summary: 'test' })
    assert.deepEqual(updated.diff, { linesAdded: 10, linesRemoved: 5 })
    assert.ok(updated.test.ok)
    assert.ok(updated.review.approved)
  })

  it('列出所有任务', () => {
    const before = store.list()
    store.create({ description: '列表测试' })
    const after = store.list()
    assert.ok(after.length > before.length)
  })

  it('按状态过滤', () => {
    const task = store.create({ description: '过滤测试' })
    store.updateStatus(task.id, DEV_STATUS.REVIEW)

    const reviewTasks = store.list({ status: DEV_STATUS.REVIEW })
    assert.ok(reviewTasks.some(t => t.id === task.id))

    const failedTasks = store.list({ status: DEV_STATUS.FAILED })
    assert.ok(!failedTasks.some(t => t.id === task.id))
  })

  it('创建带 gap 的任务', () => {
    const task = store.create({
      description: 'gap 测试',
      gap: { type: 'audio', source: 'telegram', reason: 'unsupported' },
    })

    const found = store.get(task.id)
    assert.deepEqual(found.gap, { type: 'audio', source: 'telegram', reason: 'unsupported' })
  })
})
