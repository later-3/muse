# Sprint 3：Spike 1 (Core Loop) + Spike 3 (Handoff)

> **Sprint 目标：** 用最少代码验证两个核心假设——单 Agent 循环能稳定跑，多 Agent Handoff 能可靠传递。  
> **服务于：** 全景图域 1（Core Loop）+ 域 3（Multi-Agent Handoff）  
> **前置条件：** Sprint 2 完成，Phase 0+1 退出条件达标

---

## 每日任务清单

### 第 1 天：Spike 1 设计

- [ ] 写 Spike 1 设计文档：`user/spikes/spike-1-core-loop-design.md`
  - 验证假设：Perceive→Think→Act 循环不需要完整 OODA 6 态
  - 技术选型：零依赖 Node.js + 直接调 LLM API（不经过 OpenCode）
  - 成功标准：10 轮对话稳定 + 工具调用 ≥90% + 自动错误恢复
- [ ] 确认不做：Memory、Multi-Agent、Governance、感知通道

### 第 2-3 天：Spike 1 实现

- [ ] 实现最小 Agent Core Loop
- [ ] 实现 2-3 个简单工具（如时间查询、简单计算）
- [ ] 代码存放：`user/spikes/spike-1-core-loop/`
- [ ] 跑通 10 轮对话测试

### 第 4 天：Spike 1 验证

- [ ] 测试错误恢复：模拟工具调用失败
- [ ] 记录验证结果：`user/spikes/spike-1-core-loop-report.md`
- [ ] 标注：哪些假设验证通过、哪些被推翻

### 第 5 天：Spike 3 设计

- [ ] 写 Spike 3 设计文档：`user/spikes/spike-3-handoff-design.md`
  - 验证假设：Orchestrator 可通过 Handoff 工具可靠委派任务给 Worker
  - 技术选型：基于 Spike 1 的 Core Loop × 2 个实例 + Handoff 协议
  - 成功标准：委派成功率 ≥80% + 结果回传 + Worker 失败可检测
- [ ] 确认不做：并行 Worker、复杂工作流、Governance

### 第 6-8 天：Spike 3 实现

- [ ] 实现 Orchestrator Agent（planner 角色）
- [ ] 实现 Worker Agent（arch 角色）
- [ ] 实现 Handoff 工具（transfer_to_worker / report_result）
- [ ] 代码存放：`user/spikes/spike-3-handoff/`
- [ ] 跑通：planner 委派任务 → arch 执行 → 结果回传

### 第 9 天：Spike 3 验证

- [ ] 测试失败路径：模拟 Worker 失败
- [ ] 记录验证结果：`user/spikes/spike-3-handoff-report.md`
- [ ] 标注：Handoff 协议的可靠性和需要改进的地方

### 第 10 天：Sprint 3 复盘

- [ ] mini-eval：
  - [ ] **Spike 1 Core Loop 必须 pass**（Sprint 4 的 Memory 集成依赖它）
  - [ ] Spike 3 Handoff 跑通？（可以 fail，但必须有明确的失败分析和改进方向）
  - [ ] 如果 Spike 1 fail → 停下来分析，不进入 Sprint 4
- [ ] 写复盘：`user/sprint-3-retro.md`
- [ ] 判断：如果 Spike 失败了，分析原因，是假设问题还是实现问题？

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/spikes/spike-1-core-loop-design.md` | [ ] |
| 2 | `user/spikes/spike-1-core-loop/` (代码) | [ ] |
| 3 | `user/spikes/spike-1-core-loop-report.md` | [ ] |
| 4 | `user/spikes/spike-3-handoff-design.md` | [ ] |
| 5 | `user/spikes/spike-3-handoff/` (代码) | [ ] |
| 6 | `user/spikes/spike-3-handoff-report.md` | [ ] |
| 7 | `user/sprint-3-retro.md` | [ ] |

## 不做清单

- ❌ 不做 Memory Spike（Sprint 4）
- ❌ 不用 OpenCode（零依赖验证）
- ❌ 不做完整工作流状态机
- ❌ 不接入 Telegram
