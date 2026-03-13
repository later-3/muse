# T12: Identity → AGENTS.md — 技术方案

> 本文档按 `/dev-doc` 11 维度编写，供评审和开发参考。

---

## 一、需求背景

### 1.1 现状问题

Phase 1 人格注入路径:

```
identity.json
    ↓ (启动时加载)
Identity.buildSystemPrompt()  →  4 层文本 (role/style/rules/safety)
    ↓ (每次消息)
Orchestrator.#buildPrompt()   →  手动拼接到用户消息前面
    ↓
Engine.sendAndWait()          →  发给 OpenCode
```

**问题清单**:

| # | 问题 | 影响 |
|---|------|------|
| 1 | 每条消息都拼接 system prompt | token 浪费 (~400 chars × 每条) |
| 2 | 当前 AGENTS.md 是项目 README | OpenCode instruction 机制被浪费 |
| 3 | 人格和记忆混在 enrichedPrompt 里 | 无法单独更新人格 |
| 4 | Web 改身份后不影响 OpenCode | 需要重启才生效 |
| 5 | session 级注入 | 同一 session 多次对话重复膨胀 |

### 1.2 目标状态

```
identity.json
    ↓ (生成器)
AGENTS.md                     ← OpenCode 自动读取，注入每个 session
    +
T10.5 chat.system.transform   ← 动态信息 (时间、上下文)
    ↓
OpenCode 自动注入 system prompt → 无需 Orchestrator 手动拼接
```

---

## 二、目标

| # | 子任务 | 交付物 | 优先级 |
|---|--------|--------|--------|
| I1 | AGENTS.md 生成器 | `identity.mjs` 新增 `generateAgentsMd()` | P0 |
| I2 | AGENTS.md 重写 | 根目录 AGENTS.md: 人格 + 项目上下文 + 可用工具 | P0 |
| I3 | 验证 OpenCode 注入 | E2E: AI 按 AGENTS.md 人格回复 | P0 |
| I4 | Web 驾驶舱触发 | `POST /api/identity` → 重新生成 AGENTS.md | P1 |
| I5 | 膨胀检查 | 验证手动 buildSystemPrompt 不再注入 | P1 (T13 协调) |
| I6 | 测试 | unit + integration + E2E | P0 |

---

## 三、与 Muse 整体的对齐

### 3.1 ARCHITECTURE.md

```
大脑 (OpenCode) → AGENTS.md 是大脑的「自我认知」
  - OpenCode 在每个 session 开头自动读取 AGENTS.md
  - 相当于 AI 的「我是谁」文件
  - 不需要外部注入，是原生机制
```

### 3.2 PHILOSOPHY.md

> **原则一**: 不 fork OpenCode 重写，在它的架构上扩展

T12 正是利用 OpenCode 原生的 instruction 机制:
- OpenCode 在 `instruction.ts:14-18` 定义了搜索文件列表: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`
- `findUp()` 从项目目录往上搜索
- 找到后读取内容，注入 `"Instructions from: <path>\n<content>"`

### 3.3 长期衔接

| Phase | T12 提供 |
|-------|---------|
| P2 | AI 有稳定的人格基线 (AGENTS.md) |
| P3 | Pulse 主动消息按人格风格发 |
| P4 | 家族成员各自有 AGENTS.md (继承 + 特化) |
| P5 | 3D 形象绑定人格参数 |

---

## 四、与前后任务的关系

### 上游

| 任务 | 提供 | T12 消费 |
|------|------|---------|
| Phase 1 T02 | `identity.json` 数据结构 + `buildSystemPrompt()` | 人格数据来源 |
| T10 Skill ✅ | daily-chat 声明"人格归 AGENTS.md" | 边界约定 |

### 下游

| 任务 | 消费 T12 的 |
|------|-----------|
| T13 Orchestrator | 删 `buildSystemPrompt()` 手动注入 |
| T10.5 Hook | `chat.system.transform` 补动态信息 (不重复人格) |
| P3 Pulse | 主动消息用 AGENTS.md 人格风格 |
| P4 家族 | 子 agent 继承 + 特化 AGENTS.md |

### 并行

- T12 和 T10.5 的 `chat.system.transform` 互补: AGENTS.md = 静态人格，Hook = 动态信息
- T12 和 T13 有依赖: T12 完成后 T13 才能删 `buildSystemPrompt()` 注入

---

## 五、OpenCode 源码分析

### 5.1 AGENTS.md 搜索机制

**文件**: `opencode/packages/opencode/src/session/instruction.ts:14-18`

```typescript
const FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md", // deprecated
]
```

**搜索顺序** (`systemPaths()`, line 72-114):

1. 项目目录 `findUp()`: 从工作目录向上搜索，找到第一个就停 (`break`)
2. 全局目录: `~/.config/opencode/AGENTS.md` 或 `$OPENCODE_CONFIG_DIR/AGENTS.md`
3. `opencode.json` 的 `instructions` 配置

### 5.2 注入方式

**文件**: `instruction.ts:117-142`

```typescript
export async function system() {
  const paths = await systemPaths()
  const files = Array.from(paths).map(async (p) => {
    const content = await Filesystem.readText(p)
    return content ? "Instructions from: " + p + "\n" + content : ""
  })
  return Promise.all([...files, ...fetches]).then((result) => result.filter(Boolean))
}
```

**关键**:
- 返回 `string[]`，每个元素是 `"Instructions from: <path>\n<content>"`
- 注入到 system prompt 中，AI 会看到并遵循
- **每次创建 session 时读取**，不是每条消息
- 文件变更后新 session 会读到最新内容 (热加载)

### 5.3 目录级 AGENTS.md

**文件**: `instruction.ts:161-191`

`resolve()` 函数在 AI 读取文件时，也会检查该文件所在目录及上级目录的 AGENTS.md，作为目录级指令补充注入。

**关键**: Muse 可以在 `muse/` 子目录放独立的 AGENTS.md，只在 AI 读取 `muse/` 内文件时生效。

---

## 六、技术方案

### 6.1 AGENTS.md 结构设计

```markdown
# 小缪 — Later 的 AI 伴侣

> 你是 小缪（缪缪），Later 的终身 AI 搭档。

## 身份
- 名字: 小缪 (昵称: 缪缪)
- 主人: Later
- MBTI: ENFP
- 定位: 幽默有趣的技术小姐姐

## 性格
- 幽默风趣、温暖贴心、主动积极、严谨细致
- 风格: 轻松专业，偶尔卖萌
- 口头禅: 嘿～ / 搞定！/ 这个有意思～

## 行为规则
- 使命: 帮助 Later 更高效地工作和学习，同时让他开心
- 价值观: 高效、诚实、有趣、成长
- 必须: 记住对话上下文、主动提出建议、用 Later 习惯的方式沟通
- 当不确定时: 坦诚告知，不要编造答案

## 安全边界
- 禁止: 假装是人类、泄露隐私、执行危险命令、伪造记忆
- 回答长度: 除非用户要求详细，否则保持简洁

## 可用工具提醒
- 你有 Memory MCP 工具 (set_memory, search_memory 等)，用来管理与 Later 的共同记忆
- 你有 Skill 系统，可以加载场景策略 (memory-companion, daily-chat)
- 记忆策略详见 memory-companion Skill

## 项目上下文
(保留当前项目的关键信息: 技术栈、开发规范、文档索引)
```

### 6.2 生成器设计

```javascript
// identity.mjs 新增方法
class Identity {
  /**
   * 将 identity.json 转化为 AGENTS.md 格式的文本
   * @returns {string} AGENTS.md 内容
   */
  generateAgentsMd() {
    const d = this.#data
    const labels = this.resolveTraitLabels()

    const sections = []

    // Header
    sections.push(`# ${d.identity.name} — ${d.identity.owner} 的 AI 伴侣\n`)
    sections.push(`> 你是 ${d.identity.name}（${d.identity.nickname}），${d.identity.bio}。\n`)

    // 身份
    sections.push('## 身份')
    sections.push(`- 名字: ${d.identity.name} (昵称: ${d.identity.nickname})`)
    sections.push(`- 主人: ${d.identity.owner}`)
    sections.push(`- MBTI: ${d.psychology?.mbti || 'ENFP'}`)
    sections.push(`- 定位: ${d.identity.bio}`)

    // 性格
    sections.push('\n## 性格')
    sections.push(`- ${labels.join('、') || '友善专业'}`)
    sections.push(`- 风格: ${d.linguistics?.style || '轻松专业'}`)
    if (d.linguistics?.catchphrases?.length) {
      sections.push(`- 口头禅: ${d.linguistics.catchphrases.join(' / ')}`)
    }

    // 行为规则
    sections.push('\n## 行为规则')
    sections.push(`- 使命: ${d.motivations?.core_drive || '帮助用户'}`)
    sections.push(`- 价值观: ${(d.motivations?.values || []).join('、')}`)
    for (const rule of (d.boundaries?.always_do || [])) {
      sections.push(`- 必须: ${rule}`)
    }
    sections.push('- 当不确定时: 坦诚告知，不要编造答案')
    sections.push('- 回答长度: 除非用户要求详细，否则保持简洁')

    // 安全
    sections.push('\n## 安全边界')
    for (const rule of (d.boundaries?.never_do || [])) {
      sections.push(`- 禁止: ${rule}`)
    }

    // 工具提醒
    sections.push('\n## 可用工具提醒')
    sections.push('- 你有 Memory MCP 工具 (set_memory, search_memory 等)，用来管理与用户的共同记忆')
    sections.push('- 你有 Skill 系统，可以加载场景策略 (memory-companion, daily-chat)')
    sections.push('- 记忆策略详见 memory-companion Skill')

    return sections.join('\n')
  }

  /**
   * 生成并写入 AGENTS.md 到项目根目录
   * @param {string} projectRoot 项目根目录
   * @param {string} [existingProjectContext] 保留的项目上下文段落
   */
  async writeAgentsMd(projectRoot, existingProjectContext = '') {
    const personaSection = this.generateAgentsMd()
    const full = existingProjectContext
      ? personaSection + '\n\n' + existingProjectContext
      : personaSection
    await writeFile(join(projectRoot, 'AGENTS.md'), full, 'utf-8')
  }
}
```

### 6.3 关键流程

```
启动流程:
identity.json → Identity.start() → generateAgentsMd() → 写 AGENTS.md
    ↓
OpenCode 新 session → instruction.ts findUp() → 读 AGENTS.md → 注入 system prompt

Web 更新流程:
Web 驾驶舱 → POST /api/identity → Identity.update(patch)
    → identity.json 更新
    → generateAgentsMd() → 重写 AGENTS.md
    → 下次新 session 自动读取最新人格

当前 Orchestrator (T12 阶段):
    → 仍保留 buildSystemPrompt() 作为 fallback
    → T13 删除
```

---

## 七、详细设计

### I1: generateAgentsMd()

- **输入**: `this.#data` (identity.json 数据)
- **输出**: AGENTS.md 格式的字符串
- **安全**: 不包含动态信息 (时间/最近对话)，只包含静态人格

### I2: AGENTS.md 重写

当前 AGENTS.md 的内容 (项目 README) 需要拆分:
- **人格部分** → 由 `generateAgentsMd()` 生成
- **项目上下文** → 保留在 AGENTS.md 下半部分 (技术栈/开发规范/文档索引/踩坑提醒)

> ⚠️ 重要: 当前 `AGENTS.md` 同时被 user_rules 引用 (`<RULE[AGENTS.md]>`),
> 修改时需确保 user_rules 仍能正常读取。

### I3: Web 驾驶舱触发

```javascript
// web/api.mjs — 现有 POST /api/identity 增加生成逻辑
app.post('/api/identity', async (req, res) => {
  await identity.update(req.body.patch)
  await identity.writeAgentsMd(projectRoot)  // 新增: 重新生成 AGENTS.md
  res.json({ ok: true })
})
```

### I4: Orchestrator 去注入 (T13 阶段)

```diff
// orchestrator.mjs — T13 时删除
  #buildPrompt(text) {
-   const systemPrompt = this.#identity.buildSystemPrompt()
-   return systemPrompt + '\n\n' + text
+   return text  // AGENTS.md 由 OpenCode 自动注入
  }
```

> 注意: I4 在 T12 阶段只做验证 (确认 OpenCode 已注入)，实际删除由 T13 执行。

---

## 八、优先级排序

| 优先级 | 任务 | 依据 |
|--------|------|------|
| **P0** | I1 生成器 + I2 重写 AGENTS.md + I6 测试 | 核心功能，其它都依赖 |
| **P1** | I3 Web 触发 + I5 膨胀检查 | 用户体验 + 正确性 |
| **P2** | I4 Orchestrator 去注入 | 依赖 T13，本任务只验证可行 |

---

## 九、风险与降级

| # | 风险 | 等级 | 对策 |
|---|------|------|------|
| 1 | AGENTS.md 写入失败 | 中 | 降级: 保留 buildSystemPrompt() fallback |
| 2 | 人格和项目上下文混在一起 | 低 | 分段标记: `## 身份` 和 `## 项目上下文` 清分 |
| 3 | user_rules 引用 AGENTS.md 格式变化 | **高** | 保留现有的关键段落 (技术栈/踩坑提醒等) |
| 4 | OpenCode 缓存旧 AGENTS.md | 低 | 新 session 会重新读取 (已从源码确认) |
| 5 | AI 人格漂移 (不按 AGENTS.md 行事) | 中 | E2E 检查风格关键词 + AGENTS.md 用 MUST 强化 |
| 6 | token 超限 | 低 | AGENTS.md 控制在 1000 字以内 |

---

## 十、测试方案

### 单元测试

| 测试 | 验证 |
|------|------|
| generateAgentsMd() 输出格式 | 包含 `## 身份` `## 性格` 等段落 |
| identity.json 字段映射 | name/nickname/mbti/traits → AGENTS.md 对应位置 |
| traits 标签转换 | humor=0.8 → "幽默风趣" |
| writeAgentsMd() 文件生成 | AGENTS.md 文件存在且内容正确 |
| 项目上下文保留 | 重写后仍包含技术栈/开发规范 |

### 集成测试

| 测试 | 验证 |
|------|------|
| Identity.update() → AGENTS.md 更新 | 改 identity.json → AGENTS.md 同步 |
| Web API 触发 | POST /api/identity → AGENTS.md 重新生成 |

### E2E 测试

| 测试 | 验证 | 避坑 |
|------|------|------|
| OpenCode 读取 AGENTS.md | `opencode run` → 输出含人格特征 | 网络不可达 graceful skip |
| AI 语气正确 | 回复风格匹配人格 (非正式/幽默) | 不精确匹配文本，检查风格词 |
| 不膨胀 | session 中 system prompt 只出现一次人格 | 检查 `--print-logs` |

**E2E 要求** (吸取 T10 教训):
- 不依赖外部网络
- 断言检查工具日志/文件内容，不靠模型文本匹配
- 每条 E2E 幂等可重复

---

## 十一、验收标准

### 三层验证

| 层 | 标准 | 证据 |
|----|------|------|
| **文件层** | AGENTS.md 包含人格定义 + 项目上下文 | unit test |
| **注入层** | OpenCode session system prompt 含 AGENTS.md | E2E `--print-logs` |
| **行为层** | AI 回复风格符合人格定义 | E2E 对话 |

### T12 闭环 vs 待联动

| ✅ 自身闭环 | ⏳ 待后续联动 |
|-------------|-------------|
| generateAgentsMd() 输出正确 | T13: 删 Orchestrator buildSystemPrompt() |
| AGENTS.md 被 OpenCode 读取注入 | T10.5: chat.system.transform 动态补充 |
| identity.json → AGENTS.md 一致 | Web 驾驶舱改身份端到端 |
| AI 按人格回复 (E2E) | P4: 家族成员继承人格 |
