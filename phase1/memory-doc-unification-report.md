# 记忆架构文档统一性审查报告

> 审查范围：项目内所有涉及记忆系统描述的文档
> 审查时间：2026-03-12

---

## 审查对象

| # | 文档 | 定位 |
|---|------|------|
| D1 | [ARCHITECTURE.md](file:///Users/xulater/Code/assistant-agent/ARCHITECTURE.md) | 项目总架构（愿景级） |
| D2 | [phase1/README.md](file:///Users/xulater/Code/assistant-agent/phase1/README.md) T04 节 | Phase 1 任务规划 |
| D3 | [memory-architecture.md](file:///Users/xulater/Code/assistant-agent/phase1/t07-web-cockpit/memory-architecture.md) | T07 BUG 分析时写的记忆架构说明 |
| D4 | [phase2/README.md](file:///Users/xulater/Code/assistant-agent/phase2/README.md) §3.1 | Phase 2 技术方案（含审核通过的修订） |
| D5 | [muse/AGENTS.md](file:///Users/xulater/Code/assistant-agent/muse/AGENTS.md) | 刚创建的 OpenCode agent 上下文 |

---

## 冲突 1：「4 层记忆」vs「2 层记忆」

### 各文档的说法

| 文档 | 表述 |
|------|------|
| D2 (phase1/README.md) | "实现 **4 层记忆系统**的基础版"，列出：身份记忆、语义记忆、情景记忆、工作记忆 |
| D3 (memory-architecture.md) | 只提 **2 类**：语义记忆 (semantic_memory 表) + 情景记忆 (episodic_memory 表) |
| D1 (ARCHITECTURE.md) | "语义 + 情景"（和 D3 一致） |
| D5 (muse/AGENTS.md) | "语义(KV) + 情景(对话日志)"（和 D3 一致） |

### 代码实际情况

```sql
-- muse/core/memory.mjs 中的 SCHEMA_SQL，只有 2 个表：
CREATE TABLE IF NOT EXISTS semantic_memory (...)
CREATE TABLE IF NOT EXISTS episodic_memory (...)
```

- **身份记忆** → 不在 Memory 模块中，是 `identity.mjs` 直接读 `identity.json`
- **工作记忆** → 不在 Memory 模块中，是 OpenCode session 的上下文窗口

### 分析

D2 说的"4 层"是**概念模型**：从认知科学角度定义了 4 种记忆类型。这个概念本身没错。但问题在于：

1. **新人会误解**：看到 T04 说"4 层记忆"，去翻 `memory.mjs` 代码只找到 2 个表，会困惑"另外 2 层在哪？"
2. **职责混淆**：身份记忆属于 Identity 模块，工作记忆属于 Engine/OpenCode 模块，不应归入 Memory 模块的"层"
3. **D3 和 D2 矛盾**：D3 是基于代码实际写的，只有 2 层；D2 是设计时的概念规划

### 建议

将 D2 的表述改为：

```diff
- **4 层记忆**：
+ **记忆体系**（2 层存储 + 2 外部依赖）：
  | 层 | 存储 | Phase 1 实现 | 归属模块 |
  |----|------|-------------|---------|
- | 身份 | identity.json | 直接读文件 |
+ | 身份 | identity.json | 直接读文件 | Identity 模块 |
- | 语义 | SQLite semantic_memory 表 | key-value CRUD |
+ | 语义 | SQLite semantic_memory 表 | key-value CRUD | Memory 模块 |
- | 情景 | SQLite episodic_memory 表 | 对话全文 + 日期 |
+ | 情景 | SQLite episodic_memory 表 | 对话全文 + 日期 | Memory 模块 |
- | 工作 | OpenCode session | engine 代理 |
+ | 工作 | OpenCode session 上下文窗口 | engine 代理 | Engine/OpenCode |
```

**理由**：保留 4 种记忆类型的概念完整性（这是好的设计），但明确标注哪些属于 Memory 模块、哪些是外部依赖，避免新人困惑。

---

## 冲突 2：Phase 2 向量存储方案 — ChromaDB vs sqlite-vec

### 各文档的说法

| 文档 | 方案 |
|------|------|
| D3 (memory-architecture.md) | **"记忆迁移: SQLite → 向量数据库（如 ChromaDB），支持更大规模"** |
| D4 (phase2/README.md) | **P2-08 任务明确用 sqlite-vec**，无处提及 ChromaDB |

### 分析

| 维度 | ChromaDB | sqlite-vec |
|------|----------|-----------|
| 架构 | 独立进程 (Python) | SQLite 扩展 (C) |
| 依赖 | 需要 Python 环境 + pip | Node.js 直接用 better-sqlite3 加载 |
| 与现有架构的兼容性 | **需新增进程**，违反"轻量、无框架"原则 | **零新进程**，复用现有 SQLite |
| 项目规范 | 项目用 Node.js ESM，引入 Python 是技术栈分裂 | 原生兼容 |
| Phase 2 审核意见 | 未提及 | 审核已通过 |

### 建议

D3 删除 ChromaDB，改为：

```diff
- | **记忆迁移** | SQLite → 向量数据库（如 ChromaDB），支持更大规模 |
+ | **向量检索** | sqlite-vec 扩展，在现有 SQLite 内实现向量相似度搜索 |
```

**理由**：
1. ChromaDB 需要 Python 进程，违反项目"Node.js 单栈 + 轻量"的基本原则
2. Phase 2 技术方案已审核通过，sqlite-vec 是确定方案
3. D3 是 T07 调 bug 时顺手写的未来展望，没有经过技术评审，应该对齐到正式方案

---

## 冲突 3：语义记忆提取方式 — 后处理 LLM 提取 vs AI 实时自主存储

### 各文档的说法

| 文档 | Phase 2 语义记忆提取方式 |
|------|---------|
| D3 (memory-architecture.md) | "用模型**分析对话**，自动提取'Later 常在凌晨工作'等隐式偏好，**替代正则**" |
| D4 (phase2/README.md) | "AI 通过 MCP 工具 **自主决定** 调 `set_memory`"，验收标准写明"Telegram 发'我叫张三' → AI **自主决定**调 set_memory" |

### 本质区别

```
D3 的方案（后处理提取）：
  用户说话 → AI 回复 → Orchestrator 后处理 → 调 LLM 分析 → 存语义记忆
  ↑ 仍然是 Muse 代码替 AI 做决策

D4 的方案（AI 自主调用 MCP）：
  用户说话 → AI 判断"这是偏好" → AI 主动调 set_memory → 存语义记忆
  ↑ AI 自己决定要不要存、存什么
```

### 分析

| 维度 | 后处理 LLM 提取 (D3) | AI 自主 MCP 调用 (D4) |
|------|---------------------|---------------------|
| 架构一致性 | 仍然是 Orchestrator 替 AI 思考 | 符合"不替 AI 做认知决策"原则 |
| 成本 | **每轮对话多一次 LLM 调用**（提取用） | 零额外调用——AI 在回复过程中顺手存 |
| 准确性 | 独立模型可能误提取 | AI 在对话上下文中更精准理解意图 |
| 与 Phase 2 设计的对齐 | ❌ 违反 Orchestrator 瘦身目标 | ✅ Orchestrator 不再有认知逻辑 |
| Phase 2 审核意见 | 未提及 | **审核通过**，验收标准已明确 |

### 建议

D3 的 Phase 2 路线图改为：

```diff
- | **LLM 提取语义记忆** | 用模型分析对话，自动提取"Later 常在凌晨工作"等隐式偏好，替代正则 |
+ | **AI 自主记忆** | 通过 Memory MCP Server，AI 在对话中自主调用 set_memory 存储偏好（详见 phase2/README.md §3.1） |
```

**理由**：
1. Phase 2 的核心设计哲学是"**不替 AI 做认知决策**"（phase2/README.md §3.4 明确写了去掉 `extractPreferences`）
2. 后处理 LLM 提取方案每轮多一次模型调用，性价比差
3. Phase 2 验收标准第 1 条就是"AI **自主决定**调 set_memory"——这是已审核通过的方案

---

## 总结

| 冲突 | 根因 | 建议 | 影响范围 |
|------|------|------|---------|
| 4 层 vs 2 层 | 概念模型 vs 代码实现的表述差异 | 保留 4 类概念，标注归属模块 | D2 小改 |
| ChromaDB vs sqlite-vec | D3 是非正式展望，D4 是审核通过的方案 | 删 ChromaDB，对齐 sqlite-vec | D3 小改 |
| 后处理提取 vs AI 自主 MCP | D3 是直觉写法，D4 是设计论证的结论 | 对齐到 AI 自主 MCP 调用 | D3 小改 |

> **结论**：3 个冲突的权威来源都是 `phase2/README.md`（经过审核），D3 `memory-architecture.md` 是 bug 修复时顺手写的非正式展望，应该对齐到正式方案。修改量都很小。

---

## 审核意见与决策

### 1. 总体评价

✅ **这份统一性审查报告可以采纳，判断方向基本正确。**

这份报告的价值不在于提出了新的记忆架构，而在于把当前项目里已经出现分叉的记忆口径重新收拢。它解决的是“文档一致性”和“权威来源优先级”问题，不是在推翻现有实现，也不是在额外发明一套新方案。

从 Muse 当前整体路线看，这类统一工作是必要的。因为到 `Phase 1 / T07` 为止，项目已经不再是单个模块独立推进，而是进入了：

1. 文档需要给实现让路
2. 临时分析文档不能反向定义正式架构
3. `Phase 1` 与 `Phase 2` 的接口和概念口径必须尽早收敛

这份报告在这几点上是合格的。

### 2. 对 3 个冲突判断的审核结论

#### 冲突 1：4 层记忆 vs 2 层记忆

✅ **同意报告结论。**

这里的核心不是“谁对谁错”，而是当前文档把“认知概念模型”和“Memory 模块落地实现”写混了。

当前更准确的表达应该是：

1. `4 类记忆` 是总体认知模型
2. `2 层存储` 才是 `Memory` 模块当前真正实现的内容
3. `身份记忆` 属于 `Identity`
4. `工作记忆` 属于 `Engine/OpenCode session`

所以报告建议把它改写成：
`2 层存储 + 2 个外部相关层`

这个判断是合理的，而且有利于新人读代码时不困惑。

#### 冲突 2：ChromaDB vs sqlite-vec

✅ **同意报告结论，而且建议明确以 `sqlite-vec` 为唯一正式 Phase 2 方案。**

原因很简单：

1. 当前项目是 `Node.js + SQLite + 轻量单栈`
2. `ChromaDB` 会引入 Python 进程和额外运行时
3. 这和 Muse 当前“低复杂度、工程主权、单栈优先”的路线不一致
4. `phase2/README.md` 已经形成了更成熟、更正式的决策

因此这里不建议继续在正式文档正文里保留 `ChromaDB` 作为并列候选。最多可以在历史注释或讨论记录里提一句“曾考虑过”，但不应继续污染主线口径。

#### 冲突 3：后处理提取 vs AI 自主 MCP

✅ **同意报告结论。**

从 Muse 的设计哲学看，`Phase 2` 走向 `AI 自主决定是否写记忆`，本来就是更一致的路线。

相比“Orchestrator 后处理再调一次模型做偏好提取”，`AI 自主 MCP 调用` 有几个明显优势：

1. 更符合 `PHILOSOPHY.md` 的边界设计
2. 不会继续把认知逻辑堆回 Orchestrator
3. 不需要每轮额外再做一次 LLM 提取调用
4. 和 `Phase 2` 的 agent 化方向一致

所以这里应当以 `phase2/README.md` 为准，把 D3 的旧表述回收掉。

### 3. 这份报告还可以再补强的地方

⚠️ 有 2 点可以增强，但不影响采纳结论。

1. **建议补一个“权威来源优先级”小节**

现在报告已经隐含表达了这一点，但还不够明确。建议直接写出来：

1. `phase1/README.md`：Phase 1 当前阶段权威来源
2. `phase2/README.md`：Phase 2 演进方案权威来源
3. `ARCHITECTURE.md` / `PHILOSOPHY.md`：原则级来源
4. 临时分析文档、bug 排查文档：非权威，只能跟随正式方案

这样以后再出现类似冲突时，决策链会更清楚。

2. **建议给 D3 加一个定位说明**

`memory-architecture.md` 既然是 T07 调 bug 时写的说明文，就不应再被误读成“正式架构规范”。

建议后续把它标注成：
`调试分析文档 / 非权威架构来源`

否则即使你把内容修正了，后面仍然可能有人把它当成正式规范来引用。

### 4. 最终决策

**决策：采纳这份统一方案，并按报告建议修改相关文档。**

执行原则建议明确为：

1. `phase2/README.md` 作为未来演进方案的权威来源
2. `phase1/README.md` 作为当前实现阶段的权威来源
3. 非正式分析文档全部向正式文档对齐，不允许反向定义架构

换句话说，这份报告不是“可参考”，而是可以作为一次正式的文档收敛决策来落地。

### 5. 建议的下一步

1. 按报告修改 `phase1/README.md` 中 T04 的记忆表述
2. 修改 `phase1/t07-web-cockpit/memory-architecture.md`，统一到 `sqlite-vec + AI 自主 MCP`
3. 给 `memory-architecture.md` 增加“非权威分析文档”标注
4. 后续凡是提到 Muse 记忆体系，都统一使用：
   - `4 类记忆概念`
   - `Memory 模块当前实现 = 语义 + 情景`
