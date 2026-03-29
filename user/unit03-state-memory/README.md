# Unit 03: 状态 + 记忆

> **来源底子：** [W4] Weng Blog Memory + [C8] MS Agents L13 + [D3] LangGraph + [U3] Stanford CS329A
> **上游：** unit02 多 Agent 协作
> **下游：** unit04 Prompt Eng → Week 4 综合

### 📚 前置基础

| 看到什么不懂 | 去哪里 |
|------------|--------|
| Weng 三要素 Memory 部分 | `unit01/study/01e` §2.3 |
| 向量嵌入基础 | `foundations/F8-rag.md` |

## 学习目标

1. LLM 的"记忆"到底是什么？（上下文窗口 vs 外部存储）
2. 向量嵌入怎么工作？FAISS/HNSW 怎么检索？
3. Muse 的 memory.mjs 架构是什么？可以怎么改进？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `study/03a-memory-and-vectors.md` | 记忆分类 + 向量嵌入 + 检索算法 | [W4] Weng + `repos/ai-agents-for-beginners/13-agent-memory/` + `repos/anthropic-cookbook/capabilities/contextual-embeddings/` | [占位] |
| `study/03b-state-machines.md` | 状态机 + LangGraph 概念 | [D3] LangGraph 短课 | [占位] |

---

## 🔧 OC 实战任务

### A. 理论实操

| # | 任务 | 产出 |
|---|------|------|
| oc16 | **实现 Memory Store** — SQLite 存取 + 向量相似度搜索 | `oc16-memory-store.mjs` |
| oc17 | **实现 Context Compaction** — 上下文超长时的压缩策略 | `oc17-compaction.mjs` |

### B. 课程练习

| # | 来源 | repos/ 路径 | 产出 |
|---|------|-----------|------|
| oc18 | **MS Agents** L13 Agent Memory | `repos/ai-agents-for-beginners/13-agent-memory/` | `oc18-ms-memory.md` |
| oc19 | **Hello-Agents** 记忆章节 | `repos/hello-agents/docs/chapter10-13/` | `oc19-hello-memory.md` |

### C. 项目拆解

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc20 | **OpenCode Compaction** | Session 压缩机制源码走读 | `oc20-oc-compaction.md` |
| oc21 | **Muse memory.mjs** | 我们的记忆系统审计 | `oc21-muse-memory-audit.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 里程碑 | 状态 |
|------|--------|------|
| **Muse** | Memory 系统重构 (基于 Weng + Compaction 分析) | [ ] |
| **学习助手** | V2 带记忆的学习对话 | [ ] |
