/**
 * T39-1.1: Family Registry
 *
 * Family 级服务注册表 — 让 muse 成员之间互相发现。
 *
 * 设计要点：
 * - registry.json 放在 $MUSE_HOME/$MUSE_FAMILY/registry.json
 * - 原子写入：tmpFile（唯一名）+ rename
 * - 乐观锁：version CAS + 最多 3 次冲突重试
 * - 脏在线自愈：注册时按 name 覆盖旧条目
 * - role 唯一：findByRole 返回唯一在线 member
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createLogger } from '../logger.mjs'

const log = createLogger('family-registry')
const MAX_RETRIES = 3

/**
 * 获取 registry.json 路径
 * @param {string} [registryDir] - 可选，测试用目录覆盖
 * @returns {string|null}
 */
export function getRegistryPath(registryDir) {
  if (registryDir) return join(registryDir, 'registry.json')
  const home = process.env.MUSE_HOME
  const family = process.env.MUSE_FAMILY
  if (!home || !family) return null
  return join(home, family, 'registry.json')
}

/**
 * 读取 registry（不存在则返回空）
 * @param {string} registryPath
 * @returns {{ version: number, members: Record<string, object> }}
 */
export function readRegistry(registryPath) {
  if (!existsSync(registryPath)) {
    return { version: 0, members: {} }
  }
  const raw = readFileSync(registryPath, 'utf-8')
  try {
    const data = JSON.parse(raw)
    return {
      version: data.version || 0,
      members: data.members || {},
    }
  } catch (e) {
    // JSON 损坏 → 抛错阻止继续写（防覆盖现有状态）
    const err = new RegistryCorruptError(registryPath, e.message)
    log.error('registry.json 损坏', { path: registryPath, error: e.message })
    throw err
  }
}

/**
 * Registry 文件损坏错误
 */
export class RegistryCorruptError extends Error {
  constructor(path, reason) {
    super(`registry.json 损坏: ${path} — ${reason}`)
    this.name = 'RegistryCorruptError'
    this.path = path
  }
}

/**
 * 原子写入 registry（CAS + 唯一 tmpFile + rename）
 * @param {string} registryPath
 * @param {object} data - { version, members }
 * @param {number} expectedVersion - 写入前读到的 version
 * @throws {Error} version 冲突时抛出
 */
function atomicWrite(registryPath, data, expectedVersion) {
  // 写入前再读一次确认 version
  const current = readRegistry(registryPath)
  if (current.version !== expectedVersion) {
    throw new VersionConflictError(expectedVersion, current.version)
  }

  mkdirSync(dirname(registryPath), { recursive: true })
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`
  const tmpPath = `${registryPath}.tmp.${suffix}`

  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    renameSync(tmpPath, registryPath)
  } catch (e) {
    // 清理临时文件
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
    throw e
  }
}

/**
 * Version 冲突错误
 */
export class VersionConflictError extends Error {
  constructor(expected, actual) {
    super(`registry version 冲突: expected ${expected}, actual ${actual}`)
    this.name = 'VersionConflictError'
    this.expected = expected
    this.actual = actual
  }
}

/**
 * 测试钩子：允许在 read 和 write 之间注入行为（制造真实冲突）
 * @type {{ beforeWrite?: (registryPath: string) => void }}
 */
export const _testHooks = { beforeWrite: null }

/**
 * 带重试的 registry 变更操作
 * @param {string} registryPath
 * @param {(registry: { version: number, members: Record<string, object> }) => void} mutator
 */
function mutateWithRetry(registryPath, mutator) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const registry = readRegistry(registryPath)
    const expectedVersion = registry.version

    mutator(registry)

    registry.version = expectedVersion + 1

    // 测试钩子：在 atomicWrite 前注入外部写入，制造真实 version 冲突
    if (_testHooks.beforeWrite) {
      _testHooks.beforeWrite(registryPath)
    }

    try {
      atomicWrite(registryPath, registry, expectedVersion)
      return registry
    } catch (e) {
      if (e instanceof VersionConflictError && attempt < MAX_RETRIES) {
        log.warn('registry 写入冲突，重试', { attempt: attempt + 1, expected: e.expected, actual: e.actual })
        continue
      }
      throw e
    }
  }
}

/**
 * 注册 member（脏在线自愈：已存在则覆盖）
 * @param {string} name - member 名
 * @param {{ role: string, engine: string, pid?: number }} info
 * @param {string} [registryDir] - 测试用目录覆盖
 */
export function registerMember(name, info, registryDir) {
  const registryPath = getRegistryPath(registryDir)
  if (!registryPath) {
    log.error('无法注册：MUSE_HOME 或 MUSE_FAMILY 未设置')
    throw new Error('MUSE_HOME or MUSE_FAMILY not set')
  }

  const result = mutateWithRetry(registryPath, (registry) => {
    const existing = registry.members[name]
    if (existing && existing.status === 'online') {
      log.info('覆盖旧在线条目（脏在线自愈）', { name, oldPid: existing.pid, newPid: info.pid })
    }

    registry.members[name] = {
      role: info.role,
      engine: info.engine,
      pid: info.pid || null,
      status: 'online',
      registeredAt: new Date().toISOString(),
    }
  })

  log.info('member 已注册', { name, role: info.role, engine: info.engine, version: result.version })
}

/**
 * 注销 member
 * @param {string} name
 * @param {string} [registryDir]
 */
export function unregisterMember(name, registryDir) {
  const registryPath = getRegistryPath(registryDir)
  if (!registryPath) {
    log.warn('无法注销：MUSE_HOME 或 MUSE_FAMILY 未设置')
    return
  }

  try {
    const result = mutateWithRetry(registryPath, (registry) => {
      if (registry.members[name]) {
        registry.members[name].status = 'offline'
        registry.members[name].unregisteredAt = new Date().toISOString()
      }
    })
    log.info('member 已注销', { name, version: result.version })
  } catch (e) {
    log.error('注销失败', { name, error: e.message })
  }
}

/**
 * 按 role 查找唯一在线 member
 * @param {string} role
 * @param {string} [registryDir]
 * @returns {{ name: string, role: string, engine: string, pid: number|null } | null}
 */
export function findByRole(role, registryDir) {
  const registryPath = getRegistryPath(registryDir)
  if (!registryPath) return null

  const registry = readRegistry(registryPath)
  const matches = Object.entries(registry.members)
    .filter(([, m]) => m.role === role && m.status === 'online')

  if (matches.length === 0) return null
  if (matches.length > 1) {
    const names = matches.map(([n]) => n).join(', ')
    log.error('role 唯一约束违反：多个在线 member 共享同一 role', { role, members: names })
    throw new Error(`role "${role}" 对应 ${matches.length} 个在线 member (${names})，违反唯一约束`)
  }

  const [name, member] = matches[0]
  return { name, role: member.role, engine: member.engine, pid: member.pid }
}

/**
 * 按 name 查找 member
 * @param {string} name
 * @param {string} [registryDir]
 * @returns {object|null}
 */
export function findByName(name, registryDir) {
  const registryPath = getRegistryPath(registryDir)
  if (!registryPath) return null

  const registry = readRegistry(registryPath)
  const member = registry.members[name]
  if (!member) return null
  return { name, ...member }
}

/**
 * 获取所有在线 member
 * @param {string} [registryDir]
 * @returns {Array<{ name: string, role: string, engine: string, pid: number|null }>}
 */
export function getAllOnline(registryDir) {
  const registryPath = getRegistryPath(registryDir)
  if (!registryPath) return []

  const registry = readRegistry(registryPath)
  return Object.entries(registry.members)
    .filter(([, m]) => m.status === 'online')
    .map(([name, m]) => ({ name, role: m.role, engine: m.engine, pid: m.pid }))
}
