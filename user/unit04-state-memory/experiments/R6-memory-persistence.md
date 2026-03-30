# R6: Memory 持久化稳定性检查

> **消险任务**: 评估 Muse Memory (SQLite) 的数据可靠性  
> **分析对象**: `src/mcp/memory.mjs` + `src/core/memory.mjs`

---

## Memory 架构

```
semantic_memories (key-value 长期记忆)
  → search_memory / set_memory / get_user_profile
  
episodic_memories (对话摘要)
  → add_episode / get_recent_episodes
  
goals (结构化目标)
  → create_goal / list_goals / update_goal

threads (生活线索)
  → create_thread / list_threads / get_thread
```

## 风险清单

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| 1 | **无 schema 迁移机制** | 🟡 | 表结构变更靠手动改代码。新增字段时旧数据无法自动升级 |
| 2 | **无备份策略** | 🟡 | memory.db 是单文件，误删/损坏 = 全部记忆丢失 |
| 3 | **并发写入安全** | 🟢 | SQLite WAL 模式下单进程多读安全。Muse 单进程架构下风险很低 |
| 4 | **source 优先级逻辑正确** | 🟢 | `sourcePriority()` 正确实现 user_stated > ai_inferred > ai_observed |
| 5 | **__pending key 隔离** | 🟢 | `isPendingKey()` 正确过滤未确认数据 |
| 6 | **episode 无截断** | 🟡 | `add_episode` 的 summary 无长度限制。LLM 可能存极长摘要 → 数据库膨胀 |
| 7 | **tags/meta JSON 解析** | 🟢 | `safeParseJson()` 正确处理损坏数据 |

## 亮点

- ✅ source 分级（user_stated/ai_inferred/ai_observed）设计精良
- ✅ __pending 暂存机制防止 AI 推断直接覆盖用户声明
- ✅ get_user_profile 按 confidence 聚合，低置信不进画像
- ✅ goals 和 threads 有独立表，不混入 semantic memory

## 整体评估: 🟢 7/10

Memory 稳定性较好。核心风险是无备份和无迁移机制，但在 MVP 阶段不阻塞。

**Sprint 2 接手须知**: 
- 加定期备份 (cron cp memory.db memory.db.bak)
- 考虑 episode summary 长度限制 (512 chars)
- Sprint 5 RAG 时需要加 FTS5 索引
