# mcp/ — MCP 工具层

核心模块：
- `memory.mjs` — MCP server 入口 + 工具注册
- `planner-tools.mjs` — Planner 工作流工具（create/inspect/admin_transition/rollback/handoff/read_artifact）
- `dev-tools.mjs` — 开发任务工具
- `telegram-tools.mjs` — Telegram 工具
- `image-tools.mjs` — 图像生成/搜索工具

所有工作流操作通过 Planner MCP tools 驱动，旧的 workflow-tools.mjs 已移除。
