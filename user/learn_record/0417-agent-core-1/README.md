# D10 — N10 Agent 核心 (1/3)

> **日期：** 2026-04-17（Thu）
> **路线图位置：** Week 2 · Day 10 · N10 Agent 核心（第 1 天，共 3 天）
> **定位：** 🟥 精通级（今天 1.5h，总计 10h+ 跨 3 天）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **AI Agent 到底是什么？** 和普通的 LLM 调用有什么本质区别？
2. **Agent 的核心循环（Agentic Loop）是怎么工作的？** Reason → Action → Observe 每一步在做什么？
3. **ReAct 框架是什么？** 为什么它是理解所有 Agent 的起点？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 45min | [ ] |
| 2 | 📖 先读 → `unit01-agent-core/study/01a-study-anthropic-bea.md` | 15min | [ ] |
| 3 | 📂 oc04 Session 走读（见下方） | 30min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 吴恩达 Agentic AI Module 1 + Anthropic [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) + 李宏毅 [AI Agent](https://youtu.be/M2Yg1kwPpts) 中提炼的核心知识。
> **这是整个 42 天计划中最重要的主题之一 — 你在学的就是你在造的东西。**

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **AI Agent** | 能自主使用工具完成任务的 LLM 系统 | LLM + 工具 + 循环 = Agent | 多 Agent 的协调 |
| **Agentic Loop** | Agent 的核心运行循环：思考→行动→观察→重复 | 像一个人在做事：想想→做→看结果→再想 | OODA 等军事理论对应 |
| **Tool Use** | Agent 调用外部功能（搜索、代码执行、API） | LLM 能"伸手"到外部世界 | MCP 协议细节 |
| **ReAct** | Reason + Act 的结合框架 | 先想再做，做完看结果，再想再做 | 论文中的 prompt 工程 |
| **Orchestrator** | 管理 Agent 运行流程的控制器 | Agent 的"大脑调度中心" | Swarm/LangGraph 等实现差异 |

### 🌍 背景：为什么要学这个？

**承接 Week 1：** 你已经理解了 LLM 的架构（D02-D04）和训练（D05-D06）。但 LLM 本身只是一个"文字接龙机器" — **Agent 就是让这台机器"活起来"的工程**。

[Fact] 李宏毅在 LH25_01 中一针见血：

> "AI Agent 再次爆紅，並不是真的有了什麼跟 AI Agent 本身相關的新的技術，而是在 LLM 變強之後。LLM 變強使得 AI Agent 的規劃能力、做決策的能力都有所增強。"

**技术栈位置 — 从基础到工程：**
```
Week 1 (基础)                    Week 2 (应用) ← 你在这里
──────────────                   ───────────────
D01 反向传播                      D08-09 Tokenization ✓
D02-04 Transformer               D10 Agent 核心 ← 今天
D05-06 训练管线                   D11 Agent 工具+规划
                                  D12 Agent 编排模式
```

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2022.10 | Yao et al. | ReAct 论文 | Agent 的思考+行动框架，成为事实标准 |
| 2023.6 | Lilian Weng | Agent 综述博客 | 最清晰的 Agent 架构图：Planning + Memory + Action |
| 2024.12 | Anthropic | Building Effective Agents (BEA) | 工业界最重要的 Agent 实践指南 — 直接影响 Claude 的设计 |
| 2025 | 李宏毅 | LH25_01 AI Agent 讲座 | 学术界视角的系统梳理 |
| 2025 | 吴恩达 | Agentic AI 课程 | 教你从零构建 Agent |

### 第一性原理：Agent 到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — 普通 LLM 调用的局限**

[Fact] 普通的 LLM 调用是**一次性的**：

```
User → Prompt → LLM → Response → 结束
```

问题：LLM 不能查实时信息、不能执行代码、不能操作外部系统、不能做多步推理。

**Layer 1 — Agent = LLM + 工具 + 循环**

[Fact] Agent 的核心突破是**三个能力**：

| 能力 | 解释 | 类比 |
|------|------|------|
| **Tool Use（工具使用）** | LLM 可以调用外部函数 | 人可以用手机查信息 |
| **Memory（记忆）** | 保存历史对话和中间结果 | 人可以记笔记 |
| **Planning（规划）** | 把复杂任务分解成步骤 | 人可以做计划 |

Lilian Weng 的经典架构图：
```
         ┌──────────┐
         │  Planning │ ← 分解任务、制定步骤
         └────┬─────┘
              │
    ┌─────────▼─────────┐
    │    LLM（大脑）      │ ← 思考、决策
    └─────────┬─────────┘
         ┌────┴────┐
    ┌────▼───┐ ┌──▼─────┐
    │ Memory │ │ Action  │ ← 记忆 + 执行工具
    └────────┘ └────────┘
```

**Layer 2 — Agentic Loop（核心循环）**

[Fact] Agent 的运行是一个**循环**，不是一次性调用：

```
while not done:
    1. Reason（思考）：分析当前状态，决定下一步
    2. Action（行动）：调用工具或生成回答
    3. Observe（观察）：获取工具返回结果
    4. 判断是否完成 → 没完成则回到 Step 1
```

这就是 **ReAct (Reason + Act)** 框架的核心。每一轮循环，Agent 产生的格式是：

```
Thought: 我需要查一下今天的天气
Action: search("今天天气")
Observation: 今天北京晴，25度
Thought: 我已经知道答案了
Action: respond("今天北京晴，25度")
```

**Layer 3 — 完整定义**

AI Agent = 一个以 LLM 为决策核心、能通过工具与外部世界交互、具备记忆和规划能力、以循环方式自主完成复杂任务的软件系统。

### Anthropic BEA — 工业界的 Agent 设计哲学

[Fact] Anthropic 的 Building Effective Agents 提出了**5 种编排模式**，从简单到复杂：

> 📖 详细拆解已在 → `unit01-agent-core/study/01a-study-anthropic-bea.md`

| 模式 | 复杂度 | 说明 | 适用场景 |
|------|--------|------|---------|
| **Prompt Chaining** | ⭐ | 输出 A → 输入 B → 输出 C | 固定步骤的流水线 |
| **Routing** | ⭐⭐ | 根据输入分类，走不同路径 | 客服分流 |
| **Parallelization** | ⭐⭐ | 多个 LLM 调用并行 | 多角度分析 |
| **Orchestrator-Workers** | ⭐⭐⭐ | 一个规划者 + 多个执行者 | 复杂研究任务 |
| **Evaluator-Optimizer** | ⭐⭐⭐⭐ | 生成-评估-优化循环 | 追求最优输出 |

[Fact] Anthropic 的核心建议：**优先用简单模式**。不要一上来就搞复杂的多 Agent 系统。

> "Start with simple prompts, add tools, and only reach for agent architectures when simpler approaches fall short."

### Agent 的三个关键组件

#### 1. Tool Use（工具使用）

[Fact] LLM 不是直接执行工具的 — 它只是**决定调用哪个工具、传什么参数**：

```
LLM 输出:  {"tool": "search", "args": {"query": "天气"}}
    ↓ (解析)
系统执行:  search("天气") → "北京晴 25度"
    ↓ (结果回填)
下一轮输入: "工具返回: 北京晴 25度"
```

这就是为什么工具定义（ACI — Agent-Computer Interface）非常重要 — 工具的名称、参数、描述要足够清晰，LLM 才能正确调用。

#### 2. Memory（记忆）

[Fact] 李宏毅在 LH25_01 中定义了三种记忆：

- **短期记忆（Short-term）**：当前对话的 Context Window — 会话结束就没了
- **长期记忆（Long-term）**：持久化存储（数据库/向量库）— 跨会话保留
- **工作记忆（Working Memory）**：当前任务的中间状态 — 草稿本

#### 3. Planning（规划）

[Fact] 两种规划策略：

- **前置规划**：先制定完整计划，再逐步执行（适合确定性任务）
- **动态规划**：每一步根据观察结果调整计划（适合探索性任务）

Agent 的规划能力直接取决于底层 LLM 的推理能力 — 这就是为什么 Reasoning 模型让 Agent 有了质的飞跃。

### 举例 + 发散

**Muse 就是一个 Agent — 来映射！**

```
Muse 的 Agentic Loop:
1. 用户发消息 (Input)
2. src/core/engine.mjs → 组装 Prompt（Context Engineering）
3. 调用 LLM API → 返回文本（可能包含工具调用）
4. 解析工具调用 → 执行工具 → 拿到结果 (Action + Observe)
5. 如果还没完成 → 把工具结果放回 Prompt → 回到 Step 3 (Loop)
6. 最终回答 → 返回用户
```

| Weng 架构 | Muse 对应 |
|-----------|----------|
| Planning | System Prompt 中的任务拆解指令 |
| Memory | `src/core/memory.mjs` (SOUL.md/IDENTITY.md) |
| Action/Tool | `src/mcp/` (MCP 工具服务器) |
| LLM 大脑 | OpenAI/Anthropic API 调用 |

### 📜 原文对照（关键论文/博客引用）

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "The key idea is to augment the action space of an agent with a language space." — ReAct 论文 | Agent 不仅能"做事"，还能"说出在想什么"。思考过程可见就更可控。 |
| "AI Agent 不是新技術，是 LLM 變強之後的結果。" — 李宏毅 LH25_01 | Agent 的天花板 = LLM 的能力 |
| "Start simple. Add complexity only when needed." — Anthropic BEA | 不要炫技，简单能解决的就不要用复杂方案 |

### 🎤 面试追问链

```
Q1: 什么是 AI Agent？和普通 LLM 调用有什么区别？
→ 你答: Agent = LLM + 工具 + 循环。普通调用一次就结束，Agent 可以多轮循环直到任务完成。
  Q1.1: Agent 的核心循环是怎么工作的？
  → 你答: Reason → Action → Observe → 重复。这就是 ReAct 框架。
    Q1.1.1: 规划能力从哪来？
    → 你答: 来自 LLM 的推理能力。Reasoning 模型（o1/Claude Sonnet）让规划质量大幅提升。

Q2: Anthropic 的 BEA 提出了哪些编排模式？
→ 你答: 5种，从简到繁：Prompt Chaining → Routing → Parallelization → Orchestrator-Workers → Evaluator-Optimizer
  Q2.1: 什么时候该用 Orchestrator-Workers？
  → 你答: 复杂任务需要动态分解子任务时。一个 Orchestrator 规划 + 多个 Worker 执行。
```

### 这几个概念不要混

- **Agent ≠ Chatbot**：Chatbot 只做对话（一问一答）；Agent 能自主执行多步任务
- **Tool Use ≠ RAG**：Tool Use 是调用外部函数；RAG 是检索文档注入 Context。RAG 可以_是_ Agent 的一个工具
- **ReAct ≠ Chain-of-Thought**：CoT 只是让模型"说出思考过程"（输出格式）；ReAct 还包括"行动"和"观察"（闭环循环）
- **Orchestrator ≠ Agent**：Orchestrator 是管理多个 Agent 的控制器；单个 Agent 不需要 Orchestrator

### 关键概念清单

- [ ] **Agent 的定义**：LLM + 工具 + 循环，能自主完成任务
- [ ] **Agentic Loop**：Reason → Action → Observe → 重复
- [ ] **ReAct**：思考+行动+观察的统一框架
- [ ] **Weng 三大组件**：Planning / Memory / Action
- [ ] **BEA 5 种编排模式**：从 Prompt Chaining 到 Evaluator-Optimizer
- [ ] **Tool Use 的运作**：LLM 决定调用什么 → 系统执行 → 结果回填
- [ ] **三种记忆**：短期（Context）/ 长期（持久化）/ 工作（草稿本）
- [ ] **两种规划**：前置规划 vs 动态规划
- [ ] **和 Muse 的映射**：engine.mjs / memory.mjs / MCP 对应架构中的哪些部分

---

## 🔧 实践任务：oc04 Session 走读

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L2-understand/oc04-session-walkthrough.md`

**USOLB 标注：** `[U] 使用` `[S] 源码` `[O] 观察`

**任务说明：**
1. 阅读 oc04 文档，理解 OpenCode 的 Session 生命周期
2. 映射到今天学的 Agentic Loop：Session 的哪个阶段对应 Reason/Action/Observe？
3. 观察 `oc04-demo-session-lifecycle.mjs` 的输出

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 吴恩达 Agentic AI M1 | https://www.deeplearning.ai/courses/agentic-ai/ | Module 1: Agent 基础 |
| Anthropic BEA | https://www.anthropic.com/research/building-effective-agents | 5 种编排模式（全文必读） |
| 李宏毅 AI Agent | https://youtu.be/M2Yg1kwPpts | 全程 — Agent 架构系统梳理 |
| Weng Agent Blog | https://lilianweng.github.io/posts/2023-06-23-agent/ | 经典架构图 |

> 📖 **已有 study 文档，优先读：**
> - `unit01-agent-core/study/01a-study-anthropic-bea.md` — BEA 5种编排 ✅
> - `unit01-agent-core/study/01e-leaders-react-weng.md` — ReAct + Weng ✅

---

### 补充资源 — 李宏毅知识包

> 以下知识包来自李宏毅 ML 课程，经 AI 从完整转录稿中提炼。

- [LH25_01_ai_agent — AI Agent 原理](../../reference/courses/lee-hongyi/knowledge/LH25_01_ai_agent.md)
  - 核心价值：Agent 三大组件（Memory/Action/Planning）+ ReAct + 李宏毅的"Agent不是新技术"论断
- [LH26_01_openclaw_agent — 解剖 OpenClaw](../../reference/courses/lee-hongyi/knowledge/LH26_01_openclaw_agent.md)
  - 核心价值：一个真实 Agent 的完整拆解 — 工具链、失败处理、TTS检查
- [LH25F_02_context_agent — CE + Agent + Reasoning](../../reference/courses/lee-hongyi/knowledge/LH25F_02_context_agent.md)
  - 核心价值：Agent、Context Engineering 和 Reasoning 三个概念如何交织

---

## 🧠 与 Muse/项目 的映射

> 今天学的 Agent 核心概念，你正在 **造** 的 Muse 就是一个 Agent！

- **本地代码实际做的事：**
  - `src/core/engine.mjs` — Agent 的 Agentic Loop 实现（while not done 循环）
  - `src/core/memory.mjs` — Weng 架构中的 Memory 组件
  - `src/mcp/` — Tool Use 的服务端（MCP 工具注册和调度）
  - `src/core/identity.mjs` — Agent 的身份/人设（System Prompt 中的规划指令）
- **远端模型/外部系统做的事：**
  - LLM API 返回的 `tool_calls` 字段 = Agent 的 Action 决策
  - 模型的 Reasoning 能力 = Agent 的 Planning 能力上限
- **为什么 Agent 开发者需要知道这个：**
  - **你在造的东西就是今天学的东西**。理解 Agent 架构 = 理解 Muse 的设计依据
  - BEA 的"从简单开始"原则 = Muse 先做好单 Agent 再考虑多 Agent

---

## ✅ 自检清单

- [ ] **能定义 Agent**：LLM + 工具 + 循环，和普通 LLM 调用的区别
- [ ] **能画出 Agentic Loop**：Reason → Action → Observe → 重复
- [ ] **能解释 ReAct**：思考-行动-观察的统一框架，和 CoT 的区别
- [ ] **能列出 Weng 三大组件**：Planning / Memory / Action
- [ ] **能列出 BEA 5 种模式**：从简到繁的 5 个名字
- [ ] **能把 Muse 映射到 Agent 架构**：engine/memory/MCP 各对应什么
- [ ] **完成 oc04 走读**：能说出 Session 生命周期和 Agentic Loop 的对应关系

### 面试题积累（2 题）

**Q1: 请解释 AI Agent 的核心架构，以及 ReAct 框架的工作原理**

> 你的回答：___
>
> 参考：LLM + 工具 + 循环。ReAct = Reason(思考) + Act(行动)。每轮：Thought → Action → Observation → 重复。让思考过程可见可控。

**Q2: 如果你要从零设计一个 AI Agent，你会用 Anthropic BEA 的哪种模式？为什么？**

> 你的回答：___
>
> 参考：从 Prompt Chaining 开始（最简单、最可预测）。只有当任务需要动态规划时才升级到 Orchestrator-Workers。Anthropic 原话："Start simple."

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
