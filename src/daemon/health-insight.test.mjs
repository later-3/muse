/**
 * T34: HealthInsight tests
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { HealthInsight, buildPrompt, parseInsightResponse, MIN_REPORTS } from './health-insight.mjs'

const TEST_DIR = join(import.meta.dirname, '.test-health-insight-' + process.pid)

/** Create a mock engine */
function createMockEngine(responseText = '{"status":"stable","reason":"All systems nominal","suggestion":"No action needed"}') {
  return {
    createSession: async () => ({ id: 'mock-session-' + Date.now() }),
    sendAndWait: async () => ({ text: responseText, model: 'mock' }),
  }
}

/** Create fake reports */
function fakeReports(count, overalls = []) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: `2026-03-${String(15 - i).padStart(2, '0')}T06:00:00.000Z`,
    overall: overalls[i] || '🟢',
    system: {
      engine: { status: overalls[i] || '🟢' },
      memory: { status: '🟢' },
    },
  }))
}

describe('HealthInsight', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  // --- buildPrompt ---

  it('buildPrompt includes all reports', () => {
    const reports = fakeReports(3)
    const prompt = buildPrompt(reports)
    assert.ok(prompt.includes('3 次体检报告'))
    assert.ok(prompt.includes('2026-03-15'))
    assert.ok(prompt.includes('2026-03-13'))
  })

  // --- parseInsightResponse ---

  it('parseInsightResponse parses valid JSON', () => {
    const result = parseInsightResponse('{"status":"degrading","reason":"Engine unstable","suggestion":"Check OpenCode"}')
    assert.equal(result.status, 'degrading')
    assert.equal(result.reason, 'Engine unstable')
    assert.equal(result.suggestion, 'Check OpenCode')
  })

  it('parseInsightResponse extracts JSON from mixed text', () => {
    const result = parseInsightResponse('Analysis:\n{"status":"stable","reason":"OK","suggestion":"None"}\nEnd.')
    assert.equal(result.status, 'stable')
  })

  it('parseInsightResponse returns null for empty input', () => {
    assert.equal(parseInsightResponse(''), null)
    assert.equal(parseInsightResponse(null), null)
  })

  it('parseInsightResponse returns null for invalid JSON', () => {
    assert.equal(parseInsightResponse('not json at all'), null)
  })

  it('parseInsightResponse returns null for missing required fields', () => {
    assert.equal(parseInsightResponse('{"foo":"bar"}'), null)
  })

  it('parseInsightResponse normalizes unknown status to stable', () => {
    const result = parseInsightResponse('{"status":"unknown","reason":"test","suggestion":"test"}')
    assert.equal(result.status, 'stable')
  })

  // --- generate ---

  it('generate returns null when reports < MIN_REPORTS', async () => {
    const hi = new HealthInsight({ insightDir: TEST_DIR, engine: createMockEngine() })
    const result = await hi.generate(fakeReports(2))
    assert.equal(result, null)
  })

  it('generate returns null for empty array', async () => {
    const hi = new HealthInsight({ insightDir: TEST_DIR, engine: createMockEngine() })
    assert.equal(await hi.generate([]), null)
    assert.equal(await hi.generate(null), null)
  })

  it('generate calls AI and returns structured insight', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('{"status":"degrading","reason":"Engine flaky","suggestion":"Restart OpenCode"}'),
    })

    const result = await hi.generate(fakeReports(3, ['🔴', '🟡', '🟢']))
    assert.equal(result.status, 'degrading')
    assert.equal(result.reason, 'Engine flaky')
    assert.equal(result.suggestion, 'Restart OpenCode')
    assert.ok(result.timestamp)
    assert.equal(result.reportCount, 3)
  })

  it('generate saves insight to file', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine(),
    })

    await hi.generate(fakeReports(3))
    const files = readdirSync(TEST_DIR).filter(f => f.startsWith('insight-'))
    assert.equal(files.length, 1)
  })

  it('generate returns null when AI returns garbage', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('I cannot analyze this'),
    })

    const result = await hi.generate(fakeReports(3))
    assert.equal(result, null)
  })

  it('generate creates directory if missing', async () => {
    const subDir = join(TEST_DIR, 'deep', 'nested')
    const hi = new HealthInsight({
      insightDir: subDir,
      engine: createMockEngine(),
    })

    await hi.generate(fakeReports(3))
    assert.ok(existsSync(subDir))
  })

  // --- getLatest ---

  it('getLatest returns null when no insights exist', () => {
    const hi = new HealthInsight({ insightDir: TEST_DIR, engine: createMockEngine() })
    assert.equal(hi.getLatest(), null)
  })

  it('getLatest returns null when dir does not exist', () => {
    const hi = new HealthInsight({ insightDir: join(TEST_DIR, 'nonexistent'), engine: createMockEngine() })
    assert.equal(hi.getLatest(), null)
  })

  it('getLatest returns most recent insight after generate', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('{"status":"improving","reason":"Recovery","suggestion":"Monitor"}'),
    })

    await hi.generate(fakeReports(3))
    const latest = hi.getLatest()
    assert.equal(latest.status, 'improving')
    assert.equal(latest.reason, 'Recovery')
  })

  // --- E2E ---

  it('E2E: generate → save → getLatest full chain', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('{"status":"degrading","reason":"Memory pressure","suggestion":"Run vacuum"}'),
    })

    // Generate insight from 5 reports
    const reports = fakeReports(5, ['🔴', '🟡', '🟡', '🟢', '🟢'])
    const insight = await hi.generate(reports)

    assert.ok(insight, 'should generate insight')
    assert.equal(insight.status, 'degrading')
    assert.equal(insight.reportCount, 5)

    // Verify persisted
    const latest = hi.getLatest()
    assert.deepEqual(latest.status, insight.status)
    assert.deepEqual(latest.reason, insight.reason)

    // Verify file on disk
    const files = readdirSync(TEST_DIR).filter(f => f.endsWith('.json'))
    assert.equal(files.length, 1)
  })

  // --- Integration: selfCheck → insight → sendProactive chain (simulates index.mjs onTrigger) ---

  it('Integration: degrading insight triggers sendProactive with chatIds', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('{"status":"degrading","reason":"Engine flaky","suggestion":"Check OpenCode"}'),
    })

    // Simulate the chain from index.mjs onTrigger:
    // 1. healthHistory.list(5) returns reports
    const reports = fakeReports(5, ['🔴', '🔴', '🟡', '🟢', '🟢'])

    // 2. healthInsight.generate(reports)
    const insight = await hi.generate(reports)
    assert.ok(insight)
    assert.equal(insight.status, 'degrading')

    // 3. If degrading, call sendProactive with chatIds from pulse.state
    const sentMessages = []
    const mockTelegram = {
      sendProactive: async (text, { chatIds }) => {
        sentMessages.push({ text, chatIds })
        return { sent: chatIds.length, failed: 0 }
      },
    }
    const mockPulseState = { knownChatIds: ['chat-123', 'chat-456'] }

    // This is the exact logic from index.mjs L110-L116
    if (insight.status === 'degrading') {
      const chatIds = mockPulseState.knownChatIds || []
      const msg = `😟 最近体检不太好: ${insight.reason}\n💡 ${insight.suggestion}`
      await mockTelegram.sendProactive(msg, { chatIds })
    }

    // Verify sendProactive was called with correct args
    assert.equal(sentMessages.length, 1)
    assert.deepEqual(sentMessages[0].chatIds, ['chat-123', 'chat-456'])
    assert.ok(sentMessages[0].text.includes('Engine flaky'))
    assert.ok(sentMessages[0].text.includes('Check OpenCode'))
  })

  it('Integration: stable insight does NOT trigger sendProactive', async () => {
    const hi = new HealthInsight({
      insightDir: TEST_DIR,
      engine: createMockEngine('{"status":"stable","reason":"All good","suggestion":"None"}'),
    })

    const reports = fakeReports(3)
    const insight = await hi.generate(reports)
    assert.ok(insight)
    assert.equal(insight.status, 'stable')

    // Stable should not trigger notification
    const sentMessages = []
    const mockTelegram = {
      sendProactive: async (text, { chatIds }) => {
        sentMessages.push({ text, chatIds })
        return { sent: chatIds.length, failed: 0 }
      },
    }

    if (insight.status === 'degrading') {
      await mockTelegram.sendProactive('test', { chatIds: ['123'] })
    }

    assert.equal(sentMessages.length, 0, 'stable insight should not trigger notification')
  })
})
