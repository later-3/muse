# D19 — RAG (Retrieval-Augmented Generation)

> **日期：** 2026-04-26（Sat）
> **路线图位置：** Week 3 · Day 19 · RAG
> **定位：** 🟨 理解级（今天 1.5h = 45min 理论 + 45min 实践）· **F05**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **RAG 到底解决了什么问题？** 为什么不能只靠 LLM 的训练知识？
2. **RAG 的完整管线是什么？** 从文档到回答的每一步
3. **RAG 和 D18 学的 Memory 有什么关系和区别？** 都用了向量检索，但目的不同

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（RAG 原理 + 管线） | 40min | [ ] |
| 2 | 动手实验 — 测试 Embedding 效果（见下方） | 45min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 李宏毅 [RAG](https://youtu.be/m03GReJPdKg) 讲座 + Lewis et al. RAG 原论文 (2020) + 实践经验提炼。
> RAG 是 Agent 开发中最高频使用的技术之一 — 几乎每个生产级 Agent 都在用。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **RAG** | 检索增强生成 — 先查文档再回答 | "开卷考试" — 给 LLM 参考资料再让它答题 | GraphRAG 等高级变体 |
| **Chunking** | 把长文档切成小段 | 一本书切成段落 | 不同的分块算法 |
| **Retriever** | 从文档库中检索相关段落的模块 | 图书管理员 — 帮你找到最相关的参考资料 | Dense vs Sparse Retrieval |
| **Generator** | 基于检索结果生成回答的 LLM | 看完参考资料后写答案的学生 | 生成策略的差异 |
| **Grounding** | 用检索到的事实约束 LLM 输出 | "有据可查"的回答 vs "信口开河" | 引用生成的实现 |

### 🌍 背景：为什么要学这个？

**承接 D16-D18 Context 工程：** CE 的核心问题是"在有限 Context 中放入对的信息"。RAG 是最重要的"信息注入"技术 — 它把外部知识动态检索后注入 Context。

[Fact] LLM 的两个根本局限：

| 局限 | 说明 | RAG 怎么解决 |
|------|------|-------------|
| **知识截止** | LLM 的知识停在训练日期（如 2024.4） | 检索实时文档 → 注入 Context |
| **幻觉** | LLM 会编造不存在的"事实" | 提供权威来源 → Grounding |

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2020 | Lewis et al. (Meta) | RAG 原论文 | 首次系统定义 Retrieval-Augmented Generation |
| 2022 | LangChain 团队 | LangChain 框架 | 让 RAG 管线 5 行代码就能搭 |
| 2023 | 多家 | 产业落地 | RAG 成为企业 AI 应用的标准架构 |
| 2024 | Microsoft | GraphRAG | 用知识图谱增强检索（结构化关系） |
| 2025 | 李宏毅 | LH25 RAG 讲座 | 系统化教学：从原理到高级策略 |

### 第一性原理：RAG 解决什么问题？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — LLM 不是数据库**

[Fact] LLM 的"知识"存储在参数中（模糊的、压缩的、可能过时的）。

```
你问: "2025年诺贝尔物理学奖是谁获得的？"
LLM: "我不知道/我的知识截止到2024年" 或 直接编一个（幻觉！）
```

**Layer 1 — "开卷考试"比"闭卷考试"好**

[Fact] RAG 的核心洞察 — **给 LLM 参考资料**：

```
闭卷（纯 LLM）:
  问题 → LLM → 回答（可能错/过时/编造）

开卷（RAG）:
  问题 → [检索相关文档] → 问题 + 文档 → LLM → 回答（有据可查）
```

**Layer 2 — RAG 的形式化**

```
Answer = LLM(Question + Retrieved_Documents)

其中:
  Retrieved_Documents = Retriever(Question, Document_Store)
  Document_Store = Chunked + Embedded 的文档集合
```

**Layer 3 — 完整定义**

RAG = 一种在 LLM 生成回答前，先从外部知识库中检索相关文档，并将其注入 Context 的技术框架。它解决了 LLM 的知识截止和幻觉问题，让回答"有据可查"。

### RAG 的完整管线

[Fact] RAG 分两个阶段：**离线索引** + **在线检索生成**

```
═══ 阶段 1：离线索引（提前准备）═══

原始文档 → [加载] → [分块 Chunking] → [Embedding] → [存入向量库]

"transformer.pdf"
     ↓ 加载
"Self-Attention 是 Transformer 的核心... QKV 机制..."
     ↓ 分块（每段 ~500 tokens）
Chunk 1: "Self-Attention 是 Transformer 的核心组件..."
Chunk 2: "Q = 查询, K = 键, V = 值..."
Chunk 3: "Multi-Head Attention 允许模型..."
     ↓ Embedding（每段变成 1536 维向量）
[0.12, -0.34, ...] → 存入向量库 (Chunk 1)
[0.45, 0.22, ...]  → 存入向量库 (Chunk 2)
[0.33, -0.11, ...] → 存入向量库 (Chunk 3)


═══ 阶段 2：在线检索生成（用户提问时）═══

用户问题: "Self-Attention 的 QKV 是什么？"
     ↓ Embedding
查询向量: [0.40, 0.20, ...]
     ↓ 向量相似度搜索
最相关: Chunk 2 (相似度 0.95) + Chunk 1 (0.88)
     ↓ 组装 Context
System: "根据以下文档回答用户问题:"
Context: "Chunk2: Q = 查询... Chunk1: Self-Attention 是..."
User: "Self-Attention 的 QKV 是什么？"
     ↓ LLM 生成
回答: "QKV 分别代表 Query、Key、Value。Q 表示..."
```

### Chunking — 文档切分的学问

[Fact] Chunking 是 RAG 效果的关键 — 切太大或太小都有问题：

| 参数 | 太小（100 tokens） | 太大（2000 tokens） | 推荐 |
|------|-------------------|-------------------|----|
| 上下文 | 丢失上下文，断章取义 | 包含无关信息，稀释重点 | 300-800 tokens |
| 检索精度 | 高（精准匹配） | 低（杂信息多） | 适中 |
| 数量 | 多（向量库大） | 少（向量库小） | 文档大小的 5-20 倍 |

**常见分块策略：**

```
1. 固定大小分块  → 每 500 tokens 一块（最简单）
2. 按段落分块    → 保持语义完整性
3. 递归分割      → 先按标题 → 再按段落 → 再按句子
4. 重叠分块      → 每块有 50-100 tokens 重叠（防止断裂）
```

### RAG vs Fine-tuning vs Memory

| 维度 | RAG | Fine-tuning | Memory (D18) |
|------|-----|-------------|-------------|
| **什么知识？** | 外部文档/数据库 | 领域专业知识 | 用户个人信息 |
| **何时注入？** | 每次请求时检索 | 训练时写入参数 | 每次请求时检索 |
| **更新成本** | 低（加新文档即可） | 高（需要重新训练） | 低（写入数据库） |
| **适用场景** | 实时知识、长文档 | 特定领域风格 | 个性化、历史记忆 |
| **类比** | 查百科全书 | 上课学习 | 翻日记本 |

**RAG 和 Memory 的关系：**
- 技术类似（都用向量检索）
- 目的不同：RAG = 注入"世界知识"，Memory = 注入"个人记忆"
- 实现差异：RAG 的文档库是预处理的，Memory 是运行时动态写入的

### RAG 的常见问题和优化

[Fact] 实践中 RAG 的典型问题：

**问题 1：检索不到正确文档**
```
原因: 用户问法和文档表述不同
例: 用户问"为什么 Transformer 比 RNN 快" → 文档写的是"并行计算优势"
解法: → Query Rewriting（用 LLM 改写查询）
      → Hybrid Search（向量 + 关键词同时搜）
```

**问题 2：检索到了但 LLM 没用**
```
原因: 检索结果在 Context 中的位置不好，或被其他信息淹没
解法: → 把检索结果放在 Context 靠前位置
      → 减少其他信息的干扰
      → 明确指令"基于以下文档回答"
```

**问题 3：检索到错误文档**
```
原因: 向量相似度高但语义不匹配
解法: → Reranker（用小模型对检索结果重新排序）
      → 提高 Chunking 质量
      → 增加元数据过滤（日期、来源、类别）
```

### 举例 + 发散

**数值例子：RAG 的效果对比**

```
问题: "DeepSeek-R1 用了什么 RL 算法？"

纯 LLM (GPT-4o, 知识截止 2024.4):
  "我没有关于 DeepSeek-R1 的信息" 或 编造答案
  → 准确率: 0%

RAG (检索 R1 技术报告):
  检索到: "R1 使用 Group Relative Policy Optimization (GRPO)..."
  回答: "DeepSeek-R1 使用了 GRPO 算法..."
  → 准确率: ~95%

→ RAG 把"不可能回答"变成"高质量回答"
```

> **类比（仅类比）：** 纯 LLM 像闭卷考试 — 只能用脑子里的知识。RAG 像开卷考试 — 可以翻书。对于需要精确事实的问题，开卷几乎总是更好的。

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "RAG 就是去找相關的文件來增加 LLM 可以參考的資料。" — 李宏毅 | RAG = 给 LLM 找参考书 |
| "Rather than relying solely on parametric knowledge, RAG conditions generation on retrieved evidence." — Lewis et al. | 不要只靠模型"记住"的知识，去查文档 |
| "RAG is the most impactful technique for reducing hallucinations." — 工业界共识 | RAG 是减少幻觉最有效的方法 |

### 🎤 面试追问链

```
Q1: RAG 的完整管线是什么？
→ 你答: 两阶段。离线：文档→分块→embedding→存向量库。在线：问题→embedding→检索top-K→注入Context→LLM生成。
  Q1.1: 分块大小怎么选？
  → 你答: 300-800 tokens，用重叠分块防断裂。太小丢上下文，太大稀释重点。
    Q1.1.1: 检索到了但回答还是不对怎么办？
    → 你答: 可能是位置问题（放Context靠前）、干扰（减少无关信息）、或需要Reranker重新排序。

Q2: RAG 和 Fine-tuning 什么时候用哪个？
→ 你答: RAG适合实时知识/长文档/频繁更新。Fine-tuning适合领域风格/专业术语。两者可叠加：先fine-tune领域能力，再RAG注入具体数据。
```

### 这几个概念不要混

- **RAG ≠ 搜索引擎**：RAG 是检索+生成（LLM 理解文档后回答），搜索引擎只返回链接
- **RAG ≠ Fine-tuning**：RAG 在 Context 中注入知识（临时），Fine-tuning 在参数中写入知识（永久）
- **RAG ≠ Memory**：RAG 检索"世界知识"（文档/数据库），Memory 检索"个人记忆"（用户历史）
- **Embedding ≠ LLM**：Embedding 模型把文本变向量（用于检索），LLM 生成文本（用于回答）。两者是不同的模型

### 关键概念清单

- [ ] **RAG 的定义**：检索增强生成 — 先查再答
- [ ] **二阶段管线**：离线索引(分块→embedding→存储) + 在线检索生成
- [ ] **Chunking 策略**：固定/段落/递归/重叠 + 300-800 tokens
- [ ] **RAG 的三个常见问题**：检索不到/检索到没用/检索到错的
- [ ] **RAG vs Fine-tuning vs Memory**：三者的适用场景
- [ ] **RAG 和 CE 的关系**：RAG 是 Context 5 层结构中"检索结果"层的实现

---

## 🔧 实践任务：实测 Embedding

**USOLB 标注：** `[U] 使用` `[O] 观察`

**任务说明（简易版，用 API 或在线工具）：**
1. 用 OpenAI 的 Embedding API（或 https://platform.openai.com/playground ）测试以下文本：
   - "Self-Attention 使用 QKV 机制"
   - "注意力机制通过查询、键和值来计算"
   - "今天天气很好，适合出去走走"
2. 观察：前两条的相似度应该高（语义相近），第三条和前两条的相似度应该低
3. 思考：如果 RAG 检索到第三条来回答 Attention 问题，会发生什么？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 李宏毅 RAG | https://youtu.be/m03GReJPdKg | 全程 — RAG 原理 + 进阶 |
| RAG 原论文 | https://arxiv.org/abs/2005.11401 | Abstract + 架构图 |
| LangChain RAG 教程 | https://python.langchain.com/docs/tutorials/rag/ | 代码实操 |

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - Muse 当前没有完整的 RAG 管线 — 但 `src/mcp/memory.mjs` 的 `search_memory` 使用了类似的向量检索
  - 未来如果 Muse 要支持"读取用户的文档库"，就需要搭 RAG 管线
- **远端模型/外部系统做的事：**
  - Embedding API（OpenAI text-embedding-3）把文本变向量
  - 向量数据库（Pinecone/Weaviate/本地的 ChromaDB）存储和检索
- **和后续的关系：** D20 Prompt 实践 — 把 CE/MCP/Memory/RAG 这些"信息注入"技术汇总，写出更好的 System Prompt

---

## ✅ 自检清单

- [ ] **能定义 RAG**：检索增强生成 — 先查文档再回答
- [ ] **能画出 RAG 二阶段管线**：离线索引 + 在线检索生成
- [ ] **能列出 Chunking 策略**：知道 300-800 tokens 的推荐范围
- [ ] **能区分 RAG/Fine-tuning/Memory**
- [ ] **知道 RAG 的三个常见问题和解法**
- [ ] **完成 Embedding 实测**

### 面试题积累（2 题）

**Q1: 请描述 RAG 的完整管线，从文档到回答。**

> 你的回答：___
>
> 参考：离线：文档→分块(300-800 tokens)→embedding→存向量库。在线：问题→embedding→向量相似度检索top-K→注入Context "根据以下文档回答"→LLM生成回答。

**Q2: 你的 RAG 系统检索准确率不高，怎么优化？**

> 你的回答：___
>
> 参考：4步排查：1)Chunking（是否太大太小？加重叠） 2)Query Rewriting（用LLM改写查询） 3)Hybrid Search（向量+BM25关键词） 4)Reranker（用小模型重排检索结果）。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
