# T10: Skill + Custom Tool + 开发规范

> **第一批 原生基座** — 与 T10.5/T11/T12 并行

## 目标

建立技能标准和规则框架，让 Muse 未来自我开发有据可循。

## 分两阶段理解

### T10A: 技能规范与目录 (先做)

1. 创建 `.agents/skills/` 目录结构
2. 编写 Skill 开发标准 (分层原则 / SKILL.md 格式 / 安全边界)
3. 编写 Custom Tool 定位文档 (Phase 2 以 MCP 为主，Custom Tool 为轻量例外)

### T10B: 首批 Skill + 试点 (后做)

4. `memory-companion` Skill — 记忆存取策略 (配合 T11)
5. `daily-chat` Skill — 日常聊天策略
6. Custom Tool 试点 1 个 (如 format-datetime)

## 验收

- 开发规范文档可被未来的 AI 自我开发引用
- `.agents/skills/` 目录有 2+ Skill
- AI 能通过 `skill` 工具加载并遵循指令
