# Mastra PDF 专题 (2/4) — Principles 下篇：MCP、Workflow、RAG、多 Agent

> **日期：** 2026-05-05（Tue）
> **路线图位置：** 专题加餐 · Mastra Agent PDF 课（第 2 天，共 4 天）
> **定位：** 🟥 精通级（今天 1.5h = 50min 理论 + 30min 走读 + 10min 自检）
> **PDF 来源：** `user/reference/principles_2nd_edition_updated.pdf`

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **MCP、Workflow、RAG、Multi-Agent 在 Mastra 里各解决哪一类问题？** 它们不是同义词
2. **什么时候该用 Workflow 而不是纯 Agent？** 什么叫“把自由度收回来”？
3. **为什么这本书一再强调 Start Simple？** RAG、Multi-Agent、A/B、Streaming 都要先守住简单方案

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Principles Ch10-Ch29） | 50min | [ ] |
| 2 | 📖 复习 → `unit03-multi-agent/study/02a-orchestrator-workers.md` | 10min | [ ] |
| 3 | 📖 复习 → `unit03-multi-agent/study/02b-swarm-handoff.md` | 10min | [ ] |
| 4 | 📂 走读 → `unit03-multi-agent/oc-tasks/L2-understand/oc20-harness-walkthrough.md` | 15min | [ ] |
| 5 | 📂 走读 → `unit03-multi-agent/oc-tasks/L2-understand/oc21-swarm-core-walkthrough.md` | 15min | [ ] |
| 6 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 今日主读：`Principles of Building AI Agents` 第 10-29 章。  
> 这部分覆盖的其实是 **Agent 系统的中台积木**：协议、流程、检索、协作、观测、评估。

### 📚 参考锚点

- `[ref-pri-10]` Principles Ch10-Ch11 `Popular Third-Party Tools / MCP`
- `[ref-pri-12]` Principles Ch12-Ch16 `Workflow / Suspend / Streaming / Observability`
- `[ref-pri-17]` Principles Ch17-Ch20 `RAG / Alternatives`
- `[ref-pri-21]` Principles Ch21-Ch26 `Multi-Agent / Supervisor / A2A`
- `[ref-pri-27]` Principles Ch27-Ch29 `Evals`

### 一张图先看清 5 个概念

| 概念 | 解决的问题 | 最像什么 |
|---|---|---|
| **MCP** | Agent 怎么接第三方工具 | 插座标准 |
| **Workflow** | 多步任务怎么变得可控 | 有向图 / 流程编排 |
| **RAG** | 怎么把外部知识注入上下文 | 开卷考试 |
| **Multi-Agent** | 怎么让不同角色协作 | 团队分工 |
| **Evals** | 怎么判断改动到底变好还是变坏 | AI 版测试体系 |

### MCP：不是“工具本身”，而是工具接入标准

[ref-pri-10] 这本书把 MCP 讲得很清楚：

- **Server**：封装一组工具
- **Client**：发现工具、调用工具、收结果

MCP 的价值不是新造工具，而是让：

- 第三方服务更容易被 Agent 接入
- 你的工具也更容易被别的 Agent 复用

#### 什么时候该用 MCP？

- 你的路线图里有很多第三方集成
  - 日历
  - 邮件
  - 聊天
  - 浏览器
- 你要把自己的能力开放给别的 Agent

#### 书里给出的现实提醒

MCP 生态还在早期，主要有 3 个问题：

1. **发现难**
2. **质量参差不齐**
3. **配置不统一**

所以这本书给的建议很务实：

> **别自己造一整套 MCP 轮子，优先用成熟框架。**

对你来说，这句话可以直接映射成：

- Muse 里要做 MCP 时，优先复用现有抽象
- 先把工具边界和权限搞清楚，再谈“接一切”

### Workflow：当 Agent 的自由度太高时，把图画出来

[ref-pri-12] 这本书对 Workflow 的定义很实用：

- Agent 适合开放问题
- Workflow 适合确定性更强的问题

**一句话：**

如果“让模型自己决定下一步”导致不稳定，那就把下一步写进图里。

#### 4 个基本原语

| 原语 | 作用 | 典型场景 |
|---|---|---|
| **Branching** | 并行分支 | 一份输入做多路分析 |
| **Chaining** | 顺序串联 | A 输出喂给 B |
| **Merging** | 汇总分支结果 | 汇总多路分析 |
| **Conditions** | 条件执行 | 判断某步成功后再继续 |

#### 这本书强调的 2 条最佳实践

1. **每一步输入输出都要有意义**
   - 这样 tracing 才能看懂
2. **每个 step 最好只做一件事**
   - 通常 1 步不要塞多个 LLM 调用

这和传统软件工程完全一致：

- 步骤越单一，越可观测
- 边界越清楚，越好 debug

### Suspend / Resume / Streaming / Observability：把“长任务”做得像产品

[ref-pri-12] 到 `[ref-pri-16]` 这几章给的是生产体验层。

#### Suspend / Resume

适合：

- Human-in-the-loop
- 审批等待
- 第三方长时间响应

关键思想：

- 不要让长任务一直占着一个进程
- 把状态持久化
- 需要时再恢复

#### Streaming

书里的态度非常明确：

> **Streaming 不是锦上添花，是 Agent UX 的基础设施。**

能 stream 的不只是 token，还包括：

- 搜索进度
- 规划步骤
- Workflow 当前节点
- 工具执行状态

用户为什么会觉得“快”？

- 不是后端真的更快
- 而是前端在持续给可见进展

#### Observability / Tracing

因为 LLM 非确定，所以这本书直接说：

- 不是“会不会出错”
- 而是“什么时候出错、你能不能看见”

最关键的 3 个可观测数据：

1. 每一步耗时
2. 每一步输入输出
3. 每次运行的元数据

Mastra 这里明确推荐发 OpenTelemetry（OTel），这一点和你在 Muse 的 trace/log 体系非常接近。

### RAG：别上来就过度工程

[ref-pri-17] 到 `[ref-pri-20]` 的态度非常像老工程师：

> **Fight the urge to over-engineer RAG.**

#### 这本书推荐的顺序

1. 先试 **Full Context Loading**
   - 直接把相关资料丢进大上下文
2. 再试 **Agentic RAG**
   - 用工具精确查询，不一定非要向量库
3. 实在不够，再上完整 RAG Pipeline

这是一个很重要的顺序观：

- RAG 不是默认解
- RAG 是当“直接放上下文”和“工具查询”都不够时的第三步

#### 标准 RAG Pipeline 的 6 步

1. Chunking
2. Embedding
3. Upsert
4. Indexing
5. Querying
6. Reranking

#### 这本书对向量库的判断也很实在

向量库能力已经比较商品化，重点不是“最酷的库”，而是：

- 不要让基础设施扩散
- 已有 Postgres 就上 pgvector
- 新项目可以先 Pinecone
- 云厂商已有托管服务就优先用它

### Multi-Agent：本质上是组织设计

[ref-pri-21] 到 `[ref-pri-26]` 的核心不是“炫技多 Agent”，而是：

> **把复杂任务拆成合理工种。**

#### 这本书里最有用的 4 个观点

1. **不同 Agent 应有不同 prompt / memory / tools**
2. **Supervisor 可以把别的 Agent 当作 tool**
3. **先对齐计划，再执行**
4. **Workflow 可以作为 Agent 的工具**

这个视角很重要：

- Agent 和 Workflow 不是互斥
- Workflow 可以包成 Tool 给 Agent 调
- Agent 也可以作为 Workflow 里的某一步

#### A2A vs MCP

| 协议 | 解决的问题 |
|---|---|
| **MCP** | Agent 和工具互通 |
| **A2A** | Agent 和 Agent 互通 |

对你现阶段，MCP 比 A2A 更重要，因为 Muse 现在的瓶颈明显不在跨框架 Agent 通信。

### Evals：AI 工程里的“可比较性”

[ref-pri-27] 到 `[ref-pri-29]` 讲的是评估基建。

这本书的一个核心判断是：

- 传统测试多是 pass/fail
- Agent Evals 常是 `0~1` 或等级评分

#### 书里列出的 4 类高频评估

1. **Textual Evals**
   - hallucination
   - faithfulness
   - completeness
   - answer relevancy
2. **Tool Usage Evals**
   - 该不该调工具
   - 调对没
3. **Prompt Engineering Evals**
   - prompt 微调有没有副作用
   - 对 adversarial input 稳不稳
4. **A/B + Human Review**
   - 真流量验证
   - 人类复看 traces

**这本书特别值得记的一句：**

如果你在做 RAG 或 Workflow，要同时测：

- 每一步
- 整个系统

不要只测最后答案。

### 今天最该吸收的 6 个工程结论

1. **MCP 是工具接入标准，不是工具本身。**
2. **Workflow 是在需要稳定性时收回 Agent 自由度。**
3. **Streaming 和 Tracing 都是产品能力，不只是调试能力。**
4. **RAG 不该默认上，先试大上下文和工具查询。**
5. **Multi-Agent 是组织设计问题，不是模型炫技问题。**
6. **Evals 的价值是让改动“可比较”，而不是看感觉。**

### 这几个概念不要混

- **MCP ≠ API**：MCP 是接入协议层，API 是底层服务接口
- **Workflow ≠ Multi-Agent**：Workflow 是控制流，Multi-Agent 是角色分工
- **RAG ≠ Memory**：RAG 查世界知识，Memory 查会话或用户信息
- **Supervisor ≠ Router**：Supervisor 会协调和汇总，Router 往往只分发
- **A2A ≠ MCP**：一个是 Agent-Agent，一个是 Agent-Tool

---

## 🔧 实践任务

### 任务 1：从 Harness 视角看 Workflow

> 📂 去看 → `unit03-multi-agent/oc-tasks/L2-understand/oc20-harness-walkthrough.md`

做完要回答：

1. Harness 哪些地方像 Workflow？
2. 哪些节点适合做 tracing？
3. 哪些步骤如果拆细，会更利于 eval？

### 任务 2：从 Swarm 核心看 Multi-Agent 原语

> 📂 去看 → `unit03-multi-agent/oc-tasks/L2-understand/oc21-swarm-core-walkthrough.md`

做完要回答：

1. 哪部分是 handoff？
2. 哪部分本质是 tool call？
3. 如果把一个 Workflow 包成 tool，Swarm 会怎么调用它？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 路径 | 作用 |
|---|---|---|
| Orchestrator-Workers | `unit03-multi-agent/study/02a-orchestrator-workers.md` | 对照今天的 supervisor 视角 |
| Swarm Handoff | `unit03-multi-agent/study/02b-swarm-handoff.md` | 对照今天的 control flow 视角 |
| RAG 学习记录 | `learn_record/0426-rag/README.md` | 你已有的 RAG 基础总结 |

---

## 🧠 与 Muse/项目 的映射

- **MCP**
  - Muse 的 `src/mcp/` 已经站在“工具面”了
  - 你之后要做的是收敛工具边界和权限，而不是无限扩展
- **Workflow**
  - 长链路任务、审批、需要稳定回放的任务，都更适合 Workflow 化
- **Streaming**
  - Muse 如果要做更强的 cockpit / bot 交互，必须有步骤级状态更新
- **Tracing**
  - 你已经有 `trace-reader` 和日志系统，这正是生产化基础
- **RAG**
  - 对用户知识库、课程资料、笔记搜索，RAG 是候选方案
  - 但应先试“大上下文”和“工具化检索”
- **Multi-Agent**
  - Muse 后续真要拆分角色，先从 `planner + executor` 二元结构开始
- **Evals**
  - 未来要把 prompt、memory、工具路由的修改都接入评估，而不是只靠主观体验

---

## ✅ 自检清单

- [ ] **能解释 MCP 的 server/client 两个原语**
- [ ] **能说出什么时候该用 Workflow 而不是纯 Agent**
- [ ] **知道 Branch / Then / Merge / Condition 的作用**
- [ ] **知道 Suspend / Resume 适合 Human-in-the-loop**
- [ ] **能解释为什么 Streaming 是 UX 能力**
- [ ] **能说出 Tracing 至少要看哪 3 类数据**
- [ ] **能复述 RAG 的 6 步管线**
- [ ] **知道 RAG 的推荐启用顺序：大上下文 → 工具查询 → RAG**
- [ ] **能解释 Supervisor / Workflow as Tools / A2A vs MCP**
- [ ] **知道 Evals 至少要覆盖 step-level 和 system-level**

### 面试题积累（2 题）

**Q1：什么时候你会把 Agent 改成 Workflow？**

> 你的回答：___
>
> 参考：当任务步骤已知、输出稳定性要求高、需要 tracing / checkpoint / suspend-resume / 条件分支时，用 Workflow 收回自由度。Agent 适合开放问题，Workflow 适合结构化流程。

**Q2：如果产品经理要求“给知识库问答加 RAG”，你会怎么判断是不是真的需要上向量库？**

> 你的回答：___
>
> 参考：先试大上下文直接塞资料；再试把知识访问做成工具或 MCP Server；只有当语料太大、延迟成本不合适、精确检索需求明确时，再上完整 RAG Pipeline。

---

## 📝 学习笔记

✅ 理论：
✅ 关键洞察：
❓ 问题：
💡 映射：
