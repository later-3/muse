# 📰 e 大佬精读：ReAct + Lilian Weng — Agent 理论基石

> **Sprint 1 · Day 1 · 类型：大佬追踪**  
> **学习目标：** 读完这篇，你能回答：  
> ① 什么是 ReAct？为什么它是 Agent 的基石？  
> ② Agent 系统的三要素是什么？每个要素解决什么问题？  
> ③ Muse 在这个框架里处于什么位置？

---

## 一、姚顺雨 (Shunyu Yao) — ReAct 论文

> **论文：** *ReAct: Synergizing Reasoning and Acting in Language Models* (2022)  
> **身份：** 普林斯顿大学博士 → OpenAI 研究员  
> **一句话：** 让 LLM 在"想"和"做"之间交替循环，干掉了"纯想"的幻觉问题。

### 1.1 ReAct 出现前：两种失败的方法

| 方法 | 做法 | 致命问题 |
|------|------|---------|
| **Chain-of-Thought (CoT)** | 让 LLM 一步步推理，全凭自己脑子想 | **幻觉**！想到第 5 步就开始编造不存在的信息 |
| **Action-only** | 让 LLM 直接执行动作（搜索/调API） | **盲目**！不知道为什么要做这个动作，不会回溯 |

### 1.2 ReAct 的核心创新

**把"想"和"做"交替执行。** 不是先想完再做，也不是只做不想：

```
Thought: 我需要找出 Apple 的创始人是谁               ← 推理（Reasoning）
Action:  search("Apple Inc. founders")                 ← 行动（Acting）
Observation: Apple was founded by Steve Jobs,           ← 来自真实世界的反馈
             Steve Wozniak, and Ronald Wayne in 1976.
Thought: 好的，创始人有三个。但问题问的是"主要创始人"，    ← 基于真实信息继续推理
         Steve Jobs 是最广为人知的。
Action:  finish("Steve Jobs")                           ← 最终行动
```

### 1.3 为什么 Thought 步骤是关键

没有 Thought 的 Agent 是什么样的？

```
❌ 无 Thought（Action-only）:
Action: search("Apple founder")
Observation: Steve Jobs, Steve Wozniak, Ronald Wayne
Action: search("Steve Jobs biography")          ← 为什么要搜这个？不知道
Observation: Steve Jobs was born in 1955...
Action: search("Ronald Wayne Apple")            ← 继续无目的地搜
...（可能永远搜下去）
```

```
✅ 有 Thought（ReAct）:
Thought: 问题是"谁创立了 Apple"，我先搜一下
Action: search("Apple founder")
Observation: Steve Jobs, Steve Wozniak, Ronald Wayne
Thought: 找到了！三个人。问题的答案已经完整了。
Action: finish("Steve Jobs, Steve Wozniak, Ronald Wayne")
```

**Thought 的作用：**
1. **规划** — 在行动前想清楚为什么要做
2. **判断** — 看到结果后决定是否已经够了
3. **纠错** — 发现走错了可以回溯
4. **可观测** — 人类可以看到 Agent 在想什么，方便 debug

### 1.4 实验数据

| 任务 | 纯 CoT | 纯 Action | ReAct | 说明 |
|------|--------|-----------|-------|------|
| HotpotQA (问答) | 29.4% | 25.7% | **27.4%** | 幻觉率降低 6% |
| Fever (事实验证) | 56.3% | 58.9% | **60.9%** | 准确率最高 |
| ALFWorld (交互任务) | 无法运行 | 45% | **71%** | 绝对提升 34% |
| WebShop (网上购物) | 无法运行 | 30.1% | **40.0%** | 绝对提升 10% |

> **关键发现：** ReAct 在需要和外部世界交互的任务上碾压其他方法。纯 CoT 甚至无法完成交互任务。

### 1.5 🎯 Muse 映射：ReAct 在我们的系统里在哪？

```
Muse 的每个 Agent（OpenCode）内部循环：

用户消息 → System Prompt 注入
    → LLM 推理（= Thought）
    → 决定调用哪个工具（= Action）
    → 工具执行返回结果（= Observation）
    → LLM 继续推理...
    → 直到 LLM 决定输出最终回复
```

**OpenCode 的底层就是 ReAct 模式。** 每一次 "tool call → tool result" 就是一次 Action → Observation。

**但 Muse 可以从 ReAct 借鉴的改进：**
- 目前 OpenCode 的 Thought 是隐式的（在 LLM 内部推理，不显式输出）
- 如果在 trace 里显式记录 Thought，debug 会容易得多
- 这也是 Sprint 7 可观测性的一个方向

---

## 二、Lilian Weng — 《LLM Powered Autonomous Agents》

> **身份：** OpenAI VP of Research & Safety  
> **博客：** https://lilianweng.github.io/posts/2023-06-23-agent/  
> **发布：** 2023 年 6 月  
> **地位：** **Agent 领域引用次数最多的非论文文档。** 几乎所有 Agent 框架的 README 都引用了这篇。

### 2.1 Agent 三要素框架

Weng 把所有 Agent 系统分解为 3 个核心组件：

```
┌──────────────────────────────────────────┐
│              🧠 LLM（大脑）               │
│         作为 Agent 的核心控制器            │
├──────────┬──────────┬────────────────────┤
│ Planning │ Memory   │ Tool Use           │
│ 规划能力  │ 记忆系统  │ 工具使用            │
└──────────┴──────────┴────────────────────┘
```

### 2.2 组件一：Planning（规划）

规划分两个子能力：

#### a) 任务分解 (Task Decomposition)

"把大任务拆成小任务的能力。"

| 技术 | 做法 | 一句话解释 |
|------|------|-----------|
| **Chain-of-Thought (CoT)** | "请一步一步想" | 最基础的分解方式 |
| **Tree of Thoughts (ToT)** | 同时探索多条推理路径 | CoT 的升级版，像下棋时想多步 |
| **ReAct** | 想一步做一步 | 推理和行动交替 |
| **LLM+P** | 用外部规划器 (PDDL) | 把规划外包给专业工具 |

**怎么触发分解？** 三种方式：
1. **简单 prompt：** `"Steps for XYZ.\n1."` — 让 LLM 自己列步骤
2. **任务专用指令：** `"Write a story outline."` — 给特定领域的分解格式
3. **人类输入：** 人指定怎么拆步骤

#### b) 自我反思 (Self-Reflection)

"从错误中学习的能力。"

| 技术 | 做法 |
|------|------|
| **ReAct** | 在 Thought 步骤中反思之前的 Action 结果 |
| **Reflexion** | 完整地失败一轮 → 生成反思文字 → 存入记忆 → 下一轮用反思改进 |
| **Chain of Hindsight** | 给模型看"差的输出 → 好的输出"的配对，学习改进方向 |

**Reflexion 特别值得注意：**

```
第 1 轮：尝试解题 → 失败
    ↓
反思："我上次失败是因为没有考虑边界条件"
    ↓ 存入经验记忆
第 2 轮：再次尝试，这次带着反思上下文
    ↓
成功！
```

> 在 HumanEval 编码任务上，Reflexion 达到了 **91% 通过率**，超过 GPT-4 的 80%。

### 2.3 组件二：Memory（记忆）

Weng 用人类大脑的记忆分类来类比 Agent 的记忆：

| 人类记忆 | Agent 对应 | 具体是什么 |
|---------|-----------|-----------|
| **感觉记忆** (几秒) | Embedding | 原始输入的向量表示 |
| **短期/工作记忆** (7±2 项) | In-context Learning | LLM 的上下文窗口（有限！） |
| **长期记忆** (无限) | 外部向量存储 | 向量数据库 + 检索 |

**关键洞察：LLM 的上下文窗口 = 工作记忆。** 就像人只能同时记住 7 个电话号码，LLM 也只能在一个窗口里处理有限的信息。

**长期记忆怎么实现？** → 外部向量数据库 + 最大内积搜索 (MIPS)

常用的向量检索算法（了解名称即可）：
- **LSH** — 局部敏感哈希，把相似的东西放到同一个桶
- **FAISS** (Facebook) — 分层量化，先粗搜再细搜
- **HNSW** — 分层图结构，从上往下导航
- **ScaNN** (Google) — 各向异性量化，内积保持更精确

### 2.4 组件三：Tool Use（工具使用）

"让 LLM 调用外部工具来弥补自身能力缺陷的能力。"

| 项目/论文 | 怎么让 LLM 学会用工具 |
|----------|-------------------|
| **MRKL** | LLM 当路由器，把请求分发给专家模块（计算器/API/模型） |
| **Toolformer** | 微调 LLM 自己学会在哪里插入工具调用 |
| **HuggingGPT** | 用 ChatGPT 当调度员，调用 HuggingFace 上的各种模型 |
| **ChatGPT Plugins** | 用户提供工具描述，LLM 在对话中决定何时调用 |

**工具使用的 3 个层次（来自 API-Bank 论文）：**

| Level | 能力 | 描述 |
|-------|------|------|
| **L1** | 调用工具 | 给定工具描述，能正确调用 |
| **L2** | 搜索工具 | 从工具库中找到合适的工具 |
| **L3** | 规划工具 | 面对模糊需求，規划多步工具调用 |

### 2.5 案例研究（重要的标杆项目）

| 项目 | 核心技术 | 为什么值得关注 |
|------|---------|-------------|
| **ChemCrow** | ReAct + 13 个化学工具 | 领域专家 Agent 的典范 — 在专业评估中超过 GPT-4 |
| **Generative Agents** (Stanford) | Memory Stream + 反思 + 规划 | 25 个 AI 角色组成的小镇模拟！出现了自发社交行为 |
| **AutoGPT** | 自主循环 + 工具 | 概念验证，但可靠性差 — 大量代码在做格式解析 |
| **GPT-Engineer** | 多轮澄清 + 代码生成 | 先问清楚再做 — 比 AutoGPT 务实 |

### 2.6 Weng 指出的 3 大挑战

> 这 3 个问题在 2026 年依然是热门研究方向：

| 挑战 | 问题 | Muse 怎么应对 |
|------|------|-------------|
| **有限上下文窗口** | 历史信息/指令/API 结果塞不下 | Muse 用 MCP 工具 + 外部 memory → 减轻上下文压力 |
| **长期规划能力弱** | LLM 遇到意外错误时不会调整计划 | Muse 的 Planner 用预定义工作流 + 人类审批(S3) 兜底 |
| **自然语言接口不可靠** | LLM 输出格式会出错 / 偶尔不听话 | Muse 用 MCP (结构化 JSON) + Poka-yoke 防错设计 |

---

## 三、两位大佬的对照表

| 维度 | ReAct (姚顺雨) | Weng 框架 | 两者关系 |
|------|--------------|----------|---------|
| **层次** | 单 Agent 内部循环 | 整个 Agent 系统 | ReAct 是 Planning 组件的一种实现 |
| **关注点** | 推理和行动的交替 | Planning + Memory + Tools | Weng 把 ReAct 放在更大的框架里 |
| **创新** | Thought 步骤 | 三要素分解 | Thought 是 ReAct 独特的，三要素是通用框架 |
| **局限** | 不解决记忆问题 | 不解决具体实现问题 | 需要组合使用 |

---

## 四、🎯 Muse 对照总结

| Weng 框架 | Muse 当前实现 | 状态 | 在哪个 Sprint 完善 |
|----------|-------------|------|------------------|
| **Planning — 任务分解** | Planner agent 分解工作流节点 | 🟡 基础版 | Sprint 6 |
| **Planning — 自我反思** | S2b 自开发闭环 | ❌ 未实现 | Sprint 7 |
| **Memory — 短期** | OpenCode session context | ✅ 已有 | — |
| **Memory — 长期** | memory.mjs (search/set/episode) | 🟡 需 Refactor | Sprint 4 |
| **Tool Use — L1** | MCP 工具服务器 (notify/memory/workflow) | ✅ 已有 | — |
| **Tool Use — L2** | 无（工具列表固定注入） | ❌ 未实现 | 后续 |
| **Tool Use — L3** | Planner 的工作流编排 | 🟡 基础版 | Sprint 6 |
| **Observability** | trace + plugin hooks | 🟡 部分 | Sprint 7 |

---

## 五、🧠 吸收检验

读完以后，试着回答这 3 个问题（不用写下来，心里想清楚就行）：

1. **面试题：** 请解释 ReAct 和 Chain-of-Thought 的区别。
   - 提示：CoT 只想不做 → 幻觉；ReAct 想做交替 → 用真实信息纠正

2. **面试题：** 一个 Agent 系统需要哪三个核心组件？
   - 提示：Planning / Memory / Tool Use

3. **设计题：** Muse 的 memory 系统属于短期记忆还是长期记忆？它缺的是什么？
   - 提示：session context = 短期；memory.mjs = 长期；缺的是 Reflexion（自我反思→经验沉淀）

---

*大佬追踪完成于 Sprint 1 Day 1 · 2026-03-28*
