# Memory 架构

> **一句话定义**: Memory 是让 Agent 跨越单次对话边界，保留、检索和利用历史信息的机制 — 从无状态的工具变成有记忆的伙伴。

## 核心原理

### 为什么需要 Memory？

没有 Memory 的 Agent 是**无状态**的 — 每次对话都从零开始。用户说过的偏好、做过的决策、纠正过的错误，全部丢失。Memory 让 Agent 具备四种能力：

| 能力 | 定义 | 示例 |
|------|------|------|
| **反思 (Reflective)** | 从过去的行为和结果中学习 | 记住上次哪个方案失败了 |
| **交互 (Interactive)** | 在对话中保持上下文 | 知道"那里"指的是"巴黎" |
| **主动 (Proactive)** | 基于历史数据预判需求 | 主动推荐用户常搜的内容 |
| **自主 (Autonomous)** | 利用存储的知识独立运作 | 不需要重复告知偏好 |

### Memory 的六种类型

ai-agents-for-beginners L13 定义了完整的 Memory 分类法：

| 类型 | 生命周期 | 比喻 | 示例 |
|------|---------|------|------|
| **Working Memory** | 当前任务 | 草稿纸 | "用户要求预算 <$500" |
| **Short-term Memory** | 当前对话 | 对话记忆 | "他刚说想去巴黎" |
| **Long-term Memory** | 跨对话 | 档案柜 | "Ben 喜欢滑雪，避免高级滑道" |
| **Persona Memory** | 持久 | 角色设定 | "我是滑雪规划专家" |
| **Episodic Memory** | 跨对话 | 经验日志 | "上次预订失败因为航班不可用" |
| **Entity Memory** | 跨对话 | 实体图谱 | "巴黎" + "埃菲尔铁塔" + "Le Chat Noir 餐厅" |

### Memory 管道：Extract → Store → Retrieve → Integrate

```
用户对话
    ↓
[Extract] 识别有价值的信息
    ↓
[Store] 持久化存储
    ├── Vector DB (语义相似度检索)
    ├── Knowledge Graph (关系查询)
    └── Key-Value Store (精确查找)
    ↓
[Retrieve] 新会话时检索相关记忆
    ↓
[Integrate] 注入为上下文 (类似 RAG)
    ↓
Agent 使用记忆做出更好的决策
```

### 自改进模式：Knowledge Agent

ai-agents-for-beginners L13 描述的核心模式 — 一个 **独立的 Knowledge Agent** 观察对话并自动维护知识：

```
+------------------+
| User ←→ Primary  |
|      Agent       |
+--------+---------+
         |
    (观察对话)
         v
+------------------+
| Knowledge Agent  |
| 1. 这值得保存吗？ |
| 2. 提取关键信息    |
| 3. 存入知识库      |
| 4. 下次检索注入    |
+------------------+
```

**性能优化技巧**：
- 先用**便宜快速的模型**判断信息是否值得保存
- 只在有价值时才调用更强的模型做提取和总结
- 不常用的记忆移到"冷存储"降低成本

### 专用 Memory 工具

#### Mem0 — 持久化 Memory 层

将无状态 Agent 变成有状态：
- **两阶段管道**：提取 (extract) + 更新 (update)
- LLM 驱动的总结和记忆提取
- 混合存储：vector + graph + key-value
- 自动记忆更新（增加/修改/删除）

#### Cognee — 语义 Memory

构建可查询的知识图谱：
- **双存储架构**：向量相似度搜索 + 图关系查询
- 混合检索：向量 + 图结构 + LLM 推理
- **活的记忆 (Living Memory)**：持续进化和增长
- 可视化知识图谱

### Structured RAG

超越传统 RAG 的语义匹配：

| 维度 | 传统 RAG | Structured RAG |
|------|---------|---------------|
| **匹配方式** | 语义相似度 | 结构化查询 |
| **数据处理** | 文本切块 + 嵌入 | 提取结构化信息 |
| **查询示例** | "关于巴黎的旅行" | "我周二订的巴黎航班是哪个？" |
| **精确度** | 模糊匹配 | 精确匹配 |

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/13-agent-memory/README.md) | L13: Agent Memory | ⭐⭐⭐ | 六类型 + 自改进模式 + Mem0/Cognee |
| [hello-agents](../../repos/hello-agents/docs/chapter8/) | 第八章: 记忆与检索 | ⭐⭐⭐ | 记忆系统 + RAG + 存储 |
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s06-context-compact.md) | s06: Context Compact | ⭐⭐ | Transcript 持久化 = 原始记忆 |
| [anthropic-cookbook](../../repos/anthropic-cookbook/capabilities/) | capabilities/ | ⭐ | Memory 相关的能力模式 |

## 概念间关系

- **前置概念**: [[context-engineering]] (Memory 是跨会话的 Context) / [[agent-definition]] (Memory 使 Agent 从 stateless 变为 stateful)
- **相关概念**: [[tool-use-mcp]] (Memory 检索可以作为 MCP 工具) / [[multi-agent]] (多 Agent 如何共享 Memory)
- **高阶实践**: [[identity-persona]] (Persona Memory 支撑身份一致性)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| `src/core/memory/` | Memory 管理基础设施 | 🟡 基础实现 |
| `src/core/identity/` | Persona Memory | ✅ 已实现 |
| `src/daemon/pulse/` | 基于 Memory 的主动行为 | ✅ 已实现 |
| Knowledge Agent 模式 | 自动记忆提取 | ❌ 待实现 |
| Transcript 持久化 | Episodic Memory 基础 | ❌ 待实现 |
| Entity Memory | 实体识别和关系图谱 | ❌ 待实现 |
| Vector DB 集成 | 长期记忆检索 | ❌ 待实现 |

## 与 Context Engineering 的区别

| 维度 | Context Engineering | Memory |
|------|-------------------|--------|
| **时间跨度** | 单次会话 | 跨会话 |
| **存储位置** | 上下文窗口 | 外部存储 |
| **触发方式** | 自动（压缩/裁剪） | 显式（存/取） |
| **信息类型** | 即时信息 | 凝炼的知识 |
| **交集** | 压缩后的 transcript | 长期记忆注入为上下文 |

## 开放问题

1. **Memory 的遗忘机制**：何时删除过时记忆？如何处理用户的"遗忘权"？
2. **Memory 一致性**：多个 Agent 并发写入 Memory 时如何解决冲突？
3. **Memory 的评估**：如何量化 Memory 的质量？IR 指标（precision/recall）是否足够？
4. **隐私问题**：长期记忆存储了大量用户信息，如何确保安全和隐私合规？
5. **Karpathy 知识库方法**：能否将整个 wiki 作为 Agent 的长期记忆？`raw/ → wiki/ → Memory` 的管线
