/**
 * Phase 2.5: selfCheck — 结构化自检
 *
 * 聚合各模块 health() + stats，输出三层健康报告。
 * 主承载: 小脑 (Cerebellum)。只输出事实，不做判断。
 *
 * 三层模型:
 *   L1 System Health  — 器官功能 (连通性/延迟/路由/缺口)
 *   L2 Self Model     — 自我认知 (identity/capability/已知缺口)
 *   L3 Life Health    — 生命质感 (Phase 3 Pulse 上线后填充)
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('selfcheck')

/**
 * 信号状态判定
 * @param {boolean} ok
 * @param {string} [warnCondition] - 为 true 时降为 🟡
 * @returns {'🟢'|'🟡'|'🔴'|'⚫'}
 */
function signal(ok, warnCondition) {
  if (ok === undefined || ok === null) return '⚫'
  if (!ok) return '🔴'
  if (warnCondition) return '🟡'
  return '🟢'
}

/**
 * 执行一次完整自检
 *
 * @param {object} modules - createModules() 返回的全部模块
 * @param {object} modules.engine
 * @param {object} modules.memory
 * @param {object} modules.identity
 * @param {object} [modules.telegram]
 * @param {object} [modules.web]
 * @param {object} [modules.cerebellum]
 * @param {object} [modules.registry]
 * @param {object} [modules.gapJournal]
 * @param {object} [modules.executionLog]
 * @returns {Promise<object>} 结构化体检报告
 */
export async function selfCheck(modules) {
  const startMs = Date.now()

  // --- L1: System Health ---
  const system = await checkSystemHealth(modules)

  // --- L2: Self Model Health ---
  const selfModel = checkSelfModelHealth(modules)

  // --- L3: Life Health (预留) ---
  const life = {
    proactivity: null,     // Phase 3: Pulse 发送记录
    interactionRhythm: null, // Phase 3: 消息频率
    repeatedFailures: null,  // Phase 3: 重复失败检测
    goalTracking: null,      // Phase 3: 目标跟进
    newCapabilities: null,   // Phase 3: 新能力获得
    _note: '待 Phase 3 Pulse 上线后填充',
  }

  // --- Overall ---
  const allStatuses = Object.values(system).map(s => s?.status).filter(Boolean)
  const selfStatuses = Object.values(selfModel).filter(v => typeof v === 'object' && v?.status).map(v => v.status)
  const combined = [...allStatuses, ...selfStatuses]
  const hasRed = combined.includes('🔴')
  const hasYellow = combined.includes('🟡')
  const overall = hasRed ? '🔴' : hasYellow ? '🟡' : '🟢'

  const report = {
    timestamp: new Date().toISOString(),
    elapsed: Date.now() - startMs,
    overall,
    system,
    selfModel,
    life,
  }

  log.info(`[selfcheck] 自检完成: ${overall} (${report.elapsed}ms)`)
  return report
}

/**
 * L1: System Health — 各器官连通性和运行指标
 */
async function checkSystemHealth(modules) {
  const { engine, memory, identity, telegram, web, cerebellum, executionLog, gapJournal } = modules
  const checks = {}

  // Engine
  try {
    const h = await engine.health()
    checks.engine = { status: signal(h.ok), detail: h.ok ? '连通' : '不可用' }
  } catch (e) {
    checks.engine = { status: '🔴', detail: e.message }
  }

  // Memory
  try {
    const h = await memory.health()
    checks.memory = { status: signal(h.ok), detail: h.ok ? `可用, ${h.detail?.semanticCount ?? '?'} 条语义记忆` : '不可用' }
  } catch (e) {
    checks.memory = { status: '🔴', detail: e.message }
  }

  // Identity
  try {
    const h = await identity.health()
    checks.identity = { status: signal(h.ok), detail: h.ok ? '已加载' : '未加载' }
  } catch (e) {
    checks.identity = { status: '🔴', detail: e.message }
  }

  // Telegram
  if (telegram?.health) {
    try {
      const h = await telegram.health()
      checks.telegram = { status: signal(h.ok), detail: h.ok ? `在线, ${h.detail?.activeSessions ?? 0} 活跃会话` : '离线' }
    } catch (e) {
      checks.telegram = { status: '🔴', detail: e.message }
    }
  }

  // Web
  if (web?.health) {
    try {
      const h = await web.health()
      checks.web = { status: signal(h.ok), detail: h.ok ? `运行中 :${h.detail?.port}` : '未运行' }
    } catch (e) {
      checks.web = { status: '🔴', detail: e.message }
    }
  }

  // Cerebellum
  if (cerebellum?.health) {
    try {
      const h = await cerebellum.health()
      const warn = h.detail?.consecutiveFailures > 0
      checks.cerebellum = {
        status: signal(h.ok, warn),
        detail: h.ok ? `守护中${warn ? ` (连续失败 ${h.detail.consecutiveFailures} 次)` : ''}` : '未运行',
      }
    } catch (e) {
      checks.cerebellum = { status: '🔴', detail: e.message }
    }
  }

  // Execution Router (T17)
  if (executionLog) {
    const stats = executionLog.stats()
    const unknownCount = stats.byRoute?.unknown || 0
    const unknownRate = stats.total > 0 ? unknownCount / stats.total : 0
    const warn = unknownRate > 0.05
    const red = unknownRate > 0.2
    checks.routing = {
      status: red ? '🔴' : signal(true, warn),
      detail: `${stats.total} 次执行, 成功率 ${stats.successRate}%` +
              (unknownCount > 0 ? `, unknown ${unknownCount} 次 (${Math.round(unknownRate * 100)}%)` : ''),
    }
  }

  // Gap Journal (T16)
  if (gapJournal) {
    const gaps = gapJournal.list()
    const recent = gaps.filter(g => {
      const age = Date.now() - new Date(g.timestamp).getTime()
      return age < 3600_000 // 最近 1 小时
    })
    const warn = recent.length > 0
    checks.gaps = {
      status: signal(true, warn),
      detail: `${gaps.length} 个缺口${warn ? `, 最近 1h 新增 ${recent.length} 个` : ''}`,
    }
  }

  return checks
}

/**
 * L2: Self Model Health — 自我认知
 */
function checkSelfModelHealth(modules) {
  const { registry, gapJournal, executionLog } = modules
  const checks = {}

  // Capability 自知 — registry 完整性
  if (registry) {
    const senses = registry.senses || []
    const capabilities = registry.capabilities || []
    checks.capabilityRegistry = {
      status: '🟢',
      detail: `${senses.length} 感知 / ${capabilities.length} 能力`,
      senseCount: senses.length,
      capCount: capabilities.length,
    }
  }

  // 已知缺口
  if (gapJournal) {
    const gaps = gapJournal.list()
    const byType = {}
    for (const g of gaps) {
      byType[g.type] = (byType[g.type] || 0) + 1
    }
    checks.knownGaps = {
      status: signal(true, gaps.length > 0),
      total: gaps.length,
      byType,
    }
  }

  // 路由覆盖 — 哪些路由层用过/没用过
  if (executionLog) {
    const stats = executionLog.stats()
    const usedRoutes = Object.keys(stats.byRoute || {})
    const allRoutes = ['llm', 'builtin', 'mcp', 'subagent', 'skill', 'custom', 'hook', 'instance']
    const unused = allRoutes.filter(r => !usedRoutes.includes(r))
    checks.routeCoverage = {
      status: '🟢',
      used: usedRoutes,
      unused,
      detail: `已用 ${usedRoutes.join('+')}${unused.length > 0 ? `, 未用 ${unused.join('+')}` : ''}`,
    }
  }

  return checks
}
