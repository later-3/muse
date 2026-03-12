# T17: Execution Router — 执行路由

> **第四批** — 依赖 T15 + T16

## 目标

面对任务时按优先级链选择执行路径，路由失败自动进入 Gap Journal。

## 子任务

1. 8 层路由链: LLM → 内置工具 → Skill → Custom Tool → MCP → Hook → Subagent → 新 OpenCode 实例
2. 与 Capability Registry 联动: 路由前查能力是否可用
3. 路由失败 → Gap Journal
4. 决策日志: 记录每次路由选择 (自省和审计用)

## 验收

- 路由决策有日志可查
- 路由失败自动写入 Gap Journal
- 能力可用时走正确路径 (不重复查找)
