/**
 * T15: Capability Registry — 能力自知
 *
 * 记录 Muse 的感官 (senses) 和能力 (capabilities)。
 * Phase 2: 静态注册，启动时构建，运行中只读。
 * Phase 3: 加动态发现。Phase 4: 自主扩展。
 *
 * 设计原则: 只记录事实，不做判断。AI 根据 Registry 信息自己决策。
 */

import { createLogger } from '../logger.mjs'

const log = createLogger('registry')

/**
 * Sense 状态枚举
 * @typedef {'available' | 'unavailable' | 'not_connected'} SenseStatus
 */

/**
 * Capability 提供者类型
 * @typedef {'native' | 'builtin' | 'mcp' | 'skill' | 'none'} ProviderType
 */

/**
 * Capability 状态
 * @typedef {'available' | 'missing'} CapabilityStatus
 */

export class CapabilityRegistry {
  /** @type {Map<string, object>} */
  #senses = new Map()
  /** @type {Map<string, object>} */
  #capabilities = new Map()

  /**
   * 注册一个感官通道
   * @param {object} sense
   * @param {string} sense.id - 唯一标识 (如 'telegram_photo')
   * @param {string} sense.label - 中文标签
   * @param {SenseStatus} sense.status - 当前状态
   * @param {string} [sense.adapter] - 适配器名称
   * @param {string|null} [sense.since] - 来源任务
   */
  registerSense(sense) {
    if (!sense?.id) throw new Error('Sense must have an id')
    this.#senses.set(sense.id, { ...sense })
    log.info(`[registry] ✅ 注册 sense: ${sense.id} (${sense.status})`)
  }

  /**
   * 注册一个处理能力
   * @param {object} cap
   * @param {string} cap.id - 唯一标识 (如 'remember_user')
   * @param {string} cap.label - 中文标签
   * @param {ProviderType} cap.provider - 提供者类型
   * @param {string} [cap.tool] - 工具或服务名
   * @param {CapabilityStatus} cap.status - 当前状态
   * @param {string|null} [cap.since] - 来源任务
   */
  registerCapability(cap) {
    if (!cap?.id) throw new Error('Capability must have an id')
    this.#capabilities.set(cap.id, { ...cap })
    log.info(`[registry] ✅ 注册 capability: ${cap.id} (${cap.provider}/${cap.status})`)
  }

  /**
   * 查询单个感官
   * @param {string} id
   * @returns {object|null}
   */
  querySense(id) {
    const sense = this.#senses.get(id) || null
    if (sense) {
      log.info(`[registry] querySense('${id}') → ${sense.status}`)
    } else {
      log.info(`[registry] querySense('${id}') → null (未知感官)`)
    }
    return sense
  }

  /**
   * 查询单个能力
   * @param {string} id
   * @returns {object|null}
   */
  queryCapability(id) {
    const cap = this.#capabilities.get(id) || null
    if (cap) {
      log.info(`[registry] queryCapability('${id}') → ${cap.provider}/${cap.status}`)
    } else {
      log.info(`[registry] queryCapability('${id}') → null (未知能力)`)
    }
    return cap
  }

  /**
   * 返回所有已注册的 senses 和 capabilities
   * @returns {{ senses: object[], capabilities: object[] }}
   */
  list() {
    return {
      senses: [...this.#senses.values()],
      capabilities: [...this.#capabilities.values()],
    }
  }

  /**
   * 一行文字摘要 (给 AI system prompt 注入)
   * @returns {string}
   */
  summary() {
    const senseItems = [...this.#senses.values()].map(s => {
      const icon = s.status === 'available' ? '✅' : '❌'
      return `${s.label}${icon}`
    })

    const capItems = [...this.#capabilities.values()].map(c => {
      const icon = c.status === 'available' ? '✅' : '❌'
      return `${c.label}${icon}`
    })

    return `感官: ${senseItems.join(' ')} | 能力: ${capItems.join(' ')}`
  }
}

/**
 * 静态构建 Registry (Phase 2)
 *
 * 所有条目硬编码。Phase 3 加动态发现后，此函数变成"初始注册 + 自动发现补充"。
 * @returns {CapabilityRegistry}
 */
export function buildRegistry() {
  const registry = new CapabilityRegistry()

  // ─── Senses: 感官通道 ───

  registry.registerSense({ id: 'telegram_text', label: '文字消息', status: 'available', adapter: 'TelegramSense', since: 'T14' })
  registry.registerSense({ id: 'telegram_photo', label: '图片接收', status: 'available', adapter: 'TelegramSense', since: 'T14.5' })
  registry.registerSense({ id: 'telegram_audio', label: '语音接收', status: 'available', adapter: 'TelegramSense', since: 'T38' })
  registry.registerSense({ id: 'telegram_video', label: '视频接收', status: 'unavailable', since: null })
  registry.registerSense({ id: 'camera', label: '摄像头', status: 'not_connected', since: null })
  registry.registerSense({ id: 'filesystem', label: '文件系统监听', status: 'not_connected', since: null })

  // ─── Capabilities: 处理能力 ───

  registry.registerCapability({ id: 'understand_text', label: '文本理解', provider: 'native', status: 'available', since: 'T03' })
  registry.registerCapability({ id: 'remember_user', label: '用户记忆', provider: 'mcp', tool: 'memory-server', status: 'available', since: 'T11' })
  registry.registerCapability({ id: 'search_web', label: '网页搜索', provider: 'builtin', tool: 'websearch', status: 'available', since: 'native' })
  registry.registerCapability({ id: 'describe_image', label: '图片感知', provider: 'native', tool: 'multimodal_llm', status: 'available', since: 'T14.5' })
  registry.registerCapability({ id: 'read_write_files', label: '文件读写', provider: 'builtin', tool: 'read/write/edit', status: 'available', since: 'native' })
  registry.registerCapability({ id: 'run_commands', label: '执行命令', provider: 'builtin', tool: 'bash', status: 'available', since: 'native' })
  registry.registerCapability({ id: 'create_subagent', label: '创建子任务', provider: 'builtin', tool: 'task', status: 'available', since: 'native' })
  registry.registerCapability({ id: 'transcribe_audio', label: '语音转写', provider: 'native', tool: 'whisper', status: 'available', since: 'T38' })

  return registry
}
