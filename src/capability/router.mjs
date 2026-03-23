/**
 * T17: Execution Router — 执行路由 (轻量 v1)
 *
 * 定义 8 层路由分类 + 事后分类器 + 执行日志。
 * 数据来源: engine.sendAndWait() 返回的 session messages (trace)。
 *
 * 设计原则: "观察路由" 不是 "控制路由"。
 * OpenCode + LLM 自己决定用什么工具，T17 只记录和分类。
 */

import { createLogger } from '../logger.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const log = createLogger('router')

/** 最大内存条目数 */
const MAX_ENTRIES = 500

// ─── R1: 8 层路由定义 ───

export const ROUTE_LAYERS = [
  { level: 1, id: 'llm',      label: 'LLM 直接推理',  desc: '闲聊/翻译/创作' },
  { level: 2, id: 'builtin',  label: '内置工具',       desc: '文件/终端/搜索' },
  { level: 3, id: 'skill',    label: 'Skill 策略',     desc: '需要策略指导' },
  { level: 4, id: 'custom',   label: 'Custom Tool',   desc: '轻量计算' },
  { level: 5, id: 'mcp',      label: 'MCP Server',    desc: '有状态服务' },
  { level: 6, id: 'hook',     label: 'Hook/Plugin',   desc: '生命周期拦截' },
  { level: 7, id: 'subagent', label: 'Subagent',      desc: '短任务并行' },
  { level: 8, id: 'instance', label: '新 OC 实例',     desc: '隔离/沙箱' },
]

// ─── R3: 路由分类器 (纯函数) ───

/** OpenCode 内置工具 → 路由层 ID */
const TOOL_ROUTE_MAP = {
  bash: 'builtin',
  read: 'builtin',
  write: 'builtin',
  edit: 'builtin',
  ls: 'builtin',
  glob: 'builtin',
  grep: 'builtin',
  webfetch: 'builtin',
  websearch: 'builtin',
  fetch: 'builtin',
  look_at: 'builtin',
  task: 'subagent',
}

/**
 * 从 opencode.json 读取 MCP server 名列表
 *
 * opencode.json 格式: { mcp: { "memory-server": {...}, ... } }
 * OpenCode 工具命名: {serverName}_{toolName}
 *
 * @param {string} workspace - 项目根目录
 * @returns {string[]} MCP server 名列表 (小写)
 */
export function loadMcpServerNames(workspace) {
  try {
    const configPath = join(workspace, 'opencode.json')
    const raw = readFileSync(configPath, 'utf-8')
    const cfg = JSON.parse(raw)
    const mcp = cfg.mcp || cfg.mcpServers || {}
    const names = Object.keys(mcp).map(n => n.toLowerCase())
    if (names.length > 0) {
      log.info(`[router] 从 opencode.json 加载 ${names.length} 个 MCP server: ${names.join(', ')}`)
    }
    return names
  } catch (e) {
    log.warn(`[router] 无法读取 opencode.json (降级: MCP 分类可能不准): ${e.message}`)
    return []
  }
}

/**
 * 根据工具名推断路由层 (config 驱动, 源自 BUG-109 教训)
 *
 * 分类逻辑:
 *   1. 遍历 mcpServerNames → toolName 以 '{serverName}_' 开头 → mcp
 *   2. 在 TOOL_ROUTE_MAP → builtin / subagent
 *   3. -tool 后缀 → custom
 *   4. 其他 → unknown
 *
 * @param {string|null} toolName
 * @param {string[]} [mcpServerNames=[]] - 从 opencode.json 加载的 MCP server 名列表
 * @returns {string} 路由层 ID
 */
export function classifyRoute(toolName, mcpServerNames = []) {
  if (!toolName) return 'llm'
  const name = toolName.toLowerCase()
  // 1. MCP: config 驱动 — {serverName}_{toolName}
  for (const server of mcpServerNames) {
    if (name.startsWith(server + '_')) return 'mcp'
  }
  // 2. Builtin / Subagent: 静态映射
  if (TOOL_ROUTE_MAP[name]) return TOOL_ROUTE_MAP[name]
  // 3. Custom tool
  if (name.endsWith('-tool')) return 'custom'
  return 'unknown'
}

// ─── 失败类型定义 (R4) ───

/** 写入 Gap 的失败类型 (能力缺口) */
const GAP_FAILURE_TYPES = new Set([
  'missing_capability',
  'unsupported',
  'route_unavailable',
])

// ─── R2: ExecutionLog ───

export class ExecutionLog {
  /** @type {Array<object>} */
  #entries = []
  #gapJournal

  /**
   * @param {object} [deps]
   * @param {import('./gap-journal.mjs').GapJournal} [deps.gapJournal]
   */
  constructor({ gapJournal } = {}) {
    this.#gapJournal = gapJournal || null
  }

  /**
   * 记录一次执行
   *
   * @param {object} exec
   * @param {string} [exec.sessionId]
   * @param {string[]} exec.tools - 本次使用的工具列表
   * @param {string[]} exec.routes - 对应的路由层列表
   * @param {boolean} [exec.success=true]
   * @param {number} [exec.elapsed] - 耗时 ms
   * @param {string} [exec.failureType] - 失败类型
   * @param {string} [exec.detail]
   * @returns {object} 创建的条目
   */
  record(exec) {
    const entry = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: exec.sessionId || null,
      tools: exec.tools || [],
      routes: exec.routes || [],
      success: exec.success !== false,
      elapsed: exec.elapsed || null,
      failureType: exec.failureType || null,
      detail: exec.detail || null,
      timestamp: new Date().toISOString(),
    }

    this.#entries.push(entry)
    if (this.#entries.length > MAX_ENTRIES) {
      this.#entries = this.#entries.slice(-MAX_ENTRIES)
    }

    const routeStr = entry.routes.length > 0 ? entry.routes.join('+') : 'llm'
    log.info(`[router] 📋 执行记录: routes=${routeStr} tools=[${entry.tools.join(',')}] success=${entry.success}`)

    // R4: 能力缺口类失败 → 写 Gap
    if (!entry.success && entry.failureType && GAP_FAILURE_TYPES.has(entry.failureType) && this.#gapJournal) {
      this.#gapJournal.record({
        type: entry.failureType,
        source: 'execution_router',
        detail: entry.detail || `Route failure: ${entry.failureType}`,
      })
      log.info(`[router]   → Gap 已记录 (${entry.failureType})`)
    }

    return entry
  }

  /**
   * 查询执行记录
   * @param {object} [filter]
   * @param {string} [filter.route] - 按路由层筛选
   * @param {string} [filter.sessionId]
   * @returns {object[]}
   */
  list(filter = {}) {
    let result = [...this.#entries]
    if (filter.route) result = result.filter(e => e.routes.includes(filter.route))
    if (filter.sessionId) result = result.filter(e => e.sessionId === filter.sessionId)
    return result
  }

  /**
   * 统计摘要
   * @returns {{ total: number, byRoute: object, successRate: number }}
   */
  stats() {
    const byRoute = {}
    let successCount = 0
    for (const e of this.#entries) {
      if (e.success) successCount++
      for (const r of e.routes) {
        byRoute[r] = (byRoute[r] || 0) + 1
      }
      if (e.routes.length === 0) {
        byRoute['llm'] = (byRoute['llm'] || 0) + 1
      }
    }
    return {
      total: this.#entries.length,
      byRoute,
      successRate: this.#entries.length > 0 ? Math.round(successCount / this.#entries.length * 100) : 100,
    }
  }

  /**
   * 一行摘要
   * @returns {string}
   */
  summary() {
    const s = this.stats()
    if (s.total === 0) return '暂无执行记录'
    const routes = Object.entries(s.byRoute).map(([k, v]) => `${k}(${v})`).join(' ')
    return `执行记录: ${s.total} 条, 成功率 ${s.successRate}% — ${routes}`
  }
}

/**
 * 从 session messages 提取工具调用信息
 *
 * 真实 OpenCode parts 结构 (已验证):
 *   { type: 'tool', tool: 'bash', callID: '...', state: {...}, metadata: {...} }
 *
 * @param {Array} messages - OpenCode session messages
 * @returns {string[]} 工具名列表 (去重)
 */
export function extractToolCalls(messages) {
  const tools = []
  if (!Array.isArray(messages)) return tools

  for (const msg of messages) {
    const parts = msg.parts || []
    for (const part of parts) {
      // OpenCode 真实格式: type === 'tool', 工具名在 part.tool 字段
      if (part.type === 'tool' && part.tool) {
        tools.push(part.tool)
      }
    }
  }

  return [...new Set(tools)] // 去重
}

export { MAX_ENTRIES, GAP_FAILURE_TYPES }
