/**
 * Muse Configuration
 *
 * 三种模式（优先级从高到低）:
 *   1. MUSE_MEMBER_DIR mode — start.sh 直接传 member 目录绝对路径
 *      读取 {MUSE_MEMBER_DIR}/config.json
 *   2. FAMILY_HOME mode (legacy T21) — MUSE_HOME + MUSE_MEMBER
 *      读取 {MUSE_HOME}/members/{MUSE_MEMBER}/config.json
 *   3. Legacy mode — MUSE_HOME 未设置，读 .env
 */

import 'dotenv/config'  // Load .env into process.env (env vars override everything)

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadFamilyConfig, legacyConfig, getEngineUrl as _getEngineUrl, deepMerge, DEFAULTS } from './family/config-loader.mjs'

function loadMemberDirConfig(memberDir) {
  const configPath = join(memberDir, 'config.json')
  if (!existsSync(configPath)) {
    throw new Error(`nvwa config.json 未找到: ${configPath}`)
  }
  const memberConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  // 合并：defaults + member config + env overrides
  // 复用 config-loader 的 deepMerge 和 DEFAULTS
  const base = deepMerge(DEFAULTS, {
    engine: { workspace: memberDir },
    memory: { dbPath: join(memberDir, 'data', 'memory.db') },
    identity: {
      path: join(memberDir, 'data', 'identity.json'),
      role: memberConfig.role ?? null,  // T41-1: 传给 Identity 用于 fallback 身份
    },
    telegram: { imageDir: join(memberDir, 'data', 'images') },
    pulse: { stateDir: join(memberDir, 'data', 'pulse') },
    trace: { dir: join(memberDir, 'data', 'trace') },
  })
  // map config.json fields to internal format
  // TG-GROUP-001: 添加群聊广播配置
  const fromFile = {
    telegram: memberConfig.telegram ? {
      botToken: memberConfig.telegram.botToken,
      allowedUsers: memberConfig.telegram.allowedUsers || [],
      imageDir: join(memberDir, 'data', 'images'),
      // TG-GROUP-001: 群聊广播配置
      enableBroadcast: memberConfig.telegram.enableBroadcast ?? false,  // 默认false，向后兼容
      instanceId: memberConfig.telegram.instanceId,
      instanceCreatedAt: memberConfig.telegram.instanceCreatedAt,
    } : {},
    engine: memberConfig.engine || {},
    web: memberConfig.web || {},
    memory: memberConfig.memory || {},
    daemon: memberConfig.daemon || {},
    pulse: { enabled: memberConfig.pulse?.enabled ?? false },
  }
  return deepMerge(base, fromFile)
}

const memberDir = process.env.MUSE_MEMBER_DIR
const museHome = process.env.MUSE_HOME
const museFamily = process.env.MUSE_FAMILY
// MUSE_HOME=families/, MUSE_FAMILY=later-muse-family → families/later-muse-family
const familyHome = museHome && museFamily ? join(museHome, museFamily) : museHome
const memberName = process.env.MUSE_MEMBER || 'nvwa'

// ESM export must be top-level
export const config = memberDir
  ? loadMemberDirConfig(memberDir)
  : familyHome
    ? loadFamilyConfig(familyHome, memberName)
    : legacyConfig()


export function getEngineUrl() {
  return _getEngineUrl(config)
}

/** 校验配置，返回错误列表或 throw（不耦合 process.exit） */
export function validateConfig(cfg = config) {
  const errors = []
  if (!cfg.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required')
  if (!Number.isInteger(cfg.engine.port) || cfg.engine.port < 1 || cfg.engine.port > 65535) {
    errors.push(`OPENCODE_PORT invalid: ${cfg.engine.port}`)
  }
  if (!Number.isInteger(cfg.web.port) || cfg.web.port < 1 || cfg.web.port > 65535) {
    errors.push(`WEB_PORT invalid: ${cfg.web.port}`)
  }
  if (!Number.isFinite(cfg.daemon.heartbeatIntervalMs) || cfg.daemon.heartbeatIntervalMs < 5000) {
    errors.push('HEARTBEAT_INTERVAL must be >= 5000ms')
  }
  if (errors.length > 0) {
    throw new Error('Configuration errors:\n' + errors.map(e => `  - ${e}`).join('\n'))
  }
}
