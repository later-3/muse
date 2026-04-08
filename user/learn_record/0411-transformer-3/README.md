# D04 — N02 Transformer 架构 (3/3)

> **日期：** 2026-04-11（Sat）
> **路线图位置：** Week 1 · Day 4 · N02 Transformer（第 3 天，共 3 天）
> **定位：** 🟥 精通级（今天 1h，总计 8h 跨 3 天）· **F2 完成**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **一个完整的 GPT 从输入到输出经历了什么？** 能画出 Token Embedding → Block × N → LM Head 的全流程
2. **Decoder-Only 和 Encoder-Decoder 有什么区别？** GPT 是哪种？BERT 是哪种？T5 是哪种？
3. **GPT 是怎么一个字一个字生成的？** Autoregressive Generation 的完整机制

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy "Let's Build GPT" 后段 + 李宏毅 "解剖LLM" + 原始论文 "Attention Is All You Need" + nanoGPT 源码中提炼的核心知识。
> 今天是 Transformer 三天学习的最后一天：**把所有组件拼成完整的 GPT 架构**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Token Embedding** | 把每个 token（词/子词）映射成一个向量 | 查表：token ID → 向量 | Embedding 如何训练 |
| **LM Head（Language Model Head）** | 把最终向量映射回词表概率 | 输出层：向量 → "下一个词是什么" | Weight Tying 细节 |
| **Autoregressive（自回归）** | 逐个生成，每次用之前的输出作为下一步的输入 | 像打字：打完一个字才能打下一个 | 非自回归模型 |
| **Decoder-Only** | 只用 Transformer 的解码器部分 | GPT 家族的架构选择 | Encoder-Decoder 细节 |
| **Logits** | 模型最后一层的原始输出分数（未归一化） | softmax 之前的"生分数" | Temperature/Top-k 采样 |
| **Weight Tying（权重共享）** | Token Embedding 和 LM Head 共享同一个权重矩阵 | 省参数 + 让输入输出"说同一种语言" | 为什么数学上可行 |

### 🌍 背景：为什么要学这个？

**承接 D02+D03：** 前两天你学了 Self-Attention（D02）和 Multi-Head + 位置编码 + Block（D03）。但那些都是**零件**。今天把零件组装成**完整的 GPT**。

**技术栈位置：**
```
D01 反向传播 ✅
D02 Self-Attention ✅
D03 Multi-Head + Block ✅
D04 你在这里 → 完整 GPT 架构 → 明天学训练管线
```

**[Fact] 今天学完后，你已经能从底层到顶层完整描述 GPT 的工作原理。** 这是 N02 Transformer 节点的收官。

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2017.6 | Vaswani et al. | 原始 Transformer（Encoder-Decoder） | 完整架构首次提出，用于机器翻译 |
| 2018.6 | Radford & Narasimhan (OpenAI) | GPT-1：Decoder-Only + Pretraining | 首次证明 Decoder-Only 预训练在多任务上有效 |
| 2019.2 | Radford et al. (OpenAI) | GPT-2 (1.5B) | 规模更大 + Zero-Shot 能力涌现 |
| 2020.5 | Brown et al. (OpenAI) | GPT-3 (175B) | Few-Shot Learning + 规模定律验证 |
| 2018.10 | Devlin et al. (Google) | BERT：Encoder-Only + MLM | 双向理解任务的里程碑 |
| 2019.10 | Raffel et al. (Google) | T5：Encoder-Decoder 统一框架 | Text-to-Text 范式 |

### 第一性原理：GPT 到底长什么样？

> ⚠️ 把 D02 和 D03 学的零件拼起来。

**Layer 0 — 回忆：我们已经有了什么零件**

- D02：Self-Attention（Q/K/V + Scaled Dot-Product）
- D03：Multi-Head Attention + Positional Encoding + Residual Connection + LayerNorm + Causal Mask → 完整 Transformer Block

**Layer 1 — 核心问题：零件怎么拼成完整的语言模型？**

一个语言模型需要：
1. **输入处理**：把文本变成模型能处理的向量
2. **特征提取**：理解上下文关系（Transformer Block 干的事）
3. **输出预测**：根据上下文预测"下一个词是什么"

**Layer 2 — GPT 的完整流水线**

```text
文本 "Hello world"
    ↓
[Tokenizer]     → token IDs: [15496, 995]
    ↓
[Token Embedding (wte)]  → 每个 ID 查表得到 d_model 维向量
    +
[Position Embedding (wpe)] → 每个位置查表得到 d_model 维向量
    ↓
[Dropout]
    ↓
[Transformer Block × N]  → D03 学的完整 Block，堆 N 层
    ↓
[Final LayerNorm (ln_f)]
    ↓
[LM Head (linear)]  → [d_model] → [vocab_size] 维，得到每个词的 Logits
    ↓
[Softmax → 概率分布]
    ↓
预测: "下一个 token 最可能是 ___"
```

**Layer 3 — 完整定义**

**[Fact] 面试级一句话：** GPT (Generative Pre-trained Transformer) is a decoder-only, autoregressive language model that stacks N Transformer blocks with causal masking, using token and position embeddings as input and a linear projection (LM Head) to predict the next token's probability distribution over the vocabulary.

**[Fact] 中文展开：** GPT 是一个 Decoder-Only（仅解码器）的 Autoregressive（自回归）语言模型。它把 N 个带 Causal Mask 的 Transformer Block 堆叠起来，输入端用 Token Embedding + Position Embedding 把文本编码为向量，输出端用 LM Head（线性投影层）把最终向量映射到 Vocabulary（词表）上的概率分布，预测下一个 token。

---

### 怎么做到的？— 三个关键阶段

#### 阶段 1：Input Embedding（输入编码）

```python
# nanoGPT model.py L127-L129, L177-L179
tok_emb = self.transformer.wte(idx)   # Token Embedding: [batch, seq_len, d_model]
pos_emb = self.transformer.wpe(pos)   # Position Embedding: [seq_len, d_model]
x = self.transformer.drop(tok_emb + pos_emb)  # 相加 + Dropout
```

**[Fact] GPT-2 用的是 Learnable Position Embedding**（可学习的位置嵌入），不是原始 Transformer 的 Sinusoidal PE。每个位置有一个可训练的向量，通过反向传播（D01）学出来。

**[Fact] Weight Tying：** nanoGPT [model.py:L138](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L138) 中 `self.transformer.wte.weight = self.lm_head.weight`。Token Embedding 和 LM Head 共享同一个权重矩阵。好处：减少参数量 + 让"输入表示"和"输出预测"在同一语义空间中。

#### 阶段 2：Transformer Block × N（特征提取）

```python
# nanoGPT model.py L130, L180-L182
h = nn.ModuleList([Block(config) for _ in range(config.n_layer)])  # 堆 N 个 Block

# Forward:
for block in self.transformer.h:
    x = block(x)          # 每个 Block: Pre-Norm → MHA → Residual → Pre-Norm → FFN → Residual
x = self.transformer.ln_f(x)  # 最终 LayerNorm
```

**[Fact] GPT-2 Small 堆 12 层，每层都是 D03 学的完整 Block（Pre-Norm 版本）。** 关键超参数：

| 模型 | n_layer | n_head | n_embd (d_model) | 参数量 |
|------|---------|--------|-------------------|--------|
| GPT-2 Small | 12 | 12 | 768 | 124M |
| GPT-2 Medium | 24 | 16 | 1024 | 350M |
| GPT-2 Large | 36 | 20 | 1280 | 774M |
| GPT-2 XL | 48 | 25 | 1600 | 1558M |

> 来源：[nanoGPT model.py:L217-L220](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L217)

#### 阶段 3：LM Head + Generation（输出生成）

```python
# nanoGPT model.py L133, L186-L191
self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)

# 训练时：算所有位置的 loss
logits = self.lm_head(x)                          # [batch, seq_len, vocab_size]
loss = F.cross_entropy(logits.view(-1, ...), targets.view(-1, ...))

# 推理时：只看最后一个位置
logits = self.lm_head(x[:, [-1], :])              # 只取最后一个 token 的预测
```

**[Fact] Cross-Entropy Loss：** 训练目标是让模型在每个位置预测正确的下一个 token。Loss 函数是 Cross-Entropy（交叉熵），衡量预测概率分布和真实标签之间的距离。

**[Fact] Autoregressive Generation（自回归生成）流程：**

```text
输入: "The cat"
 ↓ 模型预测下一个 token
输出: logits → softmax → 概率分布 → 采样得到 "sat"
 ↓ 把 "sat" 拼回输入
输入: "The cat sat"
 ↓ 再预测
输出: "on"
 ↓ 继续...
输入: "The cat sat on"
 ...循环直到生成 <EOS> 或达到 max_length
```

来源：[nanoGPT model.py:L306-L330](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L306)（`generate` 方法）

---

### 为什么需要它？— 设计动机

| 设计选择 | 为什么 | 如果不这样 |
|---------|--------|----------|
| **Decoder-Only** | 生成任务天然适合单向 Causal Mask | Encoder-Decoder 更复杂、参数更多，且 GPT-3 证明 Decoder-Only 缩放效果更好 |
| **Learnable PE** | 灵活，让模型自己学位置规律 | Sinusoidal 是固定的，缺少适应性（但 RoPE 在此基础上更进一步） |
| **Weight Tying** | 减少参数 + 语义一致性 | 输入和输出"说不同的语言"，参数量也接近翻倍 |
| **Pre-Norm** | 训练更稳定，尤其深层模型 | Post-Norm 在深层时容易梯度不稳 |
| **Cross-Entropy Loss** | 标准的分类目标函数 | 其他 Loss（如 MSE）不适合离散 token 预测 |

---

### 举例 + 发散

#### 三种 Transformer 变种对比

```text
原始 Transformer (2017)    GPT (2018+)           BERT (2018)
┌─────────┐               ┌─────────┐           ┌─────────┐
│ Encoder │ ←→ │ Decoder │  │ Decoder │           │ Encoder │
│ (双向)  │    │ (单向)  │  │ (Causal)│           │ (双向)  │
└─────────┘    └─────────┘  └─────────┘           └─────────┘
翻译任务                    生成任务               理解/分类任务
Encoder-Decoder            Decoder-Only           Encoder-Only
```

**[Fact] 面试关键区分：**
- **Encoder-Only (BERT)**：双向 Attention，适合理解/分类任务（NER、情感分析）
- **Decoder-Only (GPT)**：Causal Mask 单向 Attention，适合生成任务（对话、写作）
- **Encoder-Decoder (T5, 原始 Transformer)**：Encoder 看全文，Decoder 生成，适合 Seq2Seq（翻译、摘要）

#### 完整 GPT 架构图（面试能画这个就够了）

```text
输入 token IDs: [15496, 995, ...]
        ↓
┌──────────────────────────────┐
│  Token Embedding (wte)       │  查表: ID → 向量
│  + Position Embedding (wpe)  │  位置: pos → 向量
│  = x                        │  相加
│  Dropout(x)                  │
├──────────────────────────────┤
│  Transformer Block 1         │  Pre-Norm → MHA → Residual
│    (LN → Causal MHA → +)    │  → Pre-Norm → FFN → Residual
│    (LN → FFN → +)           │
├──────────────────────────────┤
│  Transformer Block 2         │
│    ...                       │
├──────────────────────────────┤
│  Transformer Block N         │
├──────────────────────────────┤
│  Final LayerNorm (ln_f)      │
├──────────────────────────────┤
│  LM Head (Linear)            │  [d_model] → [vocab_size]
│  = logits                    │
└──────────────────────────────┘
        ↓
softmax(logits) → 概率分布 → 选择下一个 token
```

---

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely." — Vaswani et al., 2017 Abstract | 原始 Transformer 宣言：只用 Attention，完全不用 RNN 和 CNN。 |
| "We use learned positional embeddings instead of sinusoidal ones." — Radford et al., GPT-1 | GPT 把固定的 sinusoidal PE 替换成了可学习的 Position Embedding。 |
| "Language models are unsupervised multitask learners." — Radford et al., GPT-2 论文标题 | GPT-2 的核心主张：语言模型不需要监督信号就能学会多种任务。 |

---

### 📚 本地参考实现（双证据）

> 论文/课程提供概念来源，本地代码提供实现级事实。

| 主题 | 本地实现 | 能证明什么 |
|------|---------|-----------|
| **完整 GPT 架构定义** | [model.py:L118-L148](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L118) | GPT 类的 __init__：wte + wpe + Block × N + ln_f + lm_head 完整组装 |
| **Forward 全流程** | [model.py:L170-L193](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L170) | tok_emb + pos_emb → Block 循环 → ln_f → lm_head → loss |
| **Weight Tying** | [model.py:L138](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L138) | `self.transformer.wte.weight = self.lm_head.weight` |
| **GPT 配置超参** | [model.py:L108-L116](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L108) | GPTConfig: n_layer=12, n_head=12, n_embd=768 (GPT-2 Small) |
| **Autoregressive 生成** | [model.py:L306-L330](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L306) | generate 方法：循环预测 → 采样 → 拼接 → 再预测 |
| **教学版完整 GPT** | [ch04 gpt.py:L1-L100](file:///Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/ch04/01_main-chapter-code/gpt.py#L1) | Raschka 的教学实现：TransformerBlock + GPTModel 完整组装 |

---

### 这几个概念不要混

- **Decoder-Only ≠ 没有 Encoder**：GPT 是 Decoder-Only，但它不需要 Encoder 的输出——它自己就是完整的模型。"Decoder" 只是说它用了 Causal Mask
- **Logits ≠ 概率**：Logits 是 LM Head 的原始输出（可以是任意实数），经过 Softmax 后才变成概率分布
- **Pretraining ≠ Fine-tuning**：GPT 先在海量文本上做 Pretraining（预训练，无监督），再针对特定任务 Fine-tuning（微调，有监督）——明天 D05 详细讲
- **Token ≠ Word**：一个英文词可能被拆成多个 token（"unhappiness" → "un" + "happiness"），中文一个字通常是 2-3 个 token——Week 2 详细讲
- **Temperature 调整 ≠ 改变模型**：Temperature 只影响 Softmax 的"锐利度"，不改变模型参数

---

### 🎤 面试追问链

```
Q1: 请从输入到输出完整描述 GPT 的架构
→ 答: Token IDs → Token Embedding + Position Embedding → N 层 Transformer Block
      (Pre-Norm → Causal MHA → Residual → Pre-Norm → FFN → Residual)
      → Final LayerNorm → LM Head (Linear) → Logits → Softmax → 下一个 token 概率
  Q1.1: GPT 用的是什么位置编码？
  → 答: GPT-1/2 用 Learnable Position Embedding（可学习），不是 Sinusoidal。
        现代模型如 LLaMA 用 RoPE。
    Q1.1.1: Weight Tying 是什么？为什么要做？
    → 答: Token Embedding 和 LM Head 共享权重。减少参数量，
          且让输入输出在同一语义空间中对齐。

Q2: GPT 是怎么生成文本的？
→ 答: Autoregressive Generation。每次输入已有序列，预测下一个 token，
      采样后拼接到序列末尾，循环直到 EOS 或 max_length。
  Q2.1: 推理时为什么只看最后一个位置的 Logits？
  → 答: 因为 Causal Mask 使得最后一个位置已经"看过"了所有前面的 token，
        它的输出包含了完整的上下文信息，只需要拿它来预测下一个词。
    Q2.1.1: 那训练时为什么要看所有位置的 Logits？
    → 答: 训练时用 Teacher Forcing，每个位置都有正确答案（下一个 token），
          所有位置同时算 Cross-Entropy Loss，效率更高。

Q3: Decoder-Only、Encoder-Only、Encoder-Decoder 有什么区别？
→ 答: Decoder-Only (GPT) = Causal Mask 单向，适合生成。
      Encoder-Only (BERT) = 双向 Attention，适合理解/分类。
      Encoder-Decoder (T5) = Encoder 看全文 + Decoder 生成，适合翻译/摘要。
  Q3.1: 为什么 GPT-3 之后主流都是 Decoder-Only？
  → 答: 实验证明 Decoder-Only + 足够的规模可以同时做理解和生成，
        架构更简单，缩放效率更好。
    Q3.1.1: ChatGPT 和 GPT-3 的架构有什么区别？
    → 答: 架构相同（Decoder-Only Transformer），差异在训练方法：
          GPT-3 是纯 Pretraining，ChatGPT 加了 SFT + RLHF。
          明天 D05 详细讲训练管线。
```

---

### 关键概念清单

- [ ] **GPT 完整架构**：Token Emb + Pos Emb → Block × N → LN → LM Head
- [ ] **Token Embedding (wte)**：token ID 查表得向量
- [ ] **Position Embedding (wpe)**：位置查表得向量，与 token emb 相加
- [ ] **LM Head**：线性层，d_model → vocab_size
- [ ] **Weight Tying**：wte 和 lm_head 共享权重
- [ ] **Autoregressive Generation**：逐 token 生成，每步用前文预测下一个
- [ ] **Cross-Entropy Loss**：训练目标函数，衡量预测分布与真实标签的距离
- [ ] **Logits vs 概率**：Logits = 原始分数，Softmax 后 = 概率
- [ ] **Decoder-Only / Encoder-Only / Encoder-Decoder** 三种变种
- [ ] **Teacher Forcing**：训练时用真实标签，不用模型自己的预测

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Build GPT | https://www.youtube.com/watch?v=kCc8FmEb1nY | 1:40:00 后 — 完整 GPT 组装 |
| 李宏毅 解剖LLM | YouTube 搜索 | GPT 架构全景 |
| nanoGPT 源码 | user/reference/repos/nanoGPT/model.py | 完整实现一个 GPT |
| Jay Alammar GPT-2 图解 | https://jalammar.github.io/illustrated-gpt2/ | GPT-2 可视化 |

---

## 🧠 与 Muse/项目 的映射

先把"仓库里的本地代码"和"远端模型内部"分开：

- **[Fact] 本地代码实际做的事：** [engine.mjs](file:///Users/xulater/Code/assistant-agent/muse/src/core/engine.mjs#L107) 组装 payload 发给模型服务。你调用的 Claude/GPT 在远端服务器上运行完整的 GPT 架构（今天学的全部内容）。
- **[Fact] 远端模型做了什么：** 收到你的 prompt 后，做 Token Embedding → 过 N 层 Block → LM Head → Autoregressive 生成。每个 Block 内部做 D02 的 Attention 和 D03 的 Multi-Head + Residual + Norm。
- **[Infer] 为什么 Agent 开发者需要懂完整架构：**
  - **上下文窗口** = GPT 配置中的 `block_size`（如 GPT-2 是 1024 token），超过就截断
  - **token 数量** 直接影响推理成本：每个 token 都要经过 N 层 Block 的完整计算
  - **Temperature/Top-k** 影响的是 LM Head 输出后的采样策略，不影响模型本身
- **[Fact] 和明天 D05 的关系：** 今天学了 GPT "长什么样"，明天学它是"怎么训出来的"（Pretraining → SFT → RLHF）。

---

## ✅ 自检清单

- [ ] 能画出 GPT 完整架构图（Input → Blocks → Output）
- [ ] 能说出 Token Embedding 和 Position Embedding 的作用 + 为什么相加
- [ ] 能解释 LM Head 做什么 + Weight Tying 为什么有效
- [ ] 能描述 Autoregressive Generation 的循环过程
- [ ] 能说出训练和推理时 Logits 使用方式的区别
- [ ] 能区分 Decoder-Only / Encoder-Only / Encoder-Decoder
- [ ] 能说出 GPT-2 Small 的关键超参（12层/12头/768维/124M参数）
- [ ] 能解释 Cross-Entropy Loss 在语言模型中的角色
- [ ] 能扛住 3 条面试追问链各 3 层

### 面试题积累（2 题）

**Q1: 请完整描述 GPT 从输入到输出的架构**

> 你的回答：___
>
> 参考：Token/Position Embedding 相加 → N 层 Transformer Block（Pre-Norm + Causal MHA + FFN + Residual）→ Final LN → LM Head → Logits → Softmax

**Q2: Decoder-Only、Encoder-Only、Encoder-Decoder 各适合什么任务？为什么主流是 Decoder-Only？**

> 你的回答：___
>
> 参考：GPT(生成) / BERT(理解) / T5(翻译)。Decoder-Only 架构简单、缩放好，GPT-3 证明规模够大时也能做理解任务

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
