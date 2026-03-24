# hooks/ — Plugin Hook 系统

核心模块：
- `event-logger.mjs` — 事件日志记录
- `message-hook.mjs` — 消息处理 hook
- `tool-audit.mjs` — 工具调用审计
- `system-prompt.mjs` — 系统提示词注入
- `trace-aggregator.mjs` — Session 粒度追踪聚合

设计：Hook 在 OpenCode 生命周期中注入逻辑，不改 OpenCode 核心。
工作流相关 hook（workflow-prompt/workflow-gate）已迁移到 Planner 架构。
