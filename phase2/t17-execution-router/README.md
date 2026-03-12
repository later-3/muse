# T17: Execution Router — 执行路由

> **第四批** — 依赖 T15 + T16

## 目标

面对任务时按优先级链选择执行路径，路由失败自动进入 Gap Journal。

## Phase 2 v1 范围 (保持轻量)

只做:
1. 路由优先级定义
2. 能力查询 (调 Registry)
3. 决策日志
4. 失败写 Gap

**不做** (Phase 3-4):
- 多 OpenCode 实例调度
- 自建 agent 生命周期
- 复杂并发编排

避免变成新的"大 orchestrator"。

## 子任务

1. 8 层路由链定义: LLM → 内置工具 → Skill → Custom Tool → MCP → Hook → Subagent → 新 OC
2. 与 Capability Registry 联动: 路由前查能力是否可用
3. 路由失败 → Gap Journal
4. 决策日志: 记录每次路由选择 (自省和审计用)

## 验收

- 路由决策有日志可查
- 路由失败自动写入 Gap Journal
- 能力可用时走正确路径
