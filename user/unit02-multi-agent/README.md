# Unit 02: 多 Agent 协作

> **终极目标关联：** 面试讲清多 Agent 设计 + Muse Harness 能改进
> **本单元终结目标 (TLO)：** 完成 unit02 后，Later 能——
> 1. 面试时讲清 Orchestrator-Workers vs Parallelization 的区别 + Handoff 机制
> 2. 画出 Muse Harness（planner→arch→coder→reviewer）的完整流程
> 3. 能审计并改进 Muse 的编排逻辑
> 4. 知道怎么评估一个 Agent 系统的好坏（量化指标）
>
> **上游：** unit01 Agent Core（先理解单 Agent 循环）
> **下游：** unit03 State+Memory
> **来源底子：** [G6] Swarm + [G5] Cookbook orchestrator + [C8] MS Agents + [U2] Berkeley CS294

---

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| 5 种编排模式 | `unit01/study/01a` §2.4 |
| Agent vs Workflow | `unit01/study/01a` §2.1 |
| ReAct 循环 | `unit01/study/01e` §1 |
| MCP 工具注册 | unit01 oc08 |

---

## 学习目标（问句形式）

1. Orchestrator-Workers 和 Parallelization 到底什么区别？
2. Swarm 的 Handoff 机制是怎么实现的？（代码级别）
3. 怎么评估一个 Agent 系统的好坏？（量化指标）
4. Muse Harness 的编排模式是什么？可以怎么改进？
5. OpenCode 的 Subagent / 多 session 机制怎么工作的？

---

## 📖 学习文档 → `study/`

> **推荐顺序：** 02a (Orchestrator) → 02b (Swarm 走读) → 02c (评估)

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `02a-orchestrator-workers.md` | Orchestrator-Workers 深入 + Cookbook 代码 | [G5] `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` | [占位] |
| `02b-swarm-handoff.md` | Swarm 源码走读 + Handoff 机制 | [G6] `repos/swarm/swarm/core.py` | [占位] |
| `02c-agent-evaluation.md` | Agent 评估方法 + 量化指标 | [D6] Eval 短课 + Berkeley slides | [占位] |

---

## 🤖 AI 并行任务 → `experiments/`

| # | 类型 | 验证什么 | 涉及源码 | 状态 |
|---|------|---------|---------|------|
| R4 | 🔧 | Muse Harness 编排效率分析：planner 拆任务的成功率 | `src/core/orchestrator.mjs` | [ ] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

> **USOLB 模型 + Bloom 递进**

### Level 1: 观察 — "看多 Agent 怎么协作"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc12 | **触发一次 Muse Harness 工作流** — 给 planner 发复杂任务，观察它怎么拆分、怎么派给 arch/coder，看 Muse 日志的完整协作过程 | `[U][L]` | 02a §Orchestrator | `data/logs/` | `oc12-harness-observation.md` |
| oc13 | **Swarm 跑通官方 demo** — clone swarm repo，跑 basic + triage 两个 example，观察 Handoff 行为 | `[U]` | 02b §Swarm | `repos/swarm/examples/` | `oc13-swarm-demo.md` |

### Level 2: 理解 — "我知道 Handoff 怎么实现的"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc14 | **走读 Muse Harness 三件套源码** — orchestrator.mjs + handoff.mjs + planner-tools.mjs，画出完整调用链和状态流转 | `[S]` | 02a + 01a §2.4 Orchestrator-Workers | `src/core/orchestrator.mjs` `src/family/handoff.mjs` `src/mcp/planner-tools.mjs` | `oc14-harness-walkthrough.md` |
| oc15 | **走读 Swarm core.py** — 重点读 run() 方法的 Handoff 机制：怎么切换 agent、怎么传递 context | `[S]` | 02b §Swarm Handoff | `repos/swarm/swarm/core.py` | `oc15-swarm-core-walkthrough.md` |

### Level 3: 分析 — "我能评判 Muse 的编排好不好"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc16 | **Muse Harness vs BEA 模式审计** — Muse 的编排属于 BEA 五模式中的哪种？有哪些不符合最佳实践？ | `[S]` | 02a + 01a §2.4 | `src/core/orchestrator.mjs` | `oc16-harness-audit.md` |
| oc17 | **Agent 评估框架设计** — 定义 Muse 的评估指标：任务成功率 / 工具调用合理性 / 响应延迟 / token 消耗 | `[S][B]` | 02c §评估 | — | `oc17-eval-framework.md` |

### Level 4: 创造 — "我能改进 Muse 的协作"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc18 | **改进 Muse Handoff** — 基于 oc16 审计结论，改进 handoff 超时处理 / 错误重试 / 回调机制 | `[B]` | 02a + 02b | `src/family/handoff.mjs` | `oc18-handoff-improve.md` + 代码 |

### Level 5: 综合 — "我能讲清多 Agent 设计"

| # | 任务 | USOLB | 对应理论 | 产出 |
|---|------|-------|---------|------|
| oc19 | **unit02 面试模拟 + STAR 故事** — Muse Harness 的设计故事 + Swarm vs Muse 对比题 | — | 02a-02c 全部 | `oc19-interview-stories.md` |

---

## 🏗️ 主线项目: Muse 里程碑

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M5 | **画出 Muse Harness 完整编排流程图** | oc14 | [ ] |
| M6 | **Harness vs BEA 审计报告 + 改进方案** | oc16 | [ ] |
| M7 | **Handoff 超时/重试机制实际改好** | oc18 | [ ] |

## 🌊 支线项目: 学习助手 里程碑

| # | 里程碑 | 关联知识 | 状态 |
|---|--------|---------|------|
| S4 | **V1 多轮对话** — 基于 Agent Loop 但支持多轮上下文 | 02a + unit01 | [ ] |

---

## ✅ 通关检查

**理论：**
- [ ] 能画出 5 种编排模式的对比表 + 适用场景
- [ ] 能说清 Swarm Handoff 的代码实现（core.py run 方法）
- [ ] 能说出 Agent 评估的 3 个核心指标

**OpenCode/Muse：**
- [ ] `[U]` 触发过一次完整 Harness 工作流并看懂日志
- [ ] `[S]` 能画出 orchestrator→handoff→planner-tools 的调用链
- [ ] `[B]` Handoff 超时处理已改好

**面试：**
- [ ] 准备了 Muse Harness 的 STAR 故事
- [ ] 能对比 Swarm vs Muse 的编排差异
