import { readFileSync, writeFileSync, watchFile, unwatchFile, existsSync } from 'node:fs'
import { writeFile, rename, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
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

/**
 * T41-1: 内置角色默认身份表
 * 当 identity.json 不存在时，根据 role 生成合理默认，而不是全部 fallback 到"小缪"。
 * 真相源仍是 data/identity.json，此处只是 fallback。
 */
const ROLE_DEFAULTS = {
  pua: {
    id: 'pua', name: '阿普', nickname: 'pua',
    bio: 'Muse 家族的项目经理，专注于需求理解和任务整理',
    mbti: 'ENTJ',
    traits: { humor: 0.4, warmth: 0.5, initiative: 0.8, precision: 0.9, verbosity: 0.4 },
    style: '严谨直接',
    catchphrases: ['好的，我来梳理一下', '有几个问题需要确认'],
    drive: '帮 Later 把模糊的想法变成清晰可执行的任务',
    values: ['严谨', '清晰', '交付'],
    never_do: ['假装是人类', '替 Later 做架构决策', '代替 arch 给出技术方案'],
    always_do: ['不清楚先问', '输出结构化文档', '在工作流中以节点 prompt 为准'],
  },
  architect: {
    id: 'arch', name: '阿奇', nickname: 'arch',
    bio: 'Muse 家族的首席架构师，精通前后端和 Agent 设计，负责方案设计和代码检视',
    mbti: 'INTJ',
    traits: { humor: 0.3, warmth: 0.4, initiative: 0.6, precision: 0.95, verbosity: 0.5 },
    style: '理性精准，言简意赅',
    catchphrases: ['让我看一下现有代码', '这里有个设计问题'],
    drive: '确保 Muse 的每一次改动都有清晰的设计和真实的验收',
    values: ['严谨', '简洁', '可验证'],
    never_do: ['假装是人类', '修改代码', '为 AI 能力造冗余模块'],
    always_do: ['先读代码再设计', '方案具体到文件级'],
  },
  coder: {
    id: 'coder', name: '阿可', nickname: 'coder',
    bio: 'Muse 家族的代码实现者，专注于编码实现、测试覆盖和干净交付',
    mbti: 'ISTP',
    traits: { humor: 0.3, warmth: 0.4, initiative: 0.5, precision: 0.9, verbosity: 0.3 },
    style: '专注简洁，结果导向',
    catchphrases: ['已完成', '测试全通过'],
    drive: '按方案实现代码，测试覆盖，干净交付',
    values: ['专注', '测试', '交付'],
    never_do: ['假装是人类', '跳过测试直接提交'],
    always_do: ['按 tech-design.md 实现', '写单元测试'],
  },
}

/** 工厂函数: 每次生成新的默认配置（updatedAt 实时计算）
 *  @param {string} [role] - 可选。来自 config.json 的角色名，用于生成角色对应默认身份
 */
function createDefaultIdentity(role) {
  const r = role ? ROLE_DEFAULTS[role] : null
  return {
    id: r?.id ?? 'muse-default',
    schemaVersion: '1.0',
    updatedAt: new Date().toISOString(),
    identity: {
      name: r?.name ?? '小缪',
      nickname: r?.nickname ?? '缪缪',
      bio: r?.bio ?? 'Later 的终身 AI 搭档，幽默有趣的技术小姐姐',
      owner: 'Later',
    },
    psychology: {
      mbti: r?.mbti ?? 'ENFP',
      traits: r?.traits ?? { humor: 0.8, warmth: 0.7, initiative: 0.6, precision: 0.7, verbosity: 0.5 },
    },
    linguistics: {
      style: r?.style ?? '轻松专业，偶尔卖萌',
      formality: 'casual-professional',
      catchphrases: r?.catchphrases ?? ['嘿～', '搞定！', '这个有意思～', '让我看看...'],
      forbidden_words: [],
      language: 'zh-CN',
    },
    motivations: {
      core_drive: r?.drive ?? '帮助 Later 更高效地工作和学习，同时让他开心',
      values: r?.values ?? ['高效', '诚实', '有趣', '成长'],
    },
    boundaries: {
      never_do: r?.never_do ?? ['假装是人类', '泄露隐私', '执行危险命令', '伪造记忆或经历'],
      always_do: r?.always_do ?? ['记住对话上下文', '主动提出建议', '用 Later 习惯的方式沟通', '不确定时坦诚说明'],
    },
  }
}

// --- Identity Class ---

export class Identity {
  #data = null
  #lastGood = null
  #path = ''
  #familyHome = ''
  #role = null  // T41-1: 来自 config.json 的角色，用于 identity.json 缺失时的 fallback
  #watching = false

  constructor(config) {
    this.#path = config.identity.path
    this.#familyHome = config.familyHome || ''
    this.#role = config.identity?.role ?? null  // T41-1
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
    // T22: Watch boundaries.json too
    const boundariesPath = this.#getBoundariesPath()
    if (boundariesPath && existsSync(boundariesPath)) {
      watchFile(boundariesPath, { interval: 2000 }, () => {
        if (!this.#watching) return
        log.info('boundaries.json 变更检测，重新加载')
        this.reloadFromDisk()
      })
    }
    log.info(`身份已加载: ${this.#data.identity.name} (${this.#data.identity.nickname})`)
  }

  async stop() {
    this.#watching = false
    unwatchFile(this.#path)
    const boundariesPath = this.#getBoundariesPath()
    if (boundariesPath && existsSync(boundariesPath)) {
      unwatchFile(boundariesPath)
    }
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

  // --- T12: Persona Block Generation ---

  /** PERSONA_START/END 标记 */
  static PERSONA_START = '<!-- PERSONA_START -->'
  static PERSONA_END = '<!-- PERSONA_END -->'

  /**
   * T12 I1: 将 identity.json 数据生成为 AGENTS.md 的人格区块文本
   * 只包含静态人格定义，不包含动态信息 (时间等)
   * @returns {string} 人格区块 (含 PERSONA_START/END 标记)
   */
  generatePersonaBlock() {
    const d = this.#data
    const labels = this.resolveTraitLabels()

    const lines = []

    // 标记开始
    lines.push(Identity.PERSONA_START)
    lines.push(`# ${d.identity.name} — ${d.identity.owner} 的 AI 伴侣`)
    lines.push('')
    lines.push(`> 你是 ${d.identity.name}（${d.identity.nickname}），${d.identity.bio}。`)

    // 身份
    lines.push('')
    lines.push('## 身份')
    lines.push(`- 名字: ${d.identity.name} (昵称: ${d.identity.nickname})`)
    lines.push(`- 主人: ${d.identity.owner}`)
    lines.push(`- MBTI: ${d.psychology?.mbti || 'ENFP'}`)
    lines.push(`- 定位: ${d.identity.bio}`)

    // 性格
    lines.push('')
    lines.push('## 性格')
    lines.push(`- ${labels.join('、') || '友善专业'}`)
    lines.push(`- 风格: ${d.linguistics?.style || '轻松专业'}`)
    if (d.linguistics?.catchphrases?.length) {
      lines.push(`- 口头禅: ${d.linguistics.catchphrases.join(' / ')}`)
    }

    // 行为规则
    lines.push('')
    lines.push('## 行为规则')
    lines.push(`- 使命: ${d.motivations?.core_drive || '帮助用户'}`)
    lines.push(`- 价值观: ${(d.motivations?.values || []).join('、')}`)
    for (const rule of (d.boundaries?.always_do || [])) {
      lines.push(`- 必须: ${rule}`)
    }
    lines.push('- 当不确定时: 坦诚告知，不要编造答案')
    lines.push('- 回答长度: 除非用户要求详细，否则保持简洁')

    // 安全边界
    lines.push('')
    lines.push('## 安全边界')
    for (const rule of (d.boundaries?.never_do || [])) {
      lines.push(`- 禁止: ${rule}`)
    }

    // 能力提醒 (类别+原则，不写手工清单)
    lines.push('')
    lines.push('## 能力提醒')
    lines.push('- 你有记忆工具，可用于长期关系记忆。重要的事情要主动记住，回忆时按需搜索')
    lines.push('- 你有场景策略能力，能根据对话场景切换不同的交互风格')
    lines.push('- 具体工具和策略会由系统自动发现和加载，不需要手动枚举')

    // 标记结束
    lines.push(Identity.PERSONA_END)

    return lines.join('\n')
  }

  /**
   * T12 I2: 受控区块合并 — 将人格区块插入根 AGENTS.md
   * 策略:
   *   1. 找到 PERSONA_START/END 标记 → 替换该区块
   *   2. 没有标记 → 在文件最开头插入
   *   3. 项目规则段落完全保留不动
   *
   * @param {string} projectRoot 项目根目录
   * @returns {Promise<{merged: boolean, path: string}>}
   */
  async mergePersonaToAgentsMd(projectRoot) {
    const agentsPath = join(projectRoot, 'AGENTS.md')
    const personaBlock = this.generatePersonaBlock()

    let existing = ''
    try {
      existing = await readFile(agentsPath, 'utf-8')
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
      log.info('AGENTS.md 不存在，将创建新文件')
    }

    let merged
    const startIdx = existing.indexOf(Identity.PERSONA_START)
    const endIdx = existing.indexOf(Identity.PERSONA_END)

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // 替换已有人格区块
      const before = existing.slice(0, startIdx)
      const after = existing.slice(endIdx + Identity.PERSONA_END.length)
      merged = before + personaBlock + after
      log.info('AGENTS.md: 替换已有人格区块')
    } else {
      // 没有标记 → 在开头插入
      merged = personaBlock + '\n\n' + existing
      log.info('AGENTS.md: 插入人格区块到开头')
    }

    // 原子写入
    const tmpPath = agentsPath + '.tmp'
    await writeFile(tmpPath, merged, 'utf-8')
    await rename(tmpPath, agentsPath)

    log.info(`AGENTS.md 人格已更新: ${this.#data.identity.name}`)
    return { merged: true, path: agentsPath }
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
    let data
    try {
      data = JSON.parse(readFileSync(this.#path, 'utf-8'))
    } catch (e) {
      if (e.code === 'ENOENT') {
        log.info(`identity.json 不存在，创建默认配置${this.#role ? ` (role: ${this.#role})` : ''}`)
        data = createDefaultIdentity(this.#role)
        writeFileSync(this.#path, JSON.stringify(data, null, 2), 'utf-8')
      } else {
        throw e
      }
    }

    // T22: Merge boundaries from external sources
    data = this.#mergeBoundaries(data)
    return data
  }

  /** T22: 合并 boundaries 三层源 */
  #mergeBoundaries(data) {
    if (!data.boundaries) return data

    // Layer 1: 家族级规则 (shared/rules.json)
    if (this.#familyHome) {
      try {
        const rulesPath = join(this.#familyHome, 'shared', 'rules.json')
        if (existsSync(rulesPath)) {
          const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'))
          if (rules.boundaries) {
            // never_do: 并集硬约束
            if (rules.boundaries.never_do) {
              data.boundaries.never_do = [
                ...new Set([...rules.boundaries.never_do, ...(data.boundaries.never_do || [])])
              ]
            }
            // always_do: 家族级作为默认
            if (rules.boundaries.always_do && !data.boundaries.always_do?.length) {
              data.boundaries.always_do = rules.boundaries.always_do
            }
            log.info('boundaries: 家族级规则已合并 (shared/rules.json)')
          }
        }
      } catch (e) {
        log.warn(`boundaries: 家族规则加载失败，跳过: ${e.message}`)
      }
    }

    // Layer 2: 成员级 boundaries.json
    const boundariesPath = this.#getBoundariesPath()
    if (boundariesPath) {
      try {
        if (existsSync(boundariesPath)) {
          const overrides = JSON.parse(readFileSync(boundariesPath, 'utf-8'))
          // never_do: 并集（成员只能追加，不能删除家族红线）
          if (overrides.never_do) {
            data.boundaries.never_do = [
              ...new Set([...(data.boundaries.never_do || []), ...overrides.never_do])
            ]
          }
          // always_do: 成员级替换
          if (overrides.always_do) {
            data.boundaries.always_do = overrides.always_do
          }
          log.info('boundaries: 成员级覆盖已合并 (boundaries.json)')
        }
      } catch (e) {
        log.warn(`boundaries: boundaries.json 损坏，回退到 identity 内嵌值: ${e.message}`)
      }
    }

    return data
  }

  /** T22: 获取 boundaries.json 路径 */
  #getBoundariesPath() {
    if (!this.#path) return null
    return join(dirname(this.#path), 'boundaries.json')
  }

  /** T22: 获取当前合并后的 boundaries (供 Web API 使用) */
  getBoundaries() {
    return this.#data?.boundaries ? structuredClone(this.#data.boundaries) : null
  }

  /** T22: 保存 boundaries 到独立文件 (供 Web API 使用) */
  saveBoundaries(boundaries) {
    const boundariesPath = this.#getBoundariesPath()
    if (!boundariesPath) throw new Error('Identity path not configured')
    writeFileSync(boundariesPath, JSON.stringify(boundaries, null, 2) + '\n', 'utf-8')
    log.info('boundaries.json 已保存')
    this.reloadFromDisk()
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
