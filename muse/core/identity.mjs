import { readFileSync, writeFileSync, watchFile, unwatchFile } from 'node:fs'
import { writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('identity')

// --- Constants ---

const VALID_TRAITS = ['humor', 'warmth', 'initiative', 'precision', 'verbosity']

const TRAIT_LABELS = {
  humor:      { low: '严肃正式', high: '幽默风趣' },
  warmth:     { low: '理性客观', high: '温暖贴心' },
  initiative: { low: '被动等待', high: '主动积极' },
  precision:  { low: '大而化之', high: '严谨细致' },
  verbosity:  { low: '言简意赅', high: '话比较多' },
}

const VALID_LANGUAGES = ['zh-CN', 'en-US', 'ja-JP']
const VALID_FORMALITY = ['formal', 'casual-professional', 'casual', 'playful']

/** 工厂函数: 每次生成新的默认配置（updatedAt 实时计算） */
function createDefaultIdentity() {
  return {
    id: 'muse-default',
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    identity: {
      name: '小缪',
      nickname: '缪缪',
      bio: 'Later 的终身 AI 搭档，幽默有趣的技术小姐姐',
      owner: 'Later',
    },
    psychology: {
      mbti: 'ENFP',
      traits: { humor: 0.8, warmth: 0.7, initiative: 0.6, precision: 0.7, verbosity: 0.5 },
    },
    linguistics: {
      style: '轻松专业，偶尔卖萌',
      formality: 'casual-professional',
      catchphrases: ['嘿～', '搞定！', '这个有意思～', '让我看看...'],
      forbidden_words: [],
      language: 'zh-CN',
    },
    motivations: {
      core_drive: '帮助 Later 更高效地工作和学习，同时让他开心',
      values: ['高效', '诚实', '有趣', '成长'],
    },
    boundaries: {
      never_do: ['假装是人类', '泄露隐私', '执行危险命令', '伪造记忆或经历'],
      always_do: ['记住对话上下文', '主动提出建议', '用 Later 习惯的方式沟通', '不确定时坦诚说明'],
    },
  }
}

// --- Identity Class ---

export class Identity {
  #data = null
  #lastGood = null
  #path = ''
  #watching = false

  constructor(config) {
    this.#path = config.identity.path
  }

  async start() {
    this.#data = this.#load()
    this.#validate(this.#data)
    this.#lastGood = structuredClone(this.#data)
    this.#watching = true
    watchFile(this.#path, { interval: 2000 }, () => {
      if (!this.#watching) return
      log.info('identity.json 变更检测，重新加载')
      this.reloadFromDisk()
    })
    log.info(`身份已加载: ${this.#data.identity.name} (${this.#data.identity.nickname})`)
  }

  async stop() {
    this.#watching = false
    unwatchFile(this.#path)
    log.info('身份系统已停止')
  }

  async health() {
    return {
      ok: this.#data !== null,
      detail: this.#data?.identity?.name || 'not loaded',
    }
  }

  /** 获取当前身份数据（只读副本，防止绕过 update/validate） */
  get data() {
    return structuredClone(this.#data)
  }

  /** 重新从磁盘加载配置（公开以支持测试） */
  reloadFromDisk() {
    try {
      const loaded = this.#load()
      this.#validate(loaded)
      this.#data = loaded
      this.#lastGood = structuredClone(loaded)
      log.info(`身份重新加载成功: ${loaded.identity.name}`)
      return true
    } catch (e) {
      log.error('重新加载失败，保留上次有效配置:', e.message)
      return false
    }
  }

  /**
   * Step 1: traits (0-1) → labels (text[])
   * <0.4 → low label, >0.6 → high label, 0.4-0.6 → skip (default)
   */
  resolveTraitLabels() {
    const traits = this.#data?.psychology?.traits || {}
    const labels = []
    for (const key of VALID_TRAITS) {
      const value = traits[key]
      if (value === undefined) continue
      const map = TRAIT_LABELS[key]
      if (value < 0.4) labels.push(map.low)
      else if (value > 0.6) labels.push(map.high)
      // 0.4-0.6: default, don't output
    }
    return labels
  }

  /**
   * Step 2: 生成 4 层结构化 system prompt
   * Layer 1: Role   — 她是谁
   * Layer 2: Style  — 怎么说话
   * Layer 3: Rules  — 必须做什么
   * Layer 4: Safety — 禁止什么
   */
  buildSystemPrompt() {
    const d = this.#data
    const labels = this.resolveTraitLabels()

    // Layer 1: Role
    const role = `你是 ${d.identity.name}（${d.identity.nickname}），${d.identity.bio}。你的主人是 ${d.identity.owner}。`

    // Layer 2: Style
    const styleParts = [
      `- MBTI: ${d.psychology?.mbti || 'ENFP'}`,
      `- 性格: ${labels.join('、') || '友善专业'}`,
      `- 风格: ${d.linguistics?.style || '轻松专业'}`,
    ]
    const catchphrases = d.linguistics?.catchphrases || []
    if (catchphrases.length > 0) {
      styleParts.push(`- 口头禅: ${catchphrases.join(' / ')}`)
    }
    styleParts.push(`- 默认语言: ${d.linguistics?.language || 'zh-CN'}`)

    // Layer 3: Behavioral Rules
    const rulesParts = [
      `- 使命: ${d.motivations?.core_drive || '帮助用户'}`,
      `- 价值观: ${(d.motivations?.values || []).join('、')}`,
    ]
    for (const rule of (d.boundaries?.always_do || [])) {
      rulesParts.push(`- 必须: ${rule}`)
    }

    // Layer 4: Safety Boundaries
    const safetyParts = []
    for (const rule of (d.boundaries?.never_do || [])) {
      safetyParts.push(`- 禁止: ${rule}`)
    }
    safetyParts.push('- 当不确定时: 坦诚告知，不要编造答案')
    safetyParts.push('- 回答长度: 除非用户要求详细，否则保持简洁')

    return [
      role,
      '',
      '## 风格',
      ...styleParts,
      '',
      '## 行为规则',
      ...rulesParts,
      '',
      '## 安全边界',
      ...safetyParts,
    ].join('\n')
  }

  /**
   * 更新身份数据（Web 驾驶舱调用）
   * 深合并 + schema 校验 + 原子写入
   */
  async update(patch) {
    const merged = deepMerge(structuredClone(this.#data), patch)
    merged.updatedAt = new Date().toISOString()
    this.#validate(merged)

    // 原子写入: tmp + rename
    const tmpPath = this.#path + '.tmp'
    await writeFile(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    await rename(tmpPath, this.#path)

    this.#data = merged
    this.#lastGood = structuredClone(merged)
    log.info('身份配置已更新并保存')
  }

  /** Schema 校验 */
  #validate(data) {
    const errors = []

    // Required fields
    if (!data.identity?.name) errors.push('identity.name is required')
    if (!data.identity?.owner) errors.push('identity.owner is required')
    if (data.identity?.name && data.identity.name.length > 20) {
      errors.push('identity.name must be <= 20 characters')
    }

    // Traits: must be known keys, 0-1 range
    const traits = data.psychology?.traits
    if (traits) {
      for (const [k, v] of Object.entries(traits)) {
        if (!VALID_TRAITS.includes(k)) errors.push(`Unknown trait: "${k}"`)
        if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`Trait "${k}" must be 0-1, got ${v}`)
      }
    }

    // Linguistics enums
    if (data.linguistics?.language && !VALID_LANGUAGES.includes(data.linguistics.language)) {
      errors.push(`Invalid language: "${data.linguistics.language}" (valid: ${VALID_LANGUAGES.join(', ')})`)
    }
    if (data.linguistics?.formality && !VALID_FORMALITY.includes(data.linguistics.formality)) {
      errors.push(`Invalid formality: "${data.linguistics.formality}" (valid: ${VALID_FORMALITY.join(', ')})`)
    }

    // Catchphrases limit
    if (data.linguistics?.catchphrases?.length > 10) {
      errors.push('catchphrases max 10 items')
    }

    // Boundaries
    if (!data.boundaries?.never_do?.length) {
      errors.push('boundaries.never_do must have at least 1 item')
    }

    if (errors.length > 0) {
      throw new Error('Identity validation failed:\n  - ' + errors.join('\n  - '))
    }
  }

  /** 从文件加载，不存在则创建默认 */
  #load() {
    try {
      return JSON.parse(readFileSync(this.#path, 'utf-8'))
    } catch (e) {
      if (e.code === 'ENOENT') {
        log.info('identity.json 不存在，创建默认配置')
        const data = createDefaultIdentity()
        writeFileSync(this.#path, JSON.stringify(data, null, 2), 'utf-8')
        return data
      }
      throw e
    }
  }
}

// --- Utilities ---

/** 深合并: 递归合并嵌套对象，数组直接替换 */
export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv)
        && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      deepMerge(tv, sv)
    } else {
      target[key] = sv
    }
  }
  return target
}

export { createDefaultIdentity, VALID_TRAITS, TRAIT_LABELS }
