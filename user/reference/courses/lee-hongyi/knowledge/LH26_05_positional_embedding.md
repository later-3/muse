# LH26_05 — Positional Embedding

> **来源：** [LH26] 李宏毅 ML 2026 Spring
> **视频：** https://youtu.be/Ll-wk8x3G_g（~90min）
> **课件：** slides_text/LH26_positional_embedding.txt
> **N 节点映射：** N04 位置编码 → D26 (未来 0503-positional-encoding)
> **提炼时间：** 2026-04-09

---

## 核心教学内容提炼

### 1. 为什么需要 Positional Embedding

[Fact] 李宏毅从第一性原理出发：

> "原来的 Transformer 是没有办法考虑输入 Token 的顺序的！为什么？因为 Self-Attention 的计算过程是：每个 Embedding 分别乘上 Q/K/V 矩阵，然后做内积——**这个过程完全没有用到位置信息**。你把输入的 Token 打乱顺序，算出来的结果是一样的。"

### 2. Sinusoidal PE — 最早的方案

[Fact] Attention is All You Need 论文中的方案：

> "用 sin 和 cos 函数生成位置编码，每个位置有一个唯一的向量。优点是对任意长度的序列都有定义，不需要学习。"

### 3. ALiBi — 简单粗暴但极其有效

[Fact] 李宏毅对 ALiBi 的评价极高：

> "ALiBi 非常神奇！它只在 512 个 Token 上训练，却可以被用在更长的 Sequence 上——而且比 Sinusoidal 在更长 Sequence 上直接训练的结果还要好。"

> "ALiBi 是全面辗压 Sinusoidal。就算它训练在比较短的 Sequence 上，都可以直接举一反三、以此类推外推到更长的 Sequence 上。"

ALiBi 的原理：不加到 Embedding 上，而是直接在 Attention Score 上加一个线性偏置，距离越远偏置越大（衰减越多）。

### 4. RoPE — 当前主流的选择

[Fact] RoPE (Rotary Position Embedding) 是目前 GPT/Llama/Gemma 等使用的方案：

> "RoPE 的思路是对 Q 和 K 做旋转——不同位置旋转不同角度。这样内积的结果自然包含了相对位置信息。"

但 RoPE 有一个问题：

> "为什么 RoPE 在没有看过的长 Sequence 上会失败？因为训练时没给过一定长度以上的位置编码，模型内部从来没'见过'那些大角度的旋转。"

### 5. 佛经类比 — No Positional Embedding

[Fact] 全课最精彩的结尾：

> "就像佛经说的——**佛法就像一条船，这个船载着我们从此岸到彼岸，但到了对岸以后就要把那个船放下**。Positional Embedding 也是一样的：训练的时候需要它来帮助模型学习，训练到一定程度以后居然**要丢掉它**！没有 Positional Embedding 的限制，模型反而可以看更长的 Sequence。"

这暗示了位置编码可能是一个"训练辅助轮"，而非终极方案。

---

## PE 方案对比

| 方案 | 位置信息编入方式 | 外推能力 | 当前状态 |
|------|---------------|---------|---------|
| Sinusoidal | 加到 Embedding | 差 | 已被淘汰 |
| Learned PE | 通过训练学习 | 差（依赖训练长度） | 少用 |
| ALiBi | Attention Score 线性偏置 | **极强** | 简单场景用 |
| RoPE | Q/K 旋转 | 中等（需额外适配） | **当前主流** |
| No PE | 训练后移除 | 实验性 | 前沿研究 |

## 关键引用

| 李宏毅原话 | 大白话 |
|----------|--------|
| "Self-Attention 完全没有用到位置信息" | 这就是为什么需要额外的位置编码 |
| "ALiBi 全面辗压 Sinusoidal" | 简单的线性偏置比精心设计的编码更好 |
| "训练时没'见过'那些大角度旋转" | RoPE 外推失败的直觉解释 |
| "到了对岸以后就要把船放下" | PE 可能只是训练辅助，不是终极需要 |
