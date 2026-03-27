# Muse 重启路线：研究驱动开发 (Research-Driven Development)

> **核心问题：** 我们在缺乏 AI Agent 理论基础的情况下做了大量开发和架构设计，导致频繁返工。  
> **本文档：** 诊断现状 → 分析根因 → 提出一个将「研究学习」与「Muse 实现」融合的新路线。  
> **目标 A：** 4 个月内完成 Muse 的 3 个锚点场景 MVP。  
> **目标 B：** 形成可面试展示的项目证明包（demo + postmortem + 技术博客）。

---

## 一、诚实的现状诊断

### 1.1 我们已经做了什么（资产盘点）

| 类别 | 资产 | 质量评估 |
|------|------|----------|
| **代码** | 38 个 Task（T01-T38），涵盖记忆、身份、Pulse、语音等 | ⚠️ 能跑，但架构未对齐 |
| **架构文档** | 7 层 Blueprint（Charter → Implementation）| ⚠️ 理想化，缺乏实践验证 |
| **工程路线** | engineering-map.md（6 个阶段 + 6 个圈层）| ⚠️ 路线合理，但跳过了研究 |
| **研究** | agent-research-map.md（刚完成 v1.0）| ✅ 好的开始，但需要深化 |
| **开发哲学** | philosophy.md（9 条原则）| ✅ 直觉很好，需要理论背书 |
| **KI 知识** | AI Agent 基础 + OpenCode 深度研究 | ✅ 有基础，但不够系统 |

### 1.2 问题出在哪里

```
根因分析（5 Why）：

为什么频繁返工？
  ← 因为架构设计后发现不合适
    ← 因为设计时缺乏参照系
      ← 因为没有系统研究过成熟的 Agent 系统
        ← 因为直接从「想法」跳到了「设计」
          ← 因为方法论中缺少「研究」这个环节
```

> [!IMPORTANT]
> **核心根因：** 我们的方法论跳过了「研究」直接进入「设计」。我们有很好的直觉（philosophy.md 的 9 条原则确实很好），但直觉需要理论和案例来校准，否则容易在实现层面走偏。

### 1.3 具体症状

| 症状 | 表现 | 根因映射 |
|------|------|----------|
| **架构漂移** | blueprint 写了 7 层文档，但实际代码走了不同路 | 设计缺乏实践案例验证 |
| **过度工程** | T37 自我开发引擎、工作流状态机等复杂功能 | 不知道「什么程度的 Agent 才够用」 |
| **概念混淆** | OODA 循环 vs ReAct 模式 vs CoreLoop 多种表述 | 缺乏对行业标准模式的清晰认知 |
| **返工循环** | architecture-review → gap-analysis → 重设计 | 设计基于想象而非案例 |
| **盲点** | 不知道 eval 怎么做、不知道 prompt engineering 最佳实践 | 研究不够深入 |

---

## 二、对现有方法论的评估

### 2.1 你提到的 8 步方法

```
研究案例 → 设计原则 → Muse blueprint → engineering-map 
→ technical design → 开发 → eval → 复盘
```

**我的判断：大方向正确，但需要调整。**

> [!WARNING]
> 这个流程的问题在于它是**线性瀑布式**的——假设研究完一次就够了。实际上，Agent 开发是一个**螺旋式**过程：每做一步都会产生新的研究需求。

### 2.2 我建议的修正

```
原来: 研究(1次) → 设计(1次) → engineering-map(1次) → 开发 → eval(1次) → 复盘
建议: [研究 ⇄ 原型验证 ⇄ Eval] → [设计 ⇄ Spike ⇄ Eval] → [实现 ⇄ Eval] → 复盘/知识沉淀
       ↻ 每个阶段都可能回到研究
       ↻ 每个阶段都带 mini-eval + exit criteria
```

**关键修正：**
1. 研究不是一次性的，而是**贯穿全程**的
2. 每个设计决策都应该有**可运行的 Spike 验证**
3. **Eval 贯穿全程**——每个 Phase 都有 mini-eval + exit criteria，不是最后才做
4. 复盘不是结尾，而是**产出知识沉淀**（KI）供后续使用

---

## 三、提议的新路线：研究驱动开发 (RDD)

### 3.1 方法论概述

```
┌──────────────────────────────────────────────────────────────────┐
│                    研究驱动开发 (RDD)                              │
│                    ⚡ Eval 贯穿全程 ⚡                             │
│                                                                  │
│  Phase 0: 基础理论                                                │
│    ├─ 学习 Agent 核心概念，精读大公司指南                            │
│    ├─ mini-eval: 能否用自己的话解释 10 个核心概念                     │
│    └─ 产出: 理论笔记 + 概念清单                                     │
│                                                                  │
│  Phase 1: 案例剖析                                                │
│    ├─ 深度拆解 3-5 个优秀项目，亲手跑通 + 读源码                      │
│    ├─ mini-eval: research-map v2 覆盖 ≥6 案例 + 证据分级             │
│    └─ 产出: 案例分析报告 + agent-research-map v2                     │
│                                                                  │
│  Phase 2: 设计原则提炼                                             │
│    ├─ 从案例中提炼适用于 Muse 的原则，校准 philosophy.md              │
│    ├─ mini-eval: 每条原则可追溯到 ≥2 个独立案例                       │
│    └─ 产出: Muse Design Principles v2                              │
│                                                                  │
│  Phase 2.5: MVP 场景锚定 ⚓                                       │
│    ├─ 锁定 3 个核心场景，所有后续 Spike/设计只服务这 3 个场景          │
│    ├─ mini-eval: 3 个场景有用户故事 + 验收标准                       │
│    └─ 产出: MVP Scenario Spec                                      │
│                                                                  │
│  Phase 3: 最小 Spike 验证（3 个独立 Spike）                         │
│    ├─ Spike 1: 单 Agent Core Loop（验证核心循环）                    │
│    ├─ Spike 2: Memory / Context Assembler（验证记忆分层）            │
│    ├─ Spike 3: Handoff / Multi-Agent Coordination（验证协作）        │
│    ├─ mini-eval: 3 个 Spike 中至少 2 个跑通 + 验证报告               │
│    └─ 产出: 3 个独立可运行原型 + 各自的验证报告                       │
│                                                                  │
│  Phase 4: 架构重设计                                               │
│    ├─ 基于 Spike 经验重写 Blueprint（轻量化）                        │
│    ├─ 现有资产 Retain/Refactor/Rewrite/Archive 矩阵                 │
│    ├─ mini-eval: 新 blueprint 覆盖 3 个锚点场景 + 资产矩阵完成       │
│    └─ 产出: Muse Architecture v2 + 资产处置矩阵                     │
│                                                                  │
│  Phase 5: 迭代开发                                                 │
│    ├─ 按圈层实现，每个迭代包含 mini-eval                             │
│    ├─ mini-eval: 每个迭代结束有 demo + 场景验收                      │
│    └─ 产出: 可用的 Muse 系统                                       │
│                                                                  │
│  Phase 6: Eval 体系化固化 (Eval Systematization)                    │
│    ├─ 将全程积累的 mini-eval 固化为正式评估框架                       │
│    ├─ LLM-as-Judge + 人工评估 + 回归基准                            │
│    └─ 产出: 可复用的 Eval 框架 + 基准报告                           │
│                                                                  │
│  Phase 7: 复盘与知识沉淀                                           │
│    ├─ 技术博客 / 开源文档 / Portfolio 整理                           │
│    └─ 产出: 面试材料 + 知识体系                                     │
│                                                                  │
│  ⟲ 每个 Phase 都可能回到 Phase 0/1 补充研究                         │
│  ⟲ 每个 Phase 都有 mini-eval + exit criteria（不达标不进入下一 Phase）│
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 与线性方法的对比

| 维度 | 线性方法 | RDD（建议） |
|------|----------|-------------|
| 研究 | 前期一次性 | 贯穿全程，按需深入 |
| 设计 | 先设计完再开发 | 设计 + Spike 交替验证 |
| 原型 | 无或仅概念验证 | 3 个最小 Spike 各验证 1 个假设 |
| Eval | 最后做 | 贯穿全程，每 Phase 有 mini-eval |
| 场景 | 全功能铺开 | 3 个锚点场景收敛 |
| 知识 | 分散在各处 | 系统化沉淀（KI）|
| 返工 | 发现问题才返工 | 主动通过 Spike 早期发现 |

### 3.3 Eval 贯穿策略

> [!IMPORTANT]
> Eval 不是 Phase 6 才开始做。Phase 6 (Eval Systematization) 是把全程积累的 mini-eval 经验**固化为框架**。

| Phase | Mini-Eval 内容 | Exit Criteria |
|-------|---------------|---------------|
| Phase 0 | 能否用自己的话解释 Agent 核心概念？ | 理论笔记 + 概念测验 pass |
| Phase 1 | 研究覆盖面足够？证据可追溯？ | research-map v2 ≥6 案例 + 证据分级 |
| Phase 2 | 每条设计原则有 ≥2 个独立案例支撑？ | Principles v2 审查通过 |
| Phase 2.5 | 3 个锚点场景有清晰 AC？ | 用户故事 + 验收标准文档完成 |
| Phase 3 | Spike 跑通？假设被验证还是被推翻？ | 3 个 Spike 中至少 2 个 pass |
| Phase 4 | 新 Blueprint 覆盖 3 个场景？资产矩阵完成？ | blueprint v2 + 资产矩阵 reviewed |
| Phase 5 | 每个迭代有 demo + 场景验收？ | 锚点场景可端到端运行 |
| **Phase 6** | **体系化：将 mini-eval 固化为正式框架** | **可复用 Eval 框架 + 基准报告** |
| Phase 7 | 知识可展示？面试可讲？ | Portfolio 完整 |

---

## 四、Phase 0 + 1 详细研究计划

> [!IMPORTANT]
> 这是最关键的部分——**研究什么、怎么研究、产出什么**。

### 4.1 研究课程表

#### 模块 A：大公司官方指南（理论基础）

| # | 材料 | 来源 | 学习重点 | 预估时间 |
|---|------|------|----------|----------|
| A1 | Building Effective Agents | Anthropic | Agent vs Workflow 区分、5 种 Workflow 模式、ACI 设计 | 2h 精读 |
| A2 | Multi-Agent Research System | Anthropic | Orchestrator-Worker 实战、并行化、eval 方法 | 3h 精读 |
| A3 | Agent Engineering Guide | OpenAI | Agents SDK 设计哲学、Handoff 模式、Guardrails | 2h 精读 |
| A4 | Agent Development Kit (ADK) | Google | 8 种多 Agent 模式、A2A 协议、状态管理 | 2h 精读 |
| A5 | Prompt Engineering for Agents | Anthropic/OpenAI | System prompt 最佳实践、Tool description 设计 | 2h 精读 |
| A6 | Evaluating AI Agents | 多来源 | eval 框架设计、LLM-as-Judge、benchmark 方法论 | 2h 研读 |

#### 模块 B：开源项目深度剖析（实践经验）

| # | 项目 | 为什么选它 | 剖析重点 | 预估时间 |
|---|------|----------|----------|----------|
| B1 | **OpenAI Swarm** | 最简 multi-agent 参考 | Handoff 实现、Routines 设计、极简 API | 3h 读源码 |
| B2 | **LangGraph** | 行业标准状态机 Agent 框架 | Graph 状态机、Checkpointing、Human-in-the-loop | 4h 读源码 + 跑 demo |
| B3 | **Anthropic Claude Code** | 顶级单 Agent 实现 | 工具设计、上下文管理、错误恢复 | 3h 分析 |
| B4 | **cat-cafe-tutorials** | 多模型 Agent 协作实战 | 记忆管理、Session 隔离、失败模式 | 3h 精读 |
| B5 | **CrewAI** (或 MetaGPT) | 角色驱动多 Agent 框架 | 角色定义、Task 委派、Process 模式 | 3h 读源码 |

#### 模块 C：AI Agent 工程技能（技术深化）

| # | 技能 | 学习路径 | 与 Muse 的关联 |
|---|------|----------|---------------|
| C1 | **Prompt Engineering** | OpenAI/Anthropic 官方指南 + 实践 | Muse 的 system prompt、tool description 设计 |
| C2 | **Tool/Function Calling** | 各平台文档 + 实验 | Muse 的 MCP 工具设计 |
| C3 | **RAG + Memory** | LangChain/LlamaIndex 文档 | Muse 的记忆系统 |
| C4 | **Agent Evaluation** | 论文 + 框架 | Muse 的质量保证 |
| C5 | **Multi-Agent Orchestration** | LangGraph + CrewAI 实践 | Muse 的 Family 协作 |
| C6 | **Observability & Tracing** | LangSmith/Langfuse 文档 | Muse 的全链路追踪 |

### 4.2 研究方法论

每个研究项目使用统一模板：

```markdown
## [项目/材料名称]

### 1. 它解决什么问题
### 2. 核心架构如何设计
### 3. 关键代码走读（附代码片段）
### 4. 优点 / 局限
### 5. 对 Muse 的 3 个具体启发
### 6. 我能从中学到什么技能
```

### 4.3 研究产出定义

每个模块的产出不是「看完了」，而是：

| 产出类型 | 具体形式 | 存放位置 |
|---------|---------|---------|
| **研究笔记** | Markdown 笔记，按 `.agents/workflows/research-note.md` 标准 | `user/research/` |
| **KI 知识条目** | 经过提炼的可复用知识 | KI Store |
| **Spike 代码** | 验证性的小项目（零依赖可运行） | `user/spikes/` |
| **设计决策** | ADR (Architecture Decision Record) | `user/adr/` |
| **技能实践** | hands-on 练习项目 | `user/exercises/` |

---

## 五、Phase 2.5: MVP 场景锚定 ⚓

> [!CAUTION]
> 没有场景收敛，后续 Spike 和 Blueprint 还会回到「大而全」。这个阶段的作用是**砍掉 80% 的功能域**，只聚焦 3 个核心场景。

### 5.1 三个锚点场景

| # | 场景 | 用户故事 | 验收标准（AC）草案 |
|---|------|---------|------------------|
| **S1** | **单 Muse 日常对话** | Later 在 Telegram 和 pua（日常陪伴 Muse）聊天，pua 记住之前的对话、有自己的性格、能主动问候 | ① 多轮对话保持上下文 ② 记忆跨 session 持久 ③ 人格一致 ④ 主动触发 ≥1 次/天 |
| **S2** | **Family 内任务协作** | Later 让 planner（规划者 Muse）安排 arch（开发者 Muse）完成一个代码任务，planner 拆解任务、委派、跟踪、汇报 | ① 任务 Handoff 成功 ② Worker（arch）独立执行 ③ 结果回传给 planner ④ 失败时重试或上报 |
| **S3** | **高风险动作审批 (Governance)** | arch 要修改核心配置文件，需要 planner 审批，Later 设置了审批规则 | ① 拦截触发 ② 审批请求发送给 planner ③ 批准后执行 ④ 拒绝后阻止 ⑤ 超时处理 |

### 5.2 场景门规则

- **后续所有 Spike 必须服务于至少 1 个锚点场景**
- **Blueprint v2 的每个模块必须标注它为哪个场景服务**
- **不在 3 个场景内的功能进入 Backlog，不进入当前 Phase**

### 5.3 场景与 Spike 的映射

| Spike | 验证的核心假设 | 服务的锚点场景 |
|-------|-------------|-------------|
| Spike 1: Core Loop | 单 Agent 的感知→推理→行动循环能稳定跑通 | S1（日常对话）|
| Spike 2: Memory | 记忆分层（短期/长期）能跨 session 工作 | S1（日常对话）|
| Spike 3: Handoff | 多 Agent 间 Handoff 协议能可靠传递任务 | S2（任务协作）+ S3（审批）|

---

## 六、三个最小 Spike 详述

> [!IMPORTANT]
> 每个 Spike 只验证 **1 个核心假设**，不混合验证。失败也是重要的信号。

### 6.1 Spike 1: 单 Agent Core Loop

| 维度 | 内容 |
|------|------|
| **验证假设** | 单 Agent 的 Perceive → Think → Act 循环可以稳定运行，不需要完整的 OODA 6 态 |
| **范围** | 最小 Agent：接收文本输入 → 调用 LLM → 返回响应，支持工具调用 |
| **不做** | Memory、Multi-Agent、Governance、VAD、任何感知通道 |
| **技术栈** | 零依赖 Node.js + 直接调 LLM API（不经过 OpenCode）|
| **成功标准** | ① 10 轮对话稳定不崩 ② 工具调用成功率 ≥90% ③ 错误恢复无需人工介入 |
| **服务场景** | S1（日常对话）|

### 6.2 Spike 2: Memory / Context Assembler

| 维度 | 内容 |
|------|------|
| **验证假设** | 短期记忆（session 内）+ 长期记忆（跨 session）分层设计可以在 context window 约束下工作 |
| **范围** | SQLite 存储 + 简单的 recall/store 接口 + context 装配器 |
| **不做** | 向量检索、语义记忆、共享记忆 scope |
| **技术栈** | SQLite + 简单 MCP 工具（store_memory / recall_memory）|
| **成功标准** | ① 跨 session 记住关键信息 ② context 装配不超 token 限制 ③ recall 延迟 <200ms |
| **服务场景** | S1（日常对话）|

### 6.3 Spike 3: Handoff / Multi-Agent Coordination

| 维度 | 内容 |
|------|------|
| **验证假设** | Orchestrator Agent 可以通过 Handoff 工具可靠地将任务委派给 Worker Agent 并收到结果 |
| **范围** | 2 个 Agent（Orchestrator + Worker），Handoff 工具，结果回传 |
| **不做** | 并行 Worker、复杂工作流、Governance 拦截 |
| **技术栈** | 基于 Spike 1 的 Core Loop × 2 个实例 + Handoff 协议 |
| **成功标准** | ① 任务委派成功率 ≥80% ② Worker 结果回传 ③ Worker 失败时 Orchestrator 能感知 |
| **服务场景** | S2（任务协作）+ S3（审批）|

---

## 七、学习路线与 Muse 实现的融合

> [!TIP]
> 关键洞察：学习不是「学完再做」，而是「学一块做一块」。每学一个模块，就用来改进 Muse 的对应部分。

### 7.1 学习-实现对照表

| RDD Phase | 学习内容 | Muse 实现对应 | 产出 |
|-----------|---------|--------------|------|
| Phase 0 | A1-A3: Agent 基础理论 | 校准 philosophy.md | Design Principles v2 |
| Phase 1 | B1-B2: Swarm + LangGraph 源码 | 为 Spike 1 提供参照 | 案例分析报告 |
| Phase 1 | B3-B5: Claude Code + cat-cafe + CrewAI | agent-research-map v2 | 完善案例库 |
| Phase 2 | C1-C2: Prompt + Tool Calling | 重设计 Muse 的 Tool 接口 | MCP Tool 设计规范 |
| Phase 2.5 | 综合 | 锁定 3 个 MVP 场景 | MVP Scenario Spec |
| Phase 3 | C3: Memory | Spike 2: Memory 原型 | Memory 验证报告 |
| Phase 3 | C5: Multi-Agent | Spike 3: Handoff 原型 | Handoff 验证报告 |
| Phase 4 | 综合 | 重写 Blueprint（轻量化）+ 资产矩阵 | Muse Architecture v2 |
| Phase 5 | C4+C6: Eval + Observability | 迭代开发 + mini-eval | 可用的 Muse 系统 |
| Phase 6 | Eval 体系化 | 固化 mini-eval 为正式框架 | Eval 框架 + 基准 |

### 7.2 退出条件驱动的节奏（4 个月总线）

> [!WARNING]
> 不用周数卡时间。用退出条件卡质量。达标才进入下一 Phase，不达标回头补。4 个月是总线约束，不是每个 Phase 的硬 deadline。

| Phase | Exit Criteria（退出条件） | 最晚截止 |
|-------|------------------------|---------|
| **Phase 0** | ① research-map v2 理论部分完成 ② 能用自己的话写出 Agent 10 个核心概念 ③ philosophy.md 校准完成 | ~月 1 中 |
| **Phase 1** | ① research-map v2 覆盖 ≥6 案例 + 证据分级 ② 亲手跑通 ≥2 个开源项目 demo ③ 每个案例有统一模板的分析报告 | ~月 1 末 |
| **Phase 2** | ① Design Principles v2 完成，每条原则有 ≥2 个独立案例支撑 ② 原则间无矛盾 | ~月 2 初 |
| **Phase 2.5** | ① 3 个锚点场景有用户故事 + AC ② Spike 与场景映射表完成 | ~月 2 初 |
| **Phase 3** | ① 3 个 Spike 中至少 2 个跑通 ② 每个 Spike 有验证报告（含失败分析） | ~月 2 末 |
| **Phase 4** | ① 新 Blueprint 对应 3 个锚点场景 ② 现有资产 Retain/Refactor/Rewrite/Archive 矩阵完成 ③ Blueprint v2 reviewed | ~月 3 初 |
| **Phase 5** | ① S1（日常对话）端到端跑通 ② S2（任务协作）端到端跑通 ③ S3（审批链路）跑通 ④ **S2b（自开发闭环）跑通** ⑤ **最小可观测性达标（trace 全覆盖 + 指标可查）** ⑥ 至少 1 个可公开演示的 demo + 1 份 failure postmortem — 即 **Muse Basic v1 全部 5 项能力达标** | ~月 3 末 |
| **Phase 6** | ① Eval 框架可复用 ② 基准报告产出 | ~月 4 初 |
| **Phase 7** | ① Portfolio 完整（Muse demo + 博客 + 面试故事 + **Capstone 非 Muse 小 Agent 应用**） ② 可以面试 | ~月 4 末 |

---

## 八、对现有资产的处置：四分法

> [!IMPORTANT]
> 不是「默认不复用」，而是用 **Retain / Refactor / Rewrite / Archive** 四分法精确分类。

### 8.1 四分法定义

| 分类 | 含义 | 标准 |
|------|------|------|
| **🟢 Retain** | 直接保留，接入新架构 | 接口清晰、职责单一、已验证稳定 |
| **🟡 Refactor** | 保留核心逻辑，调整接口/结构对齐新架构 | 逻辑健全、但接口或分层需要调整 |
| **🔴 Rewrite** | 重写（保留领域知识，代码重来） | 概念正确但实现不匹配新架构 |
| **⚫ Archive** | 归档参考，不进入新系统 | 实验性功能、过度工程、或已被新设计替代 |

### 8.2 现有代码资产分类（初步，Phase 4 时最终确定）

| 模块 | 文件 | 分类 | 理由 |
|------|------|------|------|
| **Engine** | `core/engine.mjs` | 🟢 Retain | OpenCode 封装层，接口清晰，职责单一 |
| **Telegram Adapter** | `adapters/telegram.mjs` | 🟢 Retain | 感知通道，稳定运行，接口标准 |
| **Pulse 调度器** | `daemon/pulse.mjs` | 🟢 Retain | 主动性引擎，逻辑独立，已验证 |
| **Family 配置** | `family/config-loader.mjs` | 🟢 Retain | 四层配置加载，设计合理 |
| **Memory** | `core/memory.mjs` + `mcp/memory.mjs` | 🟡 Refactor | 核心逻辑保留，scope/分层接口需对齐 |
| **Identity** | `core/identity.mjs` | 🟡 Refactor | 三层合并逻辑保留，Profile 拆分需调整 |
| **Perception** | `perception/ingress.mjs` | 🟡 Refactor | 标准化逻辑保留，Event 类型需对齐 |
| **Cerebellum** | `daemon/cerebellum.mjs` | 🟡 Refactor | 守护逻辑保留，异步演化需扩展 |
| **Orchestrator** | `core/orchestrator.mjs` | 🔴 Rewrite | 需要从薄转发重构为状态机（但领域知识保留） |
| **Workflow State Machine** | `workflow/state-machine.mjs` | 🔴 Rewrite | 概念正确但实现需基于 Spike 3 重来 |
| **Dev Engine** | `dev/` | ⚫ Archive | 过度工程，研究后决定是否需要 |
| **Goals/Threads** | `core/goals.mjs` + `core/threads.mjs` | ⚫ Archive | 实验性功能，待研究后决定 |
| **Capability Registry** | `perception/capability-registry.mjs` | ⚫ Archive | 过早抽象，研究后决定 |

### 8.3 文档资产分类

| 文档 | 分类 | 理由 |
|------|------|------|
| **philosophy.md** | 🟡 Refactor | 直觉好，Phase 0 后理论校准更新 |
| **agent-research-map.md** | 🟡 Refactor | 好的开始，Phase 1 深化为 v2 |
| **engineering-map.md** | 🟡 Refactor | 圈层思路正确，Phase 4 时基于 Spike 经验更新 |
| **architecture-blueprint (7层)** | 🔴 Rewrite | 过重，Phase 4 基于原型经验精简 |
| **technical-design 系列** | ⚫ Archive | 过早进入细节，Phase 4 后重新设计 |
| **core_loop_spike.mjs** | ⚫ Archive | 未经案例校准，Spike 1 重来 |

---

## 九、与职业发展的对齐（4 个月时间线）

### 9.1 高级 AI Agent 开发工程师的技能树

```
Agent Engineer 技能树（4 个月达标路线）
├── 🔴 核心（月 1-2 必须精通）
│   ├── LLM API 使用（OpenAI/Anthropic/Google）
│   ├── Prompt Engineering（系统提示、工具描述、few-shot）
│   ├── Tool/Function Calling 设计
│   ├── Agent 架构模式（ReAct, OODA, Plan-Execute）
│   └── 错误处理与恢复策略
├── 🟡 进阶（月 2-3 需要掌握）
│   ├── Multi-Agent 编排（Orchestrator-Worker, Handoff, Pipeline）
│   ├── Memory 系统设计（短期/长期/语义）
│   ├── RAG 设计与实现
│   ├── Agent Evaluation 方法论
│   └── Observability / Tracing
├── 🟢 加分（月 3-4 有就更好）
│   ├── Fine-tuning 经验
│   ├── Agent 安全（Guardrails, Red-teaming）
│   ├── 生产部署经验（成本优化、延迟控制）
│   └── 开源项目贡献
└── 💼 Portfolio 展示（月 4 整理）
    ├── Muse 项目（端到端 Agent 系统）
    ├── 技术博客（研究笔记 → 公开文章）
    ├── 开源贡献
    └── 面试故事（失败经验 → 解决方案）
```

### 9.2 Muse 项目如何服务于职业发展

| 面试常见问题 | Muse 中的对应经验 |
|-------------|-----------------|
| "设计一个 Agent 系统" | Muse 的完整架构设计经历 |
| "如何做 multi-agent 协作" | Muse Family 的 Orchestrator-Worker 实现 |
| "Agent 的记忆如何设计" | Muse 的 Memory 三层架构 |
| "如何评估 Agent 质量" | Muse 的 eval 框架（贯穿式 mini-eval + 体系化固化） |
| "遇到过什么 Agent 失败" | Phase 1 的 38 个 Task 中的踩坑记录 + Spike 失败分析 |
| "如何做 Prompt Engineering" | Muse 的 system prompt + tool description 设计 |
| "如何处理 Agent 的幻觉问题" | Muse 的 Governance 拦截 + 事实验证 |

---

## 十、下一步行动

如果你同意这个方向，我们立即开始：

1. **创建研究目录结构**：`user/research/` + `user/spikes/` + `user/exercises/`
2. **Phase 0 启动**：从 Anthropic Building Effective Agents 开始精读
3. **建立研究笔记模板**
4. **每完成一个研究项，产出一个 KI**；仅当研究导致重大架构决策时才产出 ADR（如 Core Loop 模式选型、Memory 分层方案、Handoff 协议选择、Governance 拦截点定位）

> **关键承诺：** 从现在起，每一个 Muse 的设计决策都必须能追溯到具体的研究证据，不再凭直觉设计。

---

## 附录：研究优先级

| 优先级 | 材料 | 理由 |
|--------|------|------|
| 🔴 最高 | Anthropic 的两篇指南（A1, A2） | Industry gold standard |
| 🔴 最高 | OpenAI Swarm 源码（B1） | 最简 multi-agent 参考实现 |
| 🟡 高 | LangGraph（B2） | 行业标准状态机框架 |
| 🟡 高 | Google ADK（A4） | 8 种模式参考 |
| 🟢 中 | cat-cafe-tutorials（B4） | 最接近 Muse 的多 Agent 实战 |
| 🟢 中 | Claude Code / Cline（B3） | 顶级单 Agent 实现 |
| ⚪ 低 | OpenClaw / ZeroClaw / Nanobot | 特定场景参考 |
