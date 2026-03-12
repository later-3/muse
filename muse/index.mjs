import { config, validateConfig } from './config.mjs'
import { log, createLogger } from './logger.mjs'
import { Identity } from './core/identity.mjs'
import { Memory } from './core/memory.mjs'
import { Engine } from './core/engine.mjs'
import { Orchestrator } from './core/orchestrator.mjs'
import { TelegramAdapter } from './adapters/telegram.mjs'
import { WebServer } from './web/api.mjs'
import { Cerebellum } from './daemon/cerebellum.mjs'

const sysLog = createLogger('system')

// --- Module Registry ---

/** 所有模块实例，按启动顺序排列 */
let modules = {}

/**
 * 创建所有模块实例 (依赖图: Config → Identity/Memory/Engine → Orchestrator → Telegram/Web)
 * 导出以便系统级测试使用
 */
export function createModules(cfg = config) {
  const identity = new Identity(cfg)
  const memory = new Memory(cfg)
  const engine = new Engine(cfg)
  const orchestrator = new Orchestrator({ config: cfg, identity, memory, engine })
  const telegram = new TelegramAdapter(cfg, orchestrator)
  const cerebellum = new Cerebellum(cfg)
  const web = new WebServer(cfg, { identity, memory, engine, orchestrator, cerebellum })

  return { identity, memory, engine, orchestrator, telegram, cerebellum, web }
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
    sysLog.info('[1/6] 启动 Web 驾驶舱...')
    try {
      await mods.web.start()
    } catch (e) {
      sysLog.error('Web 驾驶舱启动失败 (非致命):', e.message)
    }
  } else {
    sysLog.info('[1/6] Web 驾驶舱已禁用 (WEB_ENABLED=false)')
  }

  // Phase 2: 启动独立基础模块
  sysLog.info('[2/6] 启动 Identity...')
  await mods.identity.start()

  sysLog.info('[3/6] 启动 Memory...')
  await mods.memory.start()

  // Phase 3: 引擎 (依赖外部 OpenCode serve)
  sysLog.info('[4/6] 启动 Engine...')
  await mods.engine.start()

  // Phase 4: 小脑 (守护大脑 — Engine 之后启动，确保有大脑可守护)
  sysLog.info('[5/6] 启动 Cerebellum (小脑守护)...')
  try {
    await mods.cerebellum.start()
  } catch (e) {
    sysLog.error('小脑启动失败 (非致命，大脑仍可用):', e.message)
  }

  // Phase 5: Telegram 适配器
  sysLog.info('[6/6] 启动 Telegram Bot...')
  await mods.telegram.start()
}

/**
 * 按逆序优雅关闭所有模块
 */
async function stopAll(mods) {
  sysLog.info('开始优雅关闭...')

  // 逆序: 先停适配器，最后停基础模块
  try { await mods.telegram.stop() } catch (e) { sysLog.error('Telegram 停止失败:', e.message) }
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
  modules = createModules()

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

main().catch(err => {
  log.error('启动失败:', err)
  process.exit(1)
})

export { startAll, stopAll }
