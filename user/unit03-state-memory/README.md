# Unit 03: 状态 + 记忆

> **终极目标关联：** 理解 Muse memory 系统 + 能改进 Muse 的记忆策略
> **本单元终结目标 (TLO)：** 完成 unit03 后，Later 能——
> 1. 面试时讲清 LLM 记忆的三种类型 + Compaction 策略
> 2. 理解向量嵌入 + ANN 检索的原理
> 3. 走读 Muse memory.mjs 并能改进
> 4. 理解 OpenCode 的 session.compacting 机制
>
> **上游：** unit02 多 Agent 协作
> **下游：** unit04 Prompt Eng → Week 4 综合
> **来源底子：** [W4] Weng Blog Memory + [C8] MS Agents L13 + [D3] LangGraph + [U3] Stanford CS329A

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
| `03a-memory-and-vectors.md` | 记忆三分类 + 向量嵌入 + 检索算法 | [W4] Weng + `repos/ai-agents-for-beginners/13-agent-memory/` + `repos/anthropic-cookbook/capabilities/contextual-embeddings/` | [占位] |
| `03b-state-machines.md` | 状态机 + Compaction 策略 | [D3] LangGraph 短课 + OpenCode 源码 | [占位] |

---

## 🤖 AI 并行任务 → `experiments/`

| # | 类型 | 验证什么 | 涉及源码 | 状态 |
|---|------|---------|---------|------|
| R5 | 🔧 | Muse memory.mjs 存储格式分析：数据结构 + 读写频率 + 命中率 | `src/mcp/memory.mjs` | [ ] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

> **USOLB 模型 + Bloom 递进**

### Level 1: 观察 — "看 Muse 的记忆怎么工作"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc20 | **观察 Muse Memory 读写** — 多次和 Muse 对话，观察 memory.mjs 什么时候被调用、存了什么、取了什么 | `[U][L]` | 03a §记忆 | `src/mcp/memory.mjs` + `data/` | `oc20-memory-observation.md` |
| oc21 | **触发 Compaction** — 给 Muse 发长对话直到触发上下文压缩，用 hook 观察压缩前后的变化 | `[U][O][L]` | 03b §Compaction | KI: OpenCode compaction | `oc21-compaction-trigger.md` |

### Level 2: 理解 — "我知道记忆系统怎么实现的"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc22 | **走读 Muse memory.mjs 源码** — 读存储格式、检索逻辑、search_memory 工具链，标注 Weng 的记忆分类 | `[S]` | 03a §Weng Memory + 01e §2.3 | `src/mcp/memory.mjs` + `src/core/memory.mjs` | `oc22-memory-walkthrough.md` |
| oc23 | **走读 OpenCode Compaction 机制** — 读 OC 的 session.compacting hook 怎么调的、压缩策略是什么 | `[S]` | 03b §Compaction | KI: `opencode_core.md` | `oc23-compaction-walkthrough.md` |

### Level 3: 分析 + 创造 — "我能审计并改进 Muse 的记忆"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc24 | **Muse Memory 审计** — 当前 memory 系统的不足：存储效率 / 检索准确度 / 过期策略，给改进方案 | `[S][B]` | 03a 全部 | `src/mcp/memory.mjs` `src/core/memory.mjs` | `oc24-memory-audit.md` |
| oc25 | **改进 Compaction 或 Memory** — 落地一个审计出的改进点 | `[B]` | 03a + 03b | 相关源码 | `oc25-memory-improve.md` + 代码 |

### Level 5: 综合

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc26 | **unit03 面试模拟** — 记忆三分类 + Compaction + Muse Memory 的 STAR 故事 | — | `oc26-interview-stories.md` |

---

## 🏗️ 主线项目: Muse 里程碑

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M8 | **理解 Muse Memory 完整架构** — 能画出 memory.mjs + core/memory.mjs 的数据流 | oc22 | [ ] |
| M9 | **Memory 审计 + 落地一个改进** | oc24 → oc25 | [ ] |

## 🌊 支线项目: 学习助手 里程碑

| # | 里程碑 | 关联知识 | 状态 |
|---|--------|---------|------|
| S5 | **V2 带记忆的学习对话** — 记住学过什么、薄弱点在哪 | 03a Memory + 03b State | [ ] |

---

## ✅ 通关检查

- [ ] 能讲清 LLM 记忆的三种类型（工作记忆 / 短期 / 长期）
- [ ] 能解释向量嵌入 + ANN 检索的基本原理
- [ ] 能说清 Compaction 为什么需要 + OpenCode 怎么做的
- [ ] `[S]` 能画出 Muse memory.mjs 的数据流
- [ ] `[B]` 落地了一个 Memory 改进
- [ ] 准备了 Muse Memory 的 STAR 故事
