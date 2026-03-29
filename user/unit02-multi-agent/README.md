# Unit 02: 多 Agent 协作

> **对应 Sprint 1 Day 02-04** · Orchestrator + OpenAI/Google + Swarm

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| Handoff 怎么实现的 | `foundations/F3` §2 (Function Calling) |
| Prompt Injection 怎么防 | `foundations/F15` §3-4 |
| 多 Agent 的 Token 成本 | `foundations/F11` §3 (分词成本) |

## 学习目标

1. Orchestrator-Worker 模式怎么工作？
2. OpenAI / Anthropic / Google 三家 Agent 哲学的区别？
3. Swarm 的 Handoff 协议和 Muse harness 怎么对应？
4. 怎么评估一个 Agent 系统的好坏？（成功率/步骤效率/成本）

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 状态 |
|------|------|------|
| `study/02-study-multi-agent-orchestrator.md` | Orchestrator-Worker + Muse harness | [AI✓] |
| `study/03-study-openai-google-patterns.md` | 跨厂商对比 + S3 设计 | [AI✓] |
| `study/04-study-swarm-hooks.md` | Swarm 源码 + Handoff 协议 | [AI✓] |

## 🎯 你的任务

- [ ] harness 流程图 + 编排模式标注
- [ ] S3 审批流程草案
- [ ] Swarm demo 跑通

## 🤖 AI 并行任务 → `experiments/`

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp02 | `experiments/exp02-orchestrator.mjs` | 4/4 ✅ |
| 🧪 exp03 | `experiments/exp03-hitl-gate.mjs` | 6/6 ✅ |
| 🧪 exp04 | `experiments/exp04-swarm-mini.mjs` | 5/5 ✅ |
| 🔧 R2 | `experiments/R2-handoff-timeout.md` | 评估 6/10 |
| 🔧 R3 | `experiments/R3-mcp-tool-completeness.md` | 评估 7/10 |
| 🔧 R4 | `experiments/R4-prompt-injection-check.md` | 评估 5/10 |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### A. 理论实操

| # | 任务 | 对应理论 | 产出 |
|---|------|---------|------|
| oc04 | **Orchestrator-Worker 实现** — 中央调度 + 2 个 Worker（coder + reviewer），用真实 LLM | BEA §3 Orchestrator 模式 | `oc04-orchestrator-real.mjs` |
| oc05 | **Handoff 协议实现** — Agent A 遇到超出能力范围的问题 → 自动移交给 Agent B | Swarm Handoff + Muse harness | `oc05-handoff.mjs` |
| oc06 | **Human-in-the-Loop Gate** — 敏感操作需要人类确认才继续 | HITL + 审批流 | `oc06-hitl-gate-real.mjs` |
| oc06b | **Agent 评估框架** — 成功率/步骤效率/成本/用户满意度，对 oc04 的 Agent 做量化评估 | SWE-Bench/GAIA 思路 | `oc06b-agent-eval.mjs` |

### B. 课程练习

| # | 来源 | 练什么 | 产出 |
|---|------|--------|------|
| oc07 | **Anthropic Cookbook** `orchestrator-workers/` | Orchestrator 的官方 Python 实现，用 OC 做 Node.js 版 | `oc07-cookbook-orchestrator.mjs` |
| oc08 | **OpenAI Swarm** 源码 | `run()` 函数 + Agent 类 + Handoff，精读并 mini 复现 | `oc08-swarm-run-dissect.md` + `oc08-mini-swarm.mjs` |
| oc09 | **Hello-Agents** Ch3-4 多 Agent | Datawhale 多 Agent 实战章节跟练 | `oc09-hello-multi-agent.mjs` |

### C. 项目拆解

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc10 | **Cline** (VS Code Agent) | Plan & Act 模式：怎么拆任务 → 怎么执行 → 怎么自验 | `oc10-cline-plan-act.md` |
| oc11 | **Continue** (IDE Agent) | 多模型适配 + 上下文管理，和 OpenCode 对比 | `oc11-continue-vs-opencode.md` |
| oc12 | **Muse Harness** (我们自己的) | 全链路走读：harness → binding → planner → executor → callback | `oc12-muse-harness-walkthrough.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 harness 多 Agent 流程，标注 Muse 用了哪几种模式 | [ ] |
| **学习助手** | V1 加上下文索引（索引表 + load_context 按需加载） | [ ] |
