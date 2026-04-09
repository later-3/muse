# D03 — N02 Transformer 架构 (2/3)

> **日期：** 2026-04-10（Fri）
> **路线图位置：** Week 1 · Day 3 · N02 Transformer（第 2 天，共 3 天）
> **定位：** 🟥 精通级（今天 1h，总计 8h 跨 3 天）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **多头注意力为什么要"多头"？** 一个头和多个头的区别是什么？
2. **Transformer 怎么知道词序？** 没有循环结构，它靠什么知道"我喜欢你"和"你喜欢我"不同？
3. **一个完整的 Transformer Block 长什么样？** 残差连接和 LayerNorm 在哪里、解决什么问题？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy "Let's Build GPT" 40min-1h40min + 原始论文 "Attention Is All You Need" §3.2-§3.3 中提炼的核心知识。
> 今天是 Transformer 三天学习的第二天：**多头注意力 + 位置信息 + 完整 Block 结构**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Multi-Head Attention（多头注意力）** | 把注意力拆成多个独立的小组并行计算 | 像多个侦探各自查线索，最后汇总 | 头数怎么选、不同头学到了什么 |
| **Positional Encoding（位置编码）** | 告诉模型每个词在句子中的位置 | 给每个词贴一个"座位号" | sinusoidal vs RoPE 的数学推导 |
| **Residual Connection（残差连接）** | 把输入直接加到输出上 | 像给信号开了一条"高速直通车" | ResNet 原始论文细节 |
| **LayerNorm** | 把每一层的输出数值范围拉回"正常区间" | 防止数字越算越大或越小 | BatchNorm vs LayerNorm 差异 |
| **Causal Masking（因果遮蔽）** | 遮住未来的词，只看过去 | GPT 生成文字时不能偷看后面的答案 | 不同 mask 策略（causal/padding） |
| **Transformer Block（变换器块）** | 一个注意力层 + 一个前馈层 + 残差 + Norm 的完整单元 | 像一个"思考单元"，堆多个就是深度思考 | Block 内部的初始化和训练技巧 |

### 🌍 背景：为什么要学这个？

**承接 D02：** 昨天你学了 Self-Attention 的核心机制（QKV + 公式）。但 D02 只讲了**单头注意力**，而且没解决两个关键问题：Transformer 怎么知道词序？深层网络怎么稳定训练？今天补齐这些。

**技术栈位置：**
```
D01 反向传播 ✅ → D02 单头 Self-Attention ✅ → D03 你在这里
                                                  ↓
                                          多头注意力 + 位置编码
                                          + 残差 + LayerNorm
                                          + Masked Attention
                                          = 完整 Transformer Block
                                                  ↓
                                          明天 D04: GPT 完整架构
```

**[Fact] 今天学完后，你就能画出一个完整的 Transformer Block。** 这个 Block 是所有大模型（GPT/Claude/Gemini）的基本构建单元，堆叠 N 个 Block 就是一个完整的模型。

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2015 | He et al. (微软亚研) | 提出 ResNet（残差网络） | 残差连接让 150+ 层深度网络成为可能，Transformer 直接借用了这个思想 |
| 2016 | Ba, Kiros & Hinton | 提出 Layer Normalization | 替代 BatchNorm 用于序列模型，成为 Transformer 的标配 |
| 2017 | Vaswani et al. | 在 Transformer 中使用 Multi-Head Attention + Sinusoidal PE | 多头让模型同时关注不同类型的关系，PE 解决了无循环结构下的词序问题 |
| 2021 | Su et al. | 提出 RoPE（旋转位置编码） | 后续被 LLaMA/Qwen/DeepSeek 等模型广泛采用，支持更灵活的长度外推 |

### 李宏毅《解剖大型语言模型》— Attention 的直觉解释

> 来源：[LH25F] 第 3 讲《LLMunderstand》课件 · [视频](https://youtu.be/8iFvM7WUUs8)

**[Fact] 李宏毅用"两颗青苹果"讲 Attention 机制：**

```text
Attention 要做两件事：
  1. 寻找输入中"会影响「果」的意思"的 Token
  2. 把这些 Token 的信息加进来

例子："两 颗 青 蘋 果"

对 "果" 这个字做 Attention：
  果 × W_q → query（"我在找什么"）
  青 × W_k → key  （"我有什么"）
  dot product(query, key) = 2.5    ← 高分！"青"对"果"的含义有影响

  颗 × W_k → key
  dot product(query, key) = -0.5   ← 低分！"颗"影响不大

→ 结论：Attention 就是让模型决定"这个词该多关注前面哪个词"
→ "青苹果"和"水果"里的"果"含义不同，就是因为 Attention 看了不同的上下文
```

**[Fact] 层层递进——每一层把 Embedding 变得"更理解上下文"：**

```text
Token Embedding（查表得到的初始向量）：
  "苹果"的两次出现 → 相同的 Embedding（还没看上下文）

经过 Layer 1 后（Contextualized Embedding）：
  "苹果使用…"中的"苹果" → 开始像 iPhone
  "来吃苹果…"中的"苹果" → 开始像水果

→ 同一个 Token，经过不同上下文后，Embedding 就不同了！
```

**[Fact] 模型最后怎么输出下一个词——LM Head 和 "首尾呼应"：**

```text
最后一层输出的向量 → LM Head（= Embedding Table 的转置）→ 和每个 Token 的 Embedding 做 dot product
→ 分数最高的那个 Token 就是"最可能的下一个词"

这就叫"首尾呼应、以始为终"：
  输入端的 Embedding 把词变成向量，
  输出端的 LM Head 就是反过来看"这个向量最像哪个词"
```

**[Fact] 有趣的发现——Logit Lens（用透镜偷看模型的思考过程）：**

李宏毅介绍了 Logit Lens 技术：对每一层中间结果都做一次 Unembedding（反查词表），可以看到**模型在每一层"想到了什么"**。比如做翻译 "fleur → 花" 时，LLaMA 2 在中间层可能先走英文思路，后面几层才转成中文输出。

**[Fact] 拒绝向量（Refusal Vector）——Representation Engineering：**

模型在某一层的中间结果中包含"拒绝成份"。把"拒绝请求"和"不拒绝"两类场景的中间向量取平均再相减，就可以提取出一个**拒绝向量**。把它加到正常请求上 → 模型开始拒绝；减掉 → 模型不再拒绝。这说明模型内部确实学到了可解释的语义方向。

**[Fact] 每层 Attention Head 各司其职——现场解剖 Gemma/Llama：**

李宏毅在 Colab 中现场查看了从第 1 层到第 34 层的 Attention 模式：**"每一层的 Attention Head 做的事情都不太一样。"** 早期层偏向语法和局部关系，后期层偏向语义和全局推理。这为多头注意力的设计动机提供了**实验级证据**。

> **📚 完整知识包：** [LH25F_03_llm_understand.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/knowledge/LH25F_03_llm_understand.md)

---

### 第一性原理：为什么单头注意力不够？

> ⚠️ 从 D02 的单头出发，逐层往上搭建。

**Layer 0 — 回忆 D02：单头注意力做了什么**

D02 学过：一个注意力头用 Q×K^T 算出"谁关注谁"的分数，然后用这个分数对 V 加权求和。**但一个头只能学到一种"关注模式"。**

**Layer 1 — 问题：语言中有多种关系需要同时捕捉**

看这句话："The cat sat on the mat because **it** was comfortable."

- "it" 要关注 "mat"（语义指代——坐着舒服的是 mat）
- "sat" 要关注 "cat"（主语-谓语关系——谁在坐？）
- "on" 要关注 "mat"（介词-宾语关系——坐在哪？）

**[Fact] 一个注意力头倾向于学习一种关系模式。** 如果你只有 1 个头，模型很难同时捕捉语法关系、语义指代、位置邻近等多种维度的信息。

**Layer 2 — 解法：Multi-Head Attention = 多个头各看一种关系，最后合并**

把 d_model 维的向量拆成 h 个子空间，每个子空间独立做一次 Attention，最后把结果拼起来：

```
head_1 = Attention(Q × W_Q1, K × W_K1, V × W_V1)   ← 可能学"主语-谓语"
head_2 = Attention(Q × W_Q2, K × W_K2, V × W_V2)   ← 可能学"指代关系"
...
head_h = Attention(Q × W_Qh, K × W_Kh, V × W_Vh)   ← 可能学"位置邻近"

MultiHead = Concat(head_1, ..., head_h) × W_O
```

**[Fact] 每个头有自己独立的 W_Q, W_K, W_V 参数，所以能学不同的注意力模式。**

**Layer 3 — 完整理解**

**[Fact] 面试级一句话：** Multi-Head Attention performs Scaled Dot-Product Attention in parallel across multiple representation subspaces, then concatenates and linearly projects the results — with roughly the same parameter count as single-head attention (since d_k = d_model/h) but richer expressiveness.

**[Fact] 中文展开：** Multi-Head Attention 是"在多个不同的 Subspace（子空间）中并行执行 Scaled Dot-Product Attention，然后 Concatenate（拼接）结果并通过 Linear Projection（线性投影）W_O 映射回原始维度"。参数总量和单头基本相同（因为每个头的维度 d_k = d_model/h），但表达能力更强。

---

### 怎么做到的？— 四个关键组件

#### 组件 1：多头注意力（Multi-Head Attention）

**计算过程：**

```python
# 假设 d_model=512, h=8 个头, 每头 d_k = d_v = 512/8 = 64

# 1. 每个头独立计算
for i in range(h):
    Q_i = X @ W_Qi   # [n, 512] × [512, 64] = [n, 64]
    K_i = X @ W_Ki
    V_i = X @ W_Vi
    head_i = softmax(Q_i @ K_i.T / sqrt(64)) @ V_i   # [n, 64]

# 2. 拼接所有头
concat = [head_1 | head_2 | ... | head_8]   # [n, 512]

# 3. 线性投影
output = concat @ W_O   # [n, 512] × [512, 512] = [n, 512]
```

**[Fact] 关键细节：** 实际实现中不会真的用 for 循环，而是把所有头的 W 合并成一个大矩阵，一次矩阵乘法搞定（效率和单头一样）。

#### 组件 2：位置编码（Positional Encoding）

**问题：** D02 的 Self-Attention 里，打乱词序后结果不变（因为 Q×K^T 只看向量相关度，不看位置）。但 "我喜欢你" 和 "你喜欢我" 意思完全不同。

**[Fact] 解法：给每个位置加一个固定的"位置信号"，让模型能区分不同位置。**

原始 Transformer 用的是正弦/余弦函数：

```python
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

**[Analogy] 把它想象成一个"刻度尺"：** 每个位置有一个独特的刻度组合，就像 GPS 坐标一样。偶数维用 sin，奇数维用 cos，频率逐渐降低——高频编码精细位置，低频编码粗略位置。

**[Fact] 加法而非拼接：** 位置编码通常是**加到**词向量上的（`X + PE`），不是拼接。这样做的直接好处是：**不增加向量维度、实现简单、工程上已被大量模型验证有效**。例如教学实现 [ch04.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/ch04.py#L97) 和 GPT 类实现 [model.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L177) 都是直接把 token embedding 和位置表示相加。

**[Fact] 现代模型已基本不用 sinusoidal PE：** LLaMA、Qwen、DeepSeek 用 RoPE（旋转位置编码），它在注意力计算时直接旋转 Q 和 K，更灵活且支持长度外推。D04/N04 会详细讲。

#### 组件 3：残差连接（Residual Connection）

**问题：** 网络层数多了之后，信号经过多次变换会退化（深层输出反而不如浅层）。

**[Fact] 解法：** 把每一层的输入直接"跳过"该层，加到输出上：

```python
# 原始 Transformer 论文（Post-Norm）常见写法
output = LayerNorm(x + SubLayer(x))
#        ↑ 归一化   ↑ 原始输入直接加上来
```

**为什么有效？**
- **[Fact]** 残差连接来自 He et al. 2015 的 ResNet。核心洞察：让网络学习"增量"（`SubLayer(x)`）比学习"完整映射"更容易
- **[Fact]** 梯度可以完整地通过"跳跃通道"传回去，避免深层梯度消失（和 D01 的梯度直接相关）
- **[Analogy]** 像一条高速公路旁边有普通道路。高速路（残差）保证信息一定能到达，普通道路（SubLayer）负责加工信息

#### 组件 4：Masked Attention（因果遮蔽）

**问题：** GPT 是"自回归"模型——逐个生成下一个词。生成第 5 个词时，不能偷看第 6、7、8 个词（因为它们还没生成）。

**[Fact] 解法：** 在计算注意力分数时，用一个三角形的 mask 把"未来位置"的分数设为 −∞：

```
                 pos1  pos2  pos3  pos4
query pos1  [  ok    -∞    -∞    -∞  ]
query pos2  [  ok    ok    -∞    -∞  ]
query pos3  [  ok    ok    ok    -∞  ]
query pos4  [  ok    ok    ok    ok  ]
```

softmax(−∞) = 0，所以未来位置的 V 权重为 0，等于"看不到"。

**[Fact]** 这就是为什么 GPT 叫 "decoder-only" 模型——它用的是带 causal mask 的注意力。而 BERT 用的是不带 mask 的（能看到前后所有词），所以叫 "encoder-only"。

---

### 为什么需要它们？— 设计动机汇总

| 组件 | 解决什么问题 | 如果没有它会怎样 |
|------|------------|----------------|
| **Multi-Head** | 只能捕捉一种关系模式 | 模型对复杂语义的理解能力大幅下降 |
| **Positional Encoding** | Attention 不知道词序 | "我喜欢你" = "你喜欢我"，模型分不清 |
| **Residual Connection** | 深层网络信号退化 | 超过 6 层就训不动，GPT-3 的 96 层不可能 |
| **LayerNorm** | 各层数值范围不一致 | 训练不稳定，loss 震荡或发散 |
| **Causal Masking（因果遮蔽）** | 生成时看到未来词 | 模型"作弊"，不能真正学会生成 |

---

### 举例 + 发散

#### 一个完整的 Transformer Block（可以画下来）

```text
原始 Transformer 论文版 Block（Post-Norm）

输入 x (词向量 + 位置编码)
 │
 ├──────────────────────╮
 ↓                      │ (残差)
[Multi-Head Attention]   │
 ↓                      │
 + ←────────────────────╯
 ↓
[LayerNorm]
 │
 ├──────────────────────╮
 ↓                      │ (残差)
[Feed-Forward Network]   │
 ↓                      │
 + ←────────────────────╯
 ↓
[LayerNorm]
 ↓
输出 (送入下一个 Block)
```

**[Fact] 这张图对应的是原始论文里常见的 Post-Norm 画法。** 如果你想对照现代 GPT 风格实现，更常见的是 Pre-Norm：

```text
现代 GPT / nanoGPT 常见 Block（Pre-Norm）

输入 x
 │
 ├──────────────────────╮
 ↓                      │
[LayerNorm]             │
 ↓                      │
[Causal Multi-Head Attention]
 ↓                      │
 + ←────────────────────╯
 │
 ├──────────────────────╮
 ↓                      │
[LayerNorm]             │
 ↓                      │
[Feed-Forward Network]
 ↓                      │
 + ←────────────────────╯
 ↓
输出
```

**[Fact] 本地实现证据：** [model.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L103) 采用 `x = x + self.attn(self.ln_1(x))` 和 `x = x + self.mlp(self.ln_2(x))`，这是典型 Pre-Norm；教学实现 [ch04.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/ch04.py#L64) 也是 Pre-Norm。

#### 数值例子：多头拆分

假设 d_model = 8，h = 2 个头：

```text
原始向量 x = [0.1, 0.3, -0.2, 0.5, 0.4, -0.1, 0.2, 0.6]

头1 处理: x 的前 4 维 → d_k = 4
  Q1 = [0.1, 0.3, -0.2, 0.5] @ W_Q1   → 在 4 维子空间里做 attention

头2 处理: x 的后 4 维 → d_k = 4
  Q2 = [0.4, -0.1, 0.2, 0.6] @ W_Q2   → 在另一个 4 维子空间里做 attention

拼接: output = [head1_out | head2_out]   → 回到 8 维
投影: final = output @ W_O              → [8] 维输出
```

**[Fact] 注意：** 实际实现不是"切片"，而是用不同的 W 矩阵把同一输入投影到不同子空间。上面的"前 4 维 / 后 4 维"只是为了直觉理解。

#### 数值例子：位置编码

假设 d_model = 4，看前 3 个位置的 PE：

```text
pos=0:  [sin(0), cos(0), sin(0), cos(0)]           = [0.00, 1.00, 0.00, 1.00]
pos=1:  [sin(1), cos(1), sin(0.01), cos(0.01)]     ≈ [0.84, 0.54, 0.01, 1.00]
pos=2:  [sin(2), cos(2), sin(0.02), cos(0.02)]     ≈ [0.91, -0.42, 0.02, 1.00]
```

每个位置的编码都不同，模型可以用这些差异来感知"这个词在第几个位置"。

---

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions." — Vaswani et al., 2017 §3.2.2 | 多头的好处：让模型能同时在不同子空间里关注不同位置的信息。一个头学语法，另一个头学语义，各司其职。 |
| "Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens." — §3.5 | 作者自己说了：Transformer 没有循环也没有卷积，所以必须额外注入位置信息，否则模型不知道词序。 |
| "We employ a residual connection around each of the two sub-layers, followed by layer normalization." — §3.1 | 每个子层（attention 和 FFN）都包了一层残差 + LayerNorm。这是让深层网络能训练的关键。 |

---

### 📚 本地参考实现（强事实依据）

> 下面这些不是“额外资料”，而是你本地 `user/reference/repos` 里能直接对照的实现证据。

| 主题 | 本地实现 | 能证明什么 |
|------|---------|-----------|
| **GPT 的 causal mask** | [model.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L48) | 用下三角 mask 限制只能看左侧上下文 |
| **GPT 的 Pre-Norm Block** | [model.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L103) | 现代 GPT 类实现常用 `x = x + sublayer(LN(x))` |
| **GPT-2 的 learnable position embedding** | [model.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L127) | `wte` 是 token embedding，`wpe` 是位置 embedding |
| **教学版 token + position 相加** | [ch04.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/ch04.py#L97) | 位置表示直接与 token embedding 相加 |
| **现代模型里的 RoPE 与 mask** | [qwen3.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/kv_cache_batched/qwen3.py#L177) | 现代实现会对 Q/K 应用 RoPE，并用 `masked_fill(-inf)` 做 mask |

---

### 这几个概念不要混

- **Multi-Head Attention ≠ 多次单头 Attention**：多头是在不同子空间并行做 attention 再拼接，不是重复做同一个 attention
- **位置编码 ≠ 位置嵌入**：原始 Transformer 用固定的 sinusoidal 函数（位置编码），GPT-2 用可学习的位置嵌入（learnable PE），RoPE 是在 Q/K 上做旋转
- **Pre-Norm ≠ Post-Norm**：原始论文是 Post-Norm（`LayerNorm(x + SubLayer(x))`），但 GPT-2/3 和多数现代模型改用 Pre-Norm（`x + SubLayer(LayerNorm(x))`），训练更稳定
- **Encoder 的 Attention ≠ Decoder 的 Attention**：Encoder 可以看到全部位置（双向），Decoder 用 causal mask 只看过去（单向）
- **Causal Mask ≠ Padding Mask**：Causal mask 遮住未来词（GPT），Padding mask 遮住补齐的空白位置（处理变长序列）

---

### 🎤 面试追问链

```
Q1: 什么是 Multi-Head Attention？为什么要"多头"？
→ 答: 把 attention 拆成 h 个子空间并行计算再拼接。多头让模型
      能同时捕捉不同类型的关系（语法、语义、位置等）。
  Q1.1: 多头的参数量是不是变多了？
  → 答: 基本没变。d_model=512, h=8 时，每头 d_k=64。
        8 个 [512,64] 矩阵 = 1 个 [512,512] 矩阵，参数量相同。
    Q1.1.1: 头数 h 怎么选？
    → 答: 头数是模型设计超参数，没有“必须等于层数”的通则。
          例如 GPT-2 small 是 12 层 12 头，但 medium 是 24 层 16 头，
          large 是 36 层 20 头。看模型规模、head_dim 和训练稳定性来定。

Q2: Transformer 怎么知道词序？
→ 答: 通过位置编码。原始 Transformer 用 sinusoidal 函数，
      现代模型如 LLaMA 用 RoPE（旋转位置编码）。
  Q2.1: 为什么是"加"到词向量上，而不是拼接？
  → 答: 加法不增加维度，且模型可以学会把位置信息和语义信息
        在不同维度上分开。拼接会增加维度和计算量。
    Q2.1.1: RoPE 和 sinusoidal 有什么区别？
    → 答: Sinusoidal 是绝对位置编码，加在输入层。
          RoPE 在 Q/K 上做旋转，编码相对位置，支持长度外推。
          这个 D04/N04 会详细讲。

Q3: GPT 为什么只能看到前面的词？
→ 答: 因为 GPT 是自回归生成模型，逐个生成下一个词。
      用 causal mask 把未来位置的分数设为 −∞，softmax 后权重=0。
  Q3.1: BERT 和 GPT 的 Attention 有什么区别？
  → 答: BERT 是双向的（能看前后，encoder-only），
        GPT 是单向的（只看前面，decoder-only + causal mask）。
    Q3.1.1: 为什么不都用双向？
    → 答: 双向不能做生成任务（生成时后面的词还不存在）。
          GPT 的单向设计天然适合生成，BERT 适合理解/分类。
```

---

### 关键概念清单

- [ ] **Multi-Head Attention**：在多个子空间并行做 attention 再拼接，捕捉多种关系
- [ ] **头数 h 与 d_k 的关系**：d_k = d_model / h，参数总量基本不变
- [ ] **Positional Encoding**：给每个位置加一个唯一的信号，让模型知道词序
- [ ] **Sinusoidal PE**：用 sin/cos 函数生成固定位置编码
- [ ] **RoPE**：现代主流方案，在 Q/K 上旋转，编码相对位置
- [ ] **残差连接**：x + SubLayer(x)，让梯度直通、深层可训练
- [ ] **LayerNorm**：归一化数值范围，稳定训练
- [ ] **Pre-Norm vs Post-Norm**：现代模型多用 Pre-Norm
- [ ] **Masked/Causal Attention**：遮住未来位置，用于自回归生成
- [ ] **Transformer Block**：MHA + FFN + 残差 + Norm 的完整单元

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Build GPT | https://www.youtube.com/watch?v=kCc8FmEb1nY | 40:00-1:40:00 多头 + 位置 + Block |
| 原始论文 §3.2-§3.5 | https://arxiv.org/abs/1706.03762 | Fig.2 Multi-Head + §3.5 位置编码 |
| Jay Alammar 图解 | https://jalammar.github.io/illustrated-transformer/ | Multi-Head 可视化部分 |
| RoPE 原始论文 | https://arxiv.org/abs/2104.09864 | Su et al., 如需深入 N04 |
| **[LH25F] 李宏毅《解剖大型语言模型》** | https://youtu.be/8iFvM7WUUs8 | 第 3 讲 — 两颗青苹果讲 Attention + Logit Lens + 拒绝向量（上方已提炼核心内容） |
| **[LH25] 李宏毅 Model Inside** | https://youtu.be/Xnil63UDW2o | 深入解剖模型内部机制，神经元分析 |
| **[LH25] 李宏毅 Mamba** | https://youtu.be/gjsdVi90yQo | Transformer 的竞争者们 |

---

## 🧠 与 Muse/项目 的映射

先把"仓库里的本地代码"和"远端模型内部"分开：

- **[Fact] 本地代码实际做的事：** [engine.mjs](/Users/xulater/Code/assistant-agent/muse/src/core/engine.mjs#L107) 到 [engine.mjs](/Users/xulater/Code/assistant-agent/muse/src/core/engine.mjs#L125) 的 `#buildPayload` 和发送逻辑负责组装消息 payload（text + model + system prompt），通过 HTTP 发给模型服务。它不涉及 attention 计算。
- **[Fact] 远端模型内部做的事：** 你调用的 Claude/GPT 在服务端推理时，才会执行今天学的多头注意力、位置编码、残差连接等计算。每一层 Transformer Block 都在做这些操作。
- **[Infer] 为什么 Agent 开发者要懂这个：**
  - **System Prompt 的位置效应：** system prompt 在序列开头，通过 causal mask，它影响后续所有 token 的注意力。理解 mask 机制就能理解为什么 system prompt 放开头最有效。
  - **多头 → 多维度理解：** 模型能同时理解你 prompt 中的指令意图、格式要求、语境信息，靠的就是多头注意力在不同子空间里分别捕捉这些信息。
- **[Fact] 和明天内容的关系：** D04 把 Block 堆起来 + 加 Embedding 层 + 加输出头 = 完整 GPT 架构。

---

## ✅ 自检清单

- [ ] 能画出一个完整的 Transformer Block 结构图（MHA → Add&Norm → FFN → Add&Norm）
- [ ] 能解释为什么多头不增加参数量（d_k = d_model/h）
- [ ] 能说出位置编码的作用 + 为什么要用"加法"
- [ ] 能分清 sinusoidal PE / learnable PE / RoPE 三种方式
- [ ] 能说出残差连接解决什么问题（信号退化 + 梯度直通）
- [ ] 能解释 causal mask 的工作方式（未来位置→-∞→softmax=0）
- [ ] 能分清 GPT（decoder, causal）和 BERT（encoder, 双向）的区别
- [ ] 能分清 Pre-Norm 和 Post-Norm
- [ ] 能分清 causal mask 和 padding mask
- [ ] 能扛住 3 条面试追问链各 3 层

### 面试题积累（2 题）

**Q1: 请解释 Multi-Head Attention 的工作原理和设计动机**

> 你的回答：___
>
> 参考：从"一个头只能学一种模式"出发 → 拆成 h 个子空间 → 并行 attention → 拼接投影 → 参数量不变但表达力更强

**Q2：请画出一个 Transformer Block 的完整结构并解释每个组件的作用**

> 你的回答：___
>
> 参考：Input → MHA → 残差+Norm → FFN → 残差+Norm → Output。残差=梯度直通，Norm=数值稳定，MHA=多维关系捕捉，FFN=非线性变换

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
