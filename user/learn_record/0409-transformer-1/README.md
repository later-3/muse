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

### 🌍 背景：为什么要学这个？

**承接 D01：** 昨天你学了反向传播——神经网络怎么"学习"。今天学的 Transformer 就是用反向传播来训练的那个网络架构。**反向传播是引擎，Transformer 是车身。**

**技术栈位置：**
```
Layer 0: 数学根基 ← D01 反向传播 ✅
Layer 2: Transformer ← 你在这里（N02，3天精通）
Layer 3: 训练管线 ← D05-D06（N06）
```

**为什么这是最重要的知识点：** Transformer 是 2017 年至今所有大语言模型的基础架构。GPT、Claude、Gemini、DeepSeek — 全部是 Transformer。**理解 Transformer = 理解整个大模型时代的地基。**

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 1997 | Hochreiter & Schmidhuber | 发明 LSTM | 解决了 RNN 梯度消失，成此后 20 年 NLP 主力 |
| 2014 | Bahdanau et al. (蒙特利尔) | 提出 Attention 机制 | 首次在 RNN 上加 Attention，机器翻译质量大涨 |
| 2017.6 | Vaswani et al. (Google Brain, 8人) | "Attention Is All You Need" | 完全抛弃 RNN，只用 Attention。被引 15 万+，开启大模型时代 |
| 2018.6 | Radford et al. (OpenAI) | GPT-1 | 首个 Transformer Decoder 生成式预训练 |
| 2018.10 | Devlin et al. (Google) | BERT | Transformer Encoder 双向预训练，横扫 NLU |
| 2020.5 | Brown et al. (OpenAI) | GPT-3 (175B) | 证明 Transformer + 规模 = 涌现能力 |
| 2022.11 | OpenAI | ChatGPT | Transformer + RLHF → 全球爆火 |

### 第一性原理：Transformer 到底是什么？

> ⚠️ 不是一句话定义。从最底层往上搭建，面试官追问到底也能答。

**Layer 0 — 前置概念：向量和内积**

神经网络的世界里，一切都是数字。一个词 = 一个向量（一串数字），比如 "猫" = [0.2, 0.8, -0.1, ...]。两个向量做**内积（dot product）**，数值越大 = 越"相似"。**这是 Attention 的数学基础——判断两个词有多相关。**

**Layer 1 — 核心问题：怎么让机器理解"上下文"？**

人类理解语言靠上下文："苹果发布新手机" vs "苹果很好吃"，同一个"苹果"含义完全不同。机器要理解语言，必须知道每个词和周围词的关系。

2017 年前的方案是 **RNN（循环神经网络）**：像一个人从左往右逐字读，用一个"记忆向量 h"传递信息。

```
RNN 的方式（串行处理）：
  "我" → h1 → "喜" → h2 → "欢" → h3 → "吃" → h4 → "苹" → h5 → "果" → h6
  
  致命问题 1：处理到"果"时，"我"的信息已在 h 中衰减（长距离遗忘）
  致命问题 2：h2 依赖 h1，h3 依赖 h2... 必须串行，GPU 利用率低（慢）
  致命问题 3：100 层反向传播的梯度链 → 梯度消失/爆炸（难训练）
```

**Layer 2 — 核心洞察：不要串行读，让每个词直接看到所有其他词**

Vaswani 团队的突破性想法：**为什么非要一个接一个读？让每个词和所有其他词直接"对话"不就行了？**

```
Transformer 的方式（并行处理）：
  "我" "喜" "欢" "吃" "苹" "果"
   ↕    ↕    ↕    ↕    ↕    ↕     ← 所有词两两计算注意力
  [========= Self-Attention =========]
  
  "苹"直接看到"吃"，不需要经过中间的"欢" → 长距离不遗忘
  6 个词同时计算（矩阵乘法）→ GPU 并行 → 快 10-100 倍
```

这个"让每个词看到所有其他词并计算相关度"的机制，就叫 **Self-Attention（自注意力）**。

**Layer 3 — 完整定义**

**Transformer 是一种基于 Self-Attention 机制的神经网络架构。它通过计算序列中每个元素对其他所有元素的注意力权重来捕获全局依赖关系。它完全不使用循环（RNN）或卷积（CNN），只依赖 Attention + 前馈网络 + 残差连接，因此可以高度并行化。**

> **类比（仅类比）：** RNN 像一个人从头到尾读一本书，读到最后已经忘了开头。Transformer 像把整本书摊在桌上，每读一个字都能同时看到所有其他字。

---

### 怎么做到的？— Self-Attention 机制详解

Self-Attention 回答一个问题：**"当我处理某个词时，我应该关注哪些其他词？关注多少？"**

#### 三个角色：Q（Query）、K（Key）、V（Value）

每个词被变换成三个向量。为什么要三个？因为"查找关系"和"提供内容"是不同的能力：

| 角色 | 含义 | 类比 | 为什么单独的矩阵 |
|------|------|------|-----------------|
| **Q（Query）** | "我在找什么？" | 搜索引擎的搜索词 | 同一个词在不同语境下"找的东西"不同 |
| **K（Key）** | "我能提供什么？" | 网页的标题/标签 | "被找到的方式"不同于"找别人的方式" |
| **V（Value）** | "我的实际内容" | 网页的正文 | 提供内容 ≠ 标签（Key≠Value） |

#### 计算过程（4 步）

**Step 1：生成 Q、K、V**

每个词的 embedding 分别乘以三个权重矩阵（这些权重靠 D01 学的反向传播训练）：

```python
Q = X @ W_Q   # X: [n, d_model] 输入, W_Q: [d_model, d_k] 可学习参数
K = X @ W_K   # 结果 Q,K: [n, d_k]
V = X @ W_V   # V: [n, d_v]，这三个 W 矩阵靠反向传播优化
```

**Step 2：计算注意力分数**

```python
scores = Q @ K.T   # [n, d_k] × [d_k, n] = [n, n] 注意力矩阵
```

| | 我 | 喜 | 欢 | 吃 | 苹 | 果 |
|--|---|---|---|---|---|---|
| **我** | 0.2 | 0.1 | 0.1 | 0.3 | 0.1 | 0.2 |
| **吃** | 0.1 | 0.1 | 0.0 | 0.1 | **0.4** | **0.3** |

→ "吃"对"苹""果"的注意力最高——模型学到了语义关联

**Step 3：缩放 + Softmax 归一化**

```python
attention_weights = softmax(scores / sqrt(d_k))
```

- **除以 √d_k 是关键**：d_k 是 Key 维度。维度高 → 内积数值大 → softmax 输出趋向 0/1 极端 → 梯度消失（和 D01 直接相关）→ 除以 √d_k 让数值回到合理范围
- **Softmax** 让每行分数加起来 = 1（概率分布）

**Step 4：加权求和**

```python
output = attention_weights @ V   # [n, n] × [n, d_v] = [n, d_v]
```

每个词的输出 = 它关注的所有词的 V 的加权组合。

#### 完整公式

```
Attention(Q, K, V) = softmax(Q × K^T / √d_k) × V
```

2017 年论文的精华浓缩在这一行里。

---

### 为什么需要它？— 设计动机

#### RNN 的三大致命问题 vs Transformer 的解法

| 问题 | RNN 怎么样 | Transformer 怎么解决 | 为什么重要 |
|------|-----------|--------------------| --------- |
| **长距离依赖** | 100 步后信息几乎消失 | 任意两词直连，距离=1 | 长文本理解的基础 |
| **并行计算** | h_t 依赖 h_{t-1}，必须串行 | 矩阵乘法，所有词同时算 | 训练快 10-100 倍 |
| **梯度传播** | 深层梯度链 → 消失/爆炸 | 残差连接 + 直接路径 | 能训更深的网络 |

#### 代价

- **O(n²) 内存和计算**：n 个词 → n×n 注意力矩阵。n=100K 时有 100 亿个元素
- 这就是为什么模型有"最大上下文长度"限制（N05 的 Flash Attention / KV Cache 就是优化这个）

---

### 举例 + 发散

#### Karpathy Build GPT 的教学路径

1. **BigramModel**：每个字符只看前一个 → loss ~2.5（很差）
2. **+ Self-Attention**：看前面所有 → loss ~2.0（明显好转）
3. **+ Multi-Head**：D03 学 → loss 继续降
4. **+ 多层堆叠**：6 层 → 生成文本开始像样

#### 参数量感受

| 模型 | 参数量 | 层数 | 注意力头数 | 年份 |
|------|--------|-----|-----------|------|
| 原始 Transformer | 6500 万 | 6 | 8 | 2017 |
| GPT-1 | 1.17 亿 | 12 | 12 | 2018 |
| GPT-3 | 1750 亿 | 96 | 96 | 2020 |
| GPT-4 (推测) | ~1.8 万亿 | ~120 | ~96 | 2023 |

**每一层 = 一次 Self-Attention + 一次前馈网络。层数越多，"思考"越深。**

#### 明天 D03 继续

- **多头注意力（Multi-Head Attention）**：分成多个"头"
- **位置编码（Positional Encoding）**：告诉模型词序
- **残差连接 + LayerNorm**
- **解码器的 Masked Attention**：GPT 只看前面的词

---

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks... The Transformer... dispensing with recurrence and convolutions entirely." — Vaswani et al., 2017 Abstract | 论文开头宣战：以前都靠 RNN/CNN，我们完全不用，只用 Attention。 |
| "An attention function can be described as mapping a query and a set of key-value pairs to an output." — §3.2 | Attention = 拿 Query 查 Key-Value 对，本质是一次"软查询"。 |
| "We suspect that for large values of d_k, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients." — §3.2.1 | 维度高 → 内积大 → softmax 极化 → 梯度消失 → 除以 √d_k 解决。 |
| "The animal didn't cross the street because it was too tired." — Jay Alammar | Attention 怎么消歧义："it" 对 "animal" 注意力最高 → it=animal。 |

---

### 🎤 面试追问链

```
Q1: Transformer 是什么？
→ 答: 基于 Self-Attention 的架构，让每个词直接看到所有其他词，
      解决 RNN 的长距离遗忘和不能并行的问题。2017年 Google Brain 提出。
  Q1.1: 为什么 RNN 不能并行？
  → 答: 因为 h_t 依赖 h_{t-1}，必须算完上步才能算下步。
        Transformer 用矩阵乘法 Q×K^T，所有词对同时计算。
    Q1.1.1: Transformer 的代价是什么？
    → 答: O(n²) 内存。n 个词 → n×n 注意力矩阵。
          所以有上下文长度限制，需要 Flash Attention 等优化。

Q2: Attention 公式是什么？为什么除以 √d_k？
→ 答: softmax(QK^T / √d_k) × V。维度高 → 内积大 → softmax 饱和 → 梯度消失。
  Q2.1: Q、K、V 分别是什么？为什么要三个矩阵？
  → 答: Q=查询"我在找什么"，K=索引"我能提供什么"，V=内容。
        分三个因为"查找关系"和"提供内容"是不同的能力。
    Q2.1.1: 这些 W 矩阵怎么学到的？
    → 答: 反向传播。W_Q/W_K/W_V 是可学习参数，
          通过 loss 反向传播梯度来优化（D01 的内容）。

Q3: Transformer 之前的方案是什么？
→ 答: LSTM/GRU（改良 RNN），1997年 Hochreiter 发明。
  Q3.1: LSTM 和 RNN 有什么区别？
  → 答: LSTM 加了门控机制（遗忘门/输入门/输出门），
        缓解了梯度消失，但仍然是串行的。
    Q3.1.1: 那 Attention 最早是谁提出的？
    → 答: 2014 年 Bahdanau 在 RNN 机器翻译上首次加 Attention，
          Transformer 把这个思想独立出来，完全不用 RNN。
```

---

### 关键概念清单

- [ ] **Transformer**：基于 Self-Attention 的架构，让每个词直接看到所有其他词
- [ ] **Self-Attention**：计算"每个词应该关注哪些其他词、关注多少"
- [ ] **Q（Query）**："我在找什么" — 查询向量
- [ ] **K（Key）**："我能提供什么" — 索引向量
- [ ] **V（Value）**："我的实际内容" — 内容向量
- [ ] **Attention 公式**：`softmax(QK^T / √d_k) × V`
- [ ] **√d_k 缩放**：防内积太大 → softmax 饱和 → 梯度消失
- [ ] **并行计算**：矩阵乘法取代串行
- [ ] **O(n²) 代价**：n 个词 → n×n 矩阵 → 上下文长度限制

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Build GPT | https://www.youtube.com/watch?v=kCc8FmEb1nY | 0:00-40:00 Bigram → Self-Attention |
| 原始论文 | https://arxiv.org/abs/1706.03762 | Fig.1 架构图 + 3.2 节 Attention |
| Jay Alammar 图解 | https://jalammar.github.io/illustrated-transformer/ | 全文（最好的可视化） |

---

## 🧠 与 Muse/项目 的映射

- **Muse 的模型**（Claude/GPT）核心 = Transformer。理解 Attention = 理解上下文理解能力
- **`src/core/engine.mjs`** 调 LLM 时，内部在做 Q×K^T/√d_k×V
- **Context Window 限制**：O(n²) 就是上下文长度限制的原因。N05 学 Flash Attention 优化
- **明天 D03** 学多头注意力 + 完整 GPT 架构

---

## ✅ 自检清单

- [ ] 能从 Layer 0 逐层讲到 Layer 3 定义 Transformer
- [ ] 能说出 Vaswani 2017 + Bahdanau 2014 + Hochreiter 1997 各做了什么
- [ ] 能说清 Q、K、V 三角色 + 为什么需要三个矩阵
- [ ] 能写出 Attention 公式并解释 √d_k
- [ ] 能说出 RNN 三大问题 + Transformer 三大解法
- [ ] 能说出代价 O(n²) + 后续优化方向
- [ ] 能扛住面试追问链的 3 层追问

### 面试题积累（2 题）

**Q1: 请从底层讲解 Transformer 的 Self-Attention 机制**

> 你的回答：___
>
> 参考：从向量内积 → RNN的问题 → Attention思路 → QKV → 完整公式 → √d_k

**Q2: Transformer 的发展历程和关键人物？**

> 你的回答：___
>
> 参考：Hochreiter 1997 LSTM → Bahdanau 2014 首个Attention → Vaswani 2017 Transformer → Radford 2018 GPT-1 → Brown 2020 GPT-3

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
