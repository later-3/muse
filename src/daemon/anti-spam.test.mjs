/**
 * T32: Anti-Spam tests
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shouldAllow, isQuietHour } from './anti-spam.mjs'

describe('anti-spam', () => {
  describe('shouldAllow', () => {
    it('allows when all conditions normal', () => {
      const state = { dnd: false, unresponsedCount: 0, lastProactiveAt: null, triggerHistory: {} }
      const config = { quietHours: { start: 99, end: 99 }, maxPerHour: 2 }
      const trigger = { id: 'test', interval: 3600_000 }
      const result = shouldAllow(state, config, trigger)
      assert.equal(result.allowed, true)
    })

    it('blocks when dnd=true', () => {
      const state = { dnd: true }
      const result = shouldAllow(state, {}, { id: 'test' })
      assert.equal(result.allowed, false)
      assert.equal(result.reason, 'dnd')
    })

    it('allows when skipAntiSpam=true (even with dnd)', () => {
      const state = { dnd: true }
      const result = shouldAllow(state, {}, { id: 'health', skipAntiSpam: true })
      assert.equal(result.allowed, true)
    })

    it('blocks during quiet hours', () => {
      // Mock: we test isQuietHour directly instead
      const state = { dnd: false, unresponsedCount: 0, triggerHistory: {} }
      const config = { quietHours: { start: 0, end: 24 }, maxPerHour: 2 } // always quiet
      const result = shouldAllow(state, config, { id: 'test' })
      assert.equal(result.allowed, false)
      assert.equal(result.reason, 'quiet_hours')
    })

    it('blocks when rate limited', () => {
      const now = Date.now()
      const state = {
        dnd: false,
        unresponsedCount: 0,
        lastProactiveAt: new Date(now - 60_000).toISOString(), // 1 min ago
        triggerHistory: {
          a: new Date(now - 30_000).toISOString(),
          b: new Date(now - 20_000).toISOString(),
        },
      }
      const config = { quietHours: { start: 99, end: 99 }, maxPerHour: 2 } // no quiet hours
      const result = shouldAllow(state, config, { id: 'test' })
      assert.equal(result.allowed, false)
      assert.equal(result.reason, 'rate_limited')
    })

    it('blocks with frequency reduction (unresponsed >= 3)', () => {
      const now = Date.now()
      const state = {
        dnd: false,
        unresponsedCount: 3,
        lastProactiveAt: new Date(now - 1000).toISOString(), // 1s ago
        triggerHistory: {},
      }
      const config = { quietHours: { start: 99, end: 99 }, maxPerHour: 100 }
      const trigger = { id: 'test', interval: 3600_000 } // 1h, effective = 2h
      const result = shouldAllow(state, config, trigger)
      assert.equal(result.allowed, false)
      assert.equal(result.reason, 'frequency_reduced')
    })

    it('blocks with max frequency reduction (unresponsed >= 6)', () => {
      const now = Date.now()
      const state = {
        dnd: false,
        unresponsedCount: 7,
        lastProactiveAt: new Date(now - 1000).toISOString(),
        triggerHistory: {},
      }
      const config = { quietHours: { start: 99, end: 99 }, maxPerHour: 100 }
      const trigger = { id: 'test', interval: 3600_000 } // effective = 4h
      const result = shouldAllow(state, config, trigger)
      assert.equal(result.allowed, false)
      assert.equal(result.reason, 'frequency_reduced')
    })

    it('allows frequency-reduced trigger after enough time', () => {
      const now = Date.now()
      const state = {
        dnd: false,
        unresponsedCount: 3,
        lastProactiveAt: new Date(now - 8_000_000).toISOString(), // ~2.2h ago
        triggerHistory: {},
      }
      const config = { quietHours: { start: 99, end: 99 }, maxPerHour: 100 }
      const trigger = { id: 'test', interval: 3600_000 } // effective = 2h, 2.2h elapsed → allow
      const result = shouldAllow(state, config, trigger)
      assert.equal(result.allowed, true)
    })
  })

  describe('isQuietHour', () => {
    it('handles wrap-around (23→7)', () => {
      assert.equal(isQuietHour(23, 23, 7), true)
      assert.equal(isQuietHour(0, 23, 7), true)
      assert.equal(isQuietHour(3, 23, 7), true)
      assert.equal(isQuietHour(6, 23, 7), true)
      assert.equal(isQuietHour(7, 23, 7), false)
      assert.equal(isQuietHour(12, 23, 7), false)
      assert.equal(isQuietHour(22, 23, 7), false)
    })

    it('handles same-day range (9→17)', () => {
      assert.equal(isQuietHour(9, 9, 17), true)
      assert.equal(isQuietHour(12, 9, 17), true)
      assert.equal(isQuietHour(16, 9, 17), true)
      assert.equal(isQuietHour(17, 9, 17), false)
      assert.equal(isQuietHour(8, 9, 17), false)
    })
  })

  // --- E2E: replicate actual onTrigger chain from index.mjs ---

  describe('E2E: onTrigger → shouldAllow → dispatch chain', () => {
    /**
     * Simulates the real onTrigger chain from index.mjs:
     *   1. shouldAllow(pulse.state, cfg.pulse, trigger)
     *   2. if blocked → return (dispatch NOT called)
     *   3. if allowed → dispatch(trigger, modules)
     */
    async function simulateOnTrigger(trigger, pulseState, pulseConfig, dispatchFn) {
      // Step 1: Anti-Spam guard (mirrors index.mjs#L76-L86)
      const check = shouldAllow(pulseState, pulseConfig, trigger)
      if (!check.allowed) {
        return { dispatched: false, reason: check.reason }
      }

      // Step 2: dispatch (mirrors index.mjs#L103-L109)
      await dispatchFn(trigger)
      return { dispatched: true }
    }

    it('dnd=true → onTrigger blocks, dispatch NOT called', async () => {
      const calls = []
      const result = await simulateOnTrigger(
        { id: 'greet', interval: 3600_000, action: 'greet' },
        { dnd: true },  // PulseState
        {},              // Config
        async () => { calls.push('dispatch') },
      )

      assert.equal(result.dispatched, false)
      assert.equal(result.reason, 'dnd')
      assert.equal(calls.length, 0, 'dispatch should not be called')
    })

    it('normal state → onTrigger allows, dispatch IS called', async () => {
      const calls = []
      const result = await simulateOnTrigger(
        { id: 'greet', interval: 3600_000, action: 'greet' },
        { dnd: false, unresponsedCount: 0, triggerHistory: {} },
        { quietHours: { start: 99, end: 99 }, maxPerHour: 10 },
        async (trigger) => { calls.push({ dispatch: trigger.id }) },
      )

      assert.equal(result.dispatched, true)
      assert.deepEqual(calls, [{ dispatch: 'greet' }])
    })

    it('skipAntiSpam → onTrigger allows even with all guards failing', async () => {
      const calls = []
      const result = await simulateOnTrigger(
        { id: 'health-check', skipAntiSpam: true, action: 'selfCheck' },
        { dnd: true, unresponsedCount: 99 },  // everything blocked
        { quietHours: { start: 0, end: 24 }, maxPerHour: 0 },
        async (trigger) => { calls.push({ dispatch: trigger.id }) },
      )

      assert.equal(result.dispatched, true)
      assert.deepEqual(calls, [{ dispatch: 'health-check' }])
    })

    it('rate limited → onTrigger blocks, dispatch NOT called', async () => {
      const now = Date.now()
      const calls = []
      const result = await simulateOnTrigger(
        { id: 'greet', interval: 3600_000, action: 'greet' },
        {
          dnd: false,
          unresponsedCount: 0,
          lastProactiveAt: new Date(now - 60_000).toISOString(),
          triggerHistory: {
            a: new Date(now - 30_000).toISOString(),
            b: new Date(now - 20_000).toISOString(),
          },
        },
        { quietHours: { start: 99, end: 99 }, maxPerHour: 2 },
        async () => { calls.push('dispatch') },
      )

      assert.equal(result.dispatched, false)
      assert.equal(result.reason, 'rate_limited')
      assert.equal(calls.length, 0)
    })

    it('frequency reduced → onTrigger blocks until enough time passes', async () => {
      const now = Date.now()
      const calls = []

      // 1st: too recent → blocked
      const result1 = await simulateOnTrigger(
        { id: 'greet', interval: 3600_000, action: 'greet' },
        { dnd: false, unresponsedCount: 3, lastProactiveAt: new Date(now - 1000).toISOString(), triggerHistory: {} },
        { quietHours: { start: 99, end: 99 }, maxPerHour: 100 },
        async () => { calls.push('dispatch') },
      )
      assert.equal(result1.dispatched, false)
      assert.equal(result1.reason, 'frequency_reduced')

      // 2nd: enough time → allowed
      const result2 = await simulateOnTrigger(
        { id: 'greet', interval: 3600_000, action: 'greet' },
        { dnd: false, unresponsedCount: 3, lastProactiveAt: new Date(now - 8_000_000).toISOString(), triggerHistory: {} },
        { quietHours: { start: 99, end: 99 }, maxPerHour: 100 },
        async () => { calls.push('dispatch') },
      )
      assert.equal(result2.dispatched, true)
      assert.equal(calls.length, 1, 'dispatch called only on 2nd attempt')
    })
  })
})
