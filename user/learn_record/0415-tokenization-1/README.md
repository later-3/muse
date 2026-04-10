# D08 — N03 Tokenization (1/2)

> **日期：** 2026-04-15（Tue）
> **路线图位置：** Week 2 · Day 8 · N03 Tokenization（第 1 天，共 2 天）
> **定位：** 🟨 理解级（今天 1h，总计 3h 跨 2 天）· **F11 开始**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Token 到底是什么？** 为什么 LLM 不直接处理字符或单词？
2. **BPE (Byte Pair Encoding) 怎么工作？** 能用一个例子手推一遍
3. **Tokenization 对 Agent 开发有什么实际影响？** 为什么中文比英文"贵"？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy ["Let's build the GPT Tokenizer"](https://youtu.be/zduSFxRajkE)（2h13min）中提炼的核心知识。
> 这是 Karpathy 最长的一期视频，但核心知识其实 40 分钟就能吸收。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Token** | LLM 处理的最小单位（不是字符也不是单词） | 一个"子词片段"，比字符大、比整词小 | Unicode 编码细节 |
| **BPE (Byte Pair Encoding)** | 把常见的字符对合并成新 token 的算法 | 像压缩算法 — 频率高的组合变成一个符号 | RegEx 预分词的细节 |
| **Vocabulary（词表）** | 模型认识的所有 token 的集合 | GPT-4 有 ~100K 个 token | 不同模型的词表差异 |
| **Tokenizer** | 把文本切成 token 的工具/程序 | Transformer 的"翻译官"：人类文字 ↔ 模型 token | SentencePiece vs tiktoken |
| **Token ID** | 每个 token 在词表中的编号（整数） | 模型实际看到的是这些数字，不是文字 | Embedding 层的查表细节 |

### 🌍 背景：为什么要学这个？

**承接 Week 1：** 上周你学了 Transformer 架构（D02-D04）和训练管线（D05-D06）。但有一个关键问题被跳过了：**文本是怎么变成 Transformer 能处理的输入的？**

Transformer 处理的是**向量序列**（一排数字），不是文字。Tokenization 就是把人类的文字转换成模型能处理的数字序列的过程。

**技术栈位置：**
```
"你好世界" → [Tokenizer] → [15339, 50918, ...] → [Embedding] → 向量序列 → Transformer
   ↑人类文字                    ↑ Token IDs                                    ↑ 模型处理
```

**为什么 Agent 工程师必须懂 Tokenization？** [Fact]
- **Context Window 是按 token 算的，不是按字算的**。中文 1 个字 ≈ 2-3 个 token，英文 1 个词 ≈ 1-1.5 个 token
- **API 计费是按 token 算的**。同样的意思用中文表达比英文贵 ~2 倍
- **Prompt 设计要考虑 token 效率**。冗长的 Prompt 浪费 Context Window

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 1994 | Gage | 原始 BPE 论文 | 最初是一种数据压缩算法 |
| 2015 | Sennrich et al. | BPE 用于 NLP | 首次把 BPE 用于机器翻译的子词分割 |
| 2018 | Google | SentencePiece | 语言无关的 tokenizer，支持 BPE 和 Unigram |
| 2022 | OpenAI | tiktoken | GPT 系列使用的 BPE tokenizer，开源 |
| 2024 | Karpathy | minbpe | 手把手教你从零实现 BPE 的教学项目 |

### 第一性原理：Token 到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — 为什么不能直接用字符？**

[Fact] 如果直接用字符（a, b, c, ...），词表只有 ~256 个（ASCII/UTF-8 字节），但问题是：

- 一个单词（如 "attention"）变成 9 个 token → 序列太长
- Transformer 的计算量是 O(n²)（n = 序列长度）→ 字符级 tokenization 太慢
- 每个字符的"含义"太弱 — 模型需要堆很多层才能从字符组合中学到词义

**Layer 1 — 为什么不能直接用完整单词？**

[Fact] 如果直接用单词，问题是：

- 词表会非常大（英文 ~50 万个词，加上各种变体形态）
- **OOV (Out-of-Vocabulary)**：遇到新词（如人名、专业术语）就完全不认识
- 中文没有天然的"词"边界（需要额外的分词工具）

**Layer 2 — 子词 (Subword) 的核心思路**

[Fact] BPE 的核心洞察 — **折中方案**：

- 常见的词保持完整（如 "the" → 1 个 token）
- 罕见的词拆成更小的片段（如 "tokenization" → "token" + "ization"）
- 最坏情况退化到字符级别（未知字符 → 各自独立的 token）

这样词表大小可控（通常 30K-100K），又不会遇到 OOV 问题。

**Layer 3 — 完整定义**

Token = BPE 等子词算法从训练语料中自动学习出来的文本片段。它是介于字符和完整单词之间的最优分割单位，平衡了词表大小、序列长度和覆盖率。

### 怎么做到的？— BPE 算法详解

[Fact] BPE 训练过程（Karpathy 的 minbpe 实现）：

**Step 0：初始化**
- 词表 = 256 个 UTF-8 字节（0x00 到 0xFF）
- 把训练文本全部转成字节序列

**Step 1：统计最常见的字节对**
```
训练文本: "aaabdaaabac"
字节序列: [97, 97, 97, 98, 100, 97, 97, 97, 98, 97, 99]

统计相邻字节对出现次数:
  (97, 97) → 4 次  ← 最常见！
  (97, 98) → 2 次
  (98, 100) → 1 次
  ...
```

**Step 2：合并最常见的字节对**
```
创建新 token: 256 = (97, 97)  即 "aa"
替换所有出现: [256, 97, 98, 100, 256, 97, 98, 97, 99]
```

**Step 3：重复，直到达到目标词表大小**
```
再统计: (256, 97) → 2 次 ← 最常见！
创建: 257 = (256, 97) 即 "aaa"
替换: [257, 98, 100, 257, 98, 97, 99]

继续...直到词表 = 目标大小（如 50K）
```

**关键观察：**
- 高频子串被合并成单个 token → 常见词用更少 token 表示 → 序列变短 → 计算更快
- 这和数据压缩的原理完全一样

### 为什么需要它？— 设计动机

**没有 Tokenizer 会怎样？**

| 方案 | 词表大小 | "Hello world" 的 token 数 | 问题 |
|------|---------|--------------------------|------|
| 字符级 | ~256 | 11 | 序列太长，O(n²) 爆炸 |
| 单词级 | ~500K | 2 | 词表太大，OOV |
| BPE | ~50K | 2-3 | ✅ 平衡 |

### 举例 + 发散

**数值例子：GPT-4 的 tiktoken 实际编码**

```python
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4")

# 英文
enc.encode("Hello world")    # → [9906, 1917]     = 2 tokens
enc.encode("Tokenization")   # → [3404, 2065]     = 2 tokens

# 中文
enc.encode("你好世界")         # → [57668, 16325, 99013] = 3 tokens（！）
enc.encode("机器学习")         # → [21710, 17161, 99337] = 3 tokens

# 关键洞察：
# 英文 "Hello world" = 11 字符 → 2 tokens
# 中文 "你好世界"     = 4 字符  → 3 tokens
# 同样的信息量，中文用更多 token！
```

**为什么中文更"贵"？** [Fact]
- GPT 系列的 BPE 训练数据以英文为主（~90%+）
- 英文的常见词/短语被充分合并成高效 token
- 中文在训练数据中比例低 → 汉字的合并不够充分 → 需要更多 token 表示

> **类比（仅类比）：** 想象一本翻译词典。英语区域有很多"成语"（一个词代表复杂概念），中文区域只有基础字 — 说同一件事，中文需要查更多次词典。

**Token 边界引起的"Bug"**

[Fact] Karpathy 在视频中展示了一个著名的 tokenization "bug"：

```
"123456789" → 可能被切成 ["123", "456", "789"] 或 ["12345", "6789"]
```

这导致 LLM 做数学时"看到"的数字和人类不同。如果 "1234" 被切成 "12" + "34"，模型需要先理解这两个 token 合起来是 "1234" 才能做算术 — 这就是为什么早期 LLM 算数学很差。

### 📜 原文对照（关键论文/博客引用）

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "BPE iteratively replaces the most frequent pair of bytes in a sequence with a single, unused byte" — Gage 1994 | BPE 就是不断把最常见的相邻字节对合并成一个新符号 |
| "Tokenization is at the heart of much weirdness of LLMs" — Karpathy | LLM 的很多"奇怪行为"（算术差、拼写差）根源在 tokenization |
| "The tokenizer is a completely separate, independent module from the LLM" — Karpathy | Tokenizer 和模型是完全独立的两个东西，先有 tokenizer 再训模型 |

### 🎤 面试追问链

```
Q1: 什么是 BPE？为什么 LLM 用它？
→ 你答: 子词分割算法，把频繁的字符对合并。平衡词表大小和序列长度。
  Q1.1: 为什么不直接用字符？
  → 你答: 序列太长，O(n²) 太贵。而且字符含义太弱，需要堆更多层。
    Q1.1.1: 为什么不用完整单词？
    → 你答: 词表太大，而且新词 (OOV) 完全不认识。子词是折中方案。

Q2: 中文为什么比英文"贵"？
→ 你答: BPE 训练数据以英文为主，英文常见词合并充分。中文合并不够 → 同等信息量需要更多 token → Context 消耗更多 + API 费用更高。
```

### 这几个概念不要混

- **Token ≠ Word（词）**：Token 是子词片段，可能是完整词、词的一部分、甚至是单个字符
- **Token ≠ Character（字符）**：Token 通常比字符大。"Hello" = 1 token，不是 5 个
- **Tokenizer ≠ Model**：Tokenizer 是独立模块，在模型训练**之前**就确定了。换模型不换 tokenizer 是可能的
- **Vocabulary ≠ Dictionary**：Vocabulary 是 token 列表（机器用），Dictionary 是词义解释（人类用）

### 关键概念清单

- [ ] **Token 的定义**：BPE 学出的子词片段，介于字符和单词之间
- [ ] **BPE 算法**：能手推一遍 — 统计最频繁字节对 → 合并 → 重复
- [ ] **词表大小的 tradeoff**：太小 = 序列太长，太大 = Embedding 层太大
- [ ] **中文 vs 英文的 token 效率差异**：中文更"贵"的原因
- [ ] **Token 边界问题**：算术差、拼写差的根源
- [ ] **Tokenizer 和模型的独立性**：先有 tokenizer 再训模型

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Tokenizer | https://youtu.be/zduSFxRajkE | 前 40min: BPE 手推 + 代码 |
| minbpe 仓库 | https://github.com/karpathy/minbpe | 200 行 Python 实现 BPE |
| tiktoken (OpenAI) | https://github.com/openai/tiktoken | GPT 系列的生产级 tokenizer |

---

## 🧠 与 Muse/项目 的映射

> 今天学的 Tokenization，在 Agent 开发中体现在哪里？

- **本地代码实际做的事：**
  - Muse 调用 LLM API 时，发送的是文本字符串 → API 端做 tokenization → 返回的 usage 按 token 计费
  - `src/core/engine.mjs` 中的 prompt 组装 → 每一段 prompt 的 token 长度直接影响 Context Window 用量
- **远端模型/外部系统做的事：**
  - OpenAI/Anthropic API 在内部做 tokenization，开发者看不到
  - 但 usage 统计（prompt_tokens / completion_tokens）暴露了 token 数量
- **为什么 Agent 开发者需要知道这个：**
  - **Prompt 优化** = token 优化 — 简洁的 prompt 节省 Context 和费用
  - **Context Window Management** = token 管理 — 知道中文耗更多 token，可以提前估算
  - **工具返回值处理** — 工具返回的长文本会消耗大量 token，需要截断或摘要
- **和明天内容的关系：** D09 继续 Tokenizer + minbpe 代码走读 + 实测不同模型的 token 差异

---

## ✅ 自检清单

- [ ] **能解释 Token 的定义**：不是字符也不是单词，是子词片段
- [ ] **能手推 BPE**：给定一段文本，能演示合并过程
- [ ] **能解释中文为什么"贵"**：训练数据偏英文 → 中文合并不充分
- [ ] **能说出 Token 边界的影响**：算术差、拼写差的原因
- [ ] **能说出对 Agent 开发的实际影响**：Context Window / API 计费 / Prompt 优化

### 面试题积累（2 题）

**Q1: 请解释 BPE 算法的工作原理，为什么它是 LLM tokenization 的主流选择？**

> 你的回答：___
>
> 参考：迭代合并最频繁字节对。平衡词表大小和序列长度。常见词 = 少 token（高效），罕见词退化到字符（不会 OOV）。

**Q2: 如果你在开发一个中文 Agent，tokenization 会带来什么实际挑战？怎么应对？**

> 你的回答：___
>
> 参考：中文 token 效率低（~2-3 token/字 vs 英文 ~1 token/词）。应对：精简 System Prompt、工具返回值做摘要、选择中文优化的模型（如 Qwen、GLM 用中文比例更高的训练数据）。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
