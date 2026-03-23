import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { legacyConfig } from './family/config-loader.mjs'

describe('config', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TELEGRAM_') || key.startsWith('OPENCODE_') ||
          key.startsWith('DEFAULT_') || key.startsWith('HEAVY_') ||
          key.startsWith('MEMORY_') || key.startsWith('WEB_') ||
          key.startsWith('IDENTITY_') || key.startsWith('HEARTBEAT_') ||
          key.startsWith('MAX_') || key === 'MUSE_HOME' || key === 'MUSE_MEMBER') {
        delete process.env[key]
      }
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should have correct default values (legacy mode)', () => {
    const config = legacyConfig()
    assert.equal(config.engine.host, 'http://127.0.0.1')
    assert.equal(config.engine.port, 4096)
    assert.equal(config.web.port, 4097)
    assert.equal(config.memory.maxEpisodicDays, 90)
    assert.equal(config.daemon.heartbeatIntervalMs, 30000)
    assert.equal(config.daemon.maxFailures, 3)
  })

  it('getEngineUrl should return correct URL', async () => {
    const { getEngineUrl } = await import('./config.mjs')
    assert.equal(getEngineUrl(), 'http://127.0.0.1:4096')
  })

  it('should parse allowedUsers as trimmed array', () => {
    process.env.TELEGRAM_ALLOWED_USERS = '123, 456 , 789'
    const config = legacyConfig()
    assert.deepEqual(config.telegram.allowedUsers, ['123', '456', '789'])
  })

  it('should return empty array for empty allowedUsers', () => {
    process.env.TELEGRAM_ALLOWED_USERS = ''
    const config = legacyConfig()
    assert.deepEqual(config.telegram.allowedUsers, [])
  })

  it('validateConfig should throw on missing bot token', async () => {
    const { validateConfig } = await import('./config.mjs')
    const badConfig = legacyConfig()
    badConfig.telegram.botToken = ''
    assert.throws(() => validateConfig(badConfig), /TELEGRAM_BOT_TOKEN is required/)
  })

  it('validateConfig should pass with valid config', async () => {
    const { validateConfig } = await import('./config.mjs')
    const goodConfig = legacyConfig()
    goodConfig.telegram.botToken = 'test-token'
    // Should not throw
    validateConfig(goodConfig)
  })

  it('should have imageDir in legacy config', () => {
    const config = legacyConfig()
    assert.equal(config.telegram.imageDir, './data/images')
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
