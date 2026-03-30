# Unit 01: Agent 核心循环

> **对应 Sprint 1 Day 01-02** · BEA 精读 + Orchestrator + ReAct
> **底子来源：** [W5] Anthropic BEA + [W4] Weng Blog + [P6] ReAct 论文 + [U2] Berkeley CS294

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

> **推荐顺序：** 01a (BEA 核心) → 01e (Weng + ReAct) → 01b (项目分析) → 01c (代码精读)

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `study/01a-study-anthropic-bea.md` | BEA 核心概念 + Muse 思考 | [W5] BEA + `repos/anthropic-cookbook/patterns/agents/` | [升级] |
| `study/01b-study-anthropic-bea-projects.md` | 开源项目分析 + 面试准备 | [G5] Cookbook + [G13] Aider + [G6] Swarm | [AI✓] |
| `study/01c-course-cookbook-workflows.md` | Cookbook 代码精读 + 多课程对比 | `repos/anthropic-cookbook/patterns/agents/*.ipynb` | [AI✓] |
| `study/01e-leaders-react-weng.md` | ReAct + Weng 三要素 + DeepSeek/o1 | [W4] Weng + [P6] ReAct + `repos/ai-agents-for-beginners/01-03/` | [升级] |

## 🎯 你的任务

- [ ] `study/01-muse-aci-audit.md` — ACI 六原则审计
- [ ] 沉淀：Agent vs Workflow / 5 种编排模式复述

## 🤖 AI 并行任务 → `experiments/`

> **实验 = AI 在真实系统上先踩坑，Later 吸收结论。**
> **代码规范：** 见 `.agents/workflows/ai-parallel-task.md`
> **环境：** Node.js ≥ 20 + ESM only + `node:test` 原生测试

### 已完成

| 类型 | 文件 | 结果 | 内容 |
|------|------|------|------|
| 🧪 实验 | `exp01-chain-parallel-route.mjs` | 10/10 ✅ | 3 种基础编排模式（纯 JS 模拟，理论理解用） |
| 🧪 测试 | `exp01-chain-parallel-route.test.mjs` | 10/10 ✅ | 含 Muse 场景命名的测试 |
| 🔧 消险 | `R1-notify-planner-reliability.md` | 评估 5/10 | notify_planner 回调可靠性分析 |

### 待做（按优先级排序）

| # | 类型 | 实验名 | 验证什么 | 涉及源码 | 状态 |
|---|------|--------|---------|---------|------|
| R2 | 🔧 | `R2-handoff-timeout-analysis` | 分析 Muse handoff 超时场景：Worker 挂了 / LLM 没返回时 Planner 的行为 | `src/family/handoff.mjs` | [ ] |
| R3 | 🔧 | `R3-event-hook-coverage` | 审计 Muse 现有 5 个 hook 的覆盖率，哪些关键事件没有被 hook 到 | `src/plugin/hooks/*.mjs` | [ ] |



## 🔧 OC 实战任务 → `oc-tasks/`

> **原则：基于 OpenCode/Muse 实践理论，不造玩具。** AI 搭框架+注释，Later 走读理解。
> **USOLB 模型：** `[U]`使用 `[S]`源码 `[O]`观察hook `[L]`日志trace `[B]`编译修改
> **和 experiments 的区别：** experiments=AI 验证理论, OC=AI+Later 基于 OpenCode 协作

### A. Agent 循环 — 理解"OpenCode 怎么跑 Agent Loop"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc01 | **观察 OC Agent Loop** — 启动 Muse，发消息，用 event hook 打印 OC 每一轮 Reason→Action→Observe | `[U][O][L]` | 01a §一 核心循环 + 01e §1 ReAct | `src/plugin/hooks/event-logger.mjs` | `oc01-observe-agent-loop.md` |
| oc02 | **走读 OC Session 源码** — 读 OpenCode 如何管理 session (消息、轮次、停止条件)，标注理论映射 | `[S]` | 01a §2.5 Agent 定义 + 01e §2 Weng 三要素 | KI: OpenCode 架构 `opencode_core.md` | `oc02-session-walkthrough.md` |
| oc03 | **trace-reader 全链路追踪** — 让 Muse pua 做一次完整交互，用 trace-reader 看 events/tool-calls/traces | `[U][L]` | 01a §一 核心循环 | `src/plugin/trace-reader.mjs` | `oc03-trace-analysis.md` |

### B. Tool Use — 理解"OpenCode 怎么注册和调用工具"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc04 | **ACI 六原则审计 Muse MCP 工具** — 用 BEA ACI 标准审计 `planner-tools.mjs` 所有工具描述，给改进方案 | `[S][B]` | 01a §2.6 ACI | `src/mcp/planner-tools.mjs` | `oc04-aci-audit.md` |
| oc05 | **写一个新 MCP 工具** — 给 Muse 加一个学习辅助工具(如 `quiz_me`)，注册到 MCP，让 OC Agent 调用 | `[B][U]` | 01a §2.3 Augmented LLM + 01c Cookbook | `src/mcp/` 参照 `dev-tools.mjs` | `oc05-new-mcp-tool.mjs` |
| oc06 | **tool.execute hook 观察工具调用链** — 用 tool-audit hook 追踪一次完整的工具调用：谁调了什么、参数、返回、耗时 | `[O][L]` | 01a §2.6 ACI | `src/plugin/hooks/tool-audit.mjs` | `oc06-tool-trace.md` |

### C. 编排模式 — 理解"Muse 怎么做 Orchestrator-Worker"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc07 | **走读 Muse Harness 编排** — 读 orchestrator + handoff + planner-tools 三件套，画出完整调用链 | `[S]` | 01a §2.4 五种编排模式 | `src/core/orchestrator.mjs` + `src/family/handoff.mjs` + `src/mcp/planner-tools.mjs` | `oc07-harness-walkthrough.md` |
| oc08 | **Muse Prompt 注入链走读** — 从 AGENTS.md → system-prompt hook → OpenCode → LLM，完整追踪 prompt 怎么组装 | `[S][O]` | 01a §2.3 + 01e §3 | `src/plugin/hooks/system-prompt.mjs` + `src/core/identity.mjs` | `oc08-prompt-injection.md` |
| oc09 | **对比 Claude Code / Aider / OpenCode 的 Agent Loop 实现** — 三个工业级 Agent 的循环机制对比分析 | `[S]` | 01a §2.5 + 01b 项目分析 | 在线 + KI OpenCode 架构 + `repos/aider/` | `oc09-loop-comparison.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | USOLB | 状态 |
|------|---------------------|-------|------|
| **Muse** | 理解 Muse 的完整调用链: Telegram → engine → OpenCode session → MCP tools | `[S][L]` | [ ] |
| **学习助手** | V0 原型跑通（Web Speech → LLM → TTS 基础流程） | — | [/] 见 `projects/learning-assistant/` |

