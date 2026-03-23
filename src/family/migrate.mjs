/**
 * T21: Migration Script
 *
 * Migrates old data/ structure to FAMILY_HOME.
 *
 * Usage:
 *   node cli.mjs migrate [--family ~/.muse] [--member nvwa]
 *
 * What it does:
 *   1. Checks data/ exists with identity.json
 *   2. Creates FAMILY_HOME via init.mjs (if not existing)
 *   3. Copies identity.json → members/nvwa/identity/
 *   4. Copies memory.db → members/nvwa/memory/
 *   5. Copies data/images/ → members/nvwa/memory/attachments/
 *   6. Parses .env → writes to family + member config.json
 *   7. Preserves original data/ and .env (safety)
 */

import { existsSync, readFileSync, copyFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createLogger } from '../logger.mjs'
import { initFamily } from './init.mjs'

const log = createLogger('migrate')

/**
 * Migrate from old data/ to FAMILY_HOME.
 *
 * @param {string} targetDir - FAMILY_HOME target path
 * @param {object} options
 * @param {string} [options.memberName='nvwa'] - Member name
 * @param {string} [options.dataDir='./data'] - Old data directory
 */
export async function migrate(targetDir, options = {}) {
  const { memberName = 'nvwa', dataDir = './data' } = options
  const absTarget = resolve(targetDir)
  const absData = resolve(dataDir)

  // Step 1: Check old data exists
  log.info(`检查旧数据目录: ${absData}`)
  if (!existsSync(absData)) {
    throw new Error(`旧数据目录不存在: ${absData}`)
  }

  const oldIdentity = join(absData, 'identity.json')
  if (!existsSync(oldIdentity)) {
    throw new Error(`无旧数据可迁移: ${absData} 中没有 identity.json`)
  }

  // Step 2: Create FAMILY_HOME
  const familyJsonPath = join(absTarget, 'family.json')
  if (existsSync(familyJsonPath)) {
    throw new Error(`目标 FAMILY_HOME 已存在: ${absTarget} (请先删除或使用其他路径)`)
  }

  log.info(`创建 FAMILY_HOME: ${absTarget}`)
  initFamily(absTarget, { memberName })

  const memberDir = join(absTarget, 'members', memberName)

  // Step 3: Copy identity.json
  log.info(`迁移 identity.json`)
  copyFileSync(oldIdentity, join(memberDir, 'identity', 'identity.json'))

  // Step 4: Copy memory.db
  const oldMemoryDb = join(absData, 'memory.db')
  if (existsSync(oldMemoryDb)) {
    log.info(`迁移 memory.db`)
    copyFileSync(oldMemoryDb, join(memberDir, 'memory', 'memory.db'))
    // Skip WAL/SHM files — they are transient and will be recreated
    if (existsSync(oldMemoryDb + '-wal')) {
      log.warn(`跳过 memory.db-wal (临时文件, 将自动重建)`)
    }
  } else {
    log.info(`未找到 memory.db, 跳过`)
  }

  // Step 5: Copy images
  const oldImages = join(absData, 'images')
  if (existsSync(oldImages)) {
    const attachDir = join(memberDir, 'memory', 'attachments')
    const files = readdirSync(oldImages)
    log.info(`迁移 ${files.length} 个图片附件`)
    for (const file of files) {
      copyFileSync(join(oldImages, file), join(attachDir, file))
    }
  }

  // Step 6: Parse .env → write to config.json
  const envFile = resolve('.env')
  if (existsSync(envFile)) {
    log.info(`解析 .env → 写入配置文件`)
    const envContent = readFileSync(envFile, 'utf-8')
    const envVars = parseEnvFile(envContent)

    // Write member-level config (telegram + model preferences)
    const currentMemberConfig = JSON.parse(readFileSync(join(memberDir, 'config.json'), 'utf-8'))
    if (envVars.TELEGRAM_BOT_TOKEN) {
      currentMemberConfig.telegram = currentMemberConfig.telegram || {}
      currentMemberConfig.telegram.botToken = envVars.TELEGRAM_BOT_TOKEN
    }
    if (envVars.TELEGRAM_ALLOWED_USERS) {
      currentMemberConfig.telegram = currentMemberConfig.telegram || {}
      currentMemberConfig.telegram.allowedUsers = envVars.TELEGRAM_ALLOWED_USERS
        .split(',').filter(Boolean).map(s => s.trim())
    }
    if (envVars.DEFAULT_PROVIDER || envVars.DEFAULT_MODEL) {
      currentMemberConfig.engine = currentMemberConfig.engine || {}
      currentMemberConfig.engine.defaultModel = currentMemberConfig.engine.defaultModel || {}
      if (envVars.DEFAULT_PROVIDER) currentMemberConfig.engine.defaultModel.providerID = envVars.DEFAULT_PROVIDER
      if (envVars.DEFAULT_MODEL) currentMemberConfig.engine.defaultModel.modelID = envVars.DEFAULT_MODEL
    }
    if (envVars.HEAVY_PROVIDER || envVars.HEAVY_MODEL) {
      currentMemberConfig.engine = currentMemberConfig.engine || {}
      currentMemberConfig.engine.heavyModel = currentMemberConfig.engine.heavyModel || {}
      if (envVars.HEAVY_PROVIDER) currentMemberConfig.engine.heavyModel.providerID = envVars.HEAVY_PROVIDER
      if (envVars.HEAVY_MODEL) currentMemberConfig.engine.heavyModel.modelID = envVars.HEAVY_MODEL
    }
    writeFileSync(join(memberDir, 'config.json'), JSON.stringify(currentMemberConfig, null, 2) + '\n')

    // Write family-level config (engine/web/daemon)
    const currentFamilyConfig = JSON.parse(readFileSync(join(absTarget, 'config.json'), 'utf-8'))
    if (envVars.OPENCODE_HOST) currentFamilyConfig.engine = { ...currentFamilyConfig.engine, host: envVars.OPENCODE_HOST }
    if (envVars.OPENCODE_PORT) currentFamilyConfig.engine = { ...currentFamilyConfig.engine, port: parseInt(envVars.OPENCODE_PORT) }
    if (envVars.OPENCODE_WORKSPACE) currentFamilyConfig.engine = { ...currentFamilyConfig.engine, workspace: envVars.OPENCODE_WORKSPACE }
    if (envVars.WEB_PORT) currentFamilyConfig.web = { ...currentFamilyConfig.web, port: parseInt(envVars.WEB_PORT) }
    if (envVars.WEB_HOST) currentFamilyConfig.web = { ...currentFamilyConfig.web, host: envVars.WEB_HOST }
    if (envVars.HEARTBEAT_INTERVAL) currentFamilyConfig.daemon = { ...currentFamilyConfig.daemon, heartbeatIntervalMs: parseInt(envVars.HEARTBEAT_INTERVAL) }
    if (envVars.MAX_HEARTBEAT_FAILURES) currentFamilyConfig.daemon = { ...currentFamilyConfig.daemon, maxFailures: parseInt(envVars.MAX_HEARTBEAT_FAILURES) }
    writeFileSync(join(absTarget, 'config.json'), JSON.stringify(currentFamilyConfig, null, 2) + '\n')
  }

  // Step 7: Done
  log.info(`\n✅ 迁移完成!`)
  log.info(`  旧数据保留在: ${absData} (未删除)`)
  log.info(`  .env 保留 (未删除)`)
  log.info(`\n启动方式:`)
  log.info(`  MUSE_HOME=${absTarget} node index.mjs`)
  log.info(`  或: node family/cli.mjs start --family ${absTarget}`)

  return { familyHome: absTarget, memberDir }
}

/**
 * Simple .env file parser (no dependency on dotenv).
 * Handles KEY=VALUE, KEY="VALUE", comments (#), and empty lines.
 */
function parseEnvFile(content) {
  const result = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}
