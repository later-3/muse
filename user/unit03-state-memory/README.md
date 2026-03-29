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

## 📖 学习文档（AI 为你准备）

| 文件 | 内容 | 状态 |
|------|------|------|
| `05-study-langgraph-compaction.md` | Graph 状态机 + Checkpoint + OC 压缩 | [AI✓] |
| `06-study-crewai-prompt.md` | CrewAI 角色 + Prompt 组装 | [AI✓] |

## 🎯 你的任务

- [ ] 工作流状态机 Mermaid 图
- [ ] 4 个角色卡片草案
- [ ] LangGraph demo 跑通

## 🤖 AI 并行任务

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp05 | `exp05-state-machine.mjs` | 6/6 ✅ |
| 🧪 exp06 | `exp06-role-prompt.mjs` | 3/3 ✅ |
| 🔧 R5 | `R5-harness-e2e.md` | 评估 6/10 |
| 🔧 R6 | `R6-memory-persistence.md` | 评估 7/10 |

## 🔧 OC 基础小任务（学了就练）

| # | 任务 | 练什么 | 状态 |
|---|------|--------|------|
| oc07 | 用 OC session 模拟状态机：idle → working → review → done | OC 会话状态管理 | [ ] |
| oc08 | 给 OC 不同的 system prompt 模拟角色切换 | 角色系统 | [ ] |
| oc09 | 用 Muse 的 search_memory MCP 工具查记忆 | 记忆系统实操 | [ ] |

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 memory.mjs (SQLite) + search_memory 工具链 | [ ] |
| **学习助手** | V2 加对话记忆（记住之前聊过什么）+ 笔记导出 | [ ] |
