# D02 — N02 Transformer 架构 (1/3)

> **日期：** 2026-04-09（Wed）
> **路线图位置：** Week 1 · Day 2 · N02 Transformer（第 1 天，共 3 天）
> **定位：** 🟥 精通级（今天 1h，总计 8h 跨 3 天）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Transformer 是什么？** 和之前的 RNN/LSTM 比，它本质上换了什么思路？
2. **Self-Attention 怎么工作？** Q/K/V 三个矩阵分别是什么角色？
3. **为什么 Attention 是革命性的？** 它解决了 RNN 的什么致命问题？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy "Let's Build GPT" 前 40 分钟 + 原始论文 "Attention Is All You Need" 中提炼的核心知识。
> 今天是 Transformer 三天学习的第一天：**理解全局架构 + Self-Attention 机制**。

### 第一性原理：Transformer 到底是什么？

**一句话：Transformer 是一种让每个词都能"看到"句子中所有其他词的神经网络架构。**

在 Transformer 之前，处理文字的主流是 RNN（循环神经网络）：

```
RNN 的方式（串行）：
  "我" → "喜" → "欢" → "吃" → "苹" → "果"
   ↓       ↓       ↓       ↓       ↓       ↓
  h1  →   h2  →   h3  →   h4  →   h5  →   h6
  
  问题1：处理到"果"时，"我"的信息已经衰减了（长距离遗忘）
  问题2：必须一个接一个算，不能并行（慢）
```

Transformer 的思路完全不同：

```
Transformer 的方式（并行）：
  "我" "喜" "欢" "吃" "苹" "果"
   ↕    ↕    ↕    ↕    ↕    ↕     ← 每个词同时看到所有其他词
  [========= Self-Attention =========]
  
  优势1：任意两个词之间距离 = 1（不存在遗忘）
  优势2：所有词同时计算（可并行，快）
```

> **类比（仅类比）：** RNN 像一个人从头到尾读一本书，读到最后已经忘了开头。Transformer 像把整本书摊在桌上，每读一个字都能同时看到所有其他字。

---

### 怎么做到的？— Self-Attention 机制详解

Self-Attention 是 Transformer 的心脏。它回答一个问题：**"当我处理某个词时，我应该关注哪些其他词？"**

#### 三个角色：Q（Query）、K（Key）、V（Value）

每个词被变换成三个向量：

| 角色 | 含义 | 类比 |
|------|------|------|
| **Q（Query）** | "我在找什么？" | 你在搜索引擎里输入的搜索词 |
| **K（Key）** | "我能提供什么？" | 每个网页的标题/标签 |
| **V（Value）** | "我的实际内容" | 网页的正文内容 |

#### 计算过程（4 步）

**Step 1：生成 Q、K、V**

每个词的 embedding 分别乘以三个权重矩阵，得到 Q、K、V：

```python
Q = X @ W_Q   # X 是输入的词向量矩阵
K = X @ W_K   # W_Q, W_K, W_V 是可学习的参数
V = X @ W_V   # （这些参数就是靠 D01 学的反向传播来训练的）
```

**Step 2：计算注意力分数**

每个词的 Q 和所有词的 K 做内积（点乘），得到"相关度分数"：

```python
scores = Q @ K.T   # 结果是一个 n×n 矩阵（n=词数）
```

| | 我 | 喜 | 欢 | 吃 | 苹 | 果 |
|--|---|---|---|---|---|---|
| **我** | 0.2 | 0.1 | 0.1 | 0.3 | 0.1 | 0.2 |
| **吃** | 0.1 | 0.1 | 0.0 | 0.1 | **0.4** | **0.3** |

→ "吃" 这个词对 "苹" 和 "果" 的注意力最高（语义相关）

**Step 3：Softmax 归一化 + 缩放**

```python
attention_weights = softmax(scores / √d_k)
```

- 除以 `√d_k` 是防止内积太大导致 softmax 输出极端（全是 0 和 1）
- Softmax 让每行的分数加起来 = 1（变成概率分布）

**Step 4：加权求和**

```python
output = attention_weights @ V
```

每个词的输出 = 它关注的所有词的 V 的加权组合。

#### 完整公式（一行搞定）

```
Attention(Q, K, V) = softmax(Q × K^T / √d_k) × V
```

这就是 2017 年论文 "Attention Is All You Need" 的核心公式。整篇论文的精华浓缩在这一行里。

---

### 为什么需要它？— 设计动机

#### 解决了 RNN 的三大致命问题

| 问题 | RNN | Transformer |
|------|-----|-------------|
| **长距离依赖** | 信息经过 100 步后几乎消失 | 任意两个词直接连接，距离=1 |
| **并行计算** | 必须串行，一个词算完才能算下一个 | 所有词同时计算，GPU 友好 |
| **训练速度** | 序列长度 N → O(N) 步串行 | 矩阵乘法一次搞定，训练速度快 10-100 倍 |

#### 为什么是 2017 年的分水岭

- 2017 年之前：NLP 的王者是 LSTM（一种改良的 RNN）
- 2017 年 Google 发表 "Attention Is All You Need"，标题就是宣言：**你只需要注意力机制，不需要 RNN**
- 2018 年起：BERT、GPT、GPT-2、GPT-3、GPT-4… 全部基于 Transformer
- 2024 年的 Claude、Gemini、DeepSeek 也都是 Transformer 的变体

**如果你只记一件事：** 整个大模型时代 = Transformer + 缩放（更多数据/参数/算力）

---

### 举例 + 发散

#### Karpathy Build GPT 中的关键洞察

Karpathy 从零开始用 Python 实现了一个字符级 GPT。他的核心教学思路：

1. **先做一个最简单的模型**（BigramLanguageModel）：每个字符只看前一个字符来预测下一个 → 效果很差
2. **加上 Self-Attention**：每个字符能看到前面所有字符 → 效果好很多
3. **关键代码（约 50 行）就实现了注意力机制**

#### 具体数字感受

| 模型 | 参数量 | Transformer 层数 | 注意力头数 |
|------|--------|-----------------|-----------|
| GPT-2 Small | 1.17 亿 | 12 层 | 12 个头 |
| GPT-3 | 1750 亿 | 96 层 | 96 个头 |
| GPT-4 (推测) | ~1.8 万亿 | ~120 层 | ~96 个头 |
| Muse 用的模型 | 看配置 | — | — |

每一层 = 一次 Self-Attention + 一次前馈网络。层数越多，模型"思考"越深。

#### 今天没讲的（明天 D03 继续）

- **多头注意力（Multi-Head Attention）**：为什么要把注意力分成多个"头"？
- **位置编码（Positional Encoding）**：Transformer 不知道词序，怎么办？
- **残差连接 + LayerNorm**：为什么深度网络需要这些技巧？
- **解码器的 Masked Attention**：GPT 为什么只能看到前面的词？

---

### 关键概念清单

- [ ] **Transformer**：一种让每个词同时看到所有其他词的神经网络架构
- [ ] **Self-Attention**：计算"每个词应该关注哪些其他词"的机制
- [ ] **Q（Query）**："我在找什么" — 当前词的查询向量
- [ ] **K（Key）**："我能提供什么" — 每个词的标签向量
- [ ] **V（Value）**："我的实际内容" — 每个词的内容向量
- [ ] **Attention 公式**：`softmax(QK^T / √d_k) × V`
- [ ] **√d_k 缩放**：防止内积太大导致 softmax 饱和
- [ ] **并行计算优势**：Transformer 用矩阵乘法取代 RNN 的串行计算

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Build GPT | https://www.youtube.com/watch?v=kCc8FmEb1nY | 0:00-40:00 Bigram → Self-Attention |
| 原始论文 | https://arxiv.org/abs/1706.03762 | Fig.1 架构图 + 3.2 节 Attention |
| Jay Alammar 图解 | https://jalammar.github.io/illustrated-transformer/ | 全文（最好的可视化） |

---

## 🧠 与 Muse/项目 的映射

- **Muse 调用的模型**（Claude/GPT）的核心就是 Transformer。理解 Attention = 理解为什么模型能理解上下文
- **`src/core/engine.mjs`** 调用 LLM 时，模型内部就在做今天学的 Q×K^T/√d_k×V 计算
- **Context Window 限制**：Transformer 的注意力是 O(n²) 复杂度（n=序列长度），这就是为什么模型有最大上下文长度限制。后面 N05 学的 Flash Attention 就是为了优化这个
- **明天 D03** 会学多头注意力和完整 GPT 架构，到时候你能画出完整的 Transformer Block 图

---

## ✅ 自检清单

- [ ] 能一句话说出 Transformer 和 RNN 的本质区别（并行 vs 串行 / 全局 vs 局部）
- [ ] 能说出 Q、K、V 三个角色分别代表什么
- [ ] 能写出 Attention 核心公式：`softmax(QK^T / √d_k) × V`
- [ ] 能解释为什么要除以 √d_k（防止 softmax 饱和）
- [ ] 能说出 Transformer 对 RNN 的三大优势（长距离/并行/速度）
- [ ] 能说出 2017 年 "Attention Is All You Need" 为什么是分水岭

### 面试题积累（2 题）

**Q1: Self-Attention 中 Q、K、V 分别是什么？为什么需要三个不同的矩阵？**

> 你的回答：___
>
> 参考要点：Q=查询"我在找什么"，K=索引"我是什么"，V=内容"我有什么"。用三个不同矩阵而不是一个，是因为"查找关系"和"提供内容"是不同的能力，分开让模型更灵活。

**Q2: Transformer 相比 RNN 的核心优势是什么？**

> 你的回答：___
>
> 参考要点：1) 任意词距=1，解决长距离依赖；2) 矩阵运算可并行，GPU 友好；3) 训练速度快 10-100 倍。代价是 O(n²) 内存，但工程上有 Flash Attention 等优化。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
