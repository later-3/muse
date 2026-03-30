# Unit 04: 状态 + 记忆

> **终极目标关联：** 理解 Muse memory 系统 + 能改进记忆策略
> **本单元终结目标 (TLO)：** 完成 unit04 后，Later 能——
> 1. 面试时讲清 LLM 记忆的三种类型 + Compaction 策略
> 2. 理解向量嵌入 + ANN 检索的原理
> 3. 走读 Muse memory.mjs 并能改进
> 4. 理解 OpenCode 的 session.compacting 机制
>
> **上游：** unit03 多 Agent 协作
> **下游：** Week 4 综合
> **来源底子：** [W4] Weng Blog Memory + [C8] MS Agents L13 + [D3] LangGraph + [U3] Stanford CS329A
> **课程证据：** C8 L13=Memory 是倒数第二课; Berkeley U2 把 Retrieval 放在 Agent Basics 后面; 所有课程都把 Memory 放最后

---

### 📚 前置基础

| 看到什么不懂 | 去哪里 |
|------------|--------|
| Weng 三要素 Memory 部分 | `unit01/study/01e` §2.3 |
| 向量嵌入基础 | `foundations/F8-rag.md` |
| Agent Loop 怎么管理 messages | unit01 oc04 |

---

## 学习目标（问句形式）

1. LLM 的"记忆"到底是什么？（上下文窗口 vs 外部存储）
2. 向量嵌入怎么工作？FAISS/HNSW 怎么检索？
3. Compaction 是什么？为什么需要？OpenCode 怎么做的？
4. Muse 的 memory.mjs 架构是什么？可以怎么改进？
5. RAG 和 Memory 是什么关系？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `03a-memory-and-vectors.md` | 记忆三分类 + 向量嵌入 + 检索算法 | [W4] Weng + `repos/ai-agents-for-beginners/13-agent-memory/` | [占位] |
| `03b-state-machines.md` | 状态机 + Compaction 策略 | [D3] LangGraph 短课 + OpenCode 源码 | [占位] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### Level 1: 观察

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc26 | **观察 Muse Memory 读写** — 多次对话，观察 memory.mjs 调用和存取 | `[U][L]` | 03a §记忆 | `src/mcp/memory.mjs` | `oc26-memory-observation.md` |
| oc27 | **触发 Compaction** — 发长对话直到触发上下文压缩 | `[U][O][L]` | 03b §Comp | KI: OC compaction | `oc27-compaction-trigger.md` |

### Level 2: 理解

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc28 | **走读 Muse memory.mjs** — 存储格式、检索逻辑、search_memory 工具链 | `[S]` | 03a §Weng | `src/mcp/memory.mjs` `src/core/memory.mjs` | `oc28-memory-walkthrough.md` |
| oc29 | **走读 OpenCode Compaction** — session.compacting hook + 压缩策略 | `[S]` | 03b | KI: `opencode_core.md` | `oc29-compaction-walkthrough.md` |

### Level 3: 分析 + 创造

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc30 | **Muse Memory 审计** — 存储效率/检索准确度/过期策略 | `[S][B]` | `oc30-memory-audit.md` |
| oc31 | **改进 Memory** — 落地一个审计出的改进点 | `[B]` | `oc31-memory-improve.md` + 代码 |

### Level 5: 综合

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc32 | **unit04 面试模拟** — 记忆三分类 + Compaction + STAR | — | `oc32-interview-stories.md` |

---

## 🏗️ Muse 里程碑

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M10 | Memory 完整架构理解 | oc28 | [ ] |
| M11 | Memory 审计 + 落地改进 | oc30 → oc31 | [ ] |

## 🌊 学习助手里程碑

| # | 里程碑 | 状态 |
|---|--------|------|
| S6 | V3 带记忆的学习对话 | [ ] |

---

## ✅ 通关检查

- [ ] 能讲清 LLM 记忆三种类型（工作/短期/长期）
- [ ] 能解释向量嵌入 + ANN 检索的基本原理
- [ ] 能说清 Compaction 为什么需要 + OpenCode 怎么做的
- [ ] `[S]` 能画出 Muse memory.mjs 的数据流
- [ ] `[B]` 落地了一个 Memory 改进
- [ ] 准备了 Muse Memory 的 STAR 故事
