import 'dotenv/config'

export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '')
      .split(',').filter(Boolean).map(id => id.trim()),
  },

  // OpenCode Engine
  engine: {
    host: process.env.OPENCODE_HOST || 'http://127.0.0.1',
    port: parseInt(process.env.OPENCODE_PORT || '4096', 10),
    workspace: process.env.OPENCODE_WORKSPACE || process.cwd(),
    defaultModel: {
      providerID: process.env.DEFAULT_PROVIDER || 'google',
      modelID: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
    },
    heavyModel: {
      providerID: process.env.HEAVY_PROVIDER || 'anthropic',
      modelID: process.env.HEAVY_MODEL || 'claude-sonnet-4-20250514',
    },
  },

  // Memory
  memory: {
    dbPath: process.env.MEMORY_DB_PATH || './muse/data/memory.db',
    maxEpisodicDays: parseInt(process.env.MAX_EPISODIC_DAYS || '90', 10),
  },

  // Web Cockpit
  web: {
    enabled: process.env.WEB_ENABLED !== 'false',
    port: parseInt(process.env.WEB_PORT || '4097', 10),
    host: process.env.WEB_HOST || '127.0.0.1',
  },

  // Identity
  identity: {
    path: process.env.IDENTITY_PATH || './muse/data/identity.json',
  },

  // Daemon
  daemon: {
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    maxFailures: parseInt(process.env.MAX_HEARTBEAT_FAILURES || '3', 10),
  },
}

export function getEngineUrl() {
  return `${config.engine.host}:${config.engine.port}`
}

/** 校验配置，返回错误列表或 throw（不耦合 process.exit） */
export function validateConfig() {
  const errors = []
  if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required')
  // TELEGRAM_ALLOWED_USERS 留空 = 开发模式 (允许所有用户)
  if (!Number.isInteger(config.engine.port) || config.engine.port < 1 || config.engine.port > 65535) {
    errors.push(`OPENCODE_PORT invalid: ${config.engine.port}`)
  }
  if (!Number.isInteger(config.web.port) || config.web.port < 1 || config.web.port > 65535) {
    errors.push(`WEB_PORT invalid: ${config.web.port}`)
  }
  if (!Number.isFinite(config.daemon.heartbeatIntervalMs) || config.daemon.heartbeatIntervalMs < 5000) {
    errors.push('HEARTBEAT_INTERVAL must be >= 5000ms')
  }
  if (errors.length > 0) {
    throw new Error('Configuration errors:\n' + errors.map(e => `  - ${e}`).join('\n'))
  }
}
