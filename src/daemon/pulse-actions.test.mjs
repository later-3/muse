/**
 * T31: Pulse Actions tests
 *
 * Uses real Identity schema structure (nested: data.identity.name, data.boundaries, etc.)
 * and tests buildSystemPrompt() integration.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dispatch } from './pulse-actions.mjs'

/**
 * Create a fake Identity that mirrors the real Identity class interface:
 * - .data returns nested schema (data.identity.name, data.boundaries, etc.)
 * - .buildSystemPrompt() returns a structured 4-layer system prompt string
 */
function createFakeIdentity(overrides = {}) {
  const data = {
    id: 'test-identity',
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    identity: {
      name: overrides.name || '小缪',
      nickname: overrides.nickname || '缪缪',
      bio: overrides.bio || 'Later 的终身 AI 搭档',
      owner: overrides.owner || 'Later',
    },
    psychology: {
      mbti: 'ENFP',
      traits: { humor: 0.8, warmth: 0.7 },
    },
    linguistics: {
      style: '轻松专业',
      formality: 'casual-professional',
      catchphrases: ['嘿～', '搞定！'],
      language: 'zh-CN',
    },
    motivations: {
      core_drive: '帮助用户更高效地工作',
      values: ['高效', '诚实', '有趣'],
    },
    boundaries: {
      never_do: overrides.never_do || ['假装是人类', '泄露隐私', '执行危险命令'],
      always_do: overrides.always_do || ['记住对话上下文', '主动提出建议'],
    },
  }

  return {
    data,
    buildSystemPrompt() {
      const d = data
      const role = `你是 ${d.identity.name}（${d.identity.nickname}），${d.identity.bio}。你的主人是 ${d.identity.owner}。`
      const rules = d.boundaries.always_do.map(r => `- 必须: ${r}`).join('\n')
      const safety = d.boundaries.never_do.map(r => `- 禁止: ${r}`).join('\n')
      return `${role}\n\n## 行为规则\n${rules}\n\n## 安全边界\n${safety}`
    },
  }
}

describe('pulse-actions', () => {
  it('dispatch skips when no chatIds', async () => {
    let sendCalled = false
    const modules = {
      engine: {},
      telegram: { sendProactive: () => { sendCalled = true } },
      pulse: { state: { knownChatIds: [] }, pulseState: { incrementUnresponsed: () => {} } },
      identity: createFakeIdentity(),
    }
    await dispatch({ id: 'test', action: 'greet' }, modules)
    assert.equal(sendCalled, false, 'should not call sendProactive with no chatIds')
  })

  it('dispatch calls buildSystemPrompt + sendAndWait with opts.system + sendProactive', async () => {
    const calls = []
    const identity = createFakeIdentity()
    const modules = {
      engine: {
        createSession: async () => { calls.push('createSession'); return { id: 'sess-1' } },
        sendAndWait: async (sid, text, opts) => {
          calls.push('sendAndWait')
          assert.equal(sid, 'sess-1')
          assert.ok(text.includes('问候'), 'text should be scenario')
          // Verify system prompt comes from buildSystemPrompt
          assert.ok(opts.system, 'opts.system should exist')
          assert.ok(opts.system.includes('小缪（缪缪）'), 'should include full identity name+nickname')
          assert.ok(opts.system.includes('主人是 Later'), 'should include owner from nested schema')
          assert.ok(opts.system.includes('禁止: 假装是人类'), 'should include boundaries')
          assert.ok(opts.system.includes('必须: 记住对话上下文'), 'should include always_do')
          assert.ok(opts.system.includes('主动给用户发'), 'should include proactive instruction')
          return { text: '嘿 Later～早上好呀 ☀️' }
        },
      },
      telegram: {
        sendProactive: async (text, opts) => {
          calls.push('sendProactive')
          assert.ok(text.includes('Later'))
          assert.deepEqual(opts.chatIds, ['123'])
          return { sent: 1, failed: 0 }
        },
      },
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: {
          incrementUnresponsed: () => { calls.push('incrementUnresponsed') },
        },
      },
      identity,
    }

    await dispatch({ id: 'greeting', action: 'greet', interval: 7200000 }, modules)
    assert.deepEqual(calls, ['createSession', 'sendAndWait', 'sendProactive', 'incrementUnresponsed'])
  })

  it('dispatch skips push when AI returns empty text', async () => {
    let pushCalled = false
    const modules = {
      engine: {
        createSession: async () => ({ id: 'sess-2' }),
        sendAndWait: async () => ({ text: '' }),
      },
      telegram: { sendProactive: async () => { pushCalled = true; return { sent: 0, failed: 0 } } },
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: { incrementUnresponsed: () => {} },
      },
      identity: createFakeIdentity(),
    }
    await dispatch({ id: 'test', action: 'greet' }, modules)
    assert.equal(pushCalled, false, 'should skip push for empty AI response')
  })

  it('dispatch does NOT incrementUnresponsed when all pushes fail', async () => {
    let incremented = false
    const modules = {
      engine: {
        createSession: async () => ({ id: 'sess-3' }),
        sendAndWait: async () => ({ text: '嗨～' }),
      },
      telegram: {
        sendProactive: async () => ({ sent: 0, failed: 2 }),  // all failed
      },
      pulse: {
        state: { knownChatIds: ['123', '456'] },
        pulseState: {
          incrementUnresponsed: () => { incremented = true },
        },
      },
      identity: createFakeIdentity(),
    }
    await dispatch({ id: 'test', action: 'greet' }, modules)
    assert.equal(incremented, false, 'should not increment when all pushes failed')
  })

  it('dispatch throws when engine fails', async () => {
    const modules = {
      engine: {
        createSession: async () => { throw new Error('engine down') },
      },
      telegram: {},
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: {},
      },
      identity: createFakeIdentity(),
    }
    await assert.rejects(
      () => dispatch({ id: 'test', action: 'greet' }, modules),
      /engine down/,
    )
  })

  // --- E2E: Full trigger-to-push chain ---

  it('E2E: full dispatch chain with real Identity schema', async () => {
    const log = []
    const identity = createFakeIdentity({
      name: '测试缪',
      nickname: '测缪',
      owner: 'TestUser',
      never_do: ['执行危险命令'],
      always_do: ['保持温暖'],
    })

    const fakeEngine = {
      createSession: async () => {
        log.push('session')
        return { id: 'e2e-session' }
      },
      sendAndWait: async (sid, text, opts) => {
        log.push('ai')
        // Verify buildSystemPrompt output
        assert.ok(opts.system.includes('测试缪（测缪）'), 'should use real nested identity')
        assert.ok(opts.system.includes('主人是 TestUser'))
        assert.ok(opts.system.includes('禁止: 执行危险命令'))
        assert.ok(opts.system.includes('必须: 保持温暖'))
        // text should be scenario, not persona
        assert.ok(!text.includes('测试缪'), 'text should be scenario, not persona')
        return { text: '嗨～今天怎么样？🌸' }
      },
    }

    let pushedText = null
    const fakeTelegram = {
      sendProactive: async (text, opts) => {
        log.push('push')
        pushedText = text
        assert.deepEqual(opts.chatIds, ['999'])
        return { sent: 1, failed: 0 }
      },
    }

    let unresponsedIncremented = false
    const fakePulse = {
      state: { knownChatIds: ['999'] },
      pulseState: {
        incrementUnresponsed: () => {
          log.push('state')
          unresponsedIncremented = true
        },
      },
    }

    await dispatch(
      { id: 'e2e-trigger', action: 'greet', interval: 3600000 },
      { engine: fakeEngine, telegram: fakeTelegram, pulse: fakePulse, identity },
    )

    assert.deepEqual(log, ['session', 'ai', 'push', 'state'])
    assert.equal(pushedText, '嗨～今天怎么样？🌸')
    assert.ok(unresponsedIncremented)
  })

  // --- T35: goalCheck action ---

  it('goalCheck: active goals → AI decides to remind → sends', async () => {
    const calls = []
    const modules = {
      engine: {
        createSession: async () => ({ id: 'goal-sess' }),
        sendAndWait: async (sid, text, opts) => {
          calls.push('ai')
          assert.ok(text.includes('学 Rust'))
          assert.ok(opts.system.includes('检查用户的目标进度'))
          return { text: '学 Rust 进展如何？加油 💪' }
        },
      },
      telegram: {
        sendProactive: async (text, opts) => {
          calls.push('push')
          assert.ok(text.includes('Rust'))
          return { sent: 1, failed: 0 }
        },
      },
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: { incrementUnresponsed: () => calls.push('incr') },
      },
      identity: createFakeIdentity(),
      goals: {
        getActive: () => [{ id: 'g1', title: '学 Rust', progress: 30, deadline: '2026-06-01' }],
        getOverdue: () => [],
      },
    }
    await dispatch({ id: 'goal-check', action: 'goalCheck' }, modules)
    assert.deepEqual(calls, ['ai', 'push', 'incr'])
  })

  it('goalCheck: AI returns empty → no push', async () => {
    let pushCalled = false
    const modules = {
      engine: {
        createSession: async () => ({ id: 'goal-sess-2' }),
        sendAndWait: async () => ({ text: '' }),  // AI decides no reminder needed
      },
      telegram: { sendProactive: async () => { pushCalled = true; return { sent: 0, failed: 0 } } },
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: { incrementUnresponsed: () => {} },
      },
      identity: createFakeIdentity(),
      goals: {
        getActive: () => [{ id: 'g1', title: 'Test', progress: 80 }],
        getOverdue: () => [],
      },
    }
    await dispatch({ id: 'goal-check', action: 'goalCheck' }, modules)
    assert.equal(pushCalled, false, 'AI empty response should skip push')
  })

  it('goalCheck: no active goals → early return', async () => {
    let engineCalled = false
    const modules = {
      engine: { createSession: async () => { engineCalled = true; return { id: 's' } } },
      telegram: {},
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: {},
      },
      identity: createFakeIdentity(),
      goals: {
        getActive: () => [],
        getOverdue: () => [],
      },
    }
    await dispatch({ id: 'goal-check', action: 'goalCheck' }, modules)
    assert.equal(engineCalled, false, 'should not call engine when no active goals')
  })

  it('goalCheck: overdue goals appear in prompt with ⚠️', async () => {
    let promptText = ''
    const modules = {
      engine: {
        createSession: async () => ({ id: 'goal-sess-3' }),
        sendAndWait: async (sid, text) => { promptText = text; return { text: '' } },
      },
      telegram: { sendProactive: async () => ({ sent: 0, failed: 0 }) },
      pulse: {
        state: { knownChatIds: ['123'] },
        pulseState: { incrementUnresponsed: () => {} },
      },
      identity: createFakeIdentity(),
      goals: {
        getActive: () => [
          { id: 'g1', title: '过期任务', progress: 10, deadline: '2020-01-01' },
        ],
        getOverdue: () => [
          { id: 'g1', title: '过期任务', progress: 10, deadline: '2020-01-01' },
        ],
      },
    }
    await dispatch({ id: 'goal-check', action: 'goalCheck' }, modules)
    assert.ok(promptText.includes('⚠️超期'), 'overdue goals should be marked in prompt')
  })
})
