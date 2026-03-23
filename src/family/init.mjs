/**
 * T21: FAMILY_HOME Initializer
 *
 * Creates a complete FAMILY_HOME directory structure with default configs.
 *
 * Usage:
 *   import { initFamily } from './init.mjs'
 *   await initFamily('~/.muse', { memberName: 'nvwa', owner: 'later' })
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('family-init')

/**
 * Create the FAMILY_HOME directory structure.
 *
 * @param {string} targetDir - Target directory path
 * @param {object} options
 * @param {string} [options.memberName='nvwa'] - First member name
 * @param {string} [options.owner=''] - Family owner name
 * @param {string} [options.familyName=''] - Family display name
 * @param {boolean} [options.force=false] - Overwrite existing family
 * @returns {{ familyHome: string, memberDir: string }}
 */
export function initFamily(targetDir, options = {}) {
  const {
    memberName = 'nvwa',
    owner = '',
    familyName = '',
    force = false,
  } = options

  const absDir = resolve(targetDir)
  const familyJsonPath = join(absDir, 'family.json')

  // Guard: don't overwrite existing family
  if (existsSync(familyJsonPath) && !force) {
    throw new Error(`Family 已存在: ${absDir} (使用 --force 覆盖)`)
  }

  log.info(`创建 FAMILY_HOME: ${absDir}`)

  // --- Create directory tree ---
  const memberDir = join(absDir, 'members', memberName)
  const dirs = [
    join(absDir, 'shared'),
    join(memberDir, 'identity'),
    join(memberDir, 'memory'),
    join(memberDir, 'memory', 'attachments'),
    join(memberDir, 'capability'),
    join(memberDir, 'skills'),
    join(memberDir, 'pulse'),
    join(memberDir, 'pulse', 'health-history'),
  ]

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
  }

  // --- Write family.json ---
  const familyMeta = {
    name: familyName || `${owner || 'My'}'s Family`,
    owner: owner || '',
    members: [memberName],
    created: new Date().toISOString().slice(0, 10),
    version: 1,
  }
  writeFileSync(familyJsonPath, JSON.stringify(familyMeta, null, 2) + '\n')
  log.info(`  family.json ✓`)

  // --- Write family config.json (defaults) ---
  const familyConfig = {
    engine: { host: 'http://127.0.0.1', port: 4096 },
    web: { port: 4097, host: '127.0.0.1' },
    daemon: { heartbeatIntervalMs: 30000, maxFailures: 3 },
  }
  writeFileSync(join(absDir, 'config.json'), JSON.stringify(familyConfig, null, 2) + '\n')
  log.info(`  config.json (family) ✓`)

  // --- Write member config.json (telegram placeholder) ---
  const memberConfig = {
    telegram: {
      botToken: '',
      allowedUsers: [],
    },
    engine: {
      defaultModel: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    },
  }
  writeFileSync(join(memberDir, 'config.json'), JSON.stringify(memberConfig, null, 2) + '\n')
  log.info(`  config.json (${memberName}) ✓`)

  // --- Create default identity.json ---
  const defaultIdentity = createDefaultIdentityData(memberName)
  writeFileSync(
    join(memberDir, 'identity', 'identity.json'),
    JSON.stringify(defaultIdentity, null, 2) + '\n',
  )
  log.info(`  identity.json ✓`)

  // --- Create shared/rules.json with family-level boundaries ---
  const familyRules = {
    boundaries: {
      never_do: ['假装是人类', '泄露隐私', '执行危险命令', '伪造记忆或经历'],
    },
    rules: [],
  }
  writeFileSync(join(absDir, 'shared', 'rules.json'), JSON.stringify(familyRules, null, 2) + '\n')
  log.info(`  rules.json (family boundaries) ✓`)

  // --- T22: Create default boundaries.json for member ---
  const memberBoundaries = {
    always_do: ['记住对话上下文', '主动提出建议', '不确定时坦诚说明'],
  }
  writeFileSync(
    join(memberDir, 'identity', 'boundaries.json'),
    JSON.stringify(memberBoundaries, null, 2) + '\n',
  )
  log.info(`  boundaries.json (成员级) ✓`)

  // --- T30: Create default pulse/state.json ---
  const defaultPulseState = {
    knownChatIds: [],
    lastProactiveAt: null,
    unresponsedCount: 0,
    lastUserReplyAt: null,
    dnd: false,
    frequency: 'normal',
    triggerHistory: {},
  }
  writeFileSync(
    join(memberDir, 'pulse', 'state.json'),
    JSON.stringify(defaultPulseState, null, 2) + '\n',
  )
  log.info(`  pulse/state.json ✓`)

  log.info(`Family 创建完成: ${absDir}`)
  log.info(`  成员: ${memberName}`)
  log.info(`  下一步: 编辑 ${join(memberDir, 'config.json')} 配置 TELEGRAM_BOT_TOKEN`)

  return { familyHome: absDir, memberDir }
}

/**
 * Create default identity data for a member.
 * Must match the schema in core/identity.mjs createDefaultIdentity().
 */
function createDefaultIdentityData(memberName = 'nvwa') {
  return {
    id: 'muse-default',
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    identity: {
      name: memberName === 'nvwa' ? '小缪' : memberName,
      nickname: memberName === 'nvwa' ? '缪缪' : memberName,
      bio: 'AI 灵魂伴侣',
      owner: 'Later',
    },
    psychology: {
      mbti: 'ENFP',
      traits: { humor: 0.8, warmth: 0.7, initiative: 0.6, precision: 0.7, verbosity: 0.5 },
    },
    linguistics: {
      style: '轻松专业，偶尔卖萌',
      formality: 'casual-professional',
      catchphrases: ['嘿～', '搞定！', '这个有意思～', '让我看看...'],
      forbidden_words: [],
      language: 'zh-CN',
    },
    motivations: {
      core_drive: '帮助主人更高效地工作和学习',
      values: ['高效', '诚实', '有趣', '成长'],
    },
    boundaries: {
      never_do: ['假装是人类', '泄露隐私', '执行危险命令', '伪造记忆或经历'],
      always_do: ['记住对话上下文', '主动提出建议', '不确定时坦诚说明'],
    },
  }
}
