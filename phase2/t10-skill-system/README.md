# T10: Skill + Custom Tool + 开发规范

> **并行基座** — 可与 T11 并行

## 目标

建立技能标准和规则框架，让 Muse 未来自我开发有据可循。

## 子任务

1. 创建 `.agents/skills/` 目录结构
2. 编写 Skill 开发标准 (分层原则/SKILL.md 格式/安全边界)
3. `memory-companion` Skill — 记忆存取策略 (配合 T11)
4. `daily-chat` Skill — 日常聊天策略
5. Custom Tool 试点 1 个 (如 format-datetime)
6. 明确定位: Phase 2 以 MCP 为主，Custom Tool 为轻量例外

## 验收

- `.agents/skills/` 目录有 2+ Skill
- AI 能通过 `skill` 工具加载并遵循指令
- 开发规范文档可被未来的 AI 自我开发引用
