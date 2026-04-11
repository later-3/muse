# D23 — Multi-Agent (2/2)

> **日期：** 2026-04-30（Wed）
> **路线图位置：** Week 4 · Day 23 · Multi-Agent（第 2 天，共 2 天）
> **定位：** 🟨 理解级（今天 1.5h = 30min 理论 + 60min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Multi-Agent 的通信方式有哪些？** 共享 Context / 消息传递 / 黑板模式
2. **Multi-Agent 的常见坑有哪些？** 怎么避免"越帮越忙"？
3. **Muse 的 Multi-Agent 进化路线应该怎么设计？** 从单 Agent 到双 Agent 到多 Agent

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（通信+坑+框架对比） | 30min | [ ] |
| 2 | 实践：设计 Muse 的 Multi-Agent 方案（见下方） | 50min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 CrewAI / AutoGen 文档 + OpenCode Sisyphus 协议 + 工业实践中提炼。
> 今天聚焦：**通信机制 + 常见坑 + 框架对比 + Muse 的进化路线**。

### Multi-Agent 的三种通信方式

[Fact] Agent 之间怎么"说话"决定了系统的可控性和复杂度：

#### 方式 1：共享 Context（Shared Context）

```
所有 Agent 共享同一个 messages 数组

Agent A 的输出 → 加入 messages → Agent B 能看到
                                → Agent C 也能看到

优点: 简单，所有人看同一个"白板"
缺点: Context 膨胀快，隐私无法隔离
代表: OpenAI Swarm
```

#### 方式 2：消息传递（Message Passing）

```
Agent A ──msg──→ Agent B
Agent B ──msg──→ Agent C

每个 Agent 有自己的 Context
只传递必要的消息/结果

优点: Context 隔离，可扩展
缺点: 需要消息协议，复杂度高
代表: AutoGen, CrewAI
```

#### 方式 3：黑板模式（Blackboard）

```
        ┌──────────┐
        │ Blackboard │ ← 共享的结构化数据存储
        └─┬──┬──┬──┘
          │  │  │
       ┌──▼┐┌▼──┐┌▼──┐
       │ A ││ B ││ C │ ← 各 Agent 读写 Blackboard
       └───┘└───┘└───┘

优点: 结构化、可审计、状态清晰
缺点: 需要设计 Blackboard Schema
代表: 传统 AI 系统设计
```

### 主流 Multi-Agent 框架对比

[Fact] 2024-2025 年的主流框架：

| 框架 | 核心理念 | 通信方式 | 复杂度 | 适用场景 |
|------|---------|----------|--------|---------|
| **Swarm** (OpenAI) | 极简 Handoff | 共享 Context | ⭐ | 客服、路由 |
| **CrewAI** | 角色扮演团队 | 消息传递 | ⭐⭐ | 研究、内容创作 |
| **AutoGen** (Microsoft) | 可编程对话 | 消息传递 | ⭐⭐⭐ | 编程、复杂工作流 |
| **LangGraph** (LangChain) | 图状态机 | 状态图 | ⭐⭐⭐⭐ | 任何复杂流程 |
| **Sisyphus** (OpenCode) | 编排协议 | 黑板+消息 | ⭐⭐⭐ | 编码 Agent |

#### Sisyphus 协议（OpenCode 的多 Agent 编排）

[Fact] Sisyphus 是 OpenCode 的多 Agent 协议，你已经在之前的课程中接触过：

```
Sisyphus 核心思想:
1. Planner Agent — 分析任务，分解子任务
2. Executor Agent(s) — 执行具体子任务
3. 协议约束 — 明确的任务格式、状态汇报、完成标准

Muse 中已有雏形:
  src/mcp/callback-tools.mjs → notify_planner（Executor→Planner 回调）
```

### Multi-Agent 的五大常见坑

[Fact] 实践中 Multi-Agent 最常遇到的坑：

#### 坑 1：Agent 踢皮球（Infinite Handoff）

```
Agent A: "这不是我的事，交给 B"
Agent B: "这不是我的事，交给 A"
→ 无限循环！

防御: 
  - 最大 Handoff 次数限制
  - 每个 Agent 必须声明"什么情况下接受任务"
  - 设置 Fallback Agent（谁都不接就它来）
```

#### 坑 2：Context 爆炸

```
Agent A 输出 1000 tokens → 传给 B
Agent B 输出 800 tokens → 传给 C
Agent C 输出 1200 tokens → 传给 A（第二轮）
→ 第二轮 A 的 Context 已经有 3000 tokens 的"别人的话"

防御:
  - 只传递结论/摘要，不传完整输出
  - 定期做 Context 压缩
  - 黑板模式：结构化数据代替自然语言
```

#### 坑 3：任务分解失败

```
Manager: "请做以下子任务：
  1. 搜索相关论文
  2. 分析论文
  3. 写总结"

Worker 1 搜索了论文 → 但 Worker 2 不知道搜到了哪些
→ 子任务之间的上下文断裂

防御:
  - Manager 在分配时包含必要上下文
  - 子任务结果汇总后再分配下一批
  - 使用 Blackboard 共享中间结果
```

#### 坑 4：角色模糊

```
Agent A 和 Agent B 的 System Prompt 太相似
→ 谁都觉得"这活我也能干"
→ 重复劳动或互相冲突

防御:
  - 每个 Agent 的职责必须互斥（MECE 原则）
  - System Prompt 中明确"你不负责什么"
  - 工具集不重叠
```

#### 坑 5：调试地狱

```
多个 Agent 交互 → 出了 Bug → 不知道是哪个 Agent 的问题
   A的输出错了？B的理解错了？C的执行错了？

防御:
  - 每次 Handoff 记录日志
  - 全链路追踪（Muse 的 trace-reader）
  - 可重放的消息记录
```

### Muse 的 Multi-Agent 进化路线

[Fact] 根据 Anthropic "从简单开始"原则设计的进化路线：

```
═══ Phase 1（当前）: 单 Agent ═══
┌──────────────┐
│   Muse Agent  │ ← engine.mjs 循环
│   (全能型)    │    所有工具都在一个 Agent 内
└──────────────┘
适用: MVP 阶段，功能验证

═══ Phase 2（近期）: Planner + Executor ═══
┌────────────┐    Handoff    ┌────────────┐
│  Planner   │──────────────→│  Executor  │
│  (规划者)  │←──callback────│  (执行者)  │
└────────────┘                └────────────┘
适用: 复杂任务需要先规划再执行
已有雏形: callback-tools.mjs

═══ Phase 3（远期）: 专家团队 ═══
         ┌────────────┐
         │ Orchestrator│
         └──┬──┬──┬───┘
            │  │  │
    ┌───────▼┐ ▼  ▼───────┐
    │ Social │ Dev  Memory │
    │ Agent  │Agent Agent  │
    └────────┘     └───────┘
适用: Muse 同时承担社交、开发、记忆管理等多种角色
```

### D22-D23 串联

```
D22: WHY + WHAT
├── 单 Agent 的三个极限 → 什么时候需要 Multi-Agent
├── 4 种协作模式 → Manager/Pipeline/Debate/Swarm
└── Swarm Handoff → 最简实现

D23: HOW + 避坑 ← 今天
├── 3 种通信方式 → 共享Context/消息传递/黑板
├── 5 大常见坑 → 踢皮球/Context爆炸/分解失败/角色模糊/调试地狱
├── 5 框架对比 → Swarm/CrewAI/AutoGen/LangGraph/Sisyphus
└── Muse 进化路线 → 单Agent → 双Agent → 专家团队
```

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "Keep it simple. Don't coordinate agents when you can just prompt better." — Anthropic | 能改 Prompt 就别搞多 Agent |
| "The hardest part of multi-agent is debugging, not building." — 工业实践 | 搭多 Agent 容易，出了 Bug 想哭 |
| "Agents should have clearly defined, non-overlapping responsibilities." — CrewAI 原则 | 每个 Agent 的职责要互斥，不然打架 |

### 🎤 面试追问链

```
Q1: Multi-Agent 系统最常见的问题是什么？怎么避免？
→ 你答: 5个坑：踢皮球/Context爆炸/分解失败/角色模糊/调试地狱。核心防御：角色MECE、Handoff限次、只传摘要、全链路追踪。
  Q1.1: 你会选什么框架来搭 Multi-Agent？
  → 你答: 看场景。简单路由=Swarm。角色协作=CrewAI。复杂工作流=LangGraph。原则：从Swarm开始，复杂度不够再升级。
    Q1.1.1: Muse 应该用 Multi-Agent 吗？
    → 你答: MVP阶段不需要。先做好单Agent。下一步加Planner-Executor双Agent（已有callback-tools雏形）。远期才考虑专家团队。

Q2: 比较 Swarm 和 CrewAI 的设计哲学。
→ 你答: Swarm=极简(共享Context+Handoff函数,~200行),可控但能力有限。CrewAI=角色扮演(独立Context+消息传递,丰富但复杂)。Swarm适合原型,CrewAI适合生产。
```

### 这几个概念不要混

- **共享 Context ≠ 共享 Memory**：共享 Context = 同一个 messages 数组（临时），共享 Memory = 同一个持久化存储（永久）
- **Handoff ≠ API 调用**：Handoff 是把"控制权"转给另一个 Agent（包括后续对话），API 调用是一次性请求-返回
- **CrewAI ≠ AutoGen**：CrewAI 强调角色（"你是研究员"），AutoGen 强调对话流程（"按这个图执行"）
- **多 Agent ≠ 更好**：更多 Agent = 更多协调成本 + 更多失败点

### 关键概念清单

- [ ] **3 种通信方式**：共享 Context / 消息传递 / 黑板
- [ ] **5 大常见坑**：踢皮球 / Context 爆炸 / 分解失败 / 角色模糊 / 调试地狱
- [ ] **5 框架对比**：Swarm / CrewAI / AutoGen / LangGraph / Sisyphus
- [ ] **Muse 进化路线**：Phase 1(单) → Phase 2(双) → Phase 3(专家团队)
- [ ] **MECE 原则**：每个 Agent 职责互斥、集合完整

---

## 🔧 实践任务：设计 Muse Multi-Agent 方案

**USOLB 标注：** `[S] 源码` `[B] 编译`

**任务说明：**
1. 基于现有 Muse 代码，设计 Phase 2（Planner+Executor）的方案
2. 回答以下问题：
   - Planner 的 System Prompt 应该包含什么？
   - Executor 的工具集应该有哪些？
   - 两者之间的 Handoff 怎么实现？（参考 callback-tools.mjs）
   - 怎么保证不会出现"踢皮球"？
3. 输出一页设计文档（Markdown）

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| CrewAI 文档 | https://docs.crewai.com/ | 角色定义 + Task 分配 |
| AutoGen | https://github.com/microsoft/autogen | 对话流程图 |
| LangGraph | https://langchain-ai.github.io/langgraph/ | 状态图编排 |

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/mcp/callback-tools.mjs` — Planner-Executor 的回调工具（已有雏形）
  - `src/core/orchestrator.mjs` — 当前的单 Agent 循环（未来升级点）
  - `src/plugin/` — OpenCode 的 Sisyphus 协议（多 Agent 参考）
- **远端模型/外部系统做的事：**
  - 不同 Agent 可以用不同模型（Planner 用强模型，Executor 用快模型）
- **和后续的关系：** D24-D25 推理优化（KV Cache + Flash Attention）— 从"多 Agent 怎么协作"转向"单次推理怎么更快"

---

## ✅ 自检清单

- [ ] **能列出 3 种通信方式**
- [ ] **能列出 5 大常见坑**：各自的防御措施
- [ ] **能对比 5 个框架**
- [ ] **能设计 Muse 的 Phase 2 方案**
- [ ] **能串联 D22-D23**：WHY+WHAT → HOW+避坑

### 面试题积累（1 题）

**Q: 如果你的 Multi-Agent 系统出现了两个 Agent 互相"踢皮球"的情况，怎么排查和解决？**

> 你的回答：___
>
> 参考：排查：全链路日志追踪，看Handoff序列。解决：1)每个Agent的System Prompt明确声明"什么情况我接"和"什么情况我不接" 2)最大Handoff次数限制 3)设Fallback Agent 4)Handoff时附带"为什么转交"的理由。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
