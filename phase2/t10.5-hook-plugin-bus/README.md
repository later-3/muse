# T10.5: Hook / Plugin / Bus 基座

> **并行基座** — 第三批与 T14/T15 并行

## 目标

让 Hook/Plugin/Bus 不只是能力地图里的文字，而是有实际挂点可用。

## 子任务

1. `prompt.before` — 上下文/能力自知注入
2. `prompt.after` — 情景记忆落盘触发
3. `tool.output.after` — 工具调用审计日志
4. `Session.Error` → 错误记录到 Gap Journal
5. `Session.Idle` → 预留主动触发接口 (Phase 3 Pulse 用)
6. `permission.ask` → 预留审批链 (Phase 4 用)

## 验收

- prompt.after 触发情景记忆落盘 (查 episode 表)
- 工具调用有审计日志
- Session.Error 写入 Gap 记录
