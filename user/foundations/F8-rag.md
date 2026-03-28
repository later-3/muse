# F8: RAG — 检索增强生成

> **来源：** 吴恩达 LangChain 系列 + 原始论文
> **状态：** ⏳ 占位 · 待填充
> **一句话：** 让 LLM 访问外部知识，解决幻觉和知识截止问题。

---

## ⚡ 3 分钟速读版

```
一句话: [待填充]
3 个关键概念: Embedding / 向量检索 / 上下文注入
对 Muse 最重要的: Muse 的 memory.mjs search_memory 就是 RAG
面试必记: [待填充]
```

---

## 核心章节框架

### 1. RAG 原理
> 问题 → Embedding → 向量搜索 → 取回相关文档 → 注入到 Prompt → LLM 生成

### 2. Embedding 深入
> 什么是 Embedding？文本 → 高维向量。
> 语义相似度 = 余弦相似度。
> 常用模型：text-embedding-3-small / bge / m3e

### 3. 向量数据库
> Chroma / Pinecone / Milvus / FAISS
> 索引算法：HNSW / IVF / LSH

### 4. 分块策略（Chunking）
> 文档怎么切？按段落、按句子、按语义。
> Chunk size 和 overlap 的选择。

### 5. 高级 RAG
> Re-ranking / HyDE / 多路检索 / 自适应检索

---

## 💼 面试必答

[待填充]

---

## 🔗 被引用于

- `unit03-state-memory/` — Muse 长期记忆设计
- `unit01-agent-core/01e` — Weng 三要素的 Memory 组件
