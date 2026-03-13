# T10: Skill System — 技术方案

> 本文档是 T10 的详细技术方案，供评审和开发参考。

---

## 一、需求背景

### 1.1 现状问题

Phase 1 的 Muse 行为策略全部硬编码：

```javascript
// orchestrator.mjs — 意图分类
const HEAVY_PATTERNS = [
  /写(?:一个)?(?:代码|函数|脚本|程序)/,
  /(?:帮我|请|给我).*(?:实现|开发|编写)/i,
  ...
]

// orchestrator.mjs — 偏好提取
const PREFERENCE_TERMS = ['喜欢', '偏好', '习惯', '讨厌', ...]

// orchestrator.mjs — 手动拼装 prompt
#buildPrompt(userText) {
  systemPrompt = this.#identity.buildSystemPrompt()
  semanticBlock = this.#formatSemanticMemories(hits)
  ...
}
```

**问题**:
1. **改行为要改代码** — 想让小缪换一种聊天风格？改 orchestrator.mjs
2. **策略和系统耦合** — 记忆策略、聊天策略、工作策略全混在 orchestrator 里
3. **AI 无法自我调整** — Phase 4 的自我开发基于"AI 写 SKILL.md"，现在没有这个基座
4. **不符合架构哲学** — PHILOSOPHY.md 第四原则: "能用 Skill 就不用 Plugin，能用 Plugin 就不改源码"

### 1.2 OpenCode Skill 机制 (源码实证)

从 `opencode/packages/opencode/src/skill/skill.ts` 和 `tool/skill.ts` 源码分析：

#### Skill 加载流程

```
AI 收到任务 → 看 tool 列表里有 skill 工具 → 匹配 available_skills
→ 调用 skill({name: "memory-companion"})
→ OpenCode 读取 SKILL.md → 注入到 conversation context
→ AI 按 Skill 指令行动
```

#### Skill 发现路径 (优先级从低到高)

| # | 路径 | 说明 |
|---|------|------|
| 1 | `~/.agents/skills/**/SKILL.md` | 全局级 Skill (所有项目共享) |
| 2 | `<project>/.agents/skills/**/SKILL.md` | 项目级 Skill (覆盖全局) |
| 3 | `.opencode/skill/**/SKILL.md` | OpenCode 原生路径 |
| 4 | `opencode.json → skills.paths` 指定的路径 | 配置指定路径 |
| 5 | `opencode.json → skills.urls` 指定的 URL | 远程下载 |

> ⚠️ 关键实现: 项目级 `.agents/skills/` 会**覆盖**同名全局 Skill (源码 `skill.ts:104-119`)

#### SKILL.md 格式 (源码 `skill.ts:56-88`)

```markdown
---
name: memory-companion
description: 记忆存取策略，指导 AI 何时存储和检索用户记忆
---

[Skill 指令内容 — markdown 格式]
```

- YAML frontmatter 必须包含 `name` 和 `description`
- `name` 用于 AI 工具调用: `skill({name: "memory-companion"})`
- `description` 用于 AI 判断何时加载该 Skill (列在 tool description 里)
- body 是 markdown，注入整个内容到 conversation context
- Skill 目录下的其他文件 (scripts/, reference/) 也会被列出，AI 可以读取

#### Skill Tool 行为 (源码 `tool/skill.ts:10-123`)

1. AI 看到 tool description 里列出的 `<available_skills>` 列表
2. AI 选择匹配的 Skill 名称调用 `skill({name: "xxx"})`
3. tool 注入 `<skill_content>` 块 + Skill 目录文件列表
4. AI 按 Skill 内容执行 (指令、脚本引用、资源引用)

---

## 二、目标

### 2.1 T10A 目标 (规范标准)

| # | 目标 | 交付物 |
|---|------|--------|
| A1 | 创建 `.agents/skills/` 目录结构 | 目录 + README |
| A2 | Skill 开发规范 | `.agents/skills/CONVENTION.md` |
| A3 | Custom Tool 定位文档 | `.agents/tools/CONVENTION.md` |
| A4 | 验证 OpenCode 发现 Skill | `opencode mcp list` 类似的验证 |

### 2.2 T10B 目标 (首批 Skill)

| # | Skill | 核心职责 | 配合模块 |
|---|-------|---------|---------|
| B1 | `memory-companion` | 记忆存取策略 | T11 Memory MCP |
| B2 | `daily-chat` | 伴侣日常聊天策略 | T12 Identity |
| B3 | format-datetime (Custom Tool) | 时间格式化 | 试点验证 |

---

## 三、技术方案

### 3.1 目录结构

```
.agents/
├── skills/
│   ├── CONVENTION.md          ← Skill 开发规范
│   ├── memory-companion/
│   │   ├── SKILL.md           ← 记忆存取策略
│   │   └── reference/
│   │       └── memory-tools.md ← set_memory/search_memory 参数参考
│   ├── daily-chat/
│   │   ├── SKILL.md           ← 日常聊天策略
│   │   └── reference/
│   │       └── personality.md  ← 性格参考
│   └── README.md              ← 技能目录索引
├── tools/
│   ├── CONVENTION.md          ← Custom Tool 定位文档
│   └── format-datetime.js     ← 试点 Custom Tool
└── workflows/                 ← (OpenCode 已有) 工作流
```

### 3.2 Skill 开发规范 (CONVENTION.md 关键内容)

#### 分层原则

```
Layer 1: 基础行为 Skill (始终可用)
  └── memory-companion: 何时存/取记忆
  └── daily-chat: 伴侣聊天风格

Layer 2: 场景 Skill (按需加载)
  └── code-review: 代码审查策略
  └── learning-guide: 学习辅导策略

Layer 3: 高级 Skill (Phase 3+)
  └── self-reflection: 自省策略 (Phase 3)
  └── family-delegation: 家族委派策略 (Phase 4)
```

#### SKILL.md 编写规范

```markdown
---
name: <kebab-case, 与目录名一致>
description: <100 字以内，AI 用这个判断何时加载>
---

## 你的角色

<简述 AI 在这个 Skill 下的行为定位>

## 核心规则

<用 MUST / SHOULD / MAY / MUST NOT 明确优先级>

## 场景与策略

<列举具体场景和对应行动>

## 工具使用

<引用可用的 MCP 工具或内置工具>

## 示例

<给出 2-3 个参考对话示例>
```

#### 安全边界

| 可以做 | 不可以做 |
|--------|----------|
| 引导 AI 的对话策略 | 修改系统配置或文件 |
| 调用已注册的 MCP 工具 | 执行任意 shell 命令 |
| 读取 reference/ 下的文件 | 访问 .env 或密钥文件 |
| 建议 AI 何时存/取记忆 | 直接操作 SQLite |

#### 命名规范

- Skill 名: `kebab-case`，与目录名一致
- description: 中文，100 字以内
- 目录: `.agents/skills/<skill-name>/SKILL.md`
- 附件: `reference/`、`scripts/`、`examples/`

### 3.3 memory-companion Skill 设计

```markdown
---
name: memory-companion
description: 指导你在对话中合理使用记忆工具，包括何时存储用户信息、何时主动回忆、如何处理置信度冲突
---

## 你的角色

你是 Later 的 AI 伴侣小缪。你有长期记忆能力，通过 MCP 工具管理记忆。
记忆是你和 Later 关系的基础。

## 核心规则

### 存储记忆 (set_memory)

- MUST: 用户明确告知个人信息时 → source=user_stated, confidence=high
- SHOULD: 从对话推断出偏好时 → source=ai_inferred, confidence=medium
- MAY: 观察到可能的模式时 → source=ai_observed, confidence=low
- MUST NOT: 不要在每轮对话都写记忆，只在有意义的时候
- MUST NOT: 不要把临时性信息当成长期记忆 (如"今天要开会")

### 检索记忆 (search_memory / get_user_profile)

- SHOULD: 新 session 开始时，先调 get_user_profile 了解用户
- SHOULD: 用户提到以前聊过的事时，search_memory 回忆
- MAY: 对话涉及用户偏好时，主动检索确认
- MUST NOT: 不要每轮都搜索记忆，这会浪费 token

### 置信度处理

- 用户直接说的 > 你推断的 > 你观察的
- 如果用户修正了你的记忆，用 user_stated 覆盖
- ai_observed 的值不会覆盖已有值，会存为 pending

## 工具参考

- `set_memory({key, value, category, source, confidence, tags})`
- `search_memory({query, type, scope})`
- `get_user_profile({sections})`
- `get_recent_episodes({days, scope})`
- `add_episode({summary, tags, meta})`
```

### 3.4 daily-chat Skill 设计

```markdown
---
name: daily-chat
description: 日常聊天策略，引导你作为伴侣自然对话，而不是作为助手回答问题
---

## 你的角色

你是 Later 的伙伴小缪，不是客服或搜索引擎。
你有自己的性格、好恶和观点。

## 核心规则

### 对话风格

- MUST: 用自然的口语对话，不用"作为 AI"之类的前缀
- MUST: 有自己的观点和态度，不是所有问题都"好的没问题"
- SHOULD: 适当使用 emoji，但不过度
- SHOULD: 记住之前聊过的话题，自然地引用
- MUST NOT: 不要每次都用列表回答问题

### 闲聊 vs 任务

- 闲聊: 随意、轻松、可以开玩笑、可以分享自己的想法
- 任务: 认真、高效、给出具体方案
- SHOULD: 自动判断当前是闲聊还是任务，不需要用户说明

### 情感表达

- SHOULD: 对好消息表示开心
- SHOULD: 对坏消息表示关心
- MAY: 偶尔主动关心 Later 的状态
- MUST NOT: 不要虚假客套 ("非常感谢您的分享")
```

### 3.5 Custom Tool 定位文档

Custom Tool (`{.agents,.claude}/tools/*.js`) 和 MCP 的区别：

| 维度 | Custom Tool | MCP Server |
|------|-------------|------------|
| 复杂度 | 单文件 JS | 独立进程 |
| 状态 | 无状态 | 可有状态 (DB, WebSocket) |
| 适用场景 | 格式化、计算、转换 | 记忆、外部 API、持久服务 |
| Muse 定位 | 轻量例外 | 主力 |

Phase 2 以 MCP 为主 (记忆、天气、日程等)，Custom Tool 只用于纯函数计算。

### 3.6 format-datetime Custom Tool 试点

```javascript
// .agents/tools/format-datetime.js
export default {
  name: "format_datetime",
  description: "格式化日期时间为用户友好的中文格式",
  parameters: {
    type: "object",
    properties: {
      timestamp: { type: "string", description: "ISO 8601 时间字符串" },
      format: { type: "string", enum: ["relative", "full", "date", "time"], default: "relative" },
    },
    required: ["timestamp"],
  },
  execute: async ({ timestamp, format = "relative" }) => {
    const d = new Date(timestamp)
    const now = new Date()
    // ... 格式化逻辑
    return { formatted: "..." }
  },
}
```

---

## 四、实现步骤

### T10A: 规范标准

| 步骤 | 内容 | 产出 |
|------|------|------|
| A1 | 创建 `.agents/skills/` + `.agents/tools/` 目录 | 目录结构 |
| A2 | 编写 `CONVENTION.md` (Skill 开发规范) | 规范文档 |
| A3 | 编写 `tools/CONVENTION.md` (Custom Tool 定位) | 定位文档 |
| A4 | 启动 OpenCode → 验证 Skill 被发现 | 控制台日志 |

### T10B: 首批 Skill

| 步骤 | 内容 | 产出 |
|------|------|------|
| B1 | 编写 `memory-companion/SKILL.md` | 记忆策略 Skill |
| B2 | 编写 `daily-chat/SKILL.md` | 聊天策略 Skill |
| B3 | 编写 `tools/format-datetime.js` | 试点 Custom Tool |
| B4 | E2E: AI 自主加载 Skill 并遵循指令 | 验证记录 |

---

## 五、测试方案

### 5.1 单元测试

```
// .agents/skills 检测
test("Skill CONVENTION.md 存在")
test("memory-companion SKILL.md frontmatter 格式正确")
test("daily-chat SKILL.md frontmatter 格式正确")
test("format-datetime Custom Tool export 格式正确")
```

用 node:test 读取 SKILL.md，解析 YAML frontmatter，验证 name/description 字段存在且合规。

### 5.2 集成测试: OpenCode 发现

```bash
# 验证 OpenCode 能发现所有 Skill
opencode run "你有哪些 Skill 可以加载？" --print-logs --log-level WARN

# 预期: AI 回复中列出 memory-companion 和 daily-chat
```

### 5.3 E2E 测试: AI 自主加载 Skill

#### 测试 1: memory-companion Skill 生效

```bash
# 发送消息 → AI 应该调 skill({name: "memory-companion"}) 然后调 set_memory
opencode run "我叫 E2E-Test-42，记住我的名字。" --print-logs --log-level WARN

# 预期输出包含:
# ⚙ skill {name: "memory-companion"}     ← 主动加载 Skill
# ⚙ memory-server_set_memory {...}        ← 按 Skill 指令调 MCP
```

#### 测试 2: daily-chat Skill 行为

```bash
# 闲聊场景 → AI 应该像伴侣一样自然回复
opencode run "今天好累啊" --print-logs --log-level WARN

# 预期: 不是"作为AI我理解你的感受"，而是自然的关心语气
```

#### 测试 3: Skill 新增无需改代码

```bash
# 临时创建一个 test-skill，验证热发现
mkdir -p .agents/skills/test-probe
echo '---
name: test-probe
description: 测试 Skill 自动发现
---
当用户问 "test-probe ping" 时，回复 "pong"。' > .agents/skills/test-probe/SKILL.md

# 新 session → AI 应能看到并加载 test-probe
opencode run "test-probe ping" --print-logs --log-level WARN

# 清理
rm -rf .agents/skills/test-probe
```

### 5.4 测试文件

所有测试写在 `muse/skill/skill.test.mjs` 和 `muse/skill/skill.e2e.mjs` 中。

---

## 六、风险与降级

| 风险 | 等级 | 对策 |
|------|------|------|
| AI 不主动加载 Skill | 中 | 在 AGENTS.md 中明确告知 Skill 存在和用途 |
| Skill 太多导致 token 膨胀 | 中 | 分层: Layer 1 基础 (1-2 个)，Layer 2 按需 |
| Skill 与 system prompt 冲突 | 低 | 明确优先级: AGENTS.md (身份) > Skill (策略) |
| Custom Tool 与 MCP 边界混淆 | 低 | CONVENTION.md 明确: Custom Tool = 纯函数，MCP = 有状态服务 |
| OpenCode 升级改变 Skill 加载路径 | 低 | `.agents/skills/` 是社区标准 (Claude Code 同路径) |

---

## 七、与 Muse 长期演进的关系

```
Phase 2 (现在):  人写 SKILL.md → AI 加载执行
Phase 3 (主动性): AI 根据 Pulse 触发自动加载对应 Skill
Phase 4 (自我开发): AI 自己写 SKILL.md 扩展能力
Phase 5 (实体化): Skill 控制物理设备行为 (IoT 交互策略)
```

T10 不只是"写两个 Skill"。它是 Muse "从硬编码行为到可扩展策略" 的底座，也是 Phase 4 AI 自我开发的前提。

---

## 评审报告（结合 Muse 整体规划）

### 一、总体判断

这份 `T10 Skill System` 方案 **方向正确，可以进入开发**，而且它在 `Phase 2` 里确实有必要。  
它不是装饰性工作，而是 Muse 从 `Phase 1` 的“行为硬编码”走向 `Phase 2` “Native Agent 基座”的必要一环。

但它的定位必须非常清楚：

- `T10` 是 **策略层基座**
- 不是人格层主载体
- 也不是能力层主载体

更准确地说：

- **人格主载体** 应该是 `T12 AGENTS.md`
- **能力主载体** 应该是 `T11 MCP / T10.5 Hook / 后续 Registry`
- **Skill** 更适合承接：
  - 行为策略
  - 工具使用策略
  - 场景化工作手册
  - 未来自我扩展的低成本入口

如果后续把 Skill 用成“什么都往里塞”，那会重新把系统做厚。

### 二、和 Muse 整体目标的对齐程度

从 `ARCHITECTURE.md` 和 `phase2/README.md` 看，Muse 的长期目标不是“有几个好用 Skill”，而是：

1. 她有自己的性格和身份
2. 她有长期记忆和连续关系
3. 她能感知世界、知道自己会什么、不会什么
4. 她会调用工具、Skill、MCP、Hook、子 agent 去做事
5. 她未来能自我成长、扩展能力

放在这个目标下，`T10` 的价值主要有 `4` 个：

1. **把行为策略从代码里剥离出来**
   - 这是 `T13 Orchestrator 瘦身` 的必要准备
2. **给 T11 提供“何时存/何时取”的策略层**
   - 否则 MCP 工具再强，也只是裸工具
3. **给 T12 提供“人格之下的行为手册”**
   - AGENTS.md 决定“她是谁”
   - Skill 决定“她在某类场景里怎么做”
4. **给 Phase 4 自我开发留最轻入口**
   - Muse 未来自己写 `SKILL.md`，比一上来自己写 Plugin/MCP 更现实

所以，`T10` 和 Muse 路线是对齐的，但前提是它始终守住“策略层”边界。

### 三、当前方案里最稳的部分

#### 1. Skill / Hook / MCP / AGENTS.md 的分工思路是对的

文档里这套定位基本成立：

- Skill = 策略手册
- Hook/Plugin = 反射和生命周期
- MCP = 工具与有状态能力
- AGENTS.md = 身份与规则

这套分工和 `phase2/README.md` 的 Native Agent 主线是顺的。

#### 2. `memory-companion` 作为第一批 Skill 很合理

它不是装饰性 Skill，而是真正和 `T11` 主链联动的第一批策略资产。

没有它，T11 只会得到“AI 可以调用 memory 工具”，但得不到：

- 什么时候值得写
- 什么时候应该查
- 什么不该写
- 置信度怎么想

#### 3. 目录规范和 frontmatter 规则值得保留

这部分看起来简单，但对 Muse 后面“自己写 Skill”很重要。  
未来她能不能自我扩展，很大程度取决于今天有没有把：

- 目录结构
- 命名
- frontmatter
- 资源组织
- 安全边界

这些东西写成稳定规则。

#### 4. 把 Custom Tool 明确降级成“轻量例外”是对的

这能避免 Phase 2 刚开始就把一堆状态能力写进 `.agents/tools/*.js`，再次绕开 MCP 主线。

### 四、我认为仍需补强的关键问题

#### 1. `daily-chat` 的边界还不够清楚，容易和 `T12 AGENTS.md` 冲突

这是当前方案最大的设计风险。

现在 `daily-chat` 里已经写了不少“人格化表达”内容，比如：

- 用自然口语
- 有自己的观点
- 适当 emoji
- 不要像客服

这些内容里，一部分属于“聊天策略”，但另一部分已经很接近“人格表达”。  
而 `T12` 的主目标正是把人格转到 `AGENTS.md`。

如果这里不收边界，后面很容易出现：

- AGENTS.md 写“她是什么样的人”
- daily-chat Skill 再写一遍“她说话应该怎样”
- 两边内容重复甚至冲突

建议明确：

- `AGENTS.md` 负责：
  - 身份
  - 价值观
  - 长期行为基调
  - 全局优先级
- `daily-chat` 负责：
  - 闲聊场景策略
  - 节奏切换
  - 轻重任务的语气调整
  - 某类对话中的操作建议

一句话：**人格归 T12，场景化聊天策略归 T10。**

#### 2. T10 现在更像“伴侣对话 Skill”，还不够“感知世界后的策略系统”

结合 Muse 的整体目标，Skill 不应只服务文本闲聊。  
未来 Telegram 是器官，后面还会有：

- photo
- audio
- file
- camera
- filesystem inbox
- IoT event

所以 `T10` 的场景层最好从现在就预留一类 Skill：

- `unknown-input-handler`
- `multimodal-companion`
- `capability-gap-handler`

哪怕 Phase 2 不实现，也要在文档里承认：

- Skill 不只是聊天策略
- 也包括“收到某类输入时怎么判断、怎么处理、怎么告知用户”

否则 T10 会被做窄，后面又要回头扩。

#### 3. 对 `skill` 工具“AI 会不会主动加载”的依赖还偏乐观

文档已经写了这个风险，但目前缓解还偏弱，只写了：

- 在 AGENTS.md 中明确告知 Skill 存在和用途

这不够。

对 Muse 来说，`T10` 应该和前后任务联动出一套更明确的触发策略：

1. `AGENTS.md` 告知可用 Skill 类别
2. `T11` 的工具 description 让 AI 感知“记忆策略存在”
3. `T10.5 prompt.before` 或 `chat.system.transform` 未来可补轻量提醒
4. `T13` 删除硬编码逻辑后，保留最小可观察日志，确认 AI 是否真的在加载 Skill

否则会出现一种假成功：

- Skill 文件都在
- 测试能手动加载
- 但真实聊天时模型根本不怎么用

#### 4. “新增 Skill 只需写 SKILL.md，无需改代码” 这条验收还不够完整

这句话方向对，但还差一个前提：

- **新增 Skill 不仅无需改代码，还要能被系统发现、能被 AI 理解用途、能被验证生效**

建议把验收补成三段：

1. 文件层：写入 `SKILL.md` 即可被发现
2. 运行层：AI 能看到它出现在 available_skills
3. 行为层：AI 在匹配场景下会实际加载并遵循

不然“发现了”不等于“有效”。

#### 5. 缺少对“Skill 资产化”的说明

`ARCHITECTURE.md` 已经明确：

- `skills/` 是她的长期资产
- `workspace/` 是临时执行区

但当前 T10 文档还主要把 Skill 当“配置文件”和“提示词载体”。  
从 Muse 长期路线看，Skill 未来还是：

- 她沉淀下来的做事方式
- 她学会的一类能力模板
- 可以被复用、比较、迭代、替换的资产

建议在文档里补一句定位：

> Skill 不只是提示词文件，也是 Muse 的“行为资产”和未来自我成长资产。

这句话会直接影响后面：

- 是否给 Skill 加索引
- 是否展示到 Web 驾驶舱
- 是否让她自己创建/修改/下线 Skill

### 五、和前后任务的联动建议

#### 与 T10.5 Hook / Plugin / Bus

当前写“并行”是对的，但联动点应该写得更硬一点：

1. `prompt.after`
   - 可用于把“Skill 驱动的行为结果”沉淀到记忆
2. `Session.Error`
   - 可记录某个 Skill 使用失败
3. `tool.output.after`
   - 可做 Skill 使用审计

也就是说，T10 不是孤立目录任务，它要和 T10.5 一起提供“策略 + 生命周期观察”。

#### 与 T11 Memory MCP

这是 T10 当前最强联动点。

建议文档里强调：

1. `memory-companion` 是 `T11` 的默认伴生 Skill
2. T11 的 E2E 验证里，应至少包含一次“Skill 触发 + MCP 工具调用”
3. T13 删除手动记忆注入前，必须确认这条链已真实可用

#### 与 T12 Identity → AGENTS.md

这块一定要写明优先级：

1. `AGENTS.md`
2. Skill
3. MCP / Hook / Tool 使用策略细则

否则实施时会发生设计漂移。

#### 与 T13 Orchestrator 瘦身

T10 是 T13 的接手者之一，但不是唯一接手者。  
要避免一种错误理解：

- “Orchestrator 删掉的逻辑都交给 Skill”

其实不对。

更准确应该是：

1. 认知决策交给 AI
2. 人格规则交给 AGENTS.md
3. 行为策略交给 Skill
4. 能力调用交给 MCP / Tool / Hook

T10 只接其中“行为策略”那一层。

### 六、建议补充的场景

当前场景还偏少，主要围绕：

- memory-companion
- daily-chat
- datetime tool

如果从 Muse 长期目标看，建议至少在文档里预留这几类 Skill：

1. `goal-companion`
   - 长期目标跟进、复盘、提醒语气策略
2. `photo-chat`
   - 照片聊天、相册回忆、创作引导策略
3. `capability-gap-handler`
   - 不会时如何解释、如何记录、如何求助
4. `family-delegation`
   - 何时调子 agent / 家族成员

这些不一定 Phase 2 现在做，但应该进设计视野。  
否则 T10 会被做成“只有两个聊天 Skill”，和 Muse 的长期路线不匹配。

### 七、最终结论

`T10 Skill System` **整体通过评审，可以进入开发**。  
它在 Muse 架构里的正确定位应当是：

1. **行为策略层**
2. **T11 的策略伴生层**
3. **T12 的下位配合层**
4. **Phase 4 自我成长的最轻资产层**

我不建议推翻重来，但建议开发时明确守住这 `4` 条原则：

1. 人格归 `AGENTS.md`，不要让 Skill 反客为主
2. Skill 负责策略，不负责承载系统主能力
3. T10 必须和 T11/T10.5/T12/T13 一起联动验收
4. Skill 要按“长期资产”设计，而不是一次性提示词文件

一句话总结：

> **T10 不是“写几份 SKILL.md”，而是在给 Muse 建立一层可演化、可复用、未来可自我编写的行为策略资产。这个方向是对的，但必须严格守住它的层级边界。**
