# T42-5 上下文 — Planner 成员配置 + 知识包

## 背景

T42-3 创建了 planner 成员目录（骨架），T42-5 填充**正式内容**：

1. **AGENTS.md** — 指挥官人格（替换 create-member 生成的默认模板）
2. **prompt.md** — OpenCode 自定义 agent 的 system prompt（T42-3 的 3.6 引用了 `{file:./.agents/prompt.md}`）
3. **知识包** — 4 个领域知识文件 + 索引
4. **Skill** — workflow-management SOP

## 前置依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| T42-3 | ⚠️ 必须先完成 | planner 目录已存在 |
| T42-4 | ⚠️ 建议先完成 | 知识包会引用 Planner 工具名 |

## 目标目录结构

```
families/later-muse-family/members/planner/
├── AGENTS.md                        ← 5.1 指挥官人格
├── config.json                      ← T42-3 已生成
├── opencode.json                    ← T42-3 已定制
├── .agents/
│   ├── prompt.md                    ← 5.2 OpenCode agent system prompt
│   ├── skills/
│   │   └── workflow-management/
│   │       └── SKILL.md             ← 5.6 工作流管理 SOP
│   └── knowledge/
│       ├── INDEX.md                 ← 5.3 知识导航
│       ├── quality-checklist.md     ← 5.3 产出质量标准
│       ├── safety-rules.md          ← 5.4 安全红线
│       ├── family-members.md        ← 5.5 成员能力画像
│       └── iteration-playbook.md    ← 5.5 迭代策略
├── data/
│   ├── logs/
│   └── trace/
└── workspace/
```

## 与 nvwa AGENTS.md 的区别

| 维度 | nvwa | planner |
|------|------|---------|
| 定位 | AI 伴侣 / 全能助手 | 工作流指挥官 / 只读调度 |
| 工具 | 全能（bash/edit/memory/dev） | 只读 + workflow 管理 |
| 使命 | 帮 Later 工作学习 | 驱动工作流到完成 |
| 代码能力 | 能写 | 禁止 |
| 人格风格 | 轻松幽默 | 精确高效 |
