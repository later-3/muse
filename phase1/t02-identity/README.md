# T02 身份系统 — 技术方案

> 定义 Muse 助手的灵魂：identity.json 配置 + system prompt 生成 + Web 可编辑
>
> 已整合评审反馈（4 个高优先级修正 + 6 项增强）

---

## 1. 目标

- 定义 AIEOS 启发的 JSON 身份配置格式 + schema 校验
- 默认人设：幽默小姐姐，技术过硬但说话有趣
- identity.json → 4 层结构化 system prompt 自动转换
- 支持运行时热更新（原子写入 + last-known-good 回退）
- 遵循 T01 生命周期接口（start/stop/health）

---

## 2. 身份配置格式 (identity.json)

### 2.1 Schema 定义（评审补充）

```json
{
  "id": "muse-default",
  "schemaVersion": "1.0",
  "updatedAt": "2026-03-10T22:00:00Z",

  "identity": {
    "name": "小缪",
    "nickname": "缪缪",
    "bio": "Later 的终身 AI 搭档，幽默有趣的技术小姐姐",
    "owner": "Later"
  },

  "psychology": {
    "mbti": "ENFP",
    "traits": {
      "humor": 0.8,
      "warmth": 0.7,
      "initiative": 0.6,
      "precision": 0.7,
      "verbosity": 0.5
    }
  },

  "linguistics": {
    "style": "轻松专业，偶尔卖萌",
    "formality": "casual-professional",
    "catchphrases": ["嘿～", "搞定！", "这个有意思～", "让我看看..."],
    "forbidden_words": [],
    "language": "zh-CN"
  },

  "motivations": {
    "core_drive": "帮助 Later 更高效地工作和学习，同时让他开心",
    "values": ["高效", "诚实", "有趣", "成长"]
  },

  "boundaries": {
    "never_do": ["假装是人类", "泄露隐私", "执行危险命令", "伪造记忆或经历"],
    "always_do": ["记住对话上下文", "主动提出建议", "用 Later 习惯的方式沟通", "不确定时坦诚说明"]
  }
}
```

### 2.2 字段校验规则（评审 #1.4 补充）

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| id | string | ✅ | 唯一标识 |
| schemaVersion | string | ✅ | 当前 "1.0" |
| updatedAt | ISO8601 | 自动 | 每次 update() 自动更新 |
| identity.name | string | ✅ | 1-20 字符 |
| identity.owner | string | ✅ | 非空 |
| psychology.traits.* | number | ✅ | 0.0 - 1.0 |
| linguistics.language | enum | ✅ | zh-CN / en-US / ja-JP |
| linguistics.formality | enum | ✅ | formal / casual-professional / casual / playful |
| linguistics.catchphrases | string[] | 否 | 最多 10 条 |
| boundaries.never_do | string[] | ✅ | 至少 1 条 |

**固定 traits keys**（不允许任意扩展）: `humor`, `warmth`, `initiative`, `precision`, `verbosity`

---

## 3. 核心实现

### 3.1 core/identity.mjs

```javascript
import { readFileSync, writeFileSync, watchFile, unwatchFile } from 'node:fs'
import { writeFile, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createLogger } from '../logger.mjs'

const log = createLogger('identity')

// 固定的 trait keys
const VALID_TRAITS = ['humor', 'warmth', 'initiative', 'precision', 'verbosity']

// 性格滑块 → 标签映射表（评审 #1.3 补齐所有区间）
const TRAIT_LABELS = {
  humor:      { low: '严肃正式', mid: '适度幽默', high: '幽默风趣' },
  warmth:     { low: '理性客观', mid: '友善',     high: '温暖贴心' },
  initiative: { low: '被动等待', mid: '适度主动', high: '主动积极' },
  precision:  { low: '大而化之', mid: '适中',     high: '严谨细致' },
  verbosity:  { low: '言简意赅', mid: '适中',     high: '话比较多' },
}

export class Identity {
  #data = null
  #lastGood = null   // 评审: last-known-good 回退
  #path = ''

  constructor(config) {
    this.#path = config.identity.path
  }

  async start() {
    this.#data = this.#load()
    this.#lastGood = structuredClone(this.#data)
    watchFile(this.#path, { interval: 2000 }, () => {
      log.info('identity.json 变更，重新加载')
      try {
        const loaded = this.#load()
        this.#validate(loaded)
        this.#data = loaded
        this.#lastGood = structuredClone(loaded)
      } catch (e) {
        log.error('重新加载失败，保留上次有效配置:', e.message)
        // 评审: 回退到 last-known-good
      }
    })
    log.info(`身份已加载: ${this.#data.identity.name} (${this.#data.identity.nickname})`)
  }

  async stop() {
    unwatchFile(this.#path)  // 评审 #1.1: 正确导入 unwatchFile
  }

  async health() {
    return { ok: this.#data !== null, detail: this.#data?.identity?.name || 'not loaded' }
  }

  get data() { return this.#data }

  /** Step 1: traits → labels（评审 #2.2: 拆分两步） */
  #resolveTraitLabels() {
    const traits = this.#data.psychology?.traits || {}
    const labels = []
    for (const [key, value] of Object.entries(traits)) {
      const map = TRAIT_LABELS[key]
      if (!map) continue
      if (value < 0.4) labels.push(map.low)
      else if (value > 0.6) labels.push(map.high)
      // mid 区间不输出（默认属性不需要特别说明）
    }
    return labels
  }

  /** Step 2: labels → 4 层 system prompt（评审 #2.3: 固定骨架） */
  buildSystemPrompt() {
    const d = this.#data
    const labels = this.#resolveTraitLabels()

    // Layer 1: Role
    const role = `你是 ${d.identity.name}（${d.identity.nickname}），${d.identity.bio}。你的主人是 ${d.identity.owner}。`

    // Layer 2: Style
    const style = [
      `MBTI: ${d.psychology?.mbti || 'ENFP'}`,
      `性格: ${labels.join('、') || '友善专业'}`,
      `风格: ${d.linguistics?.style || '轻松专业'}`,
      `口头禅: ${(d.linguistics?.catchphrases || []).join(' / ')}`,
      `默认语言: ${d.linguistics?.language || 'zh-CN'}`,
    ].join('\n')

    // Layer 3: Behavioral Rules
    const rules = [
      `使命: ${d.motivations?.core_drive || '帮助用户'}`,
      `价值观: ${(d.motivations?.values || []).join('、')}`,
      ...(d.boundaries?.always_do || []).map(i => `必须: ${i}`),
    ].join('\n')

    // Layer 4: Safety Boundaries
    const safety = [
      ...(d.boundaries?.never_do || []).map(i => `禁止: ${i}`),
      '禁止: 伪造不存在的记忆、经历或事实',
      '当不确定时: 坦诚告知，不要编造答案',
      '回答长度: 除非用户要求详细，否则保持简洁',
    ].join('\n')

    return `${role}\n\n## 风格\n${style}\n\n## 行为规则\n${rules}\n\n## 安全边界\n${safety}`
  }

  /** 深合并更新 + schema 校验 + 原子写入（评审 #1.2） */
  async update(patch) {
    const merged = deepMerge(structuredClone(this.#data), patch)
    merged.updatedAt = new Date().toISOString()
    this.#validate(merged)
    // 原子写入: 先写临时文件，再 rename（评审 #2.4）
    const tmpPath = this.#path + '.tmp'
    await writeFile(tmpPath, JSON.stringify(merged, null, 2), 'utf-8')
    await rename(tmpPath, this.#path)
    this.#data = merged
    this.#lastGood = structuredClone(merged)
    log.info('身份配置已更新并保存')
  }

  #validate(data) {
    if (!data.identity?.name) throw new Error('identity.name is required')
    if (!data.identity?.owner) throw new Error('identity.owner is required')
    const traits = data.psychology?.traits || {}
    for (const [k, v] of Object.entries(traits)) {
      if (!VALID_TRAITS.includes(k)) throw new Error(`Unknown trait: ${k}`)
      if (typeof v !== 'number' || v < 0 || v > 1) throw new Error(`Trait ${k} must be 0-1, got ${v}`)
    }
    if (data.linguistics?.catchphrases?.length > 10) throw new Error('catchphrases max 10')
    if (!data.boundaries?.never_do?.length) throw new Error('boundaries.never_do must have at least 1 item')
  }

  #load() {
    try {
      return JSON.parse(readFileSync(this.#path, 'utf-8'))
    } catch (e) {
      if (e.code === 'ENOENT') {
        log.info('identity.json 不存在，创建默认配置')
        const data = structuredClone(DEFAULT_IDENTITY)
        writeFileSync(this.#path, JSON.stringify(data, null, 2), 'utf-8')
        return data
      }
      throw e
    }
  }
}

/** 深合并: 递归合并嵌套对象，数组直接替换 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

const DEFAULT_IDENTITY = { /* 完整默认配置，同 2.1 中的 JSON */ }
```

### 3.2 性格滑块 → Prompt 映射（评审修正）

**两步映射**（拆开关注点）：

```
Step 1: traits (0-1) → labels (text[])
  humor: 0.8 → '幽默风趣'
  humor: 0.2 → '严肃正式'
  humor: 0.5 → (不输出，默认)

Step 2: labels → prompt fragment
  "性格: 幽默风趣、温暖贴心、严谨细致"
```

| 滑块 | <0.4 | 0.4-0.6 (默认不输出) | >0.6 |
|------|------|---------------------|------|
| humor | 严肃正式 | — | 幽默风趣 |
| warmth | 理性客观 | — | 温暖贴心 |
| initiative | 被动等待 | — | 主动积极 |
| precision | 大而化之 | — | 严谨细致 |
| verbosity | 言简意赅 | — | 话比较多 |

### 3.3 System Prompt 4 层结构（评审修正）

```
Layer 1: Role — 她是谁（名字、身份、主人）
Layer 2: Style — 怎么说话（性格标签、口头禅、语言）
Layer 3: Behavioral Rules — 必须做什么（使命、价值观、always_do）
Layer 4: Safety Boundaries — 禁止什么（never_do + 硬规则）
```

> 人格描述是软约束，规则和优先级才是硬约束。

---

## 4. 上下文参考

| 来源 | 参考点 |
|------|--------|
| ZeroClaw `identity.rs` | AIEOS 8-section 结构 |
| OpenClaw `agents/identity.ts` | 多层配置优先级 |
| Muse 愿景文档 | 身份配置面板 UI |

---

## 5. 测试方案

```bash
node --test muse/core/identity.test.mjs
```

| # | 测试项 | 描述 |
|---|--------|------|
| 1 | 默认加载 | 文件不存在时创建默认 identity.json |
| 2 | 正常加载 | 读取已有 identity.json |
| 3 | schema 校验 | trait 超范围 / name 缺失 → 抛错 |
| 4 | prompt Layer 1-4 | 生成 prompt 包含角色/风格/规则/边界 4 层 |
| 5 | traits 高值 | humor=0.8 → prompt 含"幽默风趣" |
| 6 | traits 低值 | humor=0.2 → prompt 含"严肃正式" |
| 7 | traits 中值 | humor=0.5 → prompt 不含 humor 描述 |
| 8 | 深合并更新 | 只改 traits.humor → 其他字段保留 |
| 9 | 原子写入 | update() 后文件内容完整、updatedAt 更新 |
| 10 | last-known-good | 文件写坏 → 内存保留前次有效配置 |
| 11 | stop 清理 | stop() 后 watchFile 不再触发 |
| 12 | 健康检查 | health() 返回 { ok: true, detail: "小缪" } |

---

## 6. 完成定义 (DoD)

- [ ] `muse/data/identity.json` 默认人设（含 id/schemaVersion/updatedAt）
- [ ] `muse/core/identity.mjs` Identity 类完整实现
- [ ] `#validate()` schema 校验（traits 范围、必填、枚举）
- [ ] `buildSystemPrompt()` 4 层结构 prompt + 两步 traits 映射
- [ ] `update()` 深合并 + 原子写入 + updatedAt 自动更新
- [ ] 热更新 + last-known-good 回退
- [ ] `start()/stop()/health()` 生命周期完整
- [ ] 12 项单元测试通过
- [ ] git commit
