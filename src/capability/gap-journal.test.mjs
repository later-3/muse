/**
 * T16: GapJournal + Ingress 联动测试
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { GapJournal } from './gap-journal.mjs'
import { PerceptionIngress } from '../perception/ingress.mjs'
import { createPerception } from '../perception/types.mjs'
import { CapabilityRegistry } from './registry.mjs'

// ─── GapJournal 单元测试 ───

describe('T16: GapJournal', () => {
  it('record() 记录缺口并返回 entry', () => {
    const journal = new GapJournal()
    const entry = journal.record({ type: 'audio', source: 'telegram', userId: '123', reason: 'unsupported' })

    assert.ok(entry.id.startsWith('gap-'))
    assert.equal(entry.type, 'audio')
    assert.equal(entry.source, 'telegram')
    assert.equal(entry.reason, 'unsupported')
    assert.ok(entry.timestamp)
  })

  it('record() 无 type → throw', () => {
    const journal = new GapJournal()
    assert.throws(() => journal.record({ source: 'telegram' }), /type/)
  })

  it('list() 返回所有记录', () => {
    const journal = new GapJournal()
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'video', source: 'telegram' })
    journal.record({ type: 'audio', source: 'web' })

    assert.equal(journal.list().length, 3)
  })

  it('list() 支持按 type 筛选', () => {
    const journal = new GapJournal()
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'video', source: 'telegram' })

    const audioGaps = journal.list({ type: 'audio' })
    assert.equal(audioGaps.length, 1)
    assert.equal(audioGaps[0].type, 'audio')
  })

  it('list() 支持按 source 筛选', () => {
    const journal = new GapJournal()
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'audio', source: 'web' })

    const tgGaps = journal.list({ source: 'telegram' })
    assert.equal(tgGaps.length, 1)
  })

  it('stats() 返回统计', () => {
    const journal = new GapJournal()
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'video', source: 'web' })

    const stats = journal.stats()
    assert.equal(stats.total, 3)
    assert.equal(stats.byType.audio, 2)
    assert.equal(stats.byType.video, 1)
    assert.equal(stats.bySource.telegram, 2)
    assert.equal(stats.bySource.web, 1)
  })

  it('summary() 空记录 → 友好提示', () => {
    const journal = new GapJournal()
    assert.ok(journal.summary().includes('暂无'))
  })

  it('summary() 有记录 → 包含统计', () => {
    const journal = new GapJournal()
    journal.record({ type: 'audio', source: 'telegram' })
    journal.record({ type: 'video', source: 'telegram' })

    const summary = journal.summary()
    assert.ok(summary.includes('2'))
    assert.ok(summary.includes('audio'))
  })

  it('record() 带 Registry 丰富上下文', () => {
    const registry = new CapabilityRegistry()
    registry.registerSense({ id: 'telegram_audio', label: '语音', status: 'unavailable' })

    const journal = new GapJournal({ registry })
    const entry = journal.record({ type: 'audio', source: 'telegram' })

    assert.ok(entry.registryInfo)
    assert.equal(entry.registryInfo.senseId, 'telegram_audio')
    assert.equal(entry.registryInfo.status, 'unavailable')
  })
})

// ─── Ingress + GapJournal 联动测试 ───

describe('T16: Ingress → GapJournal 联动', () => {
  it('不支持类型 → 自动记录 Gap', async () => {
    const mockOrch = {
      handleMessage: mock.fn(async () => ({ text: 'ok', sessionId: null })),
    }
    const journal = new GapJournal()
    const ingress = new PerceptionIngress({ orchestrator: mockOrch, gapJournal: journal })

    const perception = createPerception('telegram', 'audio', 'user1', { textFallback: '语音' })
    await ingress.handle(perception)

    const gaps = journal.list()
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].type, 'audio')
    assert.equal(gaps[0].source, 'telegram')
    assert.equal(gaps[0].reason, 'unsupported')
  })

  it('支持类型 (text) → 不记录 Gap', async () => {
    const mockOrch = {
      handleMessage: mock.fn(async () => ({ text: 'reply', sessionId: 'sess' })),
    }
    const journal = new GapJournal()
    const ingress = new PerceptionIngress({ orchestrator: mockOrch, gapJournal: journal })

    const perception = createPerception('telegram', 'text', 'user1', { text: '你好' })
    await ingress.handle(perception)

    assert.equal(journal.list().length, 0, 'text 不应产生 Gap')
  })

  it('多次不支持 → Gap 累计', async () => {
    const mockOrch = {
      handleMessage: mock.fn(async () => ({ text: 'ok', sessionId: null })),
    }
    const journal = new GapJournal()
    const ingress = new PerceptionIngress({ orchestrator: mockOrch, gapJournal: journal })

    await ingress.handle(createPerception('telegram', 'audio', 'u1', { textFallback: '语音' }))
    await ingress.handle(createPerception('telegram', 'video', 'u2', { textFallback: '视频' }))
    await ingress.handle(createPerception('telegram', 'audio', 'u1', { textFallback: '又一条语音' }))

    assert.equal(journal.list().length, 3)
    assert.equal(journal.stats().byType.audio, 2)
    assert.equal(journal.stats().byType.video, 1)
  })
})
