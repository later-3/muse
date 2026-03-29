# Unit 03: 状态管理 + 记忆

> **对应 Sprint 1 Day 05-06** · LangGraph + CrewAI + 角色系统

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| 向量数据库怎么工作 | `foundations/F8` §2-3 (Embedding + HNSW) |
| LLM 上下文 ≠ 记忆 | `foundations/F2` §2 + `F1` §3 |
| Embedding 是什么 | `foundations/F8` §2 |
| KV-Cache 和推理速度 | `foundations/F13` §1 |

## 学习目标

1. 工作流状态机怎么设计？（状态 + 事件 + Guard）
2. 角色系统怎么构建？（Role + Team + Prompt 模板）
3. Muse 的 memory 架构和 Agent 记忆理论怎么对应？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 状态 |
|------|------|------|
| `study/05-study-langgraph-compaction.md` | Graph 状态机 + Checkpoint + OC 压缩 | [AI✓] |
| `study/06-study-crewai-prompt.md` | CrewAI 角色 + Prompt 组装 | [AI✓] |

## 🎯 你的任务

- [ ] 工作流状态机 Mermaid 图
- [ ] 4 个角色卡片草案
- [ ] LangGraph demo 跑通

## 🤖 AI 并行任务 → `experiments/`

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp05 | `experiments/exp05-state-machine.mjs` | 6/6 ✅ |
| 🧪 exp06 | `experiments/exp06-role-prompt.mjs` | 3/3 ✅ |
| 🔧 R5 | `experiments/R5-harness-e2e.md` | 评估 6/10 |
| 🔧 R6 | `experiments/R6-memory-persistence.md` | 评估 7/10 |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### A. 理论实操

| # | 任务 | 对应理论 | 产出 |
|---|------|---------|------|
| oc13 | **SQLite 记忆存储** — 用 better-sqlite3 实现 episodic + semantic 双表，支持存/查/摘要 | Weng Memory 三要素 | `oc13-memory-store.mjs` |
| oc14 | **向量搜索入门** — 用 sqlite-vec 做 Embedding 存储 + 余弦相似度检索 | F8 RAG 原理 | `oc14-vector-search.mjs` |
| oc15 | **对话上下文压缩** — 实现 token 预算管理：超限时自动摘要历史 | OpenCode compaction | `oc15-context-compaction.mjs` |

### B. 课程练习

| # | 来源 | 练什么 | 产出 |
|---|------|--------|------|
| oc16 | **LangGraph** 官方教程 | Graph 状态机 + Checkpoint 实操 | `oc16-langgraph-demo.md` |
| oc17 | **CrewAI** 官方教程 | 角色定义 + Task + Process 跑通一个多角色场景 | `oc17-crewai-demo.md` |
| oc18 | **Hello-Agents** Ch5-6 记忆 | Datawhale 记忆与状态管理实战 | `oc18-hello-memory.mjs` |

### C. 项目拆解

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc19 | **OpenCode Compaction** (我们的底座) | session 压缩机制全链路：何时触发 → 怎么摘要 → 丢什么保什么 | `oc19-oc-compaction.md` |
| oc20 | **Muse memory.mjs** | 我们的记忆模块走读：SQLite 表结构 + search_memory MCP 工具 | `oc20-muse-memory.md` |
| oc21 | **ChatGPT Memory** (逆向分析) | OpenAI 是怎么做用户记忆的？公开信息 + 推测工程实现 | `oc21-chatgpt-memory.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 memory.mjs (SQLite) + search_memory 工具链 | [ ] |
| **学习助手** | V2 加对话记忆（记住之前聊过什么）+ 笔记导出 | [ ] |
