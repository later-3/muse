# Skill 开发规范

> 本文档定义 Muse 的 Skill 编写标准。未来 AI 自我开发时也参照此规范。

## 什么是 Skill

Skill 是 **SKILL.md** 文件。当 AI 识别到任务匹配某个 Skill 时，会通过 OpenCode 的 `skill` 工具加载它。
加载后，Skill 内容注入到 conversation context，AI 按指令行动。

**Skill 是行为策略，不是能力实现。** 它告诉 AI 在某个场景下"怎么做"，而非"做什么工具"。

## 定位与优先级

```
AGENTS.md (身份/人格/全局规则)     ← 最高，永远生效
    ↓
Skill (场景策略/行为手册)           ← 按需加载，指导行为
    ↓  
MCP / Hook / Tool (能力实现)       ← 具体能力
```

- 人格、价值观、全局行为基调 → 写在 **AGENTS.md** (T12)
- 特定场景的行为策略 → 写在 **Skill**
- MCP 工具、Custom Tool → 提供能力，Skill 指导何时/如何用

## 分层原则

### Layer 1: 基础行为 Skill

始终可用，Muse 的核心行为策略。

- `memory-companion` — 记忆存取策略
- `daily-chat` — 闲聊场景策略

### Layer 2: 场景 Skill (按需加载)

特定场景下的专用策略。

- `code-review` — 代码审查策略 (预留)
- `learning-guide` — 学习辅导策略 (预留)

### Layer 3: 高级 Skill (Phase 3+)

- `self-reflection` — 自省策略 (Phase 3)
- `goal-companion` — 目标跟进策略 (Phase 3)
- `capability-gap-handler` — 能力缺口处理策略 (Phase 3)
- `family-delegation` — 家族委派策略 (Phase 4)

## SKILL.md 格式

```markdown
---
name: <kebab-case, 与目录名一致>
description: <100 字以内, AI 用此判断何时加载>
---

## 你的角色

<AI 在此 Skill 下的行为定位, 1-2 句话>

## 核心规则

<用 MUST / SHOULD / MAY / MUST NOT 明确优先级>

### MUST (必须做)
- ...

### SHOULD (应该做)
- ...

### MUST NOT (禁止做)
- ...

## 场景与策略

<列举具体场景和对应行动>

| 场景 | 行动 |
|------|------|
| ... | ... |

## 工具使用

<引用可用的 MCP 工具或内置工具及参数>

## 示例

<2-3 个参考对话片段, 展示正确行为>
```

### Frontmatter 字段

| 字段 | 必填 | 格式 | 说明 |
|------|------|------|------|
| `name` | ✅ | `kebab-case` | 与目录名一致，AI 调用时用此名 |
| `description` | ✅ | 中文, ≤100 字 | AI 判断何时加载的依据 |

## 目录布局

```
.agents/skills/<skill-name>/
├── SKILL.md                 ← 必须: 主指令文件
├── reference/               ← 可选: 参考资料 (AI 可读取)
│   ├── tools.md             ← 可用工具的参数速查
│   └── examples.md          ← 扩展示例
└── scripts/                 ← 可选: 辅助脚本 (AI 可执行)
```

- Skill 目录名 = `name` 字段值
- reference/ 下的文件会被列在 `<skill_files>` 中，AI 可按需读取
- scripts/ 适合放验证脚本或数据处理脚本

## 安全边界

| ✅ 可以做 | ❌ 不可以做 |
|-----------|------------|
| 引导 AI 的对话策略和决策方向 | 修改系统配置或 .env 文件 |
| 引用已注册的 MCP 工具 | 直接操作 SQLite 或文件系统 |
| 读取 reference/ 下的参考资料 | 执行未经审批的 shell 命令 |
| 建议 AI 何时存/取记忆 | 覆盖 AGENTS.md 的人格定义 |
| 指导工具参数的选择 | 绕过权限检查或白名单 |

## 命名规范

| 项目 | 规范 | 示例 |
|------|------|------|
| Skill 名 | `kebab-case` | `memory-companion` |
| 目录名 | 与 name 一致 | `.agents/skills/memory-companion/` |
| description | 中文, ≤100 字 | "指导你合理使用记忆工具..." |
| 附件目录 | `reference/` `scripts/` `examples/` | — |

## 新增 Skill 检查清单

- [ ] 目录名 = SKILL.md 里的 name
- [ ] description ≤100 字，清楚说明用途
- [ ] 不包含人格定义内容 (人格归 AGENTS.md)
- [ ] 不直接操作系统资源 (能力归 MCP/Tool)
- [ ] 有 MUST / MUST NOT 规则
- [ ] 有至少 1 个场景示例
- [ ] `opencode run` 验证: AI 能看到并加载
