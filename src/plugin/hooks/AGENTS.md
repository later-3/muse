# hooks/ — 工作流 Hook 系统

核心模块：
- `workflow-prompt.mjs` — 编译节点 system prompt（七要素 + 自检 + 执行规则）
- `workflow-gate.mjs` — 工具权限门控（capabilities + bash_policy + file_scope）

设计：Hook 在 OpenCode 生命周期中注入逻辑，不改 OpenCode 核心。
