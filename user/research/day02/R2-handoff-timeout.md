# R2: handoff_to_member 超时分析

> **消险任务**: 分析工作流 handoff 的超时与失败恢复  
> **分析对象**: `src/family/handoff.mjs` (311 行)

---

## 风险清单

| # | 风险 | 等级 | 位置 | 说明 |
|---|------|------|------|------|
| 1 | **MCP 就绪等超时不阻断 handoff** | 🟡 | L82-100 | `waitForMcpReady` 超时后仍发 prompt (优雅降级)，但目标 MCP 工具可能不可用 → Worker 执行时 notify_planner 找不到 |
| 2 | **prompt 发送无超时** | 🔴 | L110 | `client.prompt(sesId, prompt)` 无 AbortController → Planner 卡住 |
| 3 | **retry 只回收 session 不重发 prompt** | 🟡 | L184-222 | `retryHandoff()` 只重置状态到 pending，不自动重新执行 Step 2 |
| 4 | **delivered 状态依赖文件检查** | 🟡 | L130 | HTTP 异常时检查 `state.handoff.status === 'delivered'`，但 delivered 是 Plugin hook 异步写的，时序不确定 |
| 5 | **无全局 handoff 超时** | 🔴 | 全局 | 没有 "handoff 超过 5 分钟仍未 delivered → 自动 retry" 的机制 |

## 亮点

- ✅ 2-step 协议设计合理（PREPARE → EXECUTE）
- ✅ 有 trace 记录每个阶段耗时
- ✅ 有 retry/cancel 基础设施
- ✅ ensureNodeCompletion 安全网（L279）

## 整体评估: 🟡 6/10

**Sprint 4 接手须知**: 加全局 handoff 超时 + prompt 发送超时 + retry 自动重执行
