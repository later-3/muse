import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

describe('config', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset modules for each test
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TELEGRAM_') || key.startsWith('OPENCODE_') ||
          key.startsWith('DEFAULT_') || key.startsWith('HEAVY_') ||
          key.startsWith('MEMORY_') || key.startsWith('WEB_') ||
          key.startsWith('IDENTITY_') || key.startsWith('HEARTBEAT_') ||
          key.startsWith('MAX_')) {
        delete process.env[key]
      }
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should have correct default values', async () => {
    const { config } = await import('./config.mjs?t=' + Date.now())
    assert.equal(config.engine.host, 'http://127.0.0.1')
    assert.equal(config.engine.port, 4096)
    assert.equal(config.web.port, 4097)
    assert.equal(config.memory.maxEpisodicDays, 90)
    assert.equal(config.daemon.heartbeatIntervalMs, 30000)
    assert.equal(config.daemon.maxFailures, 3)
  })

  it('getEngineUrl should return correct URL', async () => {
    const { getEngineUrl } = await import('./config.mjs?t=' + Date.now())
    assert.equal(getEngineUrl(), 'http://127.0.0.1:4096')
  })

  it('should parse allowedUsers as trimmed array', async () => {
    process.env.TELEGRAM_ALLOWED_USERS = '123, 456 , 789'
    const { config } = await import('./config.mjs?t=' + Date.now())
    assert.deepEqual(config.telegram.allowedUsers, ['123', '456', '789'])
  })

  it('should return empty array for empty allowedUsers', async () => {
    process.env.TELEGRAM_ALLOWED_USERS = ''
    const { config } = await import('./config.mjs?t=' + Date.now())
    assert.deepEqual(config.telegram.allowedUsers, [])
  })

  it('validateConfig should throw on missing bot token', async () => {
    process.env.TELEGRAM_BOT_TOKEN = ''
    process.env.TELEGRAM_ALLOWED_USERS = '123'
    const { validateConfig } = await import('./config.mjs?t=' + Date.now())
    assert.throws(() => validateConfig(), /TELEGRAM_BOT_TOKEN is required/)
  })

  it('validateConfig should pass with valid config', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_ALLOWED_USERS = '123'
    const { validateConfig } = await import('./config.mjs?t=' + Date.now())
    // Should not throw
    validateConfig()
  })
})

describe('logger', () => {
  it('should create logger with default module', async () => {
    const { log } = await import('./logger.mjs')
    assert.equal(typeof log.info, 'function')
    assert.equal(typeof log.debug, 'function')
    assert.equal(typeof log.warn, 'function')
    assert.equal(typeof log.error, 'function')
  })

  it('should create logger with custom module name', async () => {
    const { createLogger } = await import('./logger.mjs')
    const engineLog = createLogger('engine')
    assert.equal(typeof engineLog.info, 'function')
  })
})
