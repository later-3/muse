# R1: notify_planner 可靠性分析

> **消险任务**: 分析 `notify_planner` MCP 工具的可靠性风险  
> **产出日期**: Sprint 1 Day 01  
> **分析对象**: `src/mcp/callback-tools.mjs`  
> **关联代码**: `src/family/member-client.mjs`, `src/family/registry.mjs`

---

## 1. 架构概述

```
Worker (pua/arch/coder) 完成任务
  → 调用 notify_planner(instance_id, status, summary)
  → handler 读取 state.json → 获取 plannerSession
  → 从 registry 找到 planner 的 engine URL
  → MemberClient.prompt(plannerSession, callbackMessage)
  → HTTP POST → planner 的 OpenCode /session/prompt
```

## 2. 风险点清单

### 🔴 高风险

| # | 风险 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | **plannerSession 可能失效** | `callback-tools.mjs:74` | Planner 重启后旧 session 被清除，`plannerSession` 指向已不存在的 session。OpenCode `prompt_async` 会静默返回 204 空 body。 | 加 session 存活检查 + 自动创建新 session fallback |
| 2 | **planner 不在 registry 中** | `callback-tools.mjs:83` | Planner 进程未启动/已崩溃 → `findByRole('planner')` 返回 null → 直接报错，Worker 不知道下一步 | 加重试（等 planner 启动）+ 超时后降级通知 Telegram |
| 3 | **HTTP 调用无超时** | `member-client.mjs` (prompt 方法) | 如果 Planner 的 OpenCode 卡住（OOM/死锁），Worker 会永远等待 | 给 fetch 加 AbortController + 30s 超时 |

### 🟡 中风险

| # | 风险 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 4 | **无重试机制** | `callback-tools.mjs:106` | 网络抖动/临时不可用 → 第一次失败就中断整个回调链 | 加 3 次指数退避重试（1s, 2s, 4s） |
| 5 | **state.json 读取竞态** | `callback-tools.mjs:69` | 多个 Worker 同时完成 → 同时读取 state.json → 可能读到旧状态 | 目前单节点单 Worker，风险低。未来多 Worker 时需加文件锁 |
| 6 | **prompt_async 返回 204 空 body** | `member-client.mjs:prompt()` | 如果没有特殊处理，`res.json()` 会报 `Unexpected end of JSON input` | 检查 `prompt()` 是否用了 `res.json()`（已知踩坑点） |

### 🟢 低风险

| # | 风险 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| 7 | **回调消息格式无契约** | `callback-tools.mjs:89-102` | 消息是纯文本拼接，Planner 靠 LLM 理解。格式变了 Planner 可能误解 | 考虑结构化 JSON 回调 |
| 8 | **无幂等保护** | 全局 | Worker 重试时可能重复通知 Planner → Planner 重复推进工作流 | 加 callbackId 去重 |

## 3. 关键代码审查

### 3.1 MemberClient.prompt() — 踩坑点

```javascript
// member-client.mjs 中的 prompt 方法
// 已知问题: prompt_async 返回 204 空 body
// 如果代码里有 res.json() → 会崩
// 正确做法: 检查 res.status === 204 后直接返回
```

> ⚠️ **AGENTS.md 已记录此坑**: `prompt_async 返回 204 空 body — 不要直接 res.json()`

### 3.2 Registry 查找 — 单点故障

```javascript
// callback-tools.mjs:83
const planner = findByRole('planner')
if (!planner) {
  return textResult('⚠️ Planner 不在线...')  // 直接失败，无重试
}
```

Worker 只尝试一次就放弃。如果 Planner 恰好在重启（小脑正在拉起），这个窗口期内所有回调都会丢失。

## 4. 可靠性评估

| 维度 | 评分 | 说明 |
|------|------|------|
| **正常路径** | 🟢 8/10 | Planner 在线 + Session 存活 → 正常工作 |
| **Planner 重启** | 🔴 2/10 | Session 失效，回调静默失败 |
| **网络抖动** | 🔴 3/10 | 无重试，一次失败就断链 |
| **多 Worker 并发** | 🟡 6/10 | 当前单 Worker 没问题，扩展时有竞态 |
| **整体可靠性** | 🟡 5/10 | 乐观路径可用，但缺乏容错是 MVP 阶段最大风险 |

## 5. Sprint 4 接手时建议

当 Later 到 Sprint 4 接手 Spike 3 (Handoff) 时，优先修复：

1. **必修**: 给 `prompt()` 加 30s 超时 + 3 次重试
2. **必修**: Session 失效检测 + 自动重建
3. **建议**: 回调消息改为结构化 JSON
4. **建议**: 加 callbackId 幂等保护

---

> **结论**: notify_planner 的 Happy Path 可用，但容错能力弱。主要风险集中在 Planner 重启和网络抖动两个场景。
> 这些问题不阻塞 Sprint 1-2 的研究学习，但到 Sprint 4 Spike 3 时**必须修复**。
