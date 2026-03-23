/**
 * Phase 2.5: selfCheck 测试
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { selfCheck } from './self-check.mjs'

// --- Mock Modules ---

function createMockModules(overrides = {}) {
  return {
    engine: {
      health: async () => ({ ok: true, detail: { provider: 'ok' } }),
    },
    memory: {
      health: async () => ({ ok: true, detail: { semanticCount: 42 } }),
    },
    identity: {
      health: async () => ({ ok: true, detail: { name: '小缪' } }),
    },
    telegram: {
      health: async () => ({ ok: true, detail: { activeSessions: 1 } }),
    },
    web: {
      health: async () => ({ ok: true, detail: { port: 4097 } }),
    },
    cerebellum: {
      health: async () => ({ ok: true, detail: { consecutiveFailures: 0 } }),
    },
    registry: {
      senses: [{ id: 'text' }, { id: 'image' }],
      capabilities: [{ id: 'bash' }, { id: 'read' }],
    },
    gapJournal: {
      list: () => [],
      stats: () => ({ total: 0 }),
    },
    executionLog: {
      stats: () => ({ total: 10, byRoute: { llm: 5, builtin: 3, mcp: 2 }, successRate: 100 }),
      list: () => [],
    },
    ...overrides,
  }
}

// --- Tests ---

describe('Phase 2.5: selfCheck()', () => {
  it('全绿时返回 overall 🟢', async () => {
    const report = await selfCheck(createMockModules())

    assert.ok(report.timestamp)
    assert.equal(report.overall, '🟢')

    // L1 System
    assert.equal(report.system.engine.status, '🟢')
    assert.equal(report.system.memory.status, '🟢')
    assert.equal(report.system.identity.status, '🟢')
    assert.equal(report.system.telegram.status, '🟢')
    assert.equal(report.system.web.status, '🟢')
    assert.equal(report.system.cerebellum.status, '🟢')
    assert.equal(report.system.routing.status, '🟢')
    assert.equal(report.system.gaps.status, '🟢')

    // L2 Self Model
    assert.equal(report.selfModel.capabilityRegistry.status, '🟢')
    assert.equal(report.selfModel.capabilityRegistry.senseCount, 2)
    assert.equal(report.selfModel.capabilityRegistry.capCount, 2)

    // L3 Life (placeholder)
    assert.equal(report.life.proactivity, null)
    assert.equal(report.life._note, '待 Phase 3 Pulse 上线后填充')
  })

  it('Engine 挂了 → overall 🔴', async () => {
    const report = await selfCheck(createMockModules({
      engine: { health: async () => ({ ok: false }) },
    }))

    assert.equal(report.system.engine.status, '🔴')
    assert.equal(report.overall, '🔴')
  })

  it('小脑有连续失败 → cerebellum 🟡', async () => {
    const report = await selfCheck(createMockModules({
      cerebellum: { health: async () => ({ ok: true, detail: { consecutiveFailures: 2 } }) },
    }))

    assert.equal(report.system.cerebellum.status, '🟡')
  })

  it('有新增缺口 → gaps 🟡', async () => {
    const report = await selfCheck(createMockModules({
      gapJournal: {
        list: () => [{ type: 'missing_capability', timestamp: new Date().toISOString() }],
        stats: () => ({ total: 1 }),
      },
    }))

    assert.equal(report.system.gaps.status, '🟡')
  })

  it('unknown 路由 >20% → routing 🔴', async () => {
    const report = await selfCheck(createMockModules({
      executionLog: {
        stats: () => ({ total: 5, byRoute: { llm: 2, unknown: 3 }, successRate: 100 }),
      },
    }))

    assert.equal(report.system.routing.status, '🔴')
  })

  it('模块缺失时不崩溃', async () => {
    // 只传最少模块
    const report = await selfCheck({
      engine: { health: async () => ({ ok: true }) },
      memory: { health: async () => ({ ok: true, detail: {} }) },
      identity: { health: async () => ({ ok: true }) },
    })

    assert.equal(report.overall, '🟢')
    assert.ok(!report.system.telegram, 'no telegram check')
    assert.ok(!report.system.web, 'no web check')
  })

  it('health() 抛异常 → 🔴 + 错误信息', async () => {
    const report = await selfCheck(createMockModules({
      memory: { health: async () => { throw new Error('db locked') } },
    }))

    assert.equal(report.system.memory.status, '🔴')
    assert.ok(report.system.memory.detail.includes('db locked'))
  })
})
