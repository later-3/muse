/**
 * exp01 测试 — 3 种基础编排模式
 *
 * 使用 node:test 原生测试框架
 * 运行: node --test user/experiments/exp01-chain-parallel-route.test.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStep, chain, parallel, route } from './exp01-chain-parallel-route.mjs'

// ── 辅助 ──

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

describe('exp01: createStep', () => {
  it('should create a step with name and run()', async () => {
    const step = createStep('add1', (x) => x + 1)
    assert.equal(step.name, 'add1')
    const result = await step.run(5)
    assert.equal(result.step, 'add1')
    assert.equal(result.result, 6)
    assert.ok(result.elapsedMs >= 0)
  })

  it('should support async functions', async () => {
    const step = createStep('async-step', async (x) => {
      await delay(10)
      return x * 2
    })
    const result = await step.run(3)
    assert.equal(result.result, 6)
    assert.ok(result.elapsedMs >= 10)
  })
})

describe('exp01: chain (链式)', () => {
  it('should execute steps in sequence, passing output to next input', async () => {
    const steps = [
      createStep('parse', (text) => text.split(' ')),
      createStep('filter', (words) => words.filter((w) => w.length > 3)),
      createStep('count', (words) => ({ count: words.length, words })),
    ]

    const result = await chain(steps, 'the quick brown fox jumps over the lazy dog')

    assert.equal(result.pattern, 'chain')
    assert.equal(result.trace.length, 3)
    assert.equal(result.finalResult.count, 5) // quick brown jumps over lazy
    assert.deepEqual(result.finalResult.words, ['quick', 'brown', 'jumps', 'over', 'lazy'])
  })

  it('Muse analogy: planner → arch → coder → reviewer', async () => {
    const steps = [
      createStep('planner', (task) => ({ task, plan: `implement ${task}` })),
      createStep('arch', (ctx) => ({ ...ctx, design: `design for: ${ctx.plan}` })),
      createStep('coder', (ctx) => ({ ...ctx, code: `code: ${ctx.design}` })),
      createStep('reviewer', (ctx) => ({
        ...ctx,
        approved: true,
        review: `LGTM: ${ctx.code}`,
      })),
    ]

    const result = await chain(steps, 'add memory layer')

    assert.equal(result.trace.length, 4)
    assert.equal(result.finalResult.approved, true)
    assert.ok(result.finalResult.review.includes('LGTM'))
    // 验证链条完整传递
    assert.ok(result.finalResult.task, 'add memory layer')
    assert.ok(result.finalResult.design.includes('implement'))
    assert.ok(result.finalResult.code.includes('design'))
  })

  it('should handle empty chain', async () => {
    const result = await chain([], 'hello')
    assert.equal(result.finalResult, 'hello')
    assert.equal(result.trace.length, 0)
  })
})

describe('exp01: parallel (并行)', () => {
  it('should execute all steps concurrently and aggregate', async () => {
    const steps = [
      createStep('check-syntax', async (code) => {
        await delay(20)
        return { checker: 'syntax', pass: true }
      }),
      createStep('check-style', async (code) => {
        await delay(20)
        return { checker: 'style', pass: true }
      }),
      createStep('check-security', async (code) => {
        await delay(20)
        return { checker: 'security', pass: false, issue: 'SQL injection' }
      }),
    ]

    const t0 = Date.now()
    const result = await parallel(steps, 'SELECT * FROM users', (results) => ({
      allPassed: results.every((r) => r.pass),
      issues: results.filter((r) => !r.pass).map((r) => r.issue),
    }))
    const elapsed = Date.now() - t0

    assert.equal(result.pattern, 'parallel')
    assert.equal(result.results.length, 3)
    assert.equal(result.aggregated.allPassed, false)
    assert.deepEqual(result.aggregated.issues, ['SQL injection'])
    // 并行应该 ~20ms，不是 ~60ms
    assert.ok(elapsed < 100, `should be parallel, took ${elapsed}ms`)
  })

  it('Muse analogy: multiple reviewers check different aspects', async () => {
    const reviewers = [
      createStep('code-quality', () => ({ score: 8, feedback: 'clean code' })),
      createStep('test-coverage', () => ({ score: 6, feedback: 'needs more tests' })),
      createStep('doc-completeness', () => ({ score: 9, feedback: 'well documented' })),
    ]

    const result = await parallel(reviewers, 'PR #42', (scores) => {
      const avg = scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      return { averageScore: Math.round(avg * 10) / 10, approved: avg >= 7 }
    })

    assert.equal(result.aggregated.averageScore, 7.7)
    assert.equal(result.aggregated.approved, true)
  })
})

describe('exp01: route (路由)', () => {
  it('should classify input and route to correct handler', async () => {
    const classifier = (msg) => {
      if (msg.includes('bug') || msg.includes('error')) return 'coder'
      if (msg.includes('design') || msg.includes('architecture')) return 'arch'
      return 'pua'
    }

    const handlers = {
      pua: createStep('pua', (msg) => `😊 ${msg}`),
      coder: createStep('coder', (msg) => `🔧 fixing: ${msg}`),
      arch: createStep('arch', (msg) => `📐 designing: ${msg}`),
    }

    // 路由到 coder
    const r1 = await route(classifier, handlers, 'there is a bug in memory.mjs')
    assert.equal(r1.category, 'coder')
    assert.ok(r1.result.includes('fixing'))

    // 路由到 arch
    const r2 = await route(classifier, handlers, 'rethink the architecture')
    assert.equal(r2.category, 'arch')
    assert.ok(r2.result.includes('designing'))

    // 路由到 pua (default)
    const r3 = await route(classifier, handlers, 'hello, how are you?')
    assert.equal(r3.category, 'pua')
    assert.ok(r3.result.includes('😊'))
  })

  it('should handle unknown category gracefully', async () => {
    const result = await route(
      () => 'unknown_type',
      { pua: createStep('pua', () => 'hi') },
      'test'
    )
    assert.ok(result.error.includes('unknown category'))
  })

  it('Muse analogy: Orchestrator intent classification', async () => {
    // 模拟 Muse 的 Orchestrator 意图分类
    const classifier = (msg) => {
      const lower = msg.toLowerCase()
      if (lower.includes('deploy') || lower.includes('release')) return 'approval_required'
      if (lower.includes('帮我') || lower.includes('请')) return 'task'
      return 'chat'
    }

    const handlers = {
      chat: createStep('chat', () => ({ action: 'respond', needsApproval: false })),
      task: createStep('task', () => ({ action: 'create_workflow', needsApproval: false })),
      approval_required: createStep('approval', () => ({
        action: 'request_approval',
        needsApproval: true,
      })),
    }

    const r1 = await route(classifier, handlers, '帮我重构 memory 模块')
    assert.equal(r1.category, 'task')
    assert.equal(r1.result.action, 'create_workflow')

    const r2 = await route(classifier, handlers, 'deploy to production')
    assert.equal(r2.category, 'approval_required')
    assert.equal(r2.result.needsApproval, true)
  })
})
