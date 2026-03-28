/**
 * session-context.test.mjs — Sidecar Session Store 单元测试
 *
 * 覆盖:
 *   1. writeSessionContext 写入 .session-ctx 文件
 *   2. resolveSessionId 读取 sidecar 文件
 *   3. 环境变量优先级 > sidecar > fallback
 *   4. 超时失效 (TTL 5 min)
 *   5. 文件不存在时降级为 'unknown'
 */

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── 测试环境设置 ──

let tmpDir
let originalMemberDir
let originalSessionId

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'session-ctx-'))
  mkdirSync(join(tmpDir, 'data'), { recursive: true })

  // 保存原始环境变量
  originalMemberDir = process.env.MUSE_MEMBER_DIR
  originalSessionId = process.env.OPENCODE_SESSION_ID

  // 清理可能影响测试的环境变量
  delete process.env.OPENCODE_SESSION_ID
  process.env.MUSE_MEMBER_DIR = tmpDir
})

after(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  // 恢复环境变量
  if (originalMemberDir !== undefined) {
    process.env.MUSE_MEMBER_DIR = originalMemberDir
  } else {
    delete process.env.MUSE_MEMBER_DIR
  }
  if (originalSessionId !== undefined) {
    process.env.OPENCODE_SESSION_ID = originalSessionId
  } else {
    delete process.env.OPENCODE_SESSION_ID
  }
})

beforeEach(() => {
  // 每个测试前清理 sidecar 文件和环境变量
  const ctxPath = join(tmpDir, 'data', '.session-ctx')
  try { rmSync(ctxPath) } catch { /* 不存在则忽略 */ }
  delete process.env.OPENCODE_SESSION_ID
  process.env.MUSE_MEMBER_DIR = tmpDir
})

// ── 导入被测模块 ──

const { resolveSessionId, writeSessionContext } = await import('./session-context.mjs')

// ── Tests ──

describe('writeSessionContext', () => {
  it('写入 .session-ctx 文件到 $MUSE_MEMBER_DIR/data/', () => {
    writeSessionContext({ sessionID: 'ses_test_001', tool: 'workflow_create' })

    const ctxPath = join(tmpDir, 'data', '.session-ctx')
    assert.ok(existsSync(ctxPath), '.session-ctx 文件应该存在')

    const ctx = JSON.parse(readFileSync(ctxPath, 'utf-8'))
    assert.equal(ctx.sessionID, 'ses_test_001')
    assert.equal(ctx.tool, 'workflow_create')
    assert.equal(typeof ctx.ts, 'number')
    assert.ok(Date.now() - ctx.ts < 5000, 'ts 应该是最近的时间戳')
  })

  it('无 MUSE_MEMBER_DIR 时静默不写入', () => {
    const saved = process.env.MUSE_MEMBER_DIR
    delete process.env.MUSE_MEMBER_DIR

    // 不抛异常
    writeSessionContext({ sessionID: 'ses_test_002', tool: 'test' })

    process.env.MUSE_MEMBER_DIR = saved
  })

  it('无 sessionID 时静默不写入', () => {
    writeSessionContext({ tool: 'test' })

    const ctxPath = join(tmpDir, 'data', '.session-ctx')
    assert.ok(!existsSync(ctxPath), '无 sessionID 不应写入文件')
  })

  it('包含 memberName (来自 env 或参数)', () => {
    process.env.MUSE_MEMBER = 'planner'
    writeSessionContext({ sessionID: 'ses_test_003', tool: 'handoff' })

    const ctx = JSON.parse(readFileSync(join(tmpDir, 'data', '.session-ctx'), 'utf-8'))
    assert.equal(ctx.memberName, 'planner')
    delete process.env.MUSE_MEMBER
  })
})

describe('resolveSessionId', () => {
  it('优先级 1: 环境变量 OPENCODE_SESSION_ID', () => {
    process.env.OPENCODE_SESSION_ID = 'ses_env_001'
    // 即使 sidecar 文件存在，也应返回环境变量值
    writeSessionContext({ sessionID: 'ses_sidecar_001', tool: 'test' })

    const result = resolveSessionId()
    assert.equal(result, 'ses_env_001')
    delete process.env.OPENCODE_SESSION_ID
  })

  it('优先级 2: sidecar 文件', () => {
    writeSessionContext({ sessionID: 'ses_sidecar_002', tool: 'workflow_create' })

    const result = resolveSessionId()
    assert.equal(result, 'ses_sidecar_002')
  })

  it('优先级 3: fallback unknown', () => {
    // 无环境变量，无 sidecar 文件
    const result = resolveSessionId()
    assert.equal(result, 'unknown')
  })

  it('sidecar 文件超时 (>5 min) → fallback unknown', () => {
    // 手动写一个过期的 sidecar 文件
    const ctxPath = join(tmpDir, 'data', '.session-ctx')
    writeFileSync(ctxPath, JSON.stringify({
      sessionID: 'ses_expired_001',
      tool: 'test',
      ts: Date.now() - 400_000, // 6.7 分钟前
      memberName: 'test',
    }))

    const result = resolveSessionId()
    assert.equal(result, 'unknown', '过期 sidecar 应返回 unknown')
  })

  it('sidecar 文件未超时 (<5 min) → 返回 sessionID', () => {
    const ctxPath = join(tmpDir, 'data', '.session-ctx')
    writeFileSync(ctxPath, JSON.stringify({
      sessionID: 'ses_fresh_001',
      tool: 'test',
      ts: Date.now() - 60_000, // 1 分钟前
      memberName: 'test',
    }))

    const result = resolveSessionId()
    assert.equal(result, 'ses_fresh_001')
  })

  it('sidecar 文件损坏 → fallback unknown', () => {
    const ctxPath = join(tmpDir, 'data', '.session-ctx')
    writeFileSync(ctxPath, 'not-valid-json{{{')

    const result = resolveSessionId()
    assert.equal(result, 'unknown')
  })

  it('MUSE_MEMBER_DIR 不存在 → fallback unknown', () => {
    process.env.MUSE_MEMBER_DIR = '/nonexistent/path/xxx'

    const result = resolveSessionId()
    assert.equal(result, 'unknown')

    process.env.MUSE_MEMBER_DIR = tmpDir
  })
})

describe('写入 → 读取 完整循环', () => {
  it('Plugin 写入 → MCP 读取 → 拿到正确 sessionID', () => {
    // 模拟 Plugin tool.execute.before 写入
    writeSessionContext({
      sessionID: 'ses_e2e_001',
      tool: 'workflow_create',
      memberName: 'planner',
    })

    // 模拟 MCP 子进程读取
    const resolved = resolveSessionId()
    assert.equal(resolved, 'ses_e2e_001')
  })

  it('多次写入 → 读取最新值', () => {
    writeSessionContext({ sessionID: 'ses_old', tool: 'tool_a' })
    writeSessionContext({ sessionID: 'ses_new', tool: 'tool_b' })

    const resolved = resolveSessionId()
    assert.equal(resolved, 'ses_new', '应该返回最后写入的 sessionID')
  })
})
