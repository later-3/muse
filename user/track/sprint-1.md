# Sprint 1：研究 Agent 核心 + Harness 基础

> **Sprint 目标：** 吃透 Agent Core Loop + Multi-Agent 编排的理论和案例，跑通 1 个 demo。  
> **服务于：** 全景图域 1（Core Loop）+ 域 3（Multi-Agent / Harness）  
> **退出条件：** 对齐 RDD Phase 0 — 能用自己的话解释 10 个 Agent 核心概念  
> **总览地图：** `user/overview.md`（Phase/Sprint/Day 全局对照）  
> **AI并行计划：** `make-muse/ai-parallel-track.md`（实验 + 消险清单）  
> **研究产出索引：** `user/research/README.md`  
> **每日流程：** 你看“你的任务”→ AI 看“AI 并行轨道”→ 两轨同时跑

---

## Day 01：精读 Anthropic《Building Effective Agents》

### Step 1: 📖 学习（AI 已交付，你来吸收）

- [x] 1.1 AI 已完成精读 → 产出结构化笔记，你来吸收、理解、背诵关键概念
- [x] 1.2 已交付研究笔记：
  - `01a-study-anthropic-bea.md`（核心概念 + 原文精读 + Muse 思考）
  - `01b-study-anthropic-bea-projects.md`（开源项目分析 + 面试准备）

### Step 2: 🎯 Muse 小任务 — ACI 审计

- [ ] 2.1 审查 Muse 现有 3 个关键 MCP 工具（`notify_planner` / `memory` / 任选 1 个）
- [ ] 2.2 按 ACI 六原则逐条打分（文档清晰度 / 参数防呆 / 格式开销 / 站在模型角度 / 思考空间 / Poka-yoke）
- [ ] 2.3 产出：`01-muse-aci-audit.md`（不改代码，只列问题和建议）

### Step 3: ✏️ 沉淀

- [ ] 3.1 用自己的话写出：「Agent 和 Workflow 的区别是什么」
- [ ] 3.2 用自己的话写出：「5 种编排模式分别适合什么场景」

### 研究增强（c/d/e）

- [x] 📚c: 跟练 Anthropic Cookbook `patterns/agents/basic-workflows`
- [x] 📰e: 速读姚顺雨 ReAct 论文摘要 + Lilian Weng 博客《LLM Powered Autonomous Agents》概要

### 🤖 AI 并行轨道

- [ ] 🧪 `exp01-chain-parallel-route.mjs` — 用 JS 实现 3 种基础模式 (~60行)
- [ ] 🔧 **R1: notify_planner 可靠性测试** — 连续调 20 次，记录成功率，产出坑点报告

---

## Day 02：精读 Anthropic《Multi-Agent Research System》

### Step 1: 📖 学习（AI 已交付，你来吸收）

- [AI✓] 1.1 AI 已交付 `02-study-multi-agent-orchestrator.md`（Orchestrator-Worker 代码详解 + Muse harness 审查 + OC Agent 系统）
- [ ] 1.2 你来做：读笔记 → 理解编排模式 → 能复述 Muse harness 的 3 个改进建议

### Step 2: 🎯 Muse 小任务 — harness 流程画图

- [ ] 2.1 画出 Muse harness 当前的 planner → arch/coder/reviewer 流程图
- [ ] 2.2 标注每个环节对应 Anthropic 的哪种编排模式
- [ ] 2.3 标注当前是 Workflow 还是 Agent？哪些环节可以升级？
- [ ] 2.4 产出：`02-muse-harness-flow.md`

### Step 3: ✏️ 沉淀

- [ ] 3.1 对照 Muse harness 列出：「哪些设计可以直接借鉴」「哪些需要调整」

### 研究增强（c/d/e/OC）

- [ ] 📚c: Cookbook `orchestrator_workers.ipynb` 代码详解
- [ ] 📰e: Andrew Ng 4 Agentic Patterns 核心观点
- [ ] 🔧OC: **OpenCode Agent 系统解读** — Primary/Subagent/Session 隔离机制 + 对 Muse 角色系统的启发
- [ ] 🔍Muse: **Muse harness 代码审查** — 实际审查 `src/mcp/planner-tools.mjs` + `src/family/handoff.mjs`

### 🤖 AI 并行轨道

- [ ] 🧪 `exp02-orchestrator.mjs` — 最简 Orchestrator 动态分配 Worker (~80行)
- [ ] 🔧 **R2: handoff_to_member 超时测试** — 故意让 Worker 不回调，观察 Planner 行为

---

## Day 03：精读 OpenAI Agents 指南 + Google ADK 模式

### Step 1: 📖 学习（AI 已交付，你来吸收）

- [AI✓] 1.1 AI 已交付 `03-study-openai-google-patterns.md`（跨厂商对比表 + S3 设计 + OC MCP 解读）
- [ ] 1.2 你来做：读笔记 → 理解 HITL → 判断 S3 流程是否合理
- [ ] 1.3 能回答：Handoff 最简实现是什么？HITL 什么时候触发？

### Step 2: 🎯 Muse 小任务 — S3 审批流程草案

- [ ] 2.1 结合 Google HITL 模式 + OpenAI Guardrails 设计
- [ ] 2.2 画出 S3（高风险动作审批）理想流程：触发 → 拦截 → 审批 → 执行/拒绝
- [ ] 2.3 标注哪些节点可以自动化、哪些必须人类介入
- [ ] 2.4 产出：`03-muse-s3-approval-draft.md`

### Step 3: ✏️ 沉淀

- [ ] 3.1 做一张跨厂商的「模式对比表」（Anthropic vs OpenAI vs Google）

### 研究增强（c/d/e/OC）

- [ ] 📚c: HF Agents Course Unit 1 精华提取
- [ ] 📰e: Harrison Chase(LangChain) 对 Agent 架构的最新观点
- [ ] 🔧OC: **OpenCode MCP 配置深度解读** — 本地/远程 MCP + 对 Muse MCP 工具注册的启发
- [ ] 🔍Muse: **Muse S3 审批流程与 OpenCode Permission 机制对比**

### 🤖 AI 并行轨道

- [ ] 🧪 `exp03-hitl-gate.mjs` — 模拟审批暂停/继续 (~50行)
- [ ] 🔧 **R3: MCP 工具注册完整性** — 启动 Muse，列出所有注册工具对比期望

---

## Day 04：OpenAI Swarm 源码走读

### Step 1: 📖 学习（AI 已交付 + 动手 demo）

- [AI✓] 1.1 AI 已交付 `04-study-swarm-hooks.md`（Swarm 核心 100 行 + Handoff 协议 + OC Hook 系统）
- [ ] 1.2 你来做：读笔记 → 跑 Swarm demo（`cd make-muse/reference/swarm && python examples/basic/`）
- [ ] 1.3 能回答：Swarm Agent 有几个属性？Handoff 怎么实现？

### Step 2: 🎯 Muse 小任务 — Handoff 协议草案

- [ ] 2.1 对比 Swarm 的 `transfer_to_agent()` 和 Muse 的 `notify_planner` MCP 工具
- [ ] 2.2 设计 Muse Handoff 协议草案：传什么数据？格式？失败处理？
- [ ] 2.3 产出：`04-muse-handoff-protocol.md`

### Step 3: ✏️ 沉淀

- [ ] 3.1 标注「Muse 可借鉴的 3 个设计」

### 研究增强（c/d/e/OC）

- [ ] 🔬d: **Swarm 源码拆解** — `run()` 循环 + Handoff 机制
- [ ] 🔧OC: **OpenCode Hook 系统详解** — 46+ Hooks 机制 + 对 Muse Plugin 的启发
- [ ] 🔍Muse: **Muse Handoff 机制 vs Swarm Handoff 代码对比**

### 🤖 AI 并行轨道

- [ ] 🧪 `exp04-swarm-mini.mjs` — JS 版 Swarm Handoff 核心逻辑 (~100行)
- [ ] 🔧 **R4: prompt 注入正确性** — trace 完整对话，检查 identity/persona 是否正确注入

---

## Day 05：LangGraph 概念 + Demo

### Step 1: 📖 学习（AI 已交付 + 动手 demo）

- [AI✓] 1.1 AI 已交付 `05-study-langgraph-compaction.md`（Graph+State+Checkpoint + Muse 状态图 + OC 压缩）
- [ ] 1.2 你来做：读笔记 → 跑 LangGraph 简单 demo
- [ ] 1.3 能回答：LangGraph 三元素？Checkpointer 解决什么问题？

### Step 2: 🎯 Muse 小任务 — 工作流状态图

- [ ] 2.1 用 Mermaid 画出 S2（muse-harness）的状态机草案
- [ ] 2.2 参考 LangGraph Graph 概念：节点(Node)、边(Edge)、状态流转
- [ ] 2.3 标注 Checkpointer 需要保存什么状态
- [ ] 2.4 产出：`05-muse-workflow-state.md`

### Step 3: ✏️ 沉淀

- [ ] 3.1 对比 LangGraph 和 Swarm 的设计差异

### 研究增强（c/d/e/OC）

- [ ] 📚c: HF Agents Course Unit 2 精华提取
- [ ] 🔬d: **LangGraph 拆解** — Graph + Checkpointer 模块
- [ ] 🔧OC: **OpenCode Compaction(上下文压缩) 机制** — 对 Muse 长对话管理的启发

### 🤖 AI 并行轨道

- [ ] 🧪 `exp05-state-machine.mjs` — 最简状态机 (~40行)
- [ ] 🔧 **R5: harness 端到端链路验证** — planner→arch→coder→reviewer 完整跑一遍，记录每步状态

---

## Day 06：CrewAI 概览

### Step 1: 📖 学习（AI 已交付，你来吸收）

- [AI✓] 1.1 AI 已交付 `06-study-crewai-prompt.md`（CrewAI Role/Task + 角色卡片 + OC Prompt 组装 + Karpathy/Amodei）
- [ ] 1.2 你来做：读笔记 → 判断 Muse 用 Swarm 风格还是 CrewAI 风格
- [ ] 1.3 能回答：backstory 是什么？Muse 4 个角色的约束各是什么？

### Step 2: 🎯 Muse 小任务 — 角色卡片设计

- [ ] 2.1 参考 CrewAI 的 Agent Role 定义方式
- [ ] 2.2 为 Muse 4 个角色各写一张角色卡片草案：
  - 角色名、职责范围、可用工具、擅长什么、不做什么、交接规则
- [ ] 2.3 产出：`06-muse-role-cards.md`

### Step 3: ✏️ 沉淀

- [ ] 3.1 对比 Swarm vs CrewAI：哪种更适合 Muse？为什么？

### 研究增强（c/d/e/OC）

- [ ] 📚c: Hello-Agents Ch3 多 Agent 协作 精华提取
- [ ] 🔬d: **CrewAI 拆解** — Agent Role + Task 定义
- [ ] 📰e: Karpathy《LLM OS》核心观点 + Dario Amodei 最新 Agent 发言
- [ ] 🔧OC: **OpenCode System Prompt 组装机制** — Provider Prompt + AGENTS.md 注入流程
- [ ] 🔍Muse: **Muse 角色卡片 vs OpenCode Agent 定义 对比审查**

### 🤖 AI 并行轨道

- [ ] 🧪 `exp06-role-prompt.mjs` — 同一 LLM 不同角色 prompt 效果对比 (~60行)
- [ ] 🔧 **R6: memory 跨 session 持久化** — set_memory → 重启 → search_memory 验证

---

## Day 07：Prompt Engineering 基础

### Step 1: 📖 学习（AI 已交付，你来吸收）

- [AI✓] 1.1 AI 已交付 `07-study-prompt-engineering.md`（7层结构 + pua prompt 骨架 + OC 模板对比）
- [ ] 1.2 你来做：读笔记 → 判断 pua prompt 骨架是否合理 → 标注需要修改的地方

### Step 2: 🎯 Muse 小任务 — pua Prompt 结构草案

- [ ] 2.1 设计 pua prompt 的结构骨架（不写完整 prompt）：
  - 哪些模块？（身份/性格/记忆注入/工具说明/行为规则）
  - 各模块的顺序和优先级？
  - 要避免的 prompt 反模式？
- [ ] 2.2 产出：`07-muse-prompt-structure.md`

### Step 3: ✏️ 沉淀（不需要单独的）

- [ ] 3.1 实验部分（写 pua prompt、写 MCP 工具 description）标记到 Sprint 2

### 研究增强（c/d/e/OC）

- [ ] 📰e: Jason Wei (CoT 作者) 最新研究方向
- [ ] 🔧OC: **OpenCode Prompt 模板对比** — anthropic.txt vs beast.txt vs qwen.txt 设计差异
- [ ] 🔍Muse: **Muse pua prompt vs OpenCode 最佳实践 审查**

### 🤖 AI 并行轨道

- [ ] 🧪 `exp07-prompt-layers.mjs` — 7层 prompt vs 扁平 prompt 效果对比 (~80行)

---

## Day 08-09：总结 + Design Principles 草稿

- [ ] 1. 把 Day 01-07 的研究初步整理，标注关键发现
- [ ] 2. 更新 `map.md` 的研究覆盖标注（哪些域/行已研究，哪些待深化）
- [ ] 3. 更新 `research/README.md` 索引状态
- [ ] 4. 提炼 Muse Design Principles 草稿（初步原则，Sprint 2 再定稿）
- [ ] 5. 汇总 Day 01-07 所有 Muse 小任务产出，整理为 Sprint 3 Spike 输入清单：
  - Spike 1 (Core Loop) 需要参考哪些草案？
  - Spike 2 (Memory) 需要什么前置设计？
  - Spike 3 (Handoff) 需要什么协议定义？
- [ ] 6. 产出：`user/design-principles-draft.md`（含 Spike 输入清单）
- [ ] 🔬d: **OpenCode 拆解（第一轮）** — Session Engine 模块源码走读

### 🤖 AI 并行轨道

- [ ] 🔧 **汇总消险报告** — R1-R6 结果汇总，列出“Later 接手时要注意”清单
- [ ] 🔧 **Spike 1 预评估** — 基于 R1-R6 结果评估 Spike 1 可行性

---

## Day 10：Sprint 1 复盘

- [ ] 1. mini-eval 自检（对齐 RDD Phase 0 退出条件）：
  - [ ] 能画出 Agent Core Loop 流程图吗？
  - [ ] 能讲清 Handoff vs Workflow 区别吗？
  - [ ] 能对照 Swarm/LangGraph/CrewAI 和 Muse harness 的异同吗？
  - [ ] 能口述 10 个 Agent 核心概念吗？
  - [ ] 能解释 ACI 和 HCI 的类比关系吗？
  - [ ] 能举出 3 个 Poka-yoke 在 Agent 工具中的例子吗？
- [ ] 2. 写 Sprint 1 复盘：`user/sprint-1-retro.md`
  - 哪些是高共识原则？
  - 哪些假设被推翻了？
  - Sprint 2 应该聚焦什么？

---

## 交付物汇总

### 📖 study 笔记（8 篇）

| # | 文件 | 天 | 状态 |
|---|------|---|------|
| 1 | `01a-study-anthropic-bea.md` | 01 | ✅ |
| 2 | `01b-study-anthropic-bea-projects.md` | 01 | ✅ |
| 3 | `02-study-anthropic-multi-agent.md` | 02 | ⬜ |
| 4 | `03-study-openai-google-patterns.md` | 03 | ⬜ |
| 5 | `04-study-swarm-walkthrough.md` | 04 | ⬜ |
| 6 | `05-study-langgraph-overview.md` | 05 | ⬜ |
| 7 | `06-study-crewai-overview.md` | 06 | ⬜ |
| 8 | `07-study-prompt-engineering.md` | 07 | ⬜ |

### 🎯 Muse 设计草案（7 篇）

| # | 文件 | 天 | 服务 | 状态 |
|---|------|---|------|------|
| 9 | `01-muse-aci-audit.md` | 01 | Spike 1 | ⬜ |
| 10 | `02-muse-harness-flow.md` | 02 | Spike 3 | ⬜ |
| 11 | `03-muse-s3-approval-draft.md` | 03 | S3 | ⬜ |
| 12 | `04-muse-handoff-protocol.md` | 04 | Spike 3 | ⬜ |
| 13 | `05-muse-workflow-state.md` | 05 | Spike 3 | ⬜ |
| 14 | `06-muse-role-cards.md` | 06 | S2 | ⬜ |
| 15 | `07-muse-prompt-structure.md` | 07 | S1 | ⬜ |

### 📋 综合产出（3 份）

| # | 文件 | 天 | 状态 |
|---|------|---|------|
| 16 | `user/design-principles-draft.md` | 08-09 | ⬜ |
| 17 | `user/sprint-1-retro.md` | 10 | ⬜ |
| 18 | Swarm demo 跑通 + LangGraph demo 跑通 | 04-05 | ⬜ |

---

## 不做清单

- ❌ 不写 Spike 代码（小任务只产出设计文档，不改代码）
- ❌ 不改 Muse 现有代码
- ❌ 不重写 Blueprint（Sprint 5 再做，放 `make-muse/`）
- ❌ 不深入 Memory / Voice 细节（Sprint 2）
- ✅ OpenCode 是贯穿线 — 每天都有 OC 机制学习 + Muse 对照
