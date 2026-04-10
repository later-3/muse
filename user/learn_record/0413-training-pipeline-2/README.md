# D06 — N06 训练管线 (2/2)

> **日期：** 2026-04-13（Sun）
> **路线图位置：** Week 1 · Day 6 · N06 训练管线（第 2 天，共 2 天）
> **定位：** 🟥 精通级（今天 1h，总计 6h 跨 2 天）· **F3 完成**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **RLHF 到底做了什么？** 它和 SFT 有什么本质区别？为什么 SFT 之后还不够？
2. **一个通用模型从"出生"到"上线"再到"持续进化"经历了什么？** 完整画出 Pretrain→SFT→RLHF→Post-training→终身学习的全链路
3. **模型学了新技能后为什么会忘掉旧技能？** 灾难性遗忘的根因和工业界的解法是什么？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy "State of GPT" 后半段 + 李宏毅 [LLM学习历程](https://youtu.be/YJoegm7kiUM) + [Post-training](https://youtu.be/Z6b5-77EfGk) + [终身学习](https://youtu.be/EnWz5XuOnIQ) 中提炼的核心知识。
> 今天是训练管线两天学习的第二天：**RLHF/DPO + Post-training + 终身学习**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **RLHF** | Reinforcement Learning from Human Feedback — 用人类偏好来优化模型输出 | 让模型从"会听话"变成"说得好" | PPO 算法的数学推导 |
| **DPO (Direct Preference Optimization)** | 不训 Reward Model，直接从偏好数据优化策略 | RLHF 的简化版，效果接近但更简单 | DPO loss 的数学推导 |
| **Reward Model** | 学会"什么是好回答"的判别模型 | 像一个打分老师，给回答打分 | RM 训练的具体数据格式 |
| **Catastrophic Forgetting（灾难性遗忘）** | 学了新技能后旧技能退化 | 像一个人学了法语忘了英语 | 理论上的遗忘机制（梯度干扰/特征漂移） |
| **LoRA (Low-Rank Adaptation)** | 只训练少量新增参数，冻结原始模型 | 在模型旁边插个"小插件"，不动主体 | 秩（rank）和分解的数学 |
| **Model Merging** | 把多个 fine-tune 后模型的参数求和合并 | 像嫁接——把不同能力"接枝"到一棵树上 | Task Vector 的对齐条件 |

### 🌍 背景：为什么要学这个？

**承接 D05：** 昨天你学了训练管线的前两个阶段（Pretrain + SFT）。今天补上后半程：**RLHF/DPO + Post-training + 终身学习**。学完今天，你就能画出一个 LLM 从"空壳"到"能聊天"到"持续进化"的完整链路。

**技术栈位置：**
```
[D01-D04 架构]     [D05 训练前半]       [D06 训练后半 ← 你在这里]
Transformer 架构 → Pretrain + SFT   → RLHF/DPO + Post-training + 终身学习
   ↓                    ↓                      ↓
 "长什么样"           "学会语言"             "学会说得好 + 持续进化"
```

**为什么 Agent 工程师要懂训练？**[Fact]
> "AI Agent 再次爆紅，並不是真的有了什麼跟 AI Agent 本身相關的新的技術，而是在 LLM 變強之後。" — 李宏毅 LH25_01

Agent 的能力上限取决于底层 LLM。理解训练管线 = 理解 LLM 能力的来源和边界。

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2017 | Christiano et al. | RLHF 论文 | 首次提出用人类反馈做 RL 训练语言模型 |
| 2022.3 | Ouyang / OpenAI | InstructGPT | 把 RLHF 工业化：SFT→RM→PPO 三步法 |
| 2022.11 | OpenAI | ChatGPT | InstructGPT 的公开版，RLHF 让全世界见识到效果 |
| 2023.5 | Rafailov et al. | DPO | 去掉 Reward Model，直接优化偏好，简化 RLHF |
| 2023.6 | Hu et al. | LoRA | 低秩适应微调，让小团队也能 fine-tune 大模型 |
| 2024 | 多家 | Model Merging 热潮 | Task Vector 合并让多技能组合变得可能 |

### 第一性原理：RLHF 到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — 为什么 SFT 还不够？**

[Fact] SFT 教模型"什么是正确的回答格式"，但不教"什么是好回答"。一个 SFT 后的模型可能生成语法正确但无聊、冗长或不安全的内容。

类比（仅类比）：SFT 像教小孩"遇到问题要回答"（格式），RLHF 像教小孩"怎么回答别人才满意"（质量）。

**Layer 1 — RLHF 的核心思路**

[Fact] RLHF 三步法（InstructGPT 定义的工业标准）：

1. **Step 1 — SFT**：用高质量的指令-回答对微调模型（已在 D05 学习）
2. **Step 2 — 训练 Reward Model (RM)**：
   - 给同一个 prompt 生成多个回答
   - 人类标注员排序：A > B > C（偏好数据）
   - 训练一个 RM 学会"什么回答更好"
3. **Step 3 — PPO 优化**：
   - 用 RL 算法（PPO）优化 SFT 后的模型
   - 目标：最大化 RM 给出的分数
   - 约束：不能离 SFT 模型太远（KL 散度惩罚）

**Layer 2 — DPO：去掉 Step 2**

[Fact] DPO 的核心洞察：你不需要单独训一个 RM。可以直接从偏好数据（A 比 B 好）推导出一个等价的优化目标，跳过 RM 训练。

优势：更简单（少一步）、更稳定（不依赖 RM 质量）。
劣势：不如 PPO 灵活（PPO 可以用 RM 探索更多可能性）。

**Layer 3 — 完整定义**

RLHF = 一套通过人类偏好数据来优化语言模型输出质量的方法论。核心假设：人类虽然很难写出完美回答，但能轻松判断"哪个更好"。

### 怎么做到的？— Post-training 全景

[Fact] 李宏毅在 LH25_06 中定义：

> "Post-training 通常是想要讓模型學會新的技能。這個技能不是一項知識，而是需要模型做比較大的改變才有辦法學會的事情。比如說新的語言，或者是使用工具，或者是做推理等等。"

Post-training 的三大方向：

| 方向 | 目的 | 方法 | 代价 |
|------|------|------|------|
| **能力扩展** | 学新技能（中文/工具/推理） | Full Fine-tune / LoRA | 可能遗忘旧能力 |
| **知识更新** | 植入新事实（Model Editing） | ROME / 外挂记忆 | 可能破坏其他知识 |
| **对齐优化** | 更安全更有帮助 | RLHF / DPO | 可能降低某些能力 |

### 灾难性遗忘 — 学新忘旧的核心矛盾

[Fact] 李宏毅在 LH25F_08 中定义：

> "有更新參數我們才稱之為學習。下了不一樣的 Prompt 讓模型有不同行為不算學習。"

> "就像有一個人出了社會之後，他的學習並不會停止，依照工作需求學習新技能。"

**遗忘的三个原因：**
1. **任务间干扰**：任务 A 需要的参数方向和任务 B 正好相反
2. **特征漂移**：fine-tune 改变了内部表示，旧输入被错误处理
3. **知识擦除**：新数据覆盖了旧数据建立的连结

**对抗遗忘的四大策略：**

| 策略 | 做法 | 优势 | 劣势 |
|------|------|------|------|
| **混合训练** | 新旧数据按比例混合 | 简单有效 | 旧数据存储/版权问题 |
| **LoRA 隔离** | 每个任务独立的低秩参数 | 不影响原模型 | 参数量随任务增长 |
| **Model Merging** | 各任务独立训练后合并 | 完全避免遗忘 | 必须同一个 Foundation Model |
| **知识蒸馏** | 用旧模型输出指导新模型 | 平衡新旧 | 需要额外计算 |

### Model Merging — "不用训练就能合并技能" [Fact]

[Fact] 来自 LH25_11：

> "不用訓練資料！不用做任何模型訓練！"

**Task Vector** 的数学：
```
θ = Foundation Model 参数
θ_A = 在任务A上 fine-tune 后的参数
τ_A = θ_A - θ  ← 这就是 Task Vector（学到的"差异"）

合并：θ_merged = θ + α·τ_A + β·τ_B
```

类比（仅类比）：**接枝**。把一棵会说中文的树和一棵会做推理的树嫁接到同一个根上。

实际案例：LLaMA-2-base + 中文 fine-tune vector + LLaMA-2-Chat alignment vector = 既懂中文又有 Alignment 的模型。

### 举例 + 发散

**数值例子：RLHF 的 KL 惩罚**

假设 SFT 后模型对某个 prompt 的回答概率分布是 P_sft，RLHF 优化后是 P_rlhf。

PPO 的目标函数（简化）：
```
maximize  E[RM(response)] - β · KL(P_rlhf || P_sft)
          ↑ 回答质量↑         ↑ 不要离 SFT 太远
```

β 太小 → 模型可能"讨好" RM 但说出不自然的话（reward hacking）
β 太大 → 模型几乎不变，RLHF 白做

实际训练中 β 通常设为 0.01-0.1。

> **类比（仅类比）：** 像教小孩"要有礼貌"但不能矫枉过正——太客气反而让人不舒服。

### 📜 原文对照（关键论文/博客引用）

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "We use PPO to fine-tune the SFT model... with the reward model as reward function" — InstructGPT | 用 RM 当打分老师，PPO 当教练，优化 SFT 后的模型 |
| "DPO implicitly optimizes the same objective as existing RLHF algorithms... without fitting a reward model" — DPO 论文 | DPO 数学上等价于 RLHF，但不用训练 RM |
| "Post-training 是讓模型學會新技能。不是一項知識，而是比較大的改變。" — 李宏毅 LH25_06 | Post-training 是教技能（如用工具），不是植入知识（如谁是总统） |

### 🎤 面试追问链

```
Q1: RLHF 为什么比单纯 SFT 效果好？
→ 你答: SFT 学格式，RLHF 学质量。人类偏好信号比标注答案更丰富。
  Q1.1: RLHF 中的 Reward Model 有什么问题？
  → 你答: RM 可能被 hack（模型找到 RM 的漏洞），所以需要 KL 约束。
    Q1.1.1: DPO 如何解决这个问题？
    → 你答: DPO 直接从偏好数据优化，不需要单独的 RM。数学上证明等价。

Q2: 模型 fine-tune 后为什么会遗忘？
→ 你答: 参数更新方向冲突 + 特征漂移 + 知识擦除
  Q2.1: 工业界怎么解决？
  → 你答: LoRA 隔离 + 混合训练 + Model Merging（Task Vector 相加）
```

### 这几个概念不要混

- **SFT ≠ RLHF**：SFT 学"该怎么回答"（格式），RLHF 学"怎么答更好"（质量）
- **Post-training ≠ Model Editing**：Post-training 学技能（大改），Model Editing 植入知识（小改）
- **LoRA ≠ Full Fine-tune**：LoRA 只加少量参数（~0.1%），Full FT 改所有参数
- **Model Merging ≠ Model Ensemble**：Merging 是参数合并成一个模型，Ensemble 是多个模型投票

### 关键概念清单

- [ ] **RLHF 三步法**：SFT → RM → PPO，能画出流程图
- [ ] **DPO**：不需要 RM 的 RLHF 替代方案
- [ ] **KL 散度惩罚**：防止 RLHF 走太远
- [ ] **Reward Hacking**：模型找到 RM 的漏洞
- [ ] **Catastrophic Forgetting**：学新忘旧
- [ ] **LoRA**：低秩适应，只训少量参数
- [ ] **Task Vector**：fine-tune 前后参数的差值
- [ ] **Model Merging**：参数空间接枝
- [ ] **训练全链路**：Pretrain → SFT → RLHF → Post-training → 终身学习
- [ ] **Post-training 三方向**：能力扩展 / 知识更新 / 对齐优化

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| State of GPT（后半） | https://youtu.be/bZQun8Y4L2A | 30:00 开始 — RLHF 部分 |
| 李宏毅 LLM学习历程 [LH25F] | https://youtu.be/YJoegm7kiUM | 全程 — 三阶段训练管线 |
| 李宏毅 Post-training [LH25] | https://youtu.be/Z6b5-77EfGk | 全程 — 遗忘 + 对抗策略 |
| 李宏毅 终身学习 [LH25F] | https://youtu.be/EnWz5XuOnIQ | 前 60min — Replay + LoRA 隔离 |

---

## 🧠 与 Muse/项目 的映射

> 今天学的训练管线后半程，在 Agent 开发中体现在哪里？

- **本地代码实际做的事：**
  - `src/core/identity.mjs` — 身份系统（SOUL.md/IDENTITY.md）是 SFT 和 RLHF 对齐出来的模型行为的 *调用侧* 管理
  - `src/core/memory.mjs` — 记忆系统是对"模型没有持久记忆"这一训练限制的工程补偿
- **远端模型/外部系统做的事：**
  - Claude/GPT 等模型经过 RLHF → 才能理解 System Prompt 中的身份设定
  - 模型的安全拒绝行为来自 RLHF 对齐
- **为什么 Agent 开发者需要知道这个：**
  - 理解 RLHF 才能理解"为什么模型有时候过度谨慎拒绝回答" → 知道怎么写更好的 System Prompt
  - 理解遗忘问题 → 知道为什么 fine-tune 后的模型可能丢失通用能力
- **和之后内容的关系：** D08-D09 Tokenization → D10-D12 Agent 核心 → Agent 的能力上限就是 LLM 的训练决定的

---

## ✅ 自检清单

- [ ] **能画出完整训练链路**：Pretrain → SFT → RLHF(RM+PPO) → Post-training → 终身学习，每步解决什么问题
- [ ] **能解释 RLHF vs SFT 的区别**：格式 vs 质量，用 InstructGPT 三步法讲清
- [ ] **能解释 DPO**：为什么不需要 RM，和 RLHF 的等价关系
- [ ] **能解释灾难性遗忘**：三个原因 + 四种对抗策略
- [ ] **能解释 Model Merging**：Task Vector 是什么，为什么能"不训练"就合并
- [ ] **能说出和 Agent/Muse 的关系**：RLHF 影响模型行为 → 影响 System Prompt 设计

### 面试题积累（2 题）

**Q1: 请解释 RLHF 的三步法以及 DPO 作为替代方案的优劣**

> 你的回答：___
>
> 参考：SFT→RM→PPO。DPO 跳过 RM，直接从偏好数据优化，数学上等价但更简单。PPO 更灵活但需要训 RM。

**Q2: 如果你 fine-tune 了一个 LLM 学中文，发现它英文能力下降了，可能的原因和解法是什么？**

> 你的回答：___
>
> 参考：原因=灾难性遗忘（参数方向冲突+特征漂移）。解法：LoRA 隔离、混合训练（中英数据混合）、Model Merging（独立训练后合并 Task Vector）

---

### 补充资源 — 李宏毅知识包

> 以下知识包来自李宏毅 ML 课程，经 AI 从完整转录稿中提炼，每篇包含 [Fact] 标记的讲师原话和第一性原理分析。

- [LH25_06_post_training — Post-training + Forgetting](../../reference/courses/lee-hongyi/knowledge/LH25_06_post_training.md)
  - 核心价值：三阶段训练管线（Pretrain→SFT→RLHF）、灾难性遗忘及对抗策略
- [LH25_11_model_merging — Model Merging](../../reference/courses/lee-hongyi/knowledge/LH25_11_model_merging.md)
  - 核心价值：Task Vector 数学、接枝类比、LLaMA-2 中文+Alignment 合并案例
- [LH25F_08_lifelong_learning — 通用模型的终身学习](../../reference/courses/lee-hongyi/knowledge/LH25F_08_lifelong_learning.md)
  - 核心价值：Replay / Parameter Isolation / Model Merging / Knowledge Distillation 四大抗遺忘策略
- [LH25_10_model_editing — Model Editing](../../reference/courses/lee-hongyi/knowledge/LH25_10_model_editing.md)
  - 核心价值：ROME 定点修改、和 RAG 的对比、Efficacy/Generalization/Specificity 评估三维度

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
