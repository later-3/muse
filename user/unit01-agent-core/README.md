# Unit 01: Agent 核心循环

> **对应 Sprint 1 Day 01-02** · BEA 精读 + Orchestrator + ReAct

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| LLM 怎么"规划"的 | `foundations/F1` §4 (CoT → R1 → o1) |
| 上下文窗口为什么有限 | `foundations/F2` §3 (Attention O(n²)) |
| Function Calling 怎么来的 | `foundations/F3` §2 (SFT 训练) |
| temperature=0.1 为什么 | `foundations/F6` §4 |
| XML 为什么比 JSON 可靠 | `foundations/F6` §2 |

## 学习目标

读完本单元，你能回答：
1. Agent 的核心循环是什么？（Reason → Action → Observe）
2. 5 种编排模式各自适合什么场景？
3. Muse 在 Weng 的三要素框架里处于什么位置？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 状态 |
|------|------|------|
| `study/01a-study-anthropic-bea.md` | BEA 核心概念 + Muse 思考 | [AI✓] |
| `study/01b-study-anthropic-bea-projects.md` | 开源项目分析 + 面试准备 | [AI✓] |
| `study/01c-course-cookbook-workflows.md` | Cookbook 代码精读 + 多课程对比 | [AI✓] |
| `study/01e-leaders-react-weng.md` | ReAct + Weng 三要素 + DeepSeek/o1 | [AI✓] |

## 🎯 你的任务

- [ ] `study/01-muse-aci-audit.md` — ACI 六原则审计
- [ ] 沉淀：Agent vs Workflow / 5 种编排模式复述

## 🤖 AI 并行任务 → `experiments/`

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 实验 | `experiments/exp01-chain-parallel-route.mjs` | 10/10 ✅ |
| 🔧 消险 | `experiments/R1-notify-planner-reliability.md` | 评估 5/10 |

---

## 🔧 OC 实战任务 → `oc-tasks/`

> **原则：学了就动手，拆了就复现。每个任务都要出可运行代码。**

### A. 理论实操 — 把 unit 的核心概念变成代码

| # | 任务 | 对应理论 | 产出 |
|---|------|---------|------|
| oc01 | **实现 Agent Loop** — 从零写一个 Reason→Action→Observe 循环，接真实 LLM API（MiniMax/Qwen） | BEA §1 核心循环 | `oc01-agent-loop.mjs` |
| oc02 | **实现 Tool Use** — 给 Agent 注册工具（计算器 + 文件读取），LLM 决定何时调用 | BEA §2 Tool Use + F3 Function Calling | `oc02-tool-use.mjs` |
| oc03 | **3 种编排模式对比** — Chain/Parallel/Route 接真实 LLM，对比效果和延迟 | BEA §3 编排模式 | `oc03-patterns-real-llm.mjs` |

### B. 课程练习 — 跟着优质课程动手

| # | 来源 | 练什么 | 产出 |
|---|------|--------|------|
| oc04 | **Anthropic Cookbook** `patterns/agents/` | Chain + Route 的官方实现，用 OC 复刻（Node.js 版） | `oc04-cookbook-chain.mjs` |
| oc05 | **Hello-Agents** (Datawhale 31k⭐) Ch1-2 | Agent 基础 + 工具调用，跟课跑通 | `oc05-hello-agents-ch1.mjs` |
| oc06 | **Microsoft AI Agents for Beginners** L1-3 | 12 课课程前 3 课实操 | `oc06-ms-agents-intro.md` |

### C. 项目拆解 — 拆真实项目，理解理论怎么落地

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc07 | **Claude Code** (Anthropic 官方) | Agent Loop 实现：怎么读 repo → 生成 plan → 执行 edit → 自验证 | `oc07-claude-code-loop.md` + mini 复现 |
| oc08 | **Aider** (paul-gauthier/aider) | Git 感知 Agent：怎么自动 commit、怎么做 repo-map | `oc08-aider-git-agent.md` |
| oc09 | **OpenCode** (我们的底座) | Session 管理 + Hook 系统 + prompt_async 全链路走读 | `oc09-opencode-session.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 Muse 当前的 Agent 循环（OODA → Telegram → OpenCode） | [ ] |
| **学习助手** | V0 原型跑通（Web Speech → LLM → TTS 基础流程） | [/] 见 `projects/learning-assistant/` |
