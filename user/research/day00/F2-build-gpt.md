# F2: Let's build GPT from scratch — Karpathy

> **来源：** Andrej Karpathy YouTube (2023.01) · ~2h
> **一句话：** 从零用 Python 写一个 GPT，理解 Transformer 每一层在做什么。

---

## ⚡ 3 分钟速读版

```
一句话: Transformer = Tokenizer + Embedding + Self-Attention + FFN + 输出层
3 个关键概念: Self-Attention 机制 / 位置编码 / 训练过程(loss + backprop)
对 Muse 最重要的: 理解 attention 才能理解"上下文窗口"为什么是 Agent 的瓶颈
面试必记: "Attention 让每个 token 都能直接看到序列中的其他所有 token"
```

---

## 🔬 核心原理（三栏表）

| 概念 | 能力来源 | 激活方式 | 类比（仅类比） |
|------|---------|---------|--------------|
| **Self-Attention** | 架构设计（Vaswani 2017）：Q/K/V 矩阵学习 token 间关系 | 前向传播时自动计算，不需要工程干预 | 仅类比：像开会时每个人决定听谁的更重要 |
| **Positional Encoding** | 训练时学习每个位置的编码向量 | 在 embedding 层加入位置信息 | 仅类比：像给座位编号，不然模型分不清前后 |
| **Tokenization** | BPE 算法在训练语料上学习常用子词 | 输入文本 → BPE 切分 → token ID 序列 | 仅类比：像把文章拆成"常用词块" |

---

## 1. Transformer 架构（从底到顶）

```
输入文本: "Muse 是一个 AI 伴侣"
    ↓
[Tokenizer] → [102, 534, 11, 2847, 8, 5521]   ← token ID 序列
    ↓                                            
[Embedding] → 每个 ID 查表变成一个向量 (d=768)   ← 学来的"意思"
    ↓ + Positional Encoding                      ← 加位置信息
[Self-Attention] × N 层                          ← 核心：token 之间互相看
    ↓
[Feed-Forward Network] × N 层                    ← 每个 token 独立变换
    ↓
[Output Layer] → 对词汇表每个 token 打分 → softmax → 概率
    ↓
预测: 下一个 token 最可能是 "引擎" (概率 0.6)
```

## 2. Self-Attention 是怎么工作的

这是 Transformer 最核心的机制。别被公式吓到，本质很简单：

```
每个 token 问三个问题：
  Q (Query):  "我在找什么信息？"
  K (Key):    "我有什么信息可以提供？"
  V (Value):  "如果你需要我的信息，这是具体内容。"

计算过程：
  1. 每个 token 用自己的 Q 和所有 token 的 K 做点积 → 得到"关注度"分数
  2. softmax 归一化 → 得到注意力权重（概率）
  3. 用权重加权求和所有 token 的 V → 得到这个 token 的新表示
```

**具体例子：**

```
输入: "小猫 坐在 垫子 上"

处理 "坐在" 时：
  "坐在" 的 Q 和所有 token 的 K 计算：
    "小猫" → 关注度 0.6  ← 坐在的主语很重要
    "坐在" → 关注度 0.1
    "垫子" → 关注度 0.2  ← 坐在的位置
    "上"   → 关注度 0.1

  最终 "坐在" 的新表示 = 0.6×V(小猫) + 0.1×V(坐在) + 0.2×V(垫子) + 0.1×V(上)
  → "坐在" 现在编码了"小猫在垫子上坐"的完整语义
```

> [!IMPORTANT]
> **Attention 的关键洞察：** 每个 token 都能直接"看到"序列中的所有其他 token。这就是为什么 Transformer 能处理长距离依赖（第 1 个词能直接影响第 1000 个词），而 RNN 做不到。

## 3. 为什么上下文窗口是瓶颈

Self-Attention 的计算量 = O(n²)，n 是序列长度。

```
n = 1000 tokens  → 100 万次计算  ✅ 很快
n = 10000 tokens → 1 亿次计算    ⚠️ 开始慢了
n = 100000 tokens → 100 亿次计算 🔴 非常慢+显存爆
```

这就是为什么：
- GPT-4 的上下文窗口是 128K（不是无限）
- OpenCode 需要 compaction（压缩旧消息）
- Muse 需要外部 memory（把信息存到 SQLite，不靠上下文窗口）

## 4. 训练过程

```
1. 准备数据: 海量文本切成 token 序列
2. 前向传播: 输入序列 → Transformer → 预测每个位置的下一个 token
3. 计算 Loss: 预测 vs 真实答案 → Cross-Entropy Loss
4. 反向传播: 计算每个参数的梯度 (backprop)
5. 更新参数: 梯度 × 学习率 → 调整参数 (Adam optimizer)
6. 重复 10^12 次
```

---

## 💼 面试必答

**Q: Transformer 的核心机制是什么？**
> Self-Attention。每个 token 通过 Q/K/V 矩阵计算与所有其他 token 的关注度权重，然后加权求和得到新表示。这让每个 token 都能直接看到完整序列，解决了 RNN 的长距离依赖问题。

**Q: 为什么 LLM 有上下文长度限制？**
> Self-Attention 的计算复杂度是 O(n²)，n 是序列长度。序列越长，计算量和显存需求指数增长。这就是为什么需要 compaction（压缩）和外部存储（向量 DB）来辅助。
