# Sprint 6：MVP 实现 — S1 (日常对话) + S2 (muse-harness)

> **Sprint 目标：** 基于 Architecture v2，实现 S1 和 S2 端到端跑通。  
> **服务于：** Phase 5（迭代开发）— MVP 最高优先的两个场景  
> **前置条件：** Sprint 5 完成，Architecture v2 + 资产矩阵 reviewed  
> **重要：** S1/S2 依赖的 Spike 1（Core Loop）、Spike 2（Memory）、Spike 3（Handoff）已在 Sprint 3-4 验证。

---

## 每日任务清单

### 第 1-2 天：S2 Technical Design（muse-harness）

- [ ] 写 S2 技术设计：基于 OpenCode 的 harness 实现方案
  - planner/arch/coder/reviewer 的角色如何通过 OpenCode session 实现
  - Handoff 协议如何通过 MCP/Hook 实现
  - 工作流状态如何管理
- [ ] 产出：`make-muse/technical-design/td-s2-harness.md`

### 第 3-5 天：S2 核心实现

- [ ] 实现 planner 的工作流创建和任务分解
- [ ] 实现 Handoff 工具（委派给 arch/coder）
- [ ] 实现结果回传机制
- [ ] 基于现有 🟢 Retain 的代码（engine/telegram/family）

### 第 6 天：S2 端到端验证

- [ ] 跑通：Later 下达任务 → planner 拆解 → arch 执行 → 结果回传
- [ ] 记录验证结果 + 失败分析

### 第 7 天：S1 Technical Design（日常对话）

- [ ] 写 S1 技术设计：pua 的对话、记忆、主动触发实现方案
- [ ] 产出：`make-muse/technical-design/td-s1-conversation.md`

### 第 8-9 天：S1 核心实现

- [ ] 集成 Memory Spike 到 pua
- [ ] 集成 Identity/Personality 到 pua 的 system prompt
- [ ] 接入 Telegram 通道
- [ ] 跑通：Later 和 pua 日常对话

### 第 10 天：Sprint 6 复盘

- [ ] mini-eval：
  - [ ] S2 harness 端到端跑通？
  - [ ] S1 日常对话跑通（多轮 + 跨 session 记忆）？
  - [ ] 全链路 trace 已接通（S1 + S2 的关键路径有 trace）？
- [ ] 写复盘：`user/sprint-6-retro.md`
- [ ] 开始收集 demo 材料（录屏/截图）

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `make-muse/technical-design/td-s2-harness.md` | [ ] |
| 2 | S2 harness 代码（合入 `muse/src/`） | [ ] |
| 3 | S2 端到端验证通过 | [ ] |
| 4 | `make-muse/technical-design/td-s1-conversation.md` | [ ] |
| 5 | S1 对话代码（合入 `muse/src/`） | [ ] |
| 6 | S1 端到端验证通过 | [ ] |
| 7 | 全链路 trace 接通（S1+S2 关键路径） | [ ] |
| 8 | `user/sprint-6-retro.md` | [ ] |
