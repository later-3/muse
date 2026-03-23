#!/usr/bin/env node

/**
 * T21: Muse CLI
 *
 * Usage:
 *   node muse/cli.mjs init [path]    Create FAMILY_HOME
 *   node muse/cli.mjs start          Start Muse (from FAMILY_HOME or legacy)
 *   node muse/cli.mjs migrate        Migrate data/ to FAMILY_HOME
 *
 * Environment:
 *   MUSE_HOME    Path to FAMILY_HOME (default: ~/.muse)
 *   MUSE_MEMBER  Member name (default: nvwa)
 */

import { resolve, join } from 'node:path'
import { homedir } from 'node:os'

const [,, command, ...args] = process.argv

const DEFAULT_HOME = join(homedir(), '.muse')

function printHelp() {
  console.log(`
Muse CLI — Family Management

Usage:
  node cli.mjs init [path]     创建 FAMILY_HOME (默认: ~/.muse)
  node cli.mjs start           启动 Muse
  node cli.mjs migrate         迁移 data/ 到 FAMILY_HOME
  node cli.mjs help            显示帮助

Options:
  --member <name>   指定成员名 (默认: nvwa)
  --owner <name>    指定家族所有者
  --force           覆盖已有目录
  --family <path>   指定 FAMILY_HOME 路径

Environment:
  MUSE_HOME         FAMILY_HOME 路径
  MUSE_MEMBER       成员名
`)
}

function parseArgs(args) {
  const parsed = { _: [] }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--member' && args[i + 1]) { parsed.member = args[++i] }
    else if (args[i] === '--owner' && args[i + 1]) { parsed.owner = args[++i] }
    else if (args[i] === '--family' && args[i + 1]) { parsed.family = args[++i] }
    else if (args[i] === '--force') { parsed.force = true }
    else { parsed._.push(args[i]) }
  }
  return parsed
}

async function handleInit(args) {
  const parsed = parseArgs(args)
  const targetDir = parsed._[0] || parsed.family || process.env.MUSE_HOME || DEFAULT_HOME

  const { initFamily } = await import('./init.mjs')
  const result = initFamily(resolve(targetDir), {
    memberName: parsed.member || process.env.MUSE_MEMBER || 'nvwa',
    owner: parsed.owner || '',
    force: parsed.force || false,
  })

  console.log(`\n✅ Family 已创建: ${result.familyHome}`)
  console.log(`\n启动方式:`)
  console.log(`  MUSE_HOME=${result.familyHome} node index.mjs`)
  console.log(`  或: node cli.mjs start --family ${result.familyHome}`)
}

async function handleStart(args) {
  const parsed = parseArgs(args)
  const familyHome = parsed.family || process.env.MUSE_HOME
  const memberName = parsed.member || process.env.MUSE_MEMBER || 'nvwa'

  if (familyHome) {
    // Set env vars for downstream modules
    process.env.MUSE_HOME = resolve(familyHome)
    process.env.MUSE_MEMBER = memberName
    console.log(`[cli] FAMILY_HOME: ${process.env.MUSE_HOME}, 成员: ${memberName}`)
  } else {
    console.log(`[cli] MUSE_HOME 未设置，使用旧模式 (data/)`)
  }

  // Delegate to main entry
  await import('../index.mjs')
}

async function handleMigrate(args) {
  const parsed = parseArgs(args)
  const familyHome = parsed.family || process.env.MUSE_HOME || DEFAULT_HOME

  // migrate.mjs will be implemented in S8
  try {
    const { migrate } = await import('./migrate.mjs')
    await migrate(resolve(familyHome), {
      memberName: parsed.member || process.env.MUSE_MEMBER || 'nvwa',
    })
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('❌ 迁移功能尚未实现 (S8)')
      process.exit(1)
    }
    throw e
  }
}

// --- Main ---

switch (command) {
  case 'init':
    await handleInit(args)
    break
  case 'start':
    await handleStart(args)
    break
  case 'migrate':
    await handleMigrate(args)
    break
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printHelp()
    break
  default:
    console.error(`未知命令: ${command}`)
    printHelp()
    process.exit(1)
}
