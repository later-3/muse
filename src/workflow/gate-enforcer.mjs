/**
 * GateEnforcer — 工具执行拦截器
 *
 * 职责：
 * - 能力映射（capabilities → 具体工具名）
 * - 参与者状态判定（活跃/冻结/未绑定）
 * - 工具白名单校验
 * - bash_policy 分级策略
 * - file_scope 路径级校验（code_write 工具）
 */

import { createLogger } from '../logger.mjs'
import { relative, isAbsolute } from 'node:path'

const log = createLogger('workflow-gate')

// ── 能力映射表 ──

const CAPABILITY_MAP = {
  code_read:        ['read', 'glob', 'grep'],
  code_write:       ['edit', 'write', 'apply_patch'],
  shell_exec:       ['bash'],
  workflow_control:  ['workflow_list', 'workflow_status', 'workflow_transition', 'workflow_emit_artifact', 'workflow_retry_handoff', 'workflow_cancel_handoff'],
  coder_bridge:     ['coder_create_session', 'coder_send_prompt', 'coder_approve_task', 'coder_list_sessions'],
}

// 冻结态内置能力
const FROZEN_TOOLS = new Set(['read', 'glob', 'grep', 'workflow_list', 'workflow_status', 'workflow_retry_handoff', 'workflow_cancel_handoff'])

// 活跃态下也始终放行的工具（不受节点 capabilities 限制）
const ALWAYS_ALLOWED_TOOLS = new Set(['workflow_list', 'workflow_status', 'workflow_retry_handoff', 'workflow_cancel_handoff'])

// ── bash 策略 ──

const BASH_READ_ONLY_PREFIXES = [
  'cat ', 'ls ', 'find ', 'grep ', 'head ', 'tail ', 'wc ', 'echo ',
  'git log', 'git diff', 'git show', 'git status',
  'pwd', 'which ', 'file ', 'stat ', 'du ', 'df ',
]

const BASH_TEST_BUILD_PREFIXES = [
  'npm test', 'npm run test', 'npx vitest', 'npx jest',
  'node --test', 'node --experimental-test',
  'pytest', 'python -m pytest',
  'make test', 'cargo test', 'go test',
]

const BASH_BLOCKED_PATTERNS = [
  '>', '>>', ' tee ', 'sed -i', 'rm ', 'mv ', 'cp ',
  'dd ', 'python ', 'python3 ', 'node -e', 'git apply',
  'chmod ', 'chown ', 'mkfs', 'curl ', 'wget ',
]

// ── 主入口 ──

export class GateEnforcer {
  /**
   * 判定工具调用是否允许
   *
   * @param {object} opts
   * @param {string} opts.tool - 工具名
   * @param {object} opts.args - 工具参数
   * @param {object} opts.node - 当前节点定义
   * @param {string} opts.participantStatus - 'active' | 'frozen' | 'unbound'
   * @param {string} [opts.workspaceRoot] - 工作区根目录（路径校验用）
   * @returns {{ allowed: boolean, reason?: string }}
   */
  static check({ tool, args, node, participantStatus, workspaceRoot }) {
    // 1. 未绑定 → 全部放行
    if (participantStatus === 'unbound') {
      return { allowed: true }
    }

    // 2. 冻结 → 只允许 FROZEN_TOOLS
    if (participantStatus === 'frozen') {
      if (FROZEN_TOOLS.has(tool)) {
        log.debug('冻结态放行', { tool })
        return { allowed: true }
      }
      log.info('冻结态拦截', { tool })
      return {
        allowed: false,
        reason: `参与者处于冻结状态，只允许: ${[...FROZEN_TOOLS].join(', ')}`,
      }
    }

    // 3. 活跃 → 检查 always-allow 工具
    if (ALWAYS_ALLOWED_TOOLS.has(tool)) {
      return { allowed: true }
    }

    // 4. 活跃 → 按节点 capabilities 校验
    const allowedTools = resolveCapabilities(node.capabilities || [])

    if (!allowedTools.has(tool)) {
      log.info('能力白名单拦截', { tool, node: node.id, capabilities: node.capabilities })
      return {
        allowed: false,
        reason: `工具 "${tool}" 不在节点 "${node.id}" 的能力范围内。允许的工具: ${[...allowedTools].join(', ')}`,
      }
    }

    // 4. bash 策略检查
    if (tool === 'bash') {
      const bashResult = checkBashPolicy(node.bash_policy || 'deny', args?.command || '')
      if (!bashResult.allowed) {
        log.info('bash 策略拦截', { node: node.id, policy: node.bash_policy, command: (args?.command || '').slice(0, 80) })
        return bashResult
      }
    }

    // 5. file_scope 路径检查（code_write 工具）
    if (['edit', 'write', 'apply_patch'].includes(tool) && node.file_scope) {
      const pathResult = checkFilePath(tool, args, node.file_scope, workspaceRoot)
      if (!pathResult.allowed) {
        log.info('路径校验拦截', { tool, node: node.id })
        return pathResult
      }
    }

    log.debug('放行', { tool, node: node.id })
    return { allowed: true }
  }
}

// ── 能力解析 ──

/**
 * 将 capabilities 数组解析为具体工具 Set
 * @param {string[]} capabilities
 * @returns {Set<string>}
 */
export function resolveCapabilities(capabilities) {
  const tools = new Set()
  for (const cap of capabilities) {
    const mapped = CAPABILITY_MAP[cap]
    if (mapped) {
      for (const t of mapped) tools.add(t)
    } else {
      // 未知能力名当作直接工具名
      tools.add(cap)
    }
  }
  return tools
}

// ── bash 策略检查 ──

/**
 * @param {string} policy - bash_policy 级别
 * @param {string} command - shell 命令
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkBashPolicy(policy, command) {
  const cmd = command.trim()

  switch (policy) {
    case 'deny':
      return { allowed: false, reason: '当前节点禁止使用 bash (bash_policy: deny)' }

    case 'read_only':
      return checkReadOnlyBash(cmd)

    case 'test_build':
      return checkTestBuildBash(cmd)

    case 'scoped_write':
      // scoped_write 的路径校验在外层做，这里只放行
      return { allowed: true }

    case 'full':
      return { allowed: true }

    default:
      return { allowed: false, reason: `未知 bash_policy: ${policy}` }
  }
}

function checkReadOnlyBash(cmd) {
  // 检查是否匹配只读前缀
  const isReadOnly = BASH_READ_ONLY_PREFIXES.some(p => cmd.startsWith(p))
  if (isReadOnly) {
    // 再检查是否含危险模式
    if (hasBlockedPattern(cmd)) {
      return { allowed: false, reason: `命令包含被禁止的模式 (bash_policy: read_only)` }
    }
    return { allowed: true }
  }
  return { allowed: false, reason: `命令不在 read_only 允许的前缀列表中 (bash_policy: read_only)` }
}

function checkTestBuildBash(cmd) {
  // 先检查 test_build 专有前缀
  const isTestBuild = BASH_TEST_BUILD_PREFIXES.some(p => cmd.startsWith(p))
  if (isTestBuild) return { allowed: true }

  // 回退到 read_only 检查
  return checkReadOnlyBash(cmd)
}

function hasBlockedPattern(cmd) {
  return BASH_BLOCKED_PATTERNS.some(p => cmd.includes(p))
}

// ── 路径校验 ──

/**
 * file_scope 路径级校验
 * @param {string} tool - 工具名
 * @param {object} args - 工具参数
 * @param {object} fileScope - { allowed_paths, blocked_paths }
 * @param {string} workspaceRoot - 工作区根目录
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkFilePath(tool, args, fileScope, workspaceRoot) {
  if (!workspaceRoot) {
    return { allowed: false, reason: 'workspaceRoot 未设置，无法进行路径校验' }
  }

  // 提取目标路径
  const paths = extractTargetPaths(tool, args)
  if (paths.length === 0) {
    return { allowed: false, reason: `无法从 ${tool} 参数中提取目标路径，安全优先拒绝` }
  }

  // 原子性：所有路径都必须通过
  for (const absPath of paths) {
    const result = checkSinglePath(absPath, fileScope, workspaceRoot)
    if (!result.allowed) return result
  }

  return { allowed: true }
}

function checkSinglePath(absPath, fileScope, workspaceRoot) {
  // 归一化为 workspace-relative
  const relPath = isAbsolute(absPath)
    ? relative(workspaceRoot, absPath)
    : absPath

  // 超出工作区
  if (relPath.startsWith('..')) {
    return { allowed: false, reason: `路径 "${relPath}" 超出工作区根目录` }
  }

  // blocked 优先检查
  if (fileScope.blocked_paths?.some(p => relPath.startsWith(p) || relPath === p)) {
    return { allowed: false, reason: `路径 "${relPath}" 在 blocked_paths 中` }
  }

  // allowed 检查
  if (fileScope.allowed_paths?.some(p => relPath.startsWith(p) || relPath === p)) {
    return { allowed: true }
  }

  return { allowed: false, reason: `路径 "${relPath}" 不在 allowed_paths 范围内` }
}

/**
 * 从工具参数中提取目标文件路径
 * @param {string} tool
 * @param {object} args
 * @returns {string[]}
 */
export function extractTargetPaths(tool, args) {
  if (!args) return []

  switch (tool) {
    case 'edit':
    case 'write':
      return args.filePath ? [args.filePath] : (args.file_path ? [args.file_path] : [])

    case 'apply_patch':
      return parsePatchPaths(args.patch || args.content || '')

    default:
      return []
  }
}

/**
 * 从 patch 内容中解析文件路径
 * 支持 unified diff 格式: --- a/path 和 +++ b/path
 */
export function parsePatchPaths(patchContent) {
  const paths = new Set()
  const lines = patchContent.split('\n')
  for (const line of lines) {
    // --- a/muse/src/foo.mjs  or  +++ b/muse/src/foo.mjs
    const match = line.match(/^(?:---|\+\+\+)\s+[ab]\/(.+)/)
    if (match) paths.add(match[1])
    // Also try: --- /absolute/path  or  +++ /absolute/path
    const absMatch = line.match(/^(?:---|\+\+\+)\s+(\/\S+)/)
    if (absMatch) paths.add(absMatch[1])
  }
  return [...paths]
}
