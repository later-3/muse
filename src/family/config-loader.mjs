/**
 * T21: Family Config Loader
 *
 * 4-layer config loading:
 *   1. Hardcoded defaults
 *   2. FAMILY_HOME/config.json (family-level)
 *   3. FAMILY_HOME/members/{name}/config.json (member-level)
 *   4. process.env overrides
 *
 * Usage:
 *   import { loadFamilyConfig, legacyConfig, DEFAULTS } from './config-loader.mjs'
 *   const config = loadFamilyConfig('~/.muse', 'nvwa')
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// --- Layer 1: Hardcoded Defaults ---

export const DEFAULTS = {
  telegram: {
    botToken: '',
    allowedUsers: [],
    imageDir: '',  // resolved later based on member path
  },
  engine: {
    host: 'http://127.0.0.1',
    port: 4096,
    workspace: process.cwd(),
    defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    heavyModel: { providerID: 'anthropic', modelID: 'claude-sonnet-4-20250514' },
  },
  memory: {
    dbPath: '',    // resolved later
    maxEpisodicDays: 90,
  },
  identity: {
    path: '',      // resolved later
  },
  web: {
    port: 4097,
    host: '127.0.0.1',
  },
  daemon: {
    heartbeatIntervalMs: 30_000,
    maxFailures: 3,
  },
  pulse: {
    enabled: false,
    stateDir: '',  // resolved later based on member path
    quietHours: { start: 23, end: 7 },
    maxPerHour: 2,
  },
  trace: {
    dir: '',       // resolved later based on member path
  },
}

// --- Helpers ---

/**
 * Deep merge objects. Later values override earlier ones.
 * Only merges plain objects, arrays and primitives are replaced.
 */
export function deepMerge(target, ...sources) {
  const result = { ...target }
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value) &&
          result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(result[key], value)
      } else if (value !== undefined) {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * Read and parse a JSON file. Returns null if file doesn't exist.
 * Throws on JSON parse error (corrupted file should not be silently skipped).
 */
function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (e) {
    throw new Error(`配置文件损坏: ${filePath} — ${e.message}`)
  }
}

/**
 * Extract known config keys from process.env.
 * Only includes keys that are actually set (not undefined).
 */
function envOverrides() {
  const overrides = {}

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN !== undefined) {
    overrides.telegram = overrides.telegram || {}
    overrides.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN
  }
  if (process.env.TELEGRAM_ALLOWED_USERS !== undefined) {
    overrides.telegram = overrides.telegram || {}
    overrides.telegram.allowedUsers = process.env.TELEGRAM_ALLOWED_USERS
      .split(',').filter(Boolean).map(id => id.trim())
  }

  // Engine
  if (process.env.OPENCODE_HOST) {
    overrides.engine = overrides.engine || {}
    overrides.engine.host = process.env.OPENCODE_HOST
  }
  if (process.env.OPENCODE_PORT) {
    overrides.engine = overrides.engine || {}
    overrides.engine.port = parseInt(process.env.OPENCODE_PORT, 10)
  }
  if (process.env.OPENCODE_WORKSPACE) {
    overrides.engine = overrides.engine || {}
    overrides.engine.workspace = process.env.OPENCODE_WORKSPACE
  }
  if (process.env.DEFAULT_PROVIDER) {
    overrides.engine = overrides.engine || {}
    overrides.engine.defaultModel = overrides.engine.defaultModel || {}
    overrides.engine.defaultModel.providerID = process.env.DEFAULT_PROVIDER
  }
  if (process.env.DEFAULT_MODEL) {
    overrides.engine = overrides.engine || {}
    overrides.engine.defaultModel = overrides.engine.defaultModel || {}
    overrides.engine.defaultModel.modelID = process.env.DEFAULT_MODEL
  }

  // Heavy model
  if (process.env.HEAVY_PROVIDER) {
    overrides.engine = overrides.engine || {}
    overrides.engine.heavyModel = overrides.engine.heavyModel || {}
    overrides.engine.heavyModel.providerID = process.env.HEAVY_PROVIDER
  }
  if (process.env.HEAVY_MODEL) {
    overrides.engine = overrides.engine || {}
    overrides.engine.heavyModel = overrides.engine.heavyModel || {}
    overrides.engine.heavyModel.modelID = process.env.HEAVY_MODEL
  }

  // Memory
  if (process.env.MEMORY_DB_PATH) {
    overrides.memory = overrides.memory || {}
    overrides.memory.dbPath = process.env.MEMORY_DB_PATH
  }
  if (process.env.MAX_EPISODIC_DAYS) {
    overrides.memory = overrides.memory || {}
    overrides.memory.maxEpisodicDays = parseInt(process.env.MAX_EPISODIC_DAYS, 10)
  }

  // Identity
  if (process.env.IDENTITY_PATH) {
    overrides.identity = overrides.identity || {}
    overrides.identity.path = process.env.IDENTITY_PATH
  }

  // Web
  if (process.env.WEB_PORT) {
    overrides.web = overrides.web || {}
    overrides.web.port = parseInt(process.env.WEB_PORT, 10)
  }
  if (process.env.WEB_HOST) {
    overrides.web = overrides.web || {}
    overrides.web.host = process.env.WEB_HOST
  }

  // Daemon
  if (process.env.HEARTBEAT_INTERVAL) {
    overrides.daemon = overrides.daemon || {}
    overrides.daemon.heartbeatIntervalMs = parseInt(process.env.HEARTBEAT_INTERVAL, 10)
  }
  if (process.env.MAX_HEARTBEAT_FAILURES) {
    overrides.daemon = overrides.daemon || {}
    overrides.daemon.maxFailures = parseInt(process.env.MAX_HEARTBEAT_FAILURES, 10)
  }

  // Pulse
  if (process.env.PULSE_ENABLED !== undefined) {
    overrides.pulse = overrides.pulse || {}
    overrides.pulse.enabled = process.env.PULSE_ENABLED === 'true'
  }

  return overrides
}

/**
 * Resolve member-specific data paths to absolute paths.
 * Called after merge to fill in paths based on FAMILY_HOME + member name.
 */
function resolveMemberPaths(config, familyHome, memberName) {
  const memberDir = join(familyHome, 'members', memberName)

  // Only fill paths that aren't already set (env override takes precedence)
  if (!config.memory.dbPath) {
    config.memory.dbPath = join(memberDir, 'memory', 'memory.db')
  }
  if (!config.identity.path) {
    config.identity.path = join(memberDir, 'identity', 'identity.json')
  }
  if (!config.telegram.imageDir) {
    config.telegram.imageDir = join(memberDir, 'memory', 'attachments')
  }
  if (!config.pulse.stateDir) {
    config.pulse.stateDir = join(memberDir, 'pulse')
  }
  if (!config.trace.dir) {
    config.trace.dir = join(memberDir, 'trace')
  }

  return config
}

// --- Public API ---

/**
 * Load config using 4-layer strategy from FAMILY_HOME.
 *
 * @param {string} familyHome - Absolute path to FAMILY_HOME directory
 * @param {string} memberName - Member name (default: 'nvwa')
 * @returns {object} Merged config object
 * @throws {Error} If FAMILY_HOME doesn't exist or family.json is missing
 */
export function loadFamilyConfig(familyHome, memberName = 'nvwa') {
  const absHome = resolve(familyHome)

  // Validate FAMILY_HOME exists
  if (!existsSync(absHome)) {
    throw new Error(`MUSE_HOME 指向的目录不存在: ${absHome}`)
  }

  // Validate family.json exists
  const familyJsonPath = join(absHome, 'family.json')
  if (!existsSync(familyJsonPath)) {
    throw new Error(`无效的 FAMILY_HOME: 缺少 family.json — ${absHome}`)
  }

  // Layer 1: defaults
  const defaults = structuredClone(DEFAULTS)

  // Layer 2: family config
  const familyConfigPath = join(absHome, 'config.json')
  const familyConfig = readJsonFile(familyConfigPath) || {}

  // Layer 3: member config
  const memberConfigPath = join(absHome, 'members', memberName, 'config.json')
  const memberConfig = readJsonFile(memberConfigPath) || {}

  // Layer 4: env overrides
  const env = envOverrides()

  // Merge all layers
  const merged = deepMerge(defaults, familyConfig, memberConfig, env)

  // Resolve member data paths (only fill empty ones)
  resolveMemberPaths(merged, absHome, memberName)

  return merged
}

/**
 * Legacy config loader — used when MUSE_HOME is not set.
 * Mirrors the original config.mjs behavior exactly.
 *
 * @returns {object} Config object compatible with the original format
 */
export function legacyConfig() {
  // import 'dotenv/config' is handled by the caller (config.mjs)
  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '')
        .split(',').filter(Boolean).map(id => id.trim()),
      imageDir: './data/images',
    },
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
    memory: {
      dbPath: process.env.MEMORY_DB_PATH || './data/memory.db',
      maxEpisodicDays: parseInt(process.env.MAX_EPISODIC_DAYS || '90', 10),
    },
    identity: {
      path: process.env.IDENTITY_PATH || './data/identity.json',
    },
    web: {
      port: parseInt(process.env.WEB_PORT || '4097', 10),
      host: process.env.WEB_HOST || '127.0.0.1',
    },
    daemon: {
      heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
      maxFailures: parseInt(process.env.MAX_HEARTBEAT_FAILURES || '3', 10),
    },
    pulse: {
      enabled: process.env.PULSE_ENABLED !== 'false',  // 默认启用，明确 PULSE_ENABLED=false 才禁用
      stateDir: './data/pulse',
    },
  }
}

/**
 * Get engine URL from config.
 */
export function getEngineUrl(config) {
  return `${config.engine.host}:${config.engine.port}`
}
