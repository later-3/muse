# D01 — N01 反向传播与自动微分

> **日期：** 2026-04-08（Wed）
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

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **参数（parameter）** | 模型里可以被调整的数字 | 像旋钮，调它会影响输出 | 初始化方法、参数分组 |
| **损失（loss）** | 模型输出和正确答案差多远 | 像“本次答题扣了多少分” | 各种复杂损失函数 |
| **梯度（gradient）** | 参数变一点，loss 会怎么变 | 像“往哪拧旋钮更接近正确答案”的提示 | 偏导的严格数学证明 |
| **计算图（computation graph）** | 把计算过程画成节点和箭头 | 像一张“这一步由哪几步算出来”的流程图 | 图优化、编译器实现 |
| **自动微分（autograd）** | 让程序自动把梯度算出来 | 你写前向，框架帮你补反向 | 动态图/静态图差异 |

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

**[Fact] 一句话：反向传播就是"从结果倒推原因"。它会告诉每个参数：你应该往哪个方向调、调多少，才能让输出更接近正确答案。**

想象你在调一台复杂的混音器，有 100 个旋钮（参数），最终输出一段音乐（预测）。你听了觉得不对（和正确答案有差距），现在你需要知道：**每个旋钮应该往左拧还是往右拧、拧多少？**

**[Fact]** 反向传播的关键价值，不是“凭空减少计算量”，而是**共享中间结果**，在一次反向过程中高效得到所有参数的梯度。

---

### 李宏毅的「找函式三步骤」框架

> 来源：[LH25F] 第 5 讲《BasicML》课件 · [视频](https://youtu.be/Taj1eHmZyWw)
>
> 李宏毅把整个机器学习过程提炼成**三个步骤**，用"预测课程时长"这个真实例子来讲：

**[Fact] 机器学习 = 从数据中找一个函式 f**

李宏毅的核心框架是"找函式步骤 3+1"：

```text
步骤一：我要找什么？ → 定义 Loss（衡量函式的好坏）
步骤二：我有哪些选择？ → 定义模型（候选函式的集合）
步骤三：选一个最好的   → Optimization（找 Loss 最低的那个函式）
+  验证（Validation）→ 检验是否在新数据上也好用
```

**[Fact] 他的真实例子——用投影片页数预测课程时长：**

```text
训练数据：过去 N 堂课的（页数, 时长）
模型：     y = w₁·x₁ + b         ← 只有两个待定参数 w₁ 和 b
Loss：     MSE = (1/N) Σ(yᵢ - ŷᵢ)²  ← 预测值和真实值的平方差的平均
优化：     Gradient Descent        ← 一步步调整 w₁ 和 b，让 Loss 变小
结果：     w₁* = 1.67, b* = 4.85    → y = 1.67·页数 + 4.85
```

**[Fact] 核心洞察 — Loss Surface（损失等高线图）：**

李宏毅画出了所有可能的 (w₁, b) 组合对应的 Loss 值的等高线图。每一个 (w₁, b) 的组合就是一个函式，Loss Surface 上的最低点就是"最好的函式"。**Gradient Descent 就是在这个曲面上"往下坡方向走"。**

```text
Loss Surface 等高线图:
         b ↑
           |   ╔═══╗
           |  ╔╝   ╚╗  Large Loss
           | ╔╝ ☆   ╚╗       ← ☆ = Global Minimum (最好的 w₁, b)
           | ╚╗     ╔╝  Small Loss
           |  ╚═══╝
           └────────────→ w₁
```

**[Fact] 梯度下降的直觉版——李宏毅的讲法：**

```text
在 Loss 曲线上某一点，左右各踏一小步：
  - 如果往右一小步让 Loss 变小 → 往右走
  - 如果往左一小步让 Loss 变小 → 往左走
  - 具体走多远？→ 切线斜率 × learning rate (η)
  - 更新公式：w₁¹ ← w₁⁰ - η · (∂L/∂w₁)
```

> **∂L/∂w₁ 的含义：** ∂ 读作"偏"（partial），∂L/∂w₁ 读作"L 对 w₁ 的偏导数"（partial derivative of L with respect to w₁）。物理含义是：**固定其他参数不变，w₁ 变化一点点，L 会变化多少。** 深度学习框架（如 PyTorch）能自动帮你算，不需要手动推公式。

**[Fact] 李宏毅踩过的坑——"概念很简单，做起来不容易"：**

| 问题 | 现象 | 李宏毅的经验 |
|------|------|-------------|
| Learning rate 太大 | Loss 震荡不收敛 | η=0.001 时能收敛但不够好 |
| Learning rate 太小 | 训练极慢，10000步 Loss 几乎没变 | η=0.0001 时 1000 步才微微下降 |
| Local Minimum | 卡在局部最低点，不是真正最好的 | 谁知道呢？到底该停还是继续前进 |
| Saddle Point | 梯度很小，但不是最低点 | 更糟——看起来像到了，其实没到 |

**[Fact] 从线性模型到深度学习——李宏毅的推导路径：**

```text
y = w₁x₁ + b                          ← 只能画直线（Linear Regression）
  ↓ 但数据可能不是直线怎么办？
y = b + Σ cᵢ·max(0, wᵢx₁ + bᵢ)      ← 用折线逼近任意曲线（ReLU）
  ↓ 每个 max(0, ...) 就是一个 Neuron
把多个 Neuron 排成一层 = Layer
把多个 Layer 堆起来 = Deep Learning
```

这就是为什么叫"深度学习"——**层数越多（越深），能拟合的函式越复杂。** 但同时也更容易 Overfitting（在训练数据上很好，在新数据上很差）。

**[Fact] 李宏毅的 Overfitting 经典类比——驾训班：**

> "有没有考过汽车驾照？在驾训班做训练就是训练过程，考驾照就是验证过程。正常学车应该看着路况来开。但有些人会**背轨道**——记住'到第二个锥形筒方向盘打两圈'。在驾训班得到满分，但到真正的道路上就完全不会开了。**这就是 Overfitting！**"

**[Fact] Lazy Function 例子——为什么函数范围不能太大：**

> 李宏毅构造了一个极端反例：一个函数在训练数据上看到的输入 → 输出正确答案，没看过的输入 → 一律输出 0。这个函数在训练集 loss=0（完美！），但在验证集上大爆炸。**"函数的选择范围是无限大的话，你很有机会找到这种函数。"**

**[Fact] Learning Rate 现场踩坑记录（Colab demo）：**

| 设置 | 现象 | 李宏毅的反应 |
|------|------|-------------|
| η=0.01 | w₁ 和 b 全部大爆炸 | "不行！" |
| η=0.001, 100 epochs | loss=263（最优是 240） | "还差一点距离" |
| η=0.001, 10000 epochs | 从 261 到 249 | "设大又飞起来，设小走太慢" |

> **他的结论：** "这招不是一个非常好的招数，有没有更好的招数？留着下周再讲。" → 这就是引出 Adam/AdaGrad 等自适应学习率优化器的伏笔。

> **📚 完整知识包：** [LH25F_05_basic_ml.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/knowledge/LH25F_05_basic_ml.md)

> **和 Karpathy Micrograd 的对照：** 李宏毅的 3 步骤框架和 Karpathy 的 Micrograd 是同一件事的两个视角：
> - 步骤一（定义 Loss）= Karpathy 中的 `loss = (predicted - actual)²`
> - 步骤二（定义模型）= Karpathy 中的 `Value` 类构建计算图
> - 步骤三（Optimization）= Karpathy 中的 `loss.backward()` + 梯度下降更新
>
> 区别在于：李宏毅先给你全景图（"机器学习就是找函式"），Karpathy 让你亲手搭一个最小的能跑的系统。

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
- **反向传播：** 通常是 1 次前向 + 1 次同量级的反向，就能把**所有参数的梯度一起算出来**

**[Fact] 更准确地说：** 反向传播的总成本当然还是会随着模型规模增长，但它避免了“每个参数单独试一次”的灾难性做法。正因为如此，现代深度学习才有可能训练数十亿甚至更多参数的模型。

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
        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out
```

**`_backward` 到底在干嘛？用一个例子走一遍：**

```python
# 前向：a * b = c
a = Value(2)   # a.data = 2, a.grad = 0
b = Value(3)   # b.data = 3, b.grad = 0
c = a * b      # c.data = 6, c.grad = 0
```

执行 `a * b` 的时候，Python 调用了 `__mul__`。除了算出 `c.data = 6`，还"偷偷"生成了一个 `_backward` 函数挂在 `c` 上面。这个函数**现在还没执行**，只是存着。

当我们后面调用反向传播时（假设 c 是最终输出，c.grad = 1）：

```python
c.grad = 1.0       # 最终输出对自己的梯度永远是 1
c._backward()       # 触发！

# _backward 里面做了什么？
# self 就是 a, other 就是 b, out 就是 c
# a.grad += b.data * c.grad  →  a.grad += 3 * 1 = 3
# b.grad += a.data * c.grad  →  b.grad += 2 * 1 = 2
```

结果：`a.grad = 3`，`b.grad = 2`。意思是：
- a 增加 1，c 会增加 3（因为 c = a * b，b=3，增量就是 b）
- b 增加 1，c 会增加 2（因为 c = a * b，a=2，增量就是 a）

**这就是乘法的梯度规则：`a * b` 对 `a` 的梯度 = `b`，对 `b` 的梯度 = `a`。**

**核心洞察：** 每个运算（加/乘/ReLU）在前向计算时，顺便记录下"怎么算反向的梯度"。这就叫**自动微分（Autograd）**——PyTorch 的核心就是这个思想的工业级实现。

#### 具体数字

假设一个超简单的网络：`y = w * x`，其中 x=2, w=3, 正确答案（target）=10

**先写出损失函数：**

```
Loss = (y - target)^2
```

就是"预测值和正确答案的差的平方"。差得越多，Loss 越大。

**现在逐步走一遍：**

```
Step 1 前向：y = w × x = 3 × 2 = 6
Step 2 算损失：Loss = (6 - 10)² = (-4)² = 16
Step 3 算梯度 ∂Loss/∂w（Loss 对 w 的梯度）：
  链式法则，一步步来：
  - Loss = (y - 10)²    → ∂Loss/∂y = 2×(y - 10) = 2×(6-10) = -8
  - y = w × x           → ∂y/∂w = x = 2
  - 链式法则相乘：∂Loss/∂w = ∂Loss/∂y × ∂y/∂w = -8 × 2 = -16

Step 4 更新：w = 3 - 0.01 × (-16) = 3.16  ← w 变大了（因为 y=6 太小，需要增大 w）
```

**验证：** y = 3.16 * 2 = 6.32，Loss = (6.32-10)^2 = 13.5 → **Loss 从 16 降到 13.5，确实在学习！**

#### 一个 3 节点计算图小例子

如果你觉得上面还是偏抽象，可以看这个更像"计算图"的版本：

```text
a = 2
b = 3
c = a * b = 6
L = c * c = 36
```

**先认识一个符号 ∂：** 论文和面试里你会反复见到 `∂L/∂c`。它读作"L 对 c 的偏导"，意思就是 **"c 变一丁点，L 会变多少"**。`∂` 是偏导符号，你现在就把它理解成"变化率"。下面我们**既用符号，也用大白话**，两个你都要认得。

**现在从 L 往回推（反向传播）：**

```text
第 1 步：L = c²，求 ∂L/∂c（L 对 c 的变化率）
  → ∂L/∂c = 2c = 2×6 = 12
  → 大白话：c 增加 1，L 大约增加 12

第 2 步：c = a × b，求 ∂c/∂a（c 对 a 的变化率）
  → ∂c/∂a = b = 3
  → 大白话：a 增加 1，c 增加 3（因为 b=3）

第 3 步：c = a × b，求 ∂c/∂b（c 对 b 的变化率）
  → ∂c/∂b = a = 2
  → 大白话：b 增加 1，c 增加 2（因为 a=2）
```

**链式法则：把各层的 ∂ 乘起来**

```text
∂L/∂a = ∂L/∂c × ∂c/∂a = 12 × 3 = 36
∂L/∂b = ∂L/∂c × ∂c/∂b = 12 × 2 = 24
```

**验证：** a 从 2 变成 3 → c = 3×3 = 9 → L = 81。变化量 = 81-36 = 45，接近 ∂L/∂a = 36（不完全等是因为梯度是"瞬间变化率"，大步走有误差）。

这就是链式法则在做的事：**先算 ∂L/∂c，再一层层乘回去得到 ∂L/∂a。**

---

### 📜 原文对照（关键论文/博客引用）

| 📄 原文 | 🗣️ 大白话 |
|---------|----------|
| "We describe a new learning procedure, back-propagation, for networks of neurone-like units." — Rumelhart, Hinton, Williams, Nature 1986 | 1986 年，Hinton 等人首次系统描述了反向传播算法。这篇 Nature 论文开启了神经网络的现代训练时代。 |
| "The key insight is that the chain rule can be used to compute the gradient of the loss with respect to any weight in the network." — Karpathy, Micrograd 视频 | 链式法则是整个反向传播的数学基础：不管网络多深多复杂，梯度都能通过"局部梯度相乘"一步步传回去。 |
| "What I cannot create, I do not understand." — Richard Feynman（Karpathy 在 Micrograd 开头引用） | Karpathy 引用费曼这句话解释他为什么要从零实现反向传播——只有自己写出来才算真正理解。这也是你做 OC 任务的意义。 |
| "Autograd — automatically computing gradients — is what makes modern deep learning possible." — PyTorch 文档 | 自动微分不是学术玩具，它是 PyTorch/TensorFlow 的核心引擎。你调用 `loss.backward()` 时，底层就在做 Karpathy Micrograd 展示的那些事。 |

---

### 这几个概念不要混

- **反向传播 ≠ 梯度下降**：反向传播负责“算梯度”，梯度下降负责“拿梯度更新参数”。
- **梯度 ≠ loss**：梯度回答“往哪调、调多少”，loss 回答“现在错得多不多”。
- **自动微分 ≠ 训练全过程**：自动微分只解决“怎么高效算梯度”，训练还包括数据、优化器、批次、学习率等。
- **“高效拿到所有梯度” ≠ “成本是 O(1)”**：反向传播比逐个参数试探高效得多，但总成本仍会随着模型变大而增长。

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
| **[LH25F] 李宏毅 Backpropagation** | https://youtu.be/ibJpTrp5mcE | 反向传播专题讲解 |
| **[LH25F] 李宏毅 BasicML** | https://youtu.be/Taj1eHmZyWw | 第 5 讲 — 找函式三步骤 + 梯度下降 + 从线性到深度学习（上方已提炼核心内容） |

---

## 🧠 与 Muse/项目 的映射

先把“本地代码做什么”和“远端模型做什么”分开：

- **[Fact] 本地代码实际做的事：** [engine.mjs](/Users/xulater/Code/assistant-agent/muse/src/core/engine.mjs#L81) 到 [engine.mjs](/Users/xulater/Code/assistant-agent/muse/src/core/engine.mjs#L125) 负责创建 session、组装 payload、发请求给模型服务。它**没有在本仓库里训练模型**。
- **[Fact] 远端模型实际做的事：** Muse 调用的 Claude/GPT 这类模型，之所以具备语言能力，是因为它们在训练阶段用过反向传播。
- **[Infer] 为什么 Agent 开发者也该懂这个：** 你虽然不亲手训练大模型，但理解“模型能力来自训练、不是凭空出现”，会帮助你更清楚地判断模型的能力边界、成本和幻觉风险。
- **[Fact] 明天 N02 Transformer：** Attention 里的 Q/K/V 权重矩阵，也是训练时通过反向传播学出来的参数。

### 📚 本地参考实现（双证据）

> 除了论文/课程，你本地 `user/reference/repos` 里也有可以直接对照的实现。

| 主题 | 本地实现 | 能证明什么 |
|------|---------|-----------| 
| **反向传播三步曲** | [train.py#L263](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L263) | `optimizer.zero_grad()` → `loss.backward()` → `optimizer.step()` 就是"清梯度→反向传播→更新参数"三步 |
| **loss.backward() 触发链式法则** | [model.py#L187](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L187) | `loss = F.cross_entropy(...)` 计算 loss 后，调 `.backward()` 就自动执行链式法则求所有参数梯度 |
| **可学习参数用 nn.Parameter** | [ch03.py#L14](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/ch03.py#L14) | `self.W_query = nn.Parameter(torch.rand(d_in, d_out))` — W_Q/W_K/W_V 都是 nn.Parameter，反向传播自动算它们的梯度 |
| **教学版 SelfAttention_v1** | [ch03.py#L10](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/LLMs-from-scratch/pkg/llms_from_scratch/ch03.py#L10) | Raschka 的教学版：先用 `nn.Parameter` 显式创建 W 矩阵，forward 里手动做矩阵乘法 — 和 D01 学的原理完全对应 |

---

## ✅ 自检清单

- [ ] 能一句话解释"反向传播就是从结果倒推每个参数该怎么调"
- [ ] 能说出梯度的含义："参数变一点点，Loss 变多少"
- [ ] 能讲清链式法则为什么是"小梯度相乘"
- [ ] 能解释为什么反向传播比"一个一个试"快，但**不会**误说成“训练成本是 O(1)”
- [ ] 能说 Karpathy `Value` 类的三个核心属性（data / grad / _backward）
- [ ] 能分清“反向传播算梯度”和“梯度下降改参数”是两件事

### 面试题积累（1 题）

**Q: 反向传播的核心思想是什么？它解决的关键问题是什么？**

> 你的回答：___
>
> 参考答案要点：核心=利用链式法则从输出往回传播梯度；关键问题=用一次前向 + 一次同量级反向高效拿到所有参数梯度，而不是对每个参数分别做数值微分

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
