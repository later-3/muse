# Sprint 2：Memory + 案例补全 + Prompt 深化

> **Sprint 目标：** 完成 Memory 和 Prompt Engineering 的理论研究，补全剩余案例，完成 research-map v2。  
> **服务于：** 全景图域 2（Memory）+ 域 1 补全（Prompt）+ 域 3 补全（角色定义）  
> **前置条件：** Sprint 1 完成  
> **总览地图：** `user/overview.md`（Phase/Sprint/Day 全局对照）  
> **AI并行计划：** `make-muse/ai-parallel-track.md`（实验 + 消险清单）  
> **每日流程：** 你看"你的任务"→ AI 看"AI 并行轨道"→ 两轨同时跑

---

## Day 11：Memory 理论研究

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 Memory 架构精华笔记（cat-cafe 3 层 + Anthropic Memory + Muse 映射）
- [ ] 1.2 你来做：读笔记 → 理解短期/长期/共享记忆区别 → 能回答面试题

### Step 2: 🎯 Muse 小任务

- [ ] 2.1 审查 Muse `src/mcp/memory.mjs` 当前实现
- [ ] 2.2 对照 cat-cafe 3 层模型，标注 Muse 缺什么
- [ ] 2.3 产出：`11-muse-memory-audit.md`

### 🤖 AI 并行轨道

- [ ] 🧪 `exp11-memory-layers.mjs` — 用 SQLite 实现最简 3 层记忆（短期/长期/共享）
- [ ] 🔧 **R7: Spike 1 预跑** — 最简 Core Loop 能否 10 轮对话不崩

---

## Day 12：RAG 基础 + 向量检索

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 RAG 精华笔记（Embedding 原理 + 检索策略 + Muse 适用度）
- [ ] 1.2 你来做：判断 Muse memory 是否需要向量检索（vs 关键词检索）

### Step 2: 🎯 Muse 小任务

- [ ] 2.1 设计 Muse memory recall 的检索策略草案
- [ ] 2.2 产出：`12-muse-memory-retrieval.md`

### 🤖 AI 并行轨道

- [ ] 🧪 `exp12-vector-vs-keyword.mjs` — 对比两种检索方式的召回率
- [ ] 🔧 **R8: Spike 2 预跑** — SQLite memory 能否 <200ms 响应

---

## Day 13：Tool/Function Calling 深入

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付多平台 Tool Calling 对比（OpenAI vs Anthropic vs Google vs MCP）
- [ ] 1.2 你来做：判断 Muse MCP 工具设计需要改什么

### Step 2: 🎯 Muse 小任务

- [ ] 2.1 基于 Day 1 ACI 审计 + 今天的学习，写 Muse MCP 工具设计规范 v2
- [ ] 2.2 产出：`13-muse-tool-design-spec.md`

### 🤖 AI 并行轨道

- [ ] 🔧 **R9: Spike 3 预跑** — 2 个 Agent 实例之间 Handoff 成功率
- [ ] 🔧OC: **MCP 进阶机制** — 工具参数验证 + 错误返回规范

---

## Day 14：Vercel AI SDK 走读

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 Vercel AI SDK 精华（streamText + tool() + Provider 模式）
- [ ] 1.2 你来做：判断 Muse 是否可以借鉴 Provider 抽象

### 🤖 AI 并行轨道

- [ ] 🧪 `exp14-stream-tool.mjs` — 用 Vercel AI SDK 实现流式工具调用

---

## Day 15：Pydantic AI 走读

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 Pydantic AI 精华（类型安全 Agent + Result 验证）
- [ ] 1.2 你来做：判断 Muse 的 MCP 工具结果验证是否需要加强

### 🤖 AI 并行轨道

- [ ] 🧪 `exp15-typed-agent.mjs` — 用 Zod 给 Muse MCP 工具加强类型校验

---

## Day 16：Prompt 实战

### Step 1: 📖 学习（动手实练）

- [ ] 1.1 基于 Day 7 的 pua prompt 骨架，写完整版 pua prompt v1
- [ ] 1.2 测试效果：让 pua 用 v1 prompt 对话 10 轮

### Step 2: 🎯 Muse 小任务

- [ ] 2.1 写 3 个 MCP 工具的 description（基于 ACI 六原则）
- [ ] 2.2 测试 LLM 调用准确率
- [ ] 2.3 产出：`16-muse-prompt-v1.md` + `16-muse-tool-descriptions.md`

### 🤖 AI 并行轨道

- [ ] 🔧 **R10: S3 审批工具原型** — 实现 request_approval + check_approval MCP 工具

---

## Day 17：OpenCode Sisyphus 协议

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 Sisyphus 协议精华（多 Agent 编排核心 + 状态流转 + 对 Muse 启发）
- [ ] 1.2 你来做：对比 Sisyphus vs Muse harness 的编排方式

### 🤖 AI 并行轨道

- [ ] 🔧OC: **Sisyphus 源码走读** — 协议实现 + 状态机 + 对 Muse workflow.bridge 的改进建议

---

## Day 18：Claude Code ACI 行为观察

### Step 1: 📖 学习（AI 先交付，你来吸收）

- [ ] 1.1 AI 交付 Claude Code 工具设计分析（ACI 最佳实践 + 错误恢复策略）
- [ ] 1.2 你来做：对照 Muse 的 MCP 工具，标注改进点

### 🤖 AI 并行轨道

- [ ] 🔧OC: **Custom Tools 机制** — OpenCode 自定义工具 + 对 Muse Plugin 的启发

---

## Day 19-20：Design Principles 定稿 + Sprint 2 复盘

### 你的任务

- [ ] 1. 把 Sprint 1+2 的所有研究整合到 `agent-research-map-v2.md`
- [ ] 2. 加入证据分级（高共识 / 有分歧 / 仅特定场景）
- [ ] 3. 确保覆盖 ≥6 个案例
- [ ] 4. 从所有研究中提炼设计原则 v1（每条追溯 ≥2 个案例）
- [ ] 5. mini-eval 自检：
  - [ ] research-map v2 覆盖 ≥6 案例？
  - [ ] 跑通 ≥2 个 demo？
  - [ ] 能口述 10 个 Agent 核心概念？
- [ ] 6. 产出：`design-principles-v1.md` + `sprint-2-retro.md`

### 🤖 AI 并行轨道

- [ ] 🔧 **Sprint 2 消险汇总** — R7-R10 结果汇总 + Spike 可行性最终评估
- [ ] 🔧 **Spike 1-3 准备清单** — 基于所有消险结果，列出 Later 接手时的注意事项

---

## 不做清单

- ❌ 不写 Spike 代码（Sprint 4 你接手，AI 已预跑过）
- ❌ 不改 Muse 现有主线代码
- ✅ AI 并行做实验和消险（不进主线，只产出报告）
- ✅ OpenCode 持续关联（Sisyphus / Custom Tools / MCP 进阶）
