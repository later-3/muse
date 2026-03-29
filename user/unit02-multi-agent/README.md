# Unit 02: 多 Agent 协作

> **来源底子：** [G6] Swarm + [G5] Cookbook orchestrator + [C8] MS Agents + [U2] Berkeley CS294
> **上游：** unit01 Agent Core（先理解单 Agent 循环）
> **下游：** unit03 State+Memory → unit04 Prompt Eng

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| 5 种编排模式 | `unit01/study/01a` §2.4 |
| Agent vs Workflow | `unit01/study/01a` §2.1 |
| ReAct 循环 | `unit01/study/01e` §1 |

## 学习目标

读完本单元，你能回答：
1. Orchestrator-Workers 和 Parallelization 到底什么区别？
2. Swarm 的 Handoff 机制是怎么实现的？（代码级）
3. 怎么评估一个 Agent 系统的好坏？（量化指标）
4. Muse harness 在这些模式中属于哪种？可以怎么改进？

---

## 📖 学习文档 → `study/`

> **推荐顺序：** 02a (Orchestrator) → 02b (Swarm 走读) → 02c (Agent 评估)

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `study/02a-orchestrator-workers.md` | Orchestrator-Workers 深入 + Cookbook 代码 | [G5] `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` | [占位] |
| `study/02b-swarm-handoff.md` | Swarm 源码走读 + Handoff 机制 | [G6] `repos/swarm/swarm/core.py` | [占位] |
| `study/02c-agent-evaluation.md` | Agent 评估方法 + 量化指标 | [D6] Eval 短课 + Berkeley slides | [占位] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### A. 理论实操

| # | 任务 | 对应理论 | 产出 |
|---|------|---------|------|
| oc10 | **实现 Orchestrator-Workers** — orchestrator 动态拆解任务分派 worker | BEA §模式4 | `oc10-orch-workers.mjs` |
| oc11 | **实现 Evaluator-Optimizer** — generator+evaluator 迭代循环 | BEA §模式5 | `oc11-eval-optimizer.mjs` |

### B. 课程练习

| # | 来源 | 练什么 | repos/ 路径 | 产出 |
|---|------|--------|-----------|------|
| oc12 | **Anthropic Cookbook** orchestrator | Orchestrator-Workers 官方实现 | `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` | `oc12-cookbook-orch.mjs` |
| oc13 | **MS Agents** L4-8 | Tool Use + RAG + Multi-Agent | `repos/ai-agents-for-beginners/04-08/` | `oc13-ms-agents-mid.md` |

### C. 项目拆解

| # | 项目 | 拆什么 | repos/ 路径 | 产出 |
|---|------|--------|-----------|------|
| oc14 | **Cline** | Plan&Act 模式拆解 | `repos/cline/` (待 clone) | `oc14-cline-plan-act.md` |
| oc15 | **Muse Harness** | 我们的 Orchestrator 实现审计 | `src/core/orchestrator.mjs` | `oc15-muse-harness-audit.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | Harness 工作流优化（基于 BEA 模式分析） | [ ] |
| **学习助手** | V1 多轮对话 + 记忆 | [ ] |
