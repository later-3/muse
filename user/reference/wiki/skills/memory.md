# Memory 架构

> **一句话定义**: Memory 是让 Agent 跨越单次对话边界，保留、检索和利用历史信息的机制 — 从无状态的工具变成有记忆的伙伴。

## 核心原理

### 为什么需要 Memory？

没有 Memory 的 Agent 是**无状态**的 — 每次对话都从零开始。用户说过的偏好、做过的决策、纠正过的错误，全部丢失。

```python
# hello-agents ch8: 无状态 Agent 的问题
agent = SimpleAgent(name="Learning Assistant", llm=HelloAgentsLLM())

response1 = agent.run("My name is Zhang San, I'm learning Python")
print(response1)  # "Great! Python basic syntax is an important foundation..."

response2 = agent.run("Do you remember my learning progress?")
print(response2)  # "Sorry, I don't know your learning progress..."
# → 每次对话都从零开始，之前的信息全部丢失
```

Memory 让 Agent 具备四种能力（ai-agents-for-beginners L13）：

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

### 四层记忆系统架构

hello-agents ch8 设计了完整的四层架构，对标认知科学中的人类记忆分层：

```
HelloAgents Memory System (hello-agents ch8)
├── Working Memory   — 容量 50 项 + TTL 自动清理，纯内存，会话结束即丢弃
├── Episodic Memory  — SQLite + Qdrant 混合存储，支持时间序列和事件检索
├── Semantic Memory  — Qdrant 向量 + Neo4j 知识图谱，存抽象知识和规则
└── Perceptual Memory — 多模态数据（图片/音频），按重要性动态管理
```

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

### 代码实证：Memory 工具的核心操作

hello-agents ch8 实现了完整的 MemoryTool，以下是从源码提取的关键操作：

**添加记忆**（支持四种类型）：
```python
# hello-agents ch8: MemoryTool 四种记忆类型的使用
# 1. Working Memory — 临时信息，容量受限
memory_tool.execute("add",
    content="用户刚问了一个关于 Python 函数的问题",
    memory_type="working", importance=0.6)

# 2. Episodic Memory — 具体事件和经历
memory_tool.execute("add",
    content="2024年3月15日，用户张三完成了第一个 Python 项目",
    memory_type="episodic", importance=0.8,
    event_type="milestone", location="在线学习平台")

# 3. Semantic Memory — 抽象知识和概念
memory_tool.execute("add",
    content="Python 是一种解释型、面向对象的编程语言",
    memory_type="semantic", importance=0.9,
    knowledge_type="factual")

# 4. Perceptual Memory — 多模态信息
memory_tool.execute("add",
    content="用户上传了一张 Python 代码截图，包含函数定义",
    memory_type="perceptual", importance=0.7,
    modality="image", file_path="./uploads/code_screenshot.png")
```

**Working Memory 的混合检索**（TF-IDF + 关键词）：
```python
# hello-agents ch8: WorkingMemory.retrieve 核心逻辑
def retrieve(self, query: str, limit: int = 5, **kwargs) -> List[MemoryItem]:
    self._expire_old_memories()  # TTL 过期清理

    scored_memories = []
    for memory in self.memories:
        vector_score = vector_scores.get(memory.id, 0.0)
        keyword_score = self._calculate_keyword_score(query, memory.content)

        # 混合评分: TF-IDF 向量 70% + 关键词 30%
        base_relevance = vector_score * 0.7 + keyword_score * 0.3
        time_decay = self._calculate_time_decay(memory.timestamp)
        importance_weight = 0.8 + (memory.importance * 0.4)

        final_score = base_relevance * time_decay * importance_weight
        if final_score > 0:
            scored_memories.append((final_score, memory))

    scored_memories.sort(key=lambda x: x[0], reverse=True)
    return [memory for _, memory in scored_memories[:limit]]
```

**记忆遗忘**（三种策略，源自认知科学）：
```python
# hello-agents ch8: 三种遗忘策略
# 1. 按重要性遗忘 — 删除低于阈值的记忆
memory_tool.execute("forget", strategy="importance_based", threshold=0.2)

# 2. 按时间遗忘 — 删除超过指定天数的记忆
memory_tool.execute("forget", strategy="time_based", max_age_days=30)

# 3. 按容量遗忘 — 超出限制时删除最不重要的
memory_tool.execute("forget", strategy="capacity_based", threshold=0.3)
```

**记忆巩固**（短期 → 长期，类似睡眠巩固）：
```python
# hello-agents ch8: 记忆巩固 — 模拟人脑将短期记忆转为长期记忆
# 将重要性 > 0.7 的 working 记忆提升为 episodic
memory_tool.execute("consolidate",
    from_type="working", to_type="episodic",
    importance_threshold=0.7)

# 将重要性 > 0.8 的 episodic 记忆提升为 semantic
memory_tool.execute("consolidate",
    from_type="episodic", to_type="semantic",
    importance_threshold=0.8)
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

**性能优化技巧**（ai-agents-for-beginners L13）：
- 先用**便宜快速的模型**判断信息是否值得保存
- 只在有价值时才调用更强的模型做提取和总结
- 不常用的记忆移到"冷存储"降低成本

### 专用 Memory 工具

#### Mem0 — 持久化 Memory 层

将无状态 Agent 变成有状态（ai-agents-for-beginners L13）：
- **两阶段管道**：提取 (extract) + 更新 (update)
- LLM 驱动的总结和记忆提取
- 混合存储：vector + graph + key-value
- 自动记忆更新（增加/修改/删除）

#### Cognee — 语义 Memory

构建可查询的知识图谱（ai-agents-for-beginners L13）：
- **双存储架构**：向量相似度搜索 + 图关系查询
- 混合检索：向量 + 图结构 + LLM 推理
- **活的记忆 (Living Memory)**：持续进化和增长
- 可视化知识图谱

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/13-agent-memory/README.md) | L13: Agent Memory | ⭐⭐⭐ | 六类型 + 自改进模式 + Mem0/Cognee |
| [hello-agents](../../repos/hello-agents/docs/chapter8/Chapter8-Memory-and-Retrieval.md) | 第八章: 记忆与检索 | ⭐⭐⭐ | 四层架构 + MemoryTool 完整代码 + 遗忘/巩固机制 |
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s06-context-compact.md) | s06: Context Compact | ⭐⭐ | Transcript 持久化 = 原始记忆 |
| [anthropic-cookbook](../../repos/anthropic-cookbook/capabilities/) | capabilities/ | ⭐ | Memory 相关的能力模式 |

## 概念间关系

- **前置概念**: [[context-engineering]] (Memory 是跨会话的 Context) / [[agent-definition]] (Memory 使 Agent 从 stateless 变为 stateful)
- **相关概念**: [[tool-use-mcp]] (Memory 检索可以作为 MCP 工具) / [[multi-agent]] (多 Agent 如何共享 Memory)
- **高阶实践**: [[identity-persona]] (Persona Memory 支撑身份一致性)

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
