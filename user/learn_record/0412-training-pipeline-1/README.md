# D05 — N06 训练管线 (1/2)

> **日期：** 2026-04-12（Sun）
> **路线图位置：** Week 1 · Day 5 · N06 训练管线（第 1 天，共 2 天）
> **定位：** 🟥 精通级（今天 1h，总计 6h 跨 2 天）· **F3 开始**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **一个 LLM 从"什么都不会"到"能聊天"经历了几个阶段？** 每个阶段的输入输出分别是什么？
2. **Pretraining 到底在训什么？** 它和 Fine-tuning 有什么本质区别？
3. **为什么需要 SFT？Pretrained 的模型不是已经很强了吗？**

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy "State of GPT" 前 30 分钟 + Ouyang et al.《InstructGPT》+ nanoGPT `train.py` 中提炼的核心知识。
> 今天是训练管线两天学习的第一天：**Pretraining + SFT 两个阶段**。明天补 RLHF/DPO。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Pretraining（预训练）** | 在海量文本上让模型学会"预测下一个词" | 像让小孩读遍所有书，学会语言本身 | 数据爬取和清洗细节 |
| **SFT (Supervised Fine-Tuning)** | 用人工标注的指令-回答对来微调模型 | 让模型从"会说话"变成"会听话" | LoRA/QLoRA 等高效微调 |
| **RLHF (Reinforcement Learning from Human Feedback)** | 用人类偏好来进一步优化模型输出 | 让模型从"会听话"变成"说得好" | PPO/DPO 算法细节 |
| **Next Token Prediction** | 训练目标：给定前文，预测下一个 token | GPT Pretraining 的唯一目标函数 | 数学推导 |
| **Loss（损失函数）** | 衡量模型预测和正确答案的差距 | 越低越好，训练就是在降 loss | 不同 loss 的比较 |
| **Learning Rate（学习率）** | 每一步更新参数时"迈多大的步子" | 太大会震荡，太小会卡住 | Warmup/Cosine Decay 细节 |
| **Epoch / Iteration** | Epoch = 过一遍全部数据；Iteration = 一次梯度更新 | 训练进度的两种度量方式 | 大模型通常只训 1-2 个 epoch |

### 🌍 背景：为什么要学这个？

**承接 D01-D04：** 前四天你学了 GPT 的**架构**（长什么样）。但架构只是一个空壳——参数全是随机初始化的。**训练管线决定了模型从"空壳"变成"智能体"的全过程。**

**技术栈位置：**
```
D01 反向传播 ✅ → 训练的数学基础
D02-D04 Transformer/GPT ✅ → 模型长什么样
D05 你在这里 → 模型怎么训出来的（Stage 1-2）
D06 明天 → 模型怎么变好用的（Stage 3: RLHF）
```

**[Fact] Karpathy 在 "State of GPT" 中把 LLM 训练分成明确的阶段。** 掌握这个全景图，才能理解为什么同一个架构的模型（Base vs Chat vs Instruct）行为差异巨大。

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2018.6 | Radford et al. (OpenAI) | GPT-1：Pretraining + Fine-tuning 范式 | 首次证明"先大规模预训练，再微调"的有效性 |
| 2020.5 | Brown et al. (OpenAI) | GPT-3：证明 Scale 带来涌现能力 | 175B 参数 + Few-Shot 不需要微调也能做任务 |
| 2020.1 | Kaplan et al. (OpenAI) | Scaling Laws 论文 | 揭示了模型、数据、计算量三者之间的幂律关系 |
| 2022.3 | Ouyang et al. (OpenAI) | InstructGPT：SFT + RLHF | 首次系统性地用人类反馈对齐模型行为 |
| 2022.11 | OpenAI | ChatGPT | InstructGPT 路线的产品化，全球爆火 |
| 2023.5 | Rafailov et al. (Stanford) | DPO (Direct Preference Optimization) | 简化 RLHF，不需要训 Reward Model |

### 李宏毅《大型语言模型的学习历程》— 训练管线的直觉理解

> 来源：[LH25F] 第 7 讲《LLMtraining》课件 · [视频](https://youtu.be/YJoegm7kiUM)
> 来源：[LH25] 《Pretrain + Alignment》课件 · [视频](https://youtu.be/Ozos6M1JtIE)

**[Fact] 核心框架——三个阶段就像人的成长：**

```text
Pre-train     =  学龄前    →  "熟悉人类语言"    → 从海量网络文本学文字接龙
SFT           =  上学校    →  "应该如何回应"    → 人类提供标准答案
RLHF          =  出社会    →  "什么回答更好"    → 人类仅提供反馈（不给标准答案）
```

**[Fact] 关键洞察 1 — 三个阶段都在“改模型的下一个输出”，但训练信号不一样**

Pretraining 和很多 SFT 的直接训练形式都可以理解成文字接龙（Next Token Prediction）：Pretrain 用网络文章，SFT 用问答对。  
但 **RLHF/DPO 不是简单地继续做同一种文字接龙训练**，而是额外引入人类偏好信号、reward model 或 preference optimization，去改变模型更偏好的回答方向。  
共同点是：它们都在调整模型参数，而且通常都拿上一阶段训练出的参数作为**初始化**。

**[Fact] 关键洞察 2 — 15T token 到底有多少？李宏毅的类比：**

```text
LLaMA 3 和 DeepSeek-V3 都用了约 15T（万亿）个 token 来做 Pretraining。
把这些 token 印出来：
  - 假设 100 张纸厚 1 公分
  - 厚度有 1500 公里 ← 比从地面到外太空还高！
  - 假设你每十秒读一页，需要阅读 4756 年
  - 如果有人从商朝开始读起，到现在都还没读完
```

**[Fact] 关键洞察 3 — Pretrain 模型是"璞玉"，不是废物**

李宏毅强调：Pretrain 出来的 Base Model **不是不能回答问题**，而是它可能用各种奇怪的方式续写（因为网络文本就是这样的风格）。

```text
输入："台湾最高的山是哪座？"

Base Model 可能的回答：
  → "玉山 [END]"                ← 有时候刚好对
  → "谁来告诉我呀？"            ← 续写成论坛帖子
  → "(A) 雪山 (B) 阿里山 ..."   ← 续写成选择题
  → "第二高的又是哪座？"         ← 续写成更多问题
```

SFT 和 RLHF **主要**是在调整模型的行为模式和输出偏好，不是训练新知识的主战场；但它们也可能顺带强化某些格式、任务习惯，甚至引入少量新信息。

**[Fact] 关键洞察 4 — SFT 是"画龙点睛"**

李宏毅用了两个硬证据：

1. **InstructGPT**：SFT 只用了约 1 万条标注数据，但模型行为脱胎换骨（GPT-3 Base → InstructGPT）
2. **LIMA 论文**："Less Is More for Alignment"——仅用 1000 条训练数据，回答质量就能和 GPT-4 打平 43% 的情况

→ **结论：Alignment = 画龙点睛，Pretrain = 画龙。眼睛的位置要点对！** 用错误的 SFT 数据反而会变差。

**[Fact] 关键洞察 5 — Pretrain 的威力从"知识重排"而来**

李宏毅用日本动漫 MyGO!!!!! 角色做实验（来自 "Physics of Language Models" 论文）：

```text
训练文本只出现一次："千早爱音是MyGO!!!!!的节奏吉他手"
SFT 问："谁是MyGO!!!!!的节奏吉他手？"
结果：0% 正确率 ← 只看过一种说法，完全不会

改进：用多种改写版本做 Pretrain
  "千早爱音是MyGO!!!!!的节奏吉他手，也是羽丘女子学园高中一年级学生"
  "千早爱音是羽丘女子学园高中一年级学生，同时也是MyGO!!!!!的节奏吉他手"
结果：0% → 96% 正确率 ← 同样的知识用不同方式反复说，模型才真正学会
```

**→ 核心结论：Pretrain 需要大量资料，不是因为要记更多知识，而是同样的知识需要从不同角度反复讲。**

**[Fact] 关键洞察 6 — Pretrain 不是死背，而是压缩**

李宏毅举了《孔乙己》的例子：模型不是把原文一字不差地背下来，而是**学到了文字之间的规律和逻辑**。这就像人读完一本书后，不是记住每个字，而是记住了内容的结构和意义。

**[Fact] 关键洞察 7 — Alignment 改变的 Token 极少（来自 LH25_04 讲）**

> "研究发现 shift token 的比例非常非常的少——模型在 Aligned 前后的行为其实没有那么大的变化。为什么答案看起来差很多？因为模型做文字接龙**一步错步步错**——中间有一个 Token 改了，后面接的东西可以完全不同。"

**[Fact] 关键洞察 8 — 数据品质 > 数量：改写后的数据效率 ≈ 未改写的 3 倍**

> 李宏毅引用 RefinedWeb 论文：从网络直接爬到的数据往往不能直接用。经过多步清理后的数据，训练效率是原始数据的约 3 倍。

> **📚 完整知识包：** [LH25_04_pretrain_alignment.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/knowledge/LH25_04_pretrain_alignment.md) · [LH25F_07_llm_training.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/knowledge/LH25F_07_llm_training.md)

---

### 第一性原理：LLM 是怎么训出来的？

> ⚠️ 从"一个什么都不会的模型"开始，逐步搭建到 ChatGPT。

**Layer 0 — 前置概念：训练 = 调参数**

D01 学过：反向传播 + 梯度下降 = 让模型的参数朝着"loss 更低"的方向更新。**所有训练阶段的底层机制都是这个。** 区别在于：用什么数据、优化什么目标。

**Layer 1 — 核心问题：GPT 的参数是随机初始化的，它怎么变"聪明"？**

GPT-2 Small 有 1.24 亿个参数（D04 学过），初始化时全是随机数。它不知道任何语言知识。

**Layer 2 — 三阶段训练管线（Karpathy 的 State of GPT 框架）**

```text
Stage 1: Pretraining          Stage 2: SFT              Stage 3: RLHF
(从零学语言)                   (学会遵循指令)             (学会输出高质量回答)

互联网文本                     指令-回答对                人类偏好数据
数万亿 token                   ~10K-100K 条               ~100K 比较对
Next Token Prediction          Next Token Prediction      Reward Model + PPO/DPO
数周-数月                      数小时-数天                数天

↓                              ↓                          ↓
Base Model                     SFT Model                  RLHF Model
（会续写但不听指令）            （会听指令但回答质量参差）   （ChatGPT 级别）
```

**Layer 3 — 完整定义**

**[Fact] 面试级一句话：** The modern LLM training pipeline consists of three stages: (1) Pretraining on massive unlabeled text with next-token prediction, producing a base model; (2) Supervised Fine-Tuning (SFT) on instruction-response pairs to teach the model to follow instructions; (3) RLHF/DPO alignment using human preference data to improve output quality and safety.

**[Fact] 中文展开：** 现代 LLM 训练管线分三个阶段：（1）Pretraining（预训练）在海量无标注文本上用 Next Token Prediction（下一词预测）训练，产出 Base Model；（2）SFT（监督微调）在人工标注的 Instruction-Response（指令-回答）对上继续训练，让模型学会遵循指令；（3）RLHF/DPO 用人类偏好数据对齐模型行为，提升输出质量和安全性。

---

### 怎么做到的？— Stage 1 & Stage 2 详解

#### Stage 1：Pretraining（预训练）

**目标：** 给定前面的 token 序列，预测下一个 token。这就是 Next Token Prediction，也叫 Causal Language Modeling（因果语言建模）。

**数据：** 大规模互联网文本（Common Crawl、Wikipedia、Books、代码...）。GPT-3 的训练数据约 3000 亿 token。

**训练过程（对应 nanoGPT train.py）：**

```python
# 核心训练循环（简化版，对应 nanoGPT train.py L255-L314）
while not done:
    X, Y = get_batch('train')        # X = 输入 token, Y = X 右移一位（目标）
    logits, loss = model(X, Y)       # Forward: 算 Cross-Entropy Loss
    loss.backward()                  # Backward: 反向传播算梯度（D01）
    optimizer.step()                 # 梯度下降更新参数
    optimizer.zero_grad()            # 清空梯度
```

**[Fact] 关键细节 — 数据格式：**

```text
原始文本: "The cat sat on the mat"
Input X:  [The, cat, sat, on, the]      ← 前 5 个 token
Target Y: [cat, sat, on, the, mat]      ← 各自的"下一个 token"
```

每个位置都在学"给定前文，下一个词是什么"。用 Causal Mask 确保不偷看未来（D03 学过）。

**[Fact] 关键超参数（来自 nanoGPT train.py）：**

| 超参数 | 值 | 含义 |
|--------|-----|------|
| `learning_rate` | 6e-4 | 最大学习率 |
| `max_iters` | 600,000 | 总训练步数 |
| `batch_size` | 12 | 每步处理 12 个序列 |
| `block_size` | 1024 | 上下文窗口长度 |
| `warmup_iters` | 2000 | 学习率预热步数 |
| `grad_clip` | 1.0 | 梯度裁剪阈值 |

> 来源：[nanoGPT train.py:L58-L68](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L58)

**[Fact] Learning Rate Schedule（学习率调度）：**

```text
学习率
  ↑
  |   /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
  |  /                   \
  | /    Cosine Decay      \___________
  |/ Warmup                   min_lr
  +--------------------------------→ 训练步数
  0   2000              600000
```

Warmup（预热）：前 2000 步从 0 线性升到 6e-4，避免初始化阶段大梯度破坏模型。之后 Cosine Decay 缓慢降到 min_lr。

> 来源：[nanoGPT train.py:L231-L242](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L231)

**Pretraining 的结果 = Base Model：**
- ✅ 知道语言的语法、语义、世界知识
- ✅ 能续写文本（给一段话，接着写）
- ❌ 不会回答问题（你问它问题，它可能会续写成一篇文章而不是回答）
- ❌ 可能输出有害内容（没有对齐人类价值观）

#### Stage 2：SFT (Supervised Fine-Tuning)

**问题：** Base Model 只会续写，不会"对话"。你输入 "What is the capital of France?"，它可能续写成 "What is the capital of Germany? What is..."

**解法：** 用人工标注的"指令→回答"对继续训练：

```text
训练数据格式：
  User: "What is the capital of France?"
  Assistant: "The capital of France is Paris."

  User: "Write a poem about AI"
  Assistant: "In circuits deep and data wide..."
```

**[Fact] 在标准 causal LM 式 SFT 中，训练目标和 Pretraining 很接近** — 仍然常写成 Next Token Prediction + Cross-Entropy Loss。但数据分布变了：从"互联网文章"变成"指令-回答对"。

**[Fact] SFT 的数据量远小于 Pretraining：** Pretraining 用数万亿 token，SFT 通常只需 10K-100K 条高质量指令对。这就是为什么 SFT 只需要几小时到几天。

**SFT 的结果 = Instruction-Tuned Model：**
- ✅ 能理解指令并给出相关回答
- ✅ 对话格式正确（不会乱续写）
- ❌ 回答质量参差不齐（有时啰嗦、有时不准确、有时不安全）
- ❌ 没有学会"什么是好回答"的偏好

**明天 D06 学 Stage 3：RLHF/DPO — 让模型学会"什么是好回答"。**

---

### 为什么需要它？— 设计动机

| 阶段 | 解决什么问题 | 如果跳过会怎样 |
|------|------------|--------------|
| **Pretraining** | 从零学习语言能力和世界知识 | 模型就是随机噪声，什么都不会 |
| **SFT** | 让模型学会遵循指令格式 | 模型只会续写，不会回答问题 |
| **RLHF** | 对齐人类偏好，提升回答质量 | 回答可能有害、啰嗦、不准确 |

---

### 举例 + 发散

#### 同一个模型，不同阶段的输出对比

```text
输入: "Explain quantum computing"

Base Model (Pretraining only):
  "Explain quantum computing for beginners. Step 1: Learn about qubits.
   Step 2: Study quantum gates. Step 3:..."
  → 续写了一篇教程大纲，没有真正解释

SFT Model:
  "Quantum computing uses quantum bits (qubits) instead of classical bits.
   While a classical bit is 0 or 1, a qubit can be in a superposition..."
  → 在回答问题了，但可能太长或格式不够好

RLHF Model:
  "Quantum computing leverages quantum mechanics to process information
   fundamentally differently from classical computers. Here are the key
   concepts: 1) Qubits... 2) Superposition... 3) Entanglement..."
  → 结构化、简洁、直接有用
```

#### Pretraining 的规模感受

| 模型 | 训练数据 | 训练算力 | 训练时间 |
|------|---------|---------|---------|
| GPT-2 | ~40GB 文本 | 相对后续 GPT 系列更小 | 数天级 |
| GPT-3 | ~570GB（300B token） | 大规模 GPU 集群 | 周到月级 |
| LLaMA-2 70B | ~2T token | 极大规模 GPU·小时 | 月级 |

**[Fact] Scaling Laws（缩放定律）：** Kaplan et al. 2020 发现模型性能和参数量、数据量、计算量之间存在可预测的幂律关系。这意味着：给够资源，模型**可预测地**变强。

**[Infer] 说明：** 训练成本高度依赖 GPU 型号、并行策略、云厂商报价和时间点。为了避免把粗略估算写成硬事实，这里不写死具体美元数字。

---

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "We demonstrate that language models begin to learn these tasks without any explicit supervision when trained on a large enough dataset." — GPT-2 论文 | Pretraining 的本质：只要数据够多，模型自动学会各种能力，不需要人告诉它"这是什么任务"。 |
| "We show an avenue for improving language model outputs using techniques such as Reinforcement Learning from Human Feedback (RLHF)." — InstructGPT, Ouyang et al. 2022 | InstructGPT 开创了三阶段训练范式：Pretraining → SFT → RLHF。 |
| "There exist power laws between model performance and compute, data size, and model size." — Scaling Laws, Kaplan et al. 2020 | 模型性能和资源之间存在可预测的幂律关系。这给了大厂"砸钱就能变强"的信心。 |

---

### 📚 本地参考实现（双证据）

> 论文/课程提供概念来源，本地代码提供实现级事实。

| 主题 | 本地实现 | 能证明什么 |
|------|---------|-----------|
| **完整训练循环** | [train.py:L255-L314](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L255) | forward → backward → clip → step → zero_grad 五步循环 |
| **Learning Rate Schedule** | [train.py:L231-L242](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L231) | Warmup + Cosine Decay 的真实实现 |
| **数据加载 (Next Token)** | [train.py:L116-L131](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L116) | X = data[i:i+block_size], Y = data[i+1:i+1+block_size] — 就是右移一位 |
| **Cross-Entropy Loss** | [model.py:L187](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/model.py#L187) | `F.cross_entropy(logits, targets)` — 标准分类损失 |
| **Gradient Clipping** | [train.py:L307-L309](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L307) | `clip_grad_norm_(model.parameters(), 1.0)` 防止梯度爆炸 |
| **Gradient Accumulation** | [train.py:L292-L301](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py#L292) | 多次 micro-step 累积梯度，模拟更大 batch size |

---

### 这几个概念不要混

- **Pretraining ≠ Training**：Pretraining 特指第一阶段的大规模无监督训练。"Training" 是笼统的说法，可以指任何阶段
- **SFT ≠ Fine-tuning**：SFT 特指用指令对做监督微调。Fine-tuning 是更广义的概念（也包括在分类数据上微调 BERT）
- **Base Model ≠ Chat Model**：Base Model（如 `llama-2-7b`）是 Pretraining 产出，只会续写。Chat Model（如 `llama-2-7b-chat`）经过了 SFT + RLHF
- **Epoch ≠ Iteration**：Epoch = 遍历一遍全部训练数据。Iteration = 一次梯度更新。大模型通常只训 1-2 个 epoch
- **Learning Rate ≠ Loss**：Learning Rate 是超参数（你设的），Loss 是结果（模型算的）。LR 控制"步子大小"，Loss 衡量"离目标多远"

---

### 🎤 面试追问链

```
Q1: 请描述现代 LLM 的训练管线
→ 答: 三阶段：(1) Pretraining — 海量文本 + Next Token Prediction → Base Model
      (2) SFT — 指令对 + 监督学习 → Instruction-Tuned Model
      (3) RLHF/DPO — 人类偏好 + 强化学习 → Aligned Model
  Q1.1: Pretraining 的目标函数是什么？
  → 答: Cross-Entropy Loss on Next Token Prediction。给定前文，
        最大化预测正确下一个 token 的概率。
    Q1.1.1: 为什么 Pretraining 不用其他目标（如 Masked LM）？
    → 答: GPT 用单向（Causal）目标因为生成任务天然就是逐 token 的。
          BERT 用 Masked LM（双向）是因为它做理解任务。
          目标函数的选择和模型架构（D04）以及下游用途一致。

Q2: Base Model 和 Chat Model 有什么区别？
→ 答: 架构相同。Base Model 只经过 Pretraining，会续写但不会对话。
      Chat Model 额外经过 SFT + RLHF，能理解指令并给出高质量回答。
  Q2.1: SFT 用了多少数据？
  → 答: 远少于 Pretraining。SFT 通常是 10K-100K 级高质量指令对，
        而 Pretraining 是数百亿到数千亿 token 级别。SFT 主要改变的是行为模式，
        不是重新学习全部知识。
    Q2.1.1: 那 SFT 会不会让模型忘记 Pretraining 学到的知识？
    → 答: 会有 Catastrophic Forgetting（灾难性遗忘）的风险。
          所以 SFT 的学习率非常小（~1e-5），数据量也小，
          只是微调行为，尽量不破坏原有知识。

Q3: 什么是 Scaling Laws？
→ 答: Kaplan et al. 2020 发现 LLM 性能和三个变量存在幂律关系：
      模型参数量 N、数据量 D、计算量 C。增加任何一个，
      性能都可预测地提升。这给了大厂投入资源的信心。
  Q3.1: Chinchilla Scaling 和原始 Scaling Laws 有什么区别？
  → 答: 原始（Kaplan）偏向增大模型。Chinchilla（Hoffmann 2022）
        发现数据量和模型大小应该等比例增长，不应该"模型大、数据少"。
    Q3.1.1: 这对工程实践有什么影响？
    → 答: 企业不再一味追求更大模型，而是更注重数据质量和数量。
          LLaMA-2 用 2T token 训 70B 模型，就是遵循 Chinchilla。
```

---

### 关键概念清单

- [ ] **三阶段管线**：Pretraining → SFT → RLHF
- [ ] **Pretraining**：海量文本 + Next Token Prediction + Cross-Entropy Loss
- [ ] **Base Model vs Chat Model**：续写 vs 对话
- [ ] **SFT**：指令-回答对，监督微调，数据量远小于 Pretraining
- [ ] **数据格式**：X = tokens, Y = X 右移一位
- [ ] **Learning Rate Schedule**：Warmup + Cosine Decay
- [ ] **Gradient Clipping**：防止梯度爆炸
- [ ] **Scaling Laws**：参数/数据/计算 的幂律关系
- [ ] **Catastrophic Forgetting**：微调时可能丢失预训练知识
- [ ] **明天 D06**：RLHF/DPO — 用人类偏好对齐模型

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy State of GPT | https://www.youtube.com/watch?v=bZQun8Y4L2A | 前 30min — 训练管线全景 |
| InstructGPT 论文 | https://arxiv.org/abs/2203.02155 | §2-§3 三阶段训练方法 |
| Scaling Laws 论文 | https://arxiv.org/abs/2001.08361 | 幂律关系图 |
| nanoGPT train.py | [train.py](/Users/xulater/Code/assistant-agent/muse/user/reference/repos/nanoGPT/train.py) | 完整 Pretraining 实现 |
| **[LH25] 李宏毅 Pretrain + Alignment** | https://youtu.be/Ozos6M1JtIE | 预训练和对齐的完整讲解（上方已提炼核心内容） |
| **[LH25F] 李宏毅《大型语言模型的学习历程》** | https://youtu.be/YJoegm7kiUM | 第 7 讲 — 学龄前/上学校/出社会 + MyGO 实验 + 画龙点睛（上方已提炼核心内容） |
| **[LH25F] 李宏毅 RL 概述** | https://youtu.be/XWukX-ayIrs | 强化学习基础，为明天 D06 RLHF 做准备 |
| **[LH25F] 李宏毅《训练诀窍》** | https://youtu.be/mPWvAN4hzzY | 第 6 讲 — Pretrain 详解 + Normalization + Dropout |

---

## 🧠 与 Muse/项目 的映射

- **[Fact] Muse 用的是别人训好的模型：** 你调用 Claude/GPT 时，这些模型已经走完了三阶段训练。你不需要自己做 Pretraining，因为那通常需要极高算力、海量数据和很高预算，不是当前项目范围。
- **[Fact] 但你需要理解训练管线的原因：**
  - **选模型**：Base Model（续写/补全） vs Chat Model（对话/指令）对应不同场景
  - **System Prompt 为什么有效**：SFT 阶段模型学会了"看 system prompt → 遵循"的模式
  - **模型为什么有时"不听话"**：SFT 数据覆盖不够 或 RLHF 没对齐你的具体需求
- **[Fact] 和 D06 的关系：** 明天学 RLHF/DPO，理解为什么 ChatGPT 比 GPT-3 Base "好用得多"。

---

## ✅ 自检清单

- [ ] 能画出三阶段训练管线全景图（Pretraining → SFT → RLHF）
- [ ] 能说出 Pretraining 的目标函数（Next Token Prediction + Cross-Entropy）
- [ ] 能解释数据格式：X 和 Y 是怎么从原始文本构造的
- [ ] 能说出 Base Model 和 Chat Model 的区别
- [ ] 能解释 SFT 在做什么 + 为什么数据量小
- [ ] 能说出 Learning Rate Schedule 的两阶段（Warmup + Cosine Decay）
- [ ] 能说出 Gradient Clipping 防止什么
- [ ] 能解释 Scaling Laws 的核心发现
- [ ] 能扛住 3 条面试追问链各 3 层

### 面试题积累（2 题）

**Q1: 请描述 LLM 从 Pretraining 到 ChatGPT 的完整训练流程**

> 你的回答：___
>
> 参考：Pretraining (海量文本 + Next Token Prediction) → SFT (指令对) → RLHF (人类偏好) → ChatGPT

**Q2: Pretraining 和 SFT 在训练目标上有什么异同？**

> 你的回答：___
>
> 参考：目标函数相同（都是 Next Token Prediction + Cross-Entropy），但数据不同：Pretraining 用海量无标注文本，SFT 用人工标注的指令-回答对。SFT 改变的是行为模式而非知识。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
