# Wiki 操作日志

> 按时间倒序记录所有 Ingest / Query / Lint 操作。
> 格式: `## [YYYY-MM-DD] {ingest|query|lint} | {标题}`

---

## [2026-04-08] ingest | 来源对齐 — 新建 courses/ 目录 + 补齐李宏毅/Karpathy/吴恩达链接

- 涉及 15+ 个文件
- 关键变更:
  - **新建 `reference/courses/`** 目录，为李宏毅（3门课）、Karpathy（6个视频）、吴恩达（5门课）、Anthropic（BEA博文）建立索引 README.md
  - **`_source-registry.md`** 新增"课程来源"section，课程和 repos 并行作为 Layer 1 Raw Sources
  - **`CONVENTION.md`** 42天计划表全部补齐具体 YouTube 链接（30 个 Day 中 22 个有链接更新）
  - **D01-D05** 深入资源表新增李宏毅视频 + 补充视角说明（通俗类比、教学举例）
  - 李宏毅来源覆盖：N01-N12 全部 12 个 N 节点中 10 个有李宏毅对应视频

## [2026-04-06] lint | v2 质量改造 — 代码实证/合成标注/去重/路径精化

- 涉及 10 个 wiki 页面
- 关键变更:
  - **memory.md**: 从零代码升级为代码密集 — 补充 hello-agents ch8 的 5 个核心代码片段（MemoryTool add/search/forget/consolidate + WorkingMemory.retrieve），新增四层架构图
  - **observability.md**: 标注合成代码为"编辑综合"（OpenTelemetry/Langfuse 示例），消除 L06 威胁表重复（改为交叉引用 failure-recovery + identity-persona）
  - **identity-persona.md**: 标注 JSON schema 为"编辑综合，非单一来源直接提取"
  - **failure-recovery.md**: 消除 safe_path 重复（改为交叉引用 tool-use-mcp），消除上下文失败表重复（改为交叉引用 context-engineering）
  - **_index.md**: "Phase 1/2/3" 改为功能标签（Agent 技能/LLM 基座理论/生产级工程），阅读路径加入 identity-persona 且标注 skills 路径非强制线性
  - **production 5 篇来源路径**: 根目录 → 具体文件（learn-claude-code/, ai-agents-for-beginners/, swarm/ → 具体 .md 文件）

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
