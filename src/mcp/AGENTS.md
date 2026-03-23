# mcp/ — MCP 工具层

核心模块：
- `workflow-tools.mjs` — 工作流 MCP 工具（init/status/transition/emit_artifact/list）
- `tools.mjs` — 工具注册入口

工作流工具作为 MCP tool 暴露给 AI，AI 通过 tool call 驱动工作流状态机。
