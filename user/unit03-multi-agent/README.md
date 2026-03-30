# Unit 03: 多 Agent 协作

> **终极目标关联：** 理解 Muse Harness 编排 + 能改进 Handoff
> **本单元终结目标 (TLO)：** 完成 unit03 后，Later 能——
> 1. 面试时讲清 Orchestrator-Workers 模式和 Handoff 原理
> 2. 走读并画出 Muse Harness 的完整编排流程图
> 3. 跑通 Swarm 并理解 handoff 源码
> 4. 能审计 Muse Harness 并落地改进
>
> **上游：** unit02 Prompt 工程（每个 agent 的 Prompt 要先设计好）
> **下游：** unit04 状态+记忆
> **来源底子：** [G6] Swarm + [G5] BEA Orchestrator + [C8] MS Agents L8 + [D2] crewAI
> **课程证据：** C8 L8=Multi-Agent 在 L4=ToolUse 后面; Berkeley U2 先 Agent 后 Multi-Agent; hello-agents ch7-8 在 Prompt ch5-6 后面

---

### 📚 前置基础

| 看到什么不懂 | 去哪里 |
|------------|--------|
| 5 种编排模式 | `unit01/study/01a` §2.4 |
| Prompt 设计 | **unit02** oc14 Prompt 组装链 |
| ReAct 循环 | `unit01/study/01e` §1 |
| Muse 调用链 | unit01 oc05 |

---

## 学习目标（问句形式）

1. Orchestrator-Workers 和其他编排模式有什么区别？
2. Swarm 的 Handoff 怎么实现的？为什么 OpenAI 选这个方案？
3. Muse 的 planner → arch/coder → reviewer 是怎么编排的？
4. 怎么评估一个多 Agent 系统？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `02a-orchestrator-patterns.md` | Orchestrator-Workers 深度 + Muse Harness 映射 | [G5] BEA + `repos/ai-agents-for-beginners/08-multi-agent/` | [占位] |
| `02b-swarm-handoff.md` | Swarm run() + Handoff 源码精读 | `repos/swarm/` [G6] + D2 crewAI 短课 | [占位] |
| `02c-eval-multi-agent.md` | Agent 评估方法 | D6 Eval 短课 + [U2] Berkeley Eval | [占位] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### Level 1: 观察

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc18 | **触发 Muse Harness** — 给 planner 发复杂任务，观察编排 | `[U][L]` | 02a §Orchestrator | `src/core/orchestrator.mjs` | `oc18-harness-observation.md` |
| oc19 | **Swarm 跑通官方 demo** — basic + triage 示例 | `[U]` | 02b §Handoff | `repos/swarm/examples/` | `oc19-swarm-demo.md` |

### Level 2: 理解

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc20 | **走读 Harness 三件套** — orchestrator + handoff + planner-tools | `[S]` | 02a | 三件套源码 | `oc20-harness-walkthrough.md` |
| oc21 | **走读 Swarm core.py** — run() + handoff 机制 | `[S]` | 02b | `repos/swarm/swarm/core.py` | `oc21-swarm-core-walkthrough.md` |

### Level 3: 分析

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc22 | **Harness vs BEA 审计** — Muse 编排属于哪种模式？不足在哪？ | `[S]` | 02a + 01a §2.4 | 源码 | `oc22-harness-audit.md` |
| oc23 | **评估框架设计** — 定义指标 + 采集方案 | `[S][B]` | 02c | hook | `oc23-eval-framework.md` |

### Level 4: 创造

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc24 | **改进 Muse Handoff** — 超时/错误/重试 | `[B]` | `oc24-handoff-improve.md` + 代码 |

### Level 5: 综合

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc25 | **unit03 面试模拟** — Orchestrator + Handoff + Muse STAR | — | `oc25-interview-stories.md` |

---

## 🏗️ Muse 里程碑

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M7 | Harness 编排流程图 | oc20 | [ ] |
| M8 | Harness 审计 + 改进 | oc22 → oc24 | [ ] |
| M9 | Handoff 超时修复 | oc24 | [ ] |

## 🌊 学习助手里程碑

| # | 里程碑 | 状态 |
|---|--------|------|
| S5 | V2 多轮对话 | [ ] |

---

## ✅ 通关检查

- [ ] 能讲清 Orchestrator-Workers vs 其他模式的区别
- [ ] 能解释 Swarm Handoff 的实现原理 (core.py 行号)
- [ ] `[S]` 能画出 Muse Harness 完整编排时序图
- [ ] `[B]` Handoff 改进代码已提交
- [ ] 准备了 Muse Harness 的 STAR 故事
