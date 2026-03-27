# Sprint 1：研究 Agent 核心 + Harness 基础

> **Sprint 目标：** 吃透 Agent Core Loop + Multi-Agent 编排的理论和案例，跑通 1 个 demo。  
> **服务于：** 全景图域 1（Core Loop）+ 域 3（Multi-Agent / Harness）  
> **参考文档：** `user/map.md`（全景图）、`user/Research-Driven Development.md`（总路线）

---

## 每日任务清单

### 第 1 天：精读 Anthropic《Building Effective Agents》

- [ ] 和 AI 一起精读这篇指南（重点：Agent vs Workflow 区分、5 种编排模式、ACI 工具设计）
- [ ] 产出研究笔记：`user/research/anthropic-building-effective-agents.md`
- [ ] 沉淀：用自己的话写出「Agent 和 Workflow 的区别是什么」「5 种编排模式分别适合什么场景」

### 第 2 天：精读 Anthropic《Multi-Agent Research System》

- [ ] 和 AI 一起精读这篇工程博客（重点：Orchestrator-Worker 实战、并行化、Eval 方法、失败模式）
- [ ] 产出研究笔记：`user/research/anthropic-multi-agent-research-system.md`
- [ ] 沉淀：对照 Muse harness，列出「哪些设计可以直接借鉴」「哪些需要调整」

### 第 3 天：精读 OpenAI Agents 指南 + Google ADK 模式

- [ ] OpenAI：Agents SDK 设计哲学、Handoff 模式、Guardrails
- [ ] Google：8 种多 Agent 设计模式（重点：Hierarchical、Router、HITL）
- [ ] 产出研究笔记：`user/research/openai-google-agent-patterns.md`
- [ ] 沉淀：做一张跨厂商的「模式对比表」

### 第 4 天：OpenAI Swarm 源码走读

- [ ] 和 AI 一起走读 Swarm 源码（重点：`run()` 循环、`Agent` 类、`Handoff` 工具、`instructions`）
- [ ] 亲手跑通 Swarm 的基础 demo（airline / triage 等）
- [ ] 产出走读笔记：`user/research/swarm-source-walkthrough.md`
- [ ] 沉淀：标注「Muse 可借鉴的 3 个设计」

### 第 5 天：LangGraph 概念 + Demo

- [ ] 和 AI 一起学习 LangGraph 核心概念（Graph 状态机、Checkpointer、Human-in-the-loop）
- [ ] 跑通 LangGraph 的一个 Agent demo
- [ ] 产出走读笔记：`user/research/langgraph-overview.md`
- [ ] 沉淀：对比 LangGraph 和 Swarm 的设计差异

### 第 6 天：CrewAI 概览（概念级，Sprint 2 再深入）

- [ ] 快速了解 CrewAI 的角色定义和 Task 委派模式（文档级，不读源码）
- [ ] 对比 Swarm vs CrewAI 的设计差异
- [ ] 产出：记录在当天笔记中（Sprint 2 再写独立的走读笔记）

### 第 7 天：Prompt Engineering 基础（概念级，Sprint 2 再实验）

- [ ] 精读 Anthropic/OpenAI 的 Prompt 指南中 Agent 相关章节
- [ ] 产出笔记：`user/research/prompt-engineering-for-agents.md`
- [ ] 注意：实验部分（写 pua prompt、写 MCP 工具 description）放到 Sprint 2

### 第 8-9 天：研究地图升级 + Design Principles 草稿

- [ ] 把前 7 天的研究初步整理，标注关键发现
- [ ] 提炼 Muse Design Principles 草稿（初步原则，Sprint 2 再定稿）
- [ ] 产出：`user/design-principles-draft.md`

### 第 10 天：Sprint 1 复盘

- [ ] mini-eval 自检：
  - [ ] 能画出 Agent Core Loop 流程图吗？
  - [ ] 能讲清 Handoff vs Workflow 区别吗？
  - [ ] 能对照 Swarm/LangGraph/CrewAI 和 Muse harness 的异同吗？
  - [ ] 能口述 10 个 Agent 核心概念吗？
- [ ] 写 Sprint 1 复盘：`user/sprint-1-retro.md`
  - 哪些是高共识原则？
  - 哪些假设被推翻了？
  - Sprint 2 应该聚焦什么？

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/research/anthropic-building-effective-agents.md` | [ ] |
| 2 | `user/research/anthropic-multi-agent-research-system.md` | [ ] |
| 3 | `user/research/openai-google-agent-patterns.md` | [ ] |
| 4 | `user/research/swarm-source-walkthrough.md` | [ ] |
| 5 | `user/research/langgraph-overview.md` | [ ] |
| 6 | CrewAI 概览笔记（记录在当天笔记中） | [ ] |
| 7 | `user/research/prompt-engineering-for-agents.md` | [ ] |
| 8 | `user/design-principles-draft.md` | [ ] |
| 9 | `user/sprint-1-retro.md` | [ ] |
| 10 | Swarm demo 跑通 | [ ] |
| 11 | LangGraph demo 跑通 | [ ] |

## 不做清单

- ❌ 不写 Spike 代码
- ❌ 不改 Muse 现有代码
- ❌ 不重写 Blueprint
- ❌ 不深入 Memory / Voice 细节（Sprint 2）
- ❌ 不讨论 OpenCode 具体实现方式
