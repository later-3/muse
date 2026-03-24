import { join, dirname, resolve as pathResolve } from 'node:path'
import { config, validateConfig } from './config.mjs'
import { log, createLogger } from './logger.mjs'
import { Identity } from './core/identity.mjs'
import { Memory } from './core/memory.mjs'
import { Engine } from './core/engine.mjs'
import { Orchestrator } from './core/orchestrator.mjs'
import { PerceptionIngress } from './perception/ingress.mjs'
import { TelegramChannel } from './perception/telegram-channel.mjs'
import { buildRegistry } from './capability/registry.mjs'
import { GapJournal } from './capability/gap-journal.mjs'
import { ExecutionLog, loadMcpServerNames } from './capability/router.mjs'
import { TelegramAdapter } from './adapters/telegram.mjs'
import { WebServer } from './web/api.mjs'
import { Cerebellum } from './daemon/cerebellum.mjs'
import { Pulse } from './daemon/pulse.mjs'
import { HealthHistory } from './daemon/health-history.mjs'
import { HealthInsight } from './daemon/health-insight.mjs'
import { Goals } from './core/goals.mjs'
import { Threads } from './core/threads.mjs'
import { selfCheck } from './daemon/self-check.mjs'
import { SpeechToText } from './voice/stt.mjs'
import { TextToSpeech } from './voice/tts.mjs'
import { DevStore } from './dev/store.mjs'
import { Telegraf } from 'telegraf'

const sysLog = createLogger('system')

// --- Module Registry ---

/** 所有模块实例，按启动顺序排列 */
let modules = {}

/**
 * 创建所有模块实例 (依赖图: Config → Identity/Memory/Engine → Orchestrator → Telegram/Web)
 * 导出以便系统级测试使用
 */
export async function createModules(cfg = config) {
  const identity = new Identity(cfg)
  const memory = new Memory(cfg)
  const engine = new Engine(cfg)

  // T15: Capability Registry — 能力自知
  const registry = buildRegistry()
  globalThis.__museRegistry = registry

  // T16: Gap Journal — 缺口管理
  const gapJournal = new GapJournal({ registry })

  // T17: Execution Router — 执行日志 (依赖 gapJournal)
  const executionLog = new ExecutionLog({ gapJournal })

  // T17: 从 opencode.json 加载 MCP server 名 (config 驱动路由分类)
  const mcpServerNames = loadMcpServerNames(cfg.engine.workspace)

  // Orchestrator 依赖 executionLog + mcpServerNames (T17 主链集成)
  const orchestrator = new Orchestrator({ config: cfg, identity, engine, executionLog, mcpServerNames })

  // T14.5: 共享 Telegraf bot 实例给 TelegramAdapter 和 TelegramChannel
  const bot = cfg.telegram.botToken ? new Telegraf(cfg.telegram.botToken, { handlerTimeout: 300_000 }) : null
  const channel = bot ? new TelegramChannel({ bot, imageDir: cfg.telegram?.imageDir }) : null

  // Ingress 和 Telegram 需要在 Registry + GapJournal 之后创建
  // T38: 本地 STT (whisper.cpp)
  //   模型路径: 相对于 muse/ 根目录（引擎级数据，不属于 member）
  //   index.mjs 现在在 src/ 下，需上移一层到 muse/ 根取 data/models/
  const srcDir = new URL('.', import.meta.url).pathname      // muse/src/
  const museRoot = pathResolve(srcDir, '..')                 // muse/
  const sttModel = process.env.STT_MODEL || 'ggml-base.bin'
  const modelPath = join(museRoot, 'data', 'models', sttModel)
  const sttLanguage = process.env.STT_LANGUAGE || 'zh'
  const stt = new SpeechToText({ modelPath, language: sttLanguage })
  const sttHealth = stt.health()
  if (sttHealth.ok) {
    sysLog.info(`[init] STT 本地模块已就绪 (whisper.cpp, model=${sttModel}, lang=${sttLanguage})`)
  } else {
    sysLog.warn(`[init] STT 模型未找到: ${modelPath}，语音将降级为文件路由`)
  }

  const ingress = new PerceptionIngress({ orchestrator, channel, gapJournal, stt: sttHealth.ok ? stt : null })

  const cerebellum = new Cerebellum(cfg)

  // selfCheck 预绑定 — TelegramAdapter 的 /status 可直接调用
  // web is added to allModules later after WebServer creation
  const allModules = { identity, memory, engine, orchestrator, cerebellum, registry, gapJournal, executionLog }
  const boundSelfCheck = () => selfCheck(allModules)

  // T33: Health History
  const healthHistoryDir = join(cfg.pulse.stateDir, 'health-history')
  const healthHistory = new HealthHistory(healthHistoryDir)

  // opencode-trace: 注入 member 专属 trace 路径供 Plugin 使用
  // Plugin 是通过 OpenCode 进程加载的，不能直接 import Muse config，
  // 所以用 env var 做为进程内通信桥梁。
  if (cfg.trace?.dir) {
    process.env.MUSE_TRACE_DIR = cfg.trace.dir
    sysLog.info(`[init] MUSE_TRACE_DIR: ${cfg.trace.dir}`)
  }

  // T34: Health Insight (AI-powered analysis)
  const healthInsightDir = join(cfg.pulse.stateDir, 'health-insight')
  const healthInsight = new HealthInsight({ insightDir: healthInsightDir, engine })

  // T35/T36/T37: 这些模块依赖 Memory DB → 先启动 Memory
  //   Memory.start() 本质是同步的 (better-sqlite3)
  await memory.start()

  // T35: Goals (structured goal tracking, shared Memory DB)
  const goals = new Goals(memory.getDb(), cfg.agentId || 'muse')
  goals.init()

  // T36: Threads (Life Threads, shared Memory DB)
  const threads = new Threads(memory.getDb(), cfg.agentId || 'muse')
  threads.init()

  // T37: DevStore (shared Memory DB)
  const devStore = new DevStore(memory.getDb(), cfg.agentId || 'muse')
  devStore.init()

  // T30: Pulse 主动性引擎
  const pulse = new Pulse({
    config: cfg.pulse,
    stateDir: cfg.pulse.stateDir,
    onTrigger: async (trigger, state) => {
      // T32: Anti-Spam guard
      try {
        const { shouldAllow } = await import('./daemon/anti-spam.mjs')
        const check = shouldAllow(pulse.state, cfg.pulse, trigger)
        if (!check.allowed) {
          sysLog.info(`[pulse] 拦截: trigger=${trigger.id} reason=${check.reason}`)
          return
        }
      } catch (e) {
        sysLog.warn(`[pulse] Anti-Spam 检查失败，放行: ${e.message}`)
      }

      // T33: selfCheck trigger
      if (trigger.action === 'selfCheck') {
        try {
          const report = await boundSelfCheck()
          healthHistory.save(report)
          const trend = healthHistory.detectTrend()
          if (trend.degraded) {
            sysLog.warn(`[pulse] 连续 ${trend.count} 次体检异常`)
          }

          // T34: AI Health Insight — 报告够多时生成洞察
          const reports = healthHistory.list(5)
          if (reports.length >= 3) {
            try {
              const insight = await healthInsight.generate(reports)
              if (insight) {
                sysLog.info(`[pulse] 健康洞察: status=${insight.status}`)
                // degrading 时通知用户 — 复用 T31 sendProactive
                if (insight.status === 'degrading' && telegram) {
                  const chatIds = pulse.state?.knownChatIds || []
                  const msg = `😟 最近体检不太好: ${insight.reason}\n💡 ${insight.suggestion}`
                  await telegram.sendProactive(msg, { chatIds })
                  sysLog.info(`[pulse] 退化通知已发送: ${insight.reason}`)
                }
              }
            } catch (insightErr) {
              sysLog.warn(`[pulse] AI 解读失败 (不影响体检): ${insightErr.message}`)
            }
          }
        } catch (e) {
          sysLog.warn(`[pulse] 定时体检失败: ${e.message}`)
        }
        return
      }

      // T31: dispatch trigger action
      try {
        const { dispatch } = await import('./daemon/pulse-actions.mjs')
        await dispatch(trigger, { engine, telegram, pulse, identity, goals, threads })
      } catch (e) {
        sysLog.error(`[pulse] 触发动作失败: ${e.message}`)
      }
    },
  })

  // T33: 注册定时体检触发器
  pulse.register({
    id: 'health-check',
    interval: 6 * 3600_000,  // 6 hours
    action: 'selfCheck',
    skipAntiSpam: true,
  })

  // T35: 注册 goal-check 触发器 (12 小时)
  pulse.register({
    id: 'goal-check',
    interval: 12 * 3600_000,  // 12 hours
    action: 'goalCheck',
  })

  // T36: 注册 thread-weave 触发器 (1 小时)
  pulse.register({
    id: 'thread-weave',
    interval: 3600_000,  // 1h
    action: 'threadWeave',
  })

  // T43: WebServer 降级 — 独立 cockpit 替代后，默认关闭
  // 仅当 config.web.enabled === true 时启动
  if (cfg.web?.enabled) {
    const web = new WebServer(cfg, { identity, memory, engine, orchestrator, cerebellum, pulse, healthInsight, goals, threads, devStore, registry, gapJournal, executionLog })
    allModules.web = web
  }

  // T38: TTS 语音回复
  const tts = new TextToSpeech()
  sysLog.info(`[init] TTS 已初始化 (voice=${tts.health().detail.primaryVoice})`)

  const telegram = new TelegramAdapter(cfg, orchestrator, {
    ingress, bot, channel, tts,
    modules: { executionLog, gapJournal, selfCheck: boundSelfCheck },
    pulseState: pulse.pulseState,
  })

  return { identity, memory, engine, orchestrator, ingress, channel, telegram, cerebellum, pulse, healthHistory, healthInsight, goals, threads, devStore, stt, tts, registry, gapJournal, executionLog, web }
}

/**
 * 按依赖顺序启动所有模块
 *
 * 启动策略:
 * 1. Web 驾驶舱尽早启动（Phase 1），确保即使后续模块失败也能提供诊断入口
 * 2. Identity/Memory 是独立基础模块（Phase 2）
 * 3. Engine 依赖外部 OpenCode serve（Phase 3）
 * 4. Telegram 最后启动（Phase 4）
 */
async function startAll(mods) {
  // Phase 1: Web 驾驶舱优先启动（诊断/控制入口）
  if (config.web.enabled) {
    sysLog.info('[1/7] 启动 Web 驾驶舱...')
    try {
      await mods.web.start()
    } catch (e) {
      sysLog.error('Web 驾驶舱启动失败 (非致命):', e.message)
    }
  } else {
    sysLog.info('[1/7] Web 驾驶舱已禁用 (WEB_ENABLED=false)')
  }

  // Phase 2: 启动独立基础模块
  sysLog.info('[2/7] 启动 Identity...')
  await mods.identity.start()

  // Memory 已在 createModules 中启动 (Goals/Threads/DevStore 依赖 DB)
  sysLog.info('[3/7] Memory 已就绪 (early start)')

  // Phase 3: 引擎 (依赖外部 OpenCode serve)
  sysLog.info('[4/7] 启动 Engine...')
  await mods.engine.start()

  // Phase 4: 小脑 (守护大脑 — Engine 之后启动，确保有大脑可守护)
  sysLog.info('[5/7] 启动 Cerebellum (小脑守护)...')
  try {
    await mods.cerebellum.start()
  } catch (e) {
    sysLog.error('小脑启动失败 (非致命，大脑仍可用):', e.message)
  }

  // Phase 4.5: T30 Pulse 主动性引擎
  if (mods.pulse) {
    sysLog.info('[6/7] 启动 Pulse 引擎...')
    try {
      await mods.pulse.start()
    } catch (e) {
      sysLog.error('Pulse 启动失败 (非致命):', e.message)
    }
  }

  // Phase 5: Telegram 适配器 (网络失败不应崩掉整个进程)
  sysLog.info('[7/7] 启动 Telegram Bot...')
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await mods.telegram.start()
      break
    } catch (e) {
      sysLog.error(`Telegram 启动失败 (尝试 ${attempt}/3): ${e.message}`)
      if (attempt < 3) {
        sysLog.info(`[telegram] ${attempt * 2}s 后重试...`)
        await new Promise(r => setTimeout(r, attempt * 2000))
      } else {
        sysLog.error('Telegram 启动失败 (非致命，其他模块正常运行)。请检查网络后手动重启。')
      }
    }
  }
}

/**
 * 按逆序优雅关闭所有模块
 */
async function stopAll(mods) {
  sysLog.info('开始优雅关闭...')

  // 逆序: 先停适配器，最后停基础模块
  try { await mods.telegram.stop() } catch (e) { sysLog.error('Telegram 停止失败:', e.message) }
  try { if (mods.pulse) await mods.pulse.stop() } catch (e) { sysLog.error('Pulse 停止失败:', e.message) }
  try { await mods.cerebellum.stop() } catch (e) { sysLog.error('Cerebellum 停止失败:', e.message) }
  try { await mods.engine.stop() } catch (e) { sysLog.error('Engine 停止失败:', e.message) }
  try { await mods.memory.stop() } catch (e) { sysLog.error('Memory 停止失败:', e.message) }
  try { await mods.identity.stop() } catch (e) { sysLog.error('Identity 停止失败:', e.message) }
  // Web 最后关，确保整个关闭过程都有诊断入口
  try { await mods.web.stop() } catch (e) { sysLog.error('Web 停止失败:', e.message) }

  sysLog.info('所有模块已停止')
}

// --- Main ---

async function main() {
  // fail-fast 配置校验
  validateConfig()

  log.info('🎭 Muse 助手启动中...')
  log.info(`   引擎: ${config.engine.host}:${config.engine.port}`)
  log.info(`   Web:  http://${config.web.host}:${config.web.port}`)

  // 创建模块
  modules = await createModules()

  // 启动
  await startAll(modules)

  log.info('🎭 Muse 助手已就绪!')

  // 优雅关闭
  const shutdown = async (signal) => {
    sysLog.info(`收到 ${signal}，正在关闭...`)
    await stopAll(modules)
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

// 只有直接执行时才启动 (import 时不触发, 如 startup.test.mjs)
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))
if (isDirectRun) {
  main().catch(err => {
    log.error('启动失败:', err)
    process.exit(1)
  })
}

export { startAll, stopAll }
