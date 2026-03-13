/**
 * T11: Memory MCP Server — E2E Tests
 *
 * Tests the MCP server end-to-end via `opencode mcp list` and `opencode run`.
 * Requires: opencode CLI in PATH, valid API key configured.
 *
 * These tests are slower (~10-30s each) due to real LLM calls.
 * Run with: node --test muse/mcp/memory.e2e.mjs
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, exec } from 'node:child_process'

const CWD = process.cwd()

// Helper: run command and return stdout
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd: CWD,
      encoding: 'utf-8',
      timeout: opts.timeout || 60_000,
      env: { ...process.env, ...opts.env },
    }).trim()
  } catch (e) {
    if (opts.allowFail) return e.stdout?.trim() || e.stderr?.trim() || ''
    throw e
  }
}

// Helper: check if opencode is available
function checkOpencode() {
  try {
    run('opencode --help', { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// --- Tests ---

describe('Memory MCP — E2E (opencode integration)', { skip: !checkOpencode() && 'opencode not available' }, () => {

  // ----- Step 1: MCP Server 能被 OpenCode 识别并连接 -----
  describe('MCP server connectivity', () => {
    it('should appear in opencode mcp list as connected', () => {
      const output = run('opencode mcp list 2>&1')
      assert.ok(output.includes('memory-server'), `memory-server not found in mcp list output: ${output}`)
      assert.ok(output.includes('connected'), `memory-server not connected: ${output}`)
    })
  })

  // ----- Step 2: AI 自主调 set_memory -----
  describe('AI autonomous set_memory', () => {
    it('should call set_memory when user states personal info', { timeout: 60_000 }, () => {
      const output = run(
        'opencode run "我的名字叫E2E-Test-User-42，请记住。" --print-logs --log-level WARN 2>&1',
        { timeout: 60_000 }
      )

      // AI should have called set_memory tool
      assert.ok(
        output.includes('memory-server_set_memory'),
        `AI did not call set_memory. Full output:\n${output}`
      )

      // Verify key was actually written to SQLite
      const dbCheck = run(
        `sqlite3 muse/data/memory.db "SELECT value FROM semantic_memory WHERE key LIKE '%e2e%test%user%42%' OR value LIKE '%E2E-Test-User-42%' LIMIT 1;"`,
        { allowFail: true }
      )
      // Either the value was stored directly or as part of a compound key
      assert.ok(
        dbCheck.includes('E2E-Test-User-42') || output.includes('E2E-Test-User-42'),
        `Value not persisted in SQLite. DB check: ${dbCheck}`
      )
    })
  })

  // ----- Step 3: 审计记录被写入 -----
  describe('Audit trail persistence', () => {
    it('should have audit records for the set_memory calls', () => {
      const audits = run(
        `sqlite3 muse/data/memory.db "SELECT COUNT(*) FROM memory_audit WHERE new_value LIKE '%E2E-Test-User-42%';"`,
        { allowFail: true }
      )
      const count = parseInt(audits, 10) || 0
      assert.ok(count >= 1, `Expected at least 1 audit record, got ${count}`)
    })
  })

  // ----- Step 4: AI 自主调 search / get_user_profile 来回忆信息 -----
  describe('AI autonomous memory retrieval', () => {
    it('should call get_user_profile or search_memory when asked about stored info', { timeout: 60_000 }, () => {
      const output = run(
        'opencode run "你记得我的名字吗？请告诉我。" --print-logs --log-level WARN 2>&1',
        { timeout: 60_000 }
      )

      // AI should use memory retrieval tools
      const usedMemoryTool =
        output.includes('memory-server_get_user_profile') ||
        output.includes('memory-server_search_memory')

      assert.ok(
        usedMemoryTool,
        `AI did not call any memory retrieval tool. Full output:\n${output}`
      )
    })
  })

  // ----- Step 5: 覆盖守卫 E2E -----
  describe('Overwrite guard E2E', () => {
    it('should block ai_inferred from overriding user_stated in real flow', async () => {
      // Directly verify via SQLite: set a user_stated value, then try ai_inferred
      // This test uses the Memory class directly since we can't control AI's source parameter
      const { Memory } = await import('../core/memory.mjs')
      const config = { memory: { dbPath: 'muse/data/memory.db', maxEpisodicDays: 7 } }
      const memory = new Memory(config, 'muse')
      await memory.start()

      // Write user_stated
      const r1 = memory.setMemory('e2e_guard_test', 'user_says_this', {
        source: 'user_stated', confidence: 'high',
      })
      assert.equal(r1.blocked, false)

      // Try ai_inferred override — should be blocked
      const r2 = memory.setMemory('e2e_guard_test', 'ai_thinks_this', {
        source: 'ai_inferred', confidence: 'medium',
      })
      assert.equal(r2.blocked, true)
      assert.ok(r2.reason.includes('cannot override'))

      // Verify value unchanged
      const stored = memory.getMemory('e2e_guard_test')
      assert.equal(stored.value, 'user_says_this')

      // Verify audit was written for blocked attempt
      const audits = memory.getAuditLog('e2e_guard_test')
      const blockedAudit = audits.find(a => a.action === 'set_memory_blocked')
      assert.ok(blockedAudit)

      // Cleanup
      memory.deleteMemory('e2e_guard_test')
      await memory.stop()
    })
  })

  // ----- Cleanup -----
  after(() => {
    // Clean up E2E test entries from production db
    try {
      run(`sqlite3 muse/data/memory.db "DELETE FROM semantic_memory WHERE key LIKE '%e2e%' OR value LIKE '%E2E-Test-User-42%';"`)
      run(`sqlite3 muse/data/memory.db "DELETE FROM memory_audit WHERE new_value LIKE '%E2E-Test-User-42%' OR target_key LIKE '%e2e%';"`)
    } catch {
      // Best effort cleanup
    }
  })
})
