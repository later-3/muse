#!/usr/bin/env node
/**
 * T39-1.1: Family Registry CLI
 *
 * start.sh 调用此脚本进行注册/注销。
 * ESM 兼容，不使用 require()。
 *
 * 用法：
 *   node registry-cli.mjs register <name> <role> <engine> [pid] [directory]
 *   node registry-cli.mjs unregister <name>
 */

import { registerMember, unregisterMember } from './registry.mjs'

const [,, action, ...args] = process.argv

try {
  switch (action) {
    case 'register': {
      const [name, role, engine, pid, directory] = args
      if (!name || !role || !engine) {
        console.error('用法: node registry-cli.mjs register <name> <role> <engine> [pid] [directory]')
        process.exit(1)
      }
      registerMember(name, {
        role,
        engine,
        pid: pid ? parseInt(pid, 10) : null,
        directory: directory || process.env.MUSE_MEMBER_DIR || undefined,
      })
      break
    }
    case 'unregister': {
      const [name] = args
      if (!name) {
        console.error('用法: node registry-cli.mjs unregister <name>')
        process.exit(1)
      }
      unregisterMember(name)
      break
    }
    default:
      console.error(`未知操作: ${action}`)
      console.error('可用操作: register, unregister')
      process.exit(1)
  }
} catch (e) {
  console.error(`registry-cli 失败: ${e.message}`)
  process.exit(1)
}
