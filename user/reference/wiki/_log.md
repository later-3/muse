# Wiki 操作日志

> 按时间倒序记录所有 Ingest / Query / Lint 操作。
> 格式: `## [YYYY-MM-DD] {ingest|query|lint} | {标题}`

---

## [2026-04-06] lint | DoD 合规检查 — 修复路径/死链/注册表

- 涉及 17 个 wiki 页面
- 关键变更:
  - 修正 15 篇文章的来源路径: `../repos/` → `../../repos/`（共 57 处）
  - 修复 2 个死链: `[[runtime-comparison]]` → `[[agentic-protocols]]`（multi-agent.md, tool-use-mcp.md）
  - 补强 `_source-registry.md` production 文章映射
  - 创建本文件 `_log.md`

## [2026-04-06] ingest | Karpathy llm-wiki Gist 正式规范

- 涉及 1 个 wiki 页面
- 关键变更:
  - 将 Gist 三层架构、三大操作、索引/日志机制整合进 `_methodology.md`
  - 收录社区实践（评论区 7 个扩展方向）
  - 拆分核心方法 vs 本仓库落地规范

## [2026-04-05] ingest | Phase 3 — Production Engineering (Batch 3)

- 涉及 8 个 wiki 页面
- 关键变更:
  - 新建 5 篇: harness-architecture, observability, identity-persona, agentic-protocols, failure-recovery
  - 更新 `_index.md`（完成 Phase 3 表格 + Mermaid 概念图 Production 子图）
  - 更新 `_source-registry.md`（learn-claude-code, ai-agents-for-beginners 覆盖标记）

## [2026-04-05] ingest | Phase 2 — LLM Foundations (Batch 2)

- 涉及 7 个 wiki 页面
- 关键变更:
  - 新建 4 篇: transformer, tokenization, training-pipeline, reasoning
  - 更新 `_index.md`（Phase 2 表格 + Mermaid Foundations 子图）
  - 更新 `_source-registry.md`

## [2026-04-04] ingest | Phase 1 — Agent Skills (Batch 1)

- 涉及 8 个 wiki 页面
- 关键变更:
  - 新建 6 篇: agent-definition, tool-use-mcp, prompt-engineering, multi-agent, context-engineering, memory
  - 创建 `_index.md` 和 `_source-registry.md`
  - 建立 wiki 目录结构 (skills/ foundations/ production/)
