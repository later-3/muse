# D01 — N01 反向传播与自动微分

> **日期：** 2026-04-08（Tue）
> **路线图位置：** Week 1 · Day 1 · N01 反向传播
> **定位：** 🟩 概念级（1h，理解即可）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **反向传播是什么？** 一句大白话讲清
2. **梯度怎么倒推的？** 链式法则的核心思想
3. **和 Agent 有什么关系？** Muse 背后的 LLM 就是靠反向传播训练出来的

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy Micrograd (2h37min) 中提炼的核心知识。
> 你读完这一节就掌握了反向传播，不需要看完整视频。

### 🌍 背景：为什么要学这个？

**你现在在哪：** 这是 6 周路线的第 1 天。你即将进入大模型的世界，而大模型（GPT/Claude/Gemini）的训练全部依赖反向传播。

**技术栈位置：**
```
Layer 0: 数学根基 ← 反向传播在这里（N01）
Layer 2: Transformer ← 明天学（N02），它的参数靠反向传播训练
Layer 3: 训练管线 ← D05-D06 学（N06），整个流程建立在反向传播之上
```

**前置知识：** 不需要任何前置知识。反向传播是从零开始的第一块积木。

**和 Agent 的关系：** 你做的 Muse Agent 调用 LLM → LLM 的所有能力都是训练出来的 → 训练的核心引擎就是反向传播。**不理解这个，后面的一切都是空中楼阁。**

### 第一性原理：反向传播到底是什么？

**一句话：反向传播就是"从结果倒推原因"——告诉每个参数"你应该往哪个方向调、调多少，才能让输出更接近正确答案"。**

想象你在调一台复杂的混音器，有 100 个旋钮（参数），最终输出一段音乐（预测）。你听了觉得不对（和正确答案有差距），现在你需要知道：**每个旋钮应该往左拧还是往右拧、拧多少？**

反向传播就是一种高效算法，能一次性算出所有 100 个旋钮的调整方向和幅度。

---

### 怎么做到的？— 机制详解

#### Step 1：前向传播（Forward Pass）

给一个输入，让它"流过"整个网络，每一层做计算，最终得到一个输出。

```
输入 x → [权重w1 × x + 偏置b1] → ReLU → [权重w2 × ... ] → 输出 ŷ
```

这一步就是普通的函数计算，没什么特别的。

#### Step 2：计算损失（Loss）

把模型的输出 ŷ 和正确答案 y 做对比，算出一个数字"差了多少"：

```
Loss = (ŷ - y)²
```

Loss 越大 = 模型越差，Loss = 0 = 完美预测。

#### Step 3：反向传播（Backward Pass）— 核心

从 Loss 出发，**沿着计算图往回走**，计算每个参数对 Loss 的"贡献度"。这个贡献度就是**梯度（Gradient）**。

```
Loss → 计算 ∂Loss/∂w2 → 计算 ∂Loss/∂w1 → 计算 ∂Loss/∂b1
                ↑                ↑                ↑
           w2 的梯度         w1 的梯度         b1 的梯度
```

**梯度的含义：** w1 变化一丁点（比如 +0.001），Loss 会变化多少？如果梯度 = 3.0，意味着 w1 增加 0.001，Loss 大约增加 0.003。

#### Step 4：更新参数（Gradient Descent）

知道了每个参数的梯度后，朝**梯度的反方向**微调参数：

```python
w1 = w1 - learning_rate × gradient_w1
```

为什么是反方向？因为梯度告诉你"往哪走 Loss 会增大"，那反方向自然 Loss 减小。

#### 核心魔法：链式法则（Chain Rule）

神经网络是一连串函数的嵌套：`f(g(h(x)))`。链式法则说，整体的梯度 = 每一步的局部梯度**相乘**：

```
∂Loss/∂x = ∂Loss/∂f × ∂f/∂g × ∂g/∂h × ∂h/∂x
```

> **类比（仅类比）：** 像一条传输链上的齿轮。最后一个齿轮（Loss）转了一圈，通过齿轮比（局部梯度），可以算出第一个齿轮（输入参数）转了多少。每个齿轮只需要知道自己的齿轮比，不需要知道整条链。

---

### 为什么需要它？— 设计动机

**没有反向传播会怎样？**

如果有 1 亿个参数，你想知道每个参数的梯度：
- **笨方法（数值微分）：** 每个参数微调一下，跑一次前向传播，看 Loss 变了多少。1 亿个参数 = 跑 1 亿次前向传播 → **不可能**
- **反向传播：** 只需要跑 1 次前向 + 1 次反向 = 2 次计算 → **O(1) 的成本获得所有梯度**

这就是反向传播的革命性：**计算成本几乎不随参数数量增长**。所以才能训练数十亿参数的 GPT。

**历史节点：**
- 1986 年 Rumelhart/Hinton 在 Nature 发表反向传播论文
- 此后所有深度学习（CNN/RNN/Transformer/GPT）都基于此训练

---

### 举例 + 发散

#### Karpathy 的 Micrograd 例子

Karpathy 用 Python 实现了一个极简的自动微分引擎，核心只有一个 `Value` 类：

```python
class Value:
    def __init__(self, data):
        self.data = data        # 这个节点的数值
        self.grad = 0.0         # 这个节点的梯度（反向传播后填充）
        self._backward = lambda: None  # 反向传播时执行的函数
        self._prev = set()      # 这个节点由哪些节点计算而来

    def __mul__(self, other):
        out = Value(self.data * other.data)
        # 乘法的局部梯度：∂(a×b)/∂a = b, ∂(a×b)/∂b = a
        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out
```

**核心洞察：** 每个运算（加/乘/ReLU）在前向计算时，顺便记录下"怎么算反向的梯度"。这就叫**自动微分（Autograd）**——PyTorch 的核心就是这个思想的工业级实现。

#### 具体数字

假设一个超简单的网络：`y = w × x`，其中 x=2, w=3, 正确答案=10

```
前向：y = 3 × 2 = 6
损失：Loss = (6 - 10)² = 16
梯度：∂Loss/∂w = 2 × (6-10) × x = 2 × (-4) × 2 = -16
更新：w = 3 - 0.01 × (-16) = 3.16   ← w 变大了，因为 y 之前太小
```

再算一次：y = 3.16 × 2 = 6.32，Loss = (6.32-10)² = 13.5 → **Loss 确实变小了！**

---

### 📜 原文对照（关键论文/博客引用）

| 📄 原文 | 🗣️ 大白话 |
|---------|----------|
| "We describe a new learning procedure, back-propagation, for networks of neurone-like units." — Rumelhart, Hinton, Williams, Nature 1986 | 1986 年，Hinton 等人首次系统描述了反向传播算法。这篇 Nature 论文开启了神经网络的现代训练时代。 |
| "The key insight is that the chain rule can be used to compute the gradient of the loss with respect to any weight in the network." — Karpathy, Micrograd 视频 | 链式法则是整个反向传播的数学基础：不管网络多深多复杂，梯度都能通过"局部梯度相乘"一步步传回去。 |
| "What I cannot create, I do not understand." — Richard Feynman（Karpathy 在 Micrograd 开头引用） | Karpathy 引用费曼这句话解释他为什么要从零实现反向传播——只有自己写出来才算真正理解。这也是你做 OC 任务的意义。 |
| "Autograd — automatically computing gradients — is what makes modern deep learning possible." — PyTorch 文档 | 自动微分不是学术玩具，它是 PyTorch/TensorFlow 的核心引擎。你调用 `loss.backward()` 时，底层就在做 Karpathy Micrograd 展示的那些事。 |

---

### 关键概念清单

- [ ] **前向传播**：给输入，算输出，就是正常的函数计算
- [ ] **损失函数（Loss）**：衡量"模型输出和正确答案差多远"的数字
- [ ] **梯度（Gradient）**：某个参数变一丁点，Loss 会变多少
- [ ] **链式法则**：复杂函数的梯度 = 每一步的局部梯度相乘
- [ ] **自动微分（Autograd）**：让计算机自动算梯度，不需要手推公式

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Micrograd | https://www.youtube.com/watch?v=VMj-3S1tku0 | 0:00-20:00 直觉 + 1:30:00-2:00:00 反向传播 |
| 3Blue1Brown 反向传播 | https://www.youtube.com/watch?v=Ilg3gGewQ5U | 全程动画讲解，15min |
| Micrograd 代码 | https://github.com/karpathy/micrograd | engine.py 只有 100 行 |

---

## 🧠 与 Muse/项目 的映射

- **Muse 的 LLM 大脑**（`src/core/engine.mjs` 调用的模型）就是靠反向传播训练出来的。理解训练过程 = 理解模型的能力边界和成本
- **为什么 LLM 训练要烧钱：** GPT-4 有万亿级参数，每个都要算梯度。但反向传播的效率让这成为可能（否则根本训不出来）
- **明天 N02 Transformer：** Attention 层里的 Q/K/V 矩阵就是靠今天学的反向传播训练出来的参数

---

## ✅ 自检清单

- [ ] 能一句话解释"反向传播就是从结果倒推每个参数该怎么调"
- [ ] 能说出梯度的含义："参数变一点点，Loss 变多少"
- [ ] 能讲清链式法则为什么是"小梯度相乘"
- [ ] 能解释为什么反向传播比"一个一个试"快（O(1) vs O(N)）
- [ ] 能说 Karpathy `Value` 类的三个核心属性（data / grad / _backward）

### 面试题积累（1 题）

**Q: 反向传播的核心思想是什么？它解决的关键问题是什么？**

> 你的回答：___
>
> 参考答案要点：核心=利用链式法则从输出往回传播梯度；关键问题=高效计算所有参数的梯度（O(1)次前向+反向 vs O(N)次数值微分）

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
