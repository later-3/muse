# D13 — N09 Reasoning (1/2)

> **日期：** 2026-04-20（Sun）
> **路线图位置：** Week 2 · Day 13 · N09 Reasoning（第 1 天，共 2 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **LLM 的"推理"到底是什么？** 它是真的在思考，还是只是更好的文字接龙？
2. **CoT (Chain-of-Thought) 为什么有效？** 从技术层面解释它的原理
3. **Reasoning Model (o1/R1) 和普通模型有什么本质区别？** "思考时间"是怎么回事？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Reasoning 原理） | 40min | [ ] |
| 2 | 📂 oc07 Prompt 注入链实验（见下方） | 45min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 李宏毅 [Reasoning](https://youtu.be/bJFtcwLSNxI) + Wei et al. CoT 论文 (2022) + DeepSeek-R1 技术报告中提炼的核心知识。
> 今天是 Reasoning 两天学习的第一天：**原理 + CoT + Reasoning Model 的训练**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Chain-of-Thought (CoT)** | 让 LLM "先想再答"的 Prompt 技巧 | 在答案前加一段推理过程 | Few-shot vs Zero-shot CoT |
| **Reasoning Model** | 专门训练过推理能力的模型（o1/R1） | 输出前会先生成一段"内部思考" | 训练时的 RL 算法细节 |
| **Test-Time Compute** | 推理时花更多计算来"想更久" | 可以用更多时间换更好的答案 | 搜索算法（MCTS）|
| **GRPO** | DeepSeek-R1 使用的强化学习算法 | 不需要 Reward Model，直接用组内对比分配奖励 | 与 PPO 的数学差异 |
| **Thinking Token** | Reasoning Model 内部思考产生的 token | 用户看不到，但消耗计算和费用 | 不同模型的 thinking 格式 |

### 🌍 背景：为什么要学这个？

**承接 D10-D12 Agent 核心：** 你已经知道 Agent = LLM + 工具 + 循环。但 Agent 的规划能力（Planning）直接取决于 LLM 的**推理能力**。推理越强 → Agent 越能把复杂任务分解成正确的步骤。

[Fact] 李宏毅在 LH25_07 中定义：

> "推理就是 Slow Thinking。以前 LLM 就是 Fast Thinking — 問什麼立刻答。現在 Reasoning Model 會先想一下再回答。"

**技术栈位置：**
```
D10-12 Agent核心          D13 Reasoning ← 你在这里
─────────────            ─────────────
Agent = LLM + 工具 + 循环   推理 = Agent 的"大脑质量"
  其中 LLM 的推理能力        CoT/o1/R1 = 更强的大脑
  决定了 Agent 的天花板
```

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2022.1 | Wei et al. (Google) | CoT 论文 | 第一个系统证明"让模型说出推理过程"能大幅提升效果 |
| 2022.5 | Kojima et al. | Zero-shot CoT | 发现只加"Let's think step by step"就有效！ |
| 2024.9 | OpenAI | o1 模型 | 首个商业 Reasoning Model，在数学/代码上碾压 GPT-4 |
| 2024.12 | DeepSeek | DeepSeek-R1 | 开源 Reasoning Model，用 GRPO 替代 PPO |
| 2025.1 | DeepSeek | R1-Zero | 纯 RL 训练出推理能力，无需 SFT — 震惊业界 |

### 第一性原理：LLM 的"推理"到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — LLM 是文字接龙机**

[Fact] LLM 本质上做的是 P(x_{n+1} | x_1, ..., x_n) — 给定前文预测下一个 token。它**没有显式的推理引擎**（不像程序有 if/else 逻辑）。

那它怎么"推理"的？

**Layer 1 — CoT 的核心洞察**

[Fact] Wei et al. (2022) 的发现 — **让模型输出中间步骤，答案就变准了**：

```
❌ 传统: "Roger 有 5 个网球，又买了 2 罐（每罐 3 个），他有几个？" → "11"
✅ CoT:  "Roger 有 5 个网球，又买了 2 罐（每罐 3 个），他有几个？"
         → "他原来有 5 个。买了 2 × 3 = 6 个。一共 5 + 6 = 11 个。答案是 11。"
```

两种回答结果一样，但 CoT 在更复杂的问题上**准确率高出 30-50%**。

**为什么 CoT 有效？**

[Fact] 李宏毅在 LH25_07 中的理论解释：

> "Transformer 每一層只能做有限的計算。如果問題的计算复杂度超過了層數能做的事情，就一定會答錯。但如果讓它先產生中間步驟，每個步驟都經過全部的層數去計算，等於讓 Transformer 做了更多的計算。"

**通俗解释：** Transformer 的每一层 = 一步简单计算。如果问题需要 20 步才能解决，但模型只有 32 层 → 直接回答可能 "算不过来"。但如果 CoT 让模型把中间步骤写出来 → 每个中间步骤都经过 32 层处理 → 总计算量翻倍 → 能解决更复杂的问题。

```
直接回答:  Input → [32层Transformer] → Answer（32层计算量）
CoT回答:   Input → [32层] → Step1 → [32层] → Step2 → [32层] → Answer（96层计算量）
```

**Layer 2 — Reasoning Model：从 Prompt 技巧到模型能力**

[Fact] CoT 是 Prompt 技巧（任何模型都能用），Reasoning Model 是**训练出来的能力**：

| 维度 | CoT (Prompt 技巧) | Reasoning Model (o1/R1) |
|------|-------------------|------------------------|
| 实现 | Prompt 中加"请一步一步想" | 模型内部自动产生思考链 |
| 训练 | 不需要额外训练 | 需要 RL 训练（GRPO/PPO） |
| 思考过程 | 用户可见（在输出中） | 通常隐藏（thinking token） |
| 计算消耗 | 输出 token 增加 | 增加很多 thinking token |
| 效果提升 | 中等 | 大幅（数学/代码） |

**Layer 3 — 完整定义**

LLM Reasoning = 通过生成中间推理步骤来增加有效计算量，从而解决需要多步逻辑的复杂问题的能力。可以通过 Prompt（CoT）或训练（Reasoning Model）来激活。

### Reasoning Model 是怎么训练的？

[Fact] DeepSeek-R1 的训练揭示了关键路径：

**Step 1：冷启动（Cold Start）**
- 用少量高质量 CoT 示例做 SFT
- 让模型学会"写推理过程"的基本格式

**Step 2：RL 强化（GRPO）**
- 给模型大量数学/代码问题
- 生成多个回答 → 能验证正确性的给高奖励
- GRPO 算法：**不需要 Reward Model** — 组内排名直接当奖励

```
问题: "3x + 5 = 14, x = ?"
回答A: "3x = 9, x = 3" → 正确 → 高奖励
回答B: "x = 14/3"       → 错误 → 低奖励
回答C: "3x = 9, x = 3" → 正确 → 高奖励
→ GRPO: A和C获得正向强化，B被抑制
```

**Step 3：拒绝采样 + 蒸馏**
- 用大模型的推理过程蒸馏到小模型

[Fact] DeepSeek-R1-Zero 的震撼发现：

> "R1-Zero 只用 RL，完全不用 SFT。模型自己发明了 think 的方式 — 甚至学会了用中文思考（尽管训练数据主要是英文）。"

### Test-Time Compute — 推理时间换质量

[Fact] 关键思想 — **花更多时间想 = 更好的答案**：

```
传统模型:  一次 forward pass → 输出答案
Reasoning: 多次 forward pass → 生成 thinking → 最终输出
          ↑花更多计算（时间/钱）  ↑但答案更好
```

[Fact] 李宏毅在 LH25_07 中的比喻：

> "Scaling Law 已經在 Pre-train 的時候遇到了瓶頸。那 Reasoning 就是找到了新的 Scaling 維度 — 不是加更多訓練數據，而是在推理的時候花更多計算。"

这被称为 **Inference-Time Scaling** — 训练阶段的 Scaling Law 遇到瓶颈后的新突破口。

### 举例 + 发散

**数值例子：CoT 的效果差距**

[Fact] Wei et al. (2022) 在 GSM8K（小学数学）上的测试：

| 模型 | 直接回答 | CoT | 提升幅度 |
|------|---------|-----|---------|
| PaLM 540B | 56.5% | 74.4% | +17.9% |
| GPT-3.5 | ~57% | ~78% | ~+21% |

关键发现：CoT 只在大模型（>100B 参数）上有效。小模型加 CoT 反而变差 — 因为小模型"想不清楚"，中间步骤反而引入错误。

> **类比（仅类比）：** 让小学生"一步一步想"能帮助做题。但让幼儿园小朋友"一步一步想"可能越想越乱。模型大小 ≈ "思维能力" ≈ 年龄。

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "We explore the ability of LLMs to perform chain of thought — a series of intermediate reasoning steps." — Wei et al. | CoT = 让 LLM 说出中间推理步骤 |
| "Let's think step by step." — Kojima (Zero-shot CoT) | 就这一句话就能提升推理效果。LLM 的"魔法咒语"。 |
| "推理就是 Slow Thinking。" — 李宏毅 LH25_07 | 快思考(直接回答) vs 慢思考(先想再答) |
| "Scaling Law 遇到瓶頸 → Inference-Time Scaling 是新出路。" — 李宏毅 LH25_07 | 不能再靠"训练更多"了，要靠"想更久" |

### 🎤 面试追问链

```
Q1: CoT 为什么能提升 LLM 的推理能力？
→ 你答: 每个中间步骤都经过全部 Transformer 层计算 → 等效计算量翻倍 → 能解决更复杂的问题
  Q1.1: 那为什么小模型不行？
  → 你答: 小模型的每一层计算能力有限，"一步一步想"时容易在中间步骤出错 → 错误累积 → 最终答案更差
    Q1.1.1: Reasoning Model 和 CoT 有什么区别？
    → 你答: CoT 是 Prompt 技巧（外部引导），Reasoning Model 是训练出来的能力（内部驱动）。后者用 RL(GRPO) 训练出"自动想"的能力。

Q2: Test-Time Compute 和传统的 Scaling Law 有什么关系？
→ 你答: 传统 Scaling Law 在训练阶段（更多数据/更大模型）遇到瓶颈。Test-Time Compute 是新维度 — 在推理阶段花更多计算换更好答案。
```

### 这几个概念不要混

- **CoT ≠ Reasoning Model**：CoT 是 Prompt 技巧（人写）；Reasoning Model 是训练出来的能力（模型自己想）
- **Reasoning ≠ Understanding**：Reasoning 是多步逻辑推导；Understanding 是语义理解。LLM 可能"推理"对了但并不真正"理解"
- **GRPO ≠ PPO**：PPO 需要 Reward Model；GRPO 不需要 — 直接用组内排名当奖励
- **Thinking Token ≠ Output Token**：Thinking Token 是模型内部思考（通常隐藏）；Output Token 是给用户看的

### 关键概念清单

- [ ] **CoT 的原理**：中间步骤增加等效计算量
- [ ] **CoT 只在大模型有效**：>100B 参数才稳定有效
- [ ] **Zero-shot CoT**："Let's think step by step" 的魔力
- [ ] **Reasoning Model vs CoT**：训练能力 vs Prompt 技巧
- [ ] **GRPO**：不需要 RM，组内排名当奖励
- [ ] **R1-Zero 的发现**：纯 RL 能自动学会推理
- [ ] **Test-Time Compute**：推理时间换质量 → Inference-Time Scaling
- [ ] **和 Agent 的联系**：推理能力 = Agent 的规划天花板

---

## 🔧 实践任务：oc07 Prompt 注入链

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L3-analyze/oc07-prompt-chain.md`

**USOLB 标注：** `[O] 观察` `[L] 日志` `[B] 编译`

**任务说明：**
1. 阅读 oc07 文档，理解 Prompt 在 Agent 系统中的组装流程
2. 实验不同的 Prompt 策略（加/不加 CoT 提示），观察模型回答质量变化
3. 思考：System Prompt 中的"请一步一步分析"类指令和今天学的 CoT 是什么关系？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 李宏毅 Reasoning | https://youtu.be/bJFtcwLSNxI | 前 60min：CoT + Reasoning Model |
| CoT 论文 | https://arxiv.org/abs/2201.11903 | Abstract + Section 2-3 |
| DeepSeek-R1 技术报告 | https://arxiv.org/abs/2401.12954 | GRPO + R1-Zero 部分 |

---

### 补充资源 — 李宏毅知识包

- [LH25_07_reasoning — Reasoning 完整解析](../../reference/courses/lee-hongyi/knowledge/LH25_07_reasoning.md)
  - 核心价值：CoT 原理 + GRPO + R1-Zero + Inference-Time Scaling
- [LH25_08_reason_eval — Reasoning 评估的坑](../../reference/courses/lee-hongyi/knowledge/LH25_08_reason_eval.md)
  - 核心价值：GSM8K 泄漏、Process RM 的挑战（D15 会深入）

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/core/identity.mjs` — System Prompt 中如果包含"请一步步分析"类指令 = 手动 CoT
  - `src/core/engine.mjs` — 选择模型时，o1/R1 类模型自动启用 Reasoning
- **远端模型/外部系统做的事：**
  - 如果使用 o1/Claude Sonnet thinking → 模型在内部生成 thinking token → 计费包含这些
  - Thinking token 通常 **比 output token 多 5-10 倍** → 推理任务成本高
- **为什么 Agent 开发者需要知道这个：**
  - **选模型**：简单任务用快模型（GPT-4o-mini），复杂规划用 Reasoning 模型（o1）
  - **成本控制**：Reasoning 模型的 thinking token 很贵 → 不是所有任务都需要
  - **Agent 规划质量**：更好的推理 → Agent 拆解任务更准确 → 最终效果更好

---

## ✅ 自检清单

- [ ] **能解释 CoT 为什么有效**：中间步骤增加等效计算量
- [ ] **能区分 CoT 和 Reasoning Model**：Prompt 技巧 vs 训练能力
- [ ] **知道 GRPO 的核心思路**：不需要 RM，组内排名当奖励
- [ ] **能解释 Test-Time Compute**：推理时花更多计算换更好答案
- [ ] **知道和 Agent 的关系**：推理能力 = Agent 规划的天花板
- [ ] **完成 oc07 Prompt 注入链**

### 面试题积累（2 题）

**Q1: 请解释 Chain-of-Thought 的技术原理。为什么"Let's think step by step"就能提升效果？**

> 你的回答：___
>
> 参考：每个中间推理步骤都经过 Transformer 全部层的计算，等效增加了总计算量。直接回答=32层计算，CoT=每步32层×N步。只在>100B参数的大模型上有效。

**Q2: o1/R1 这样的 Reasoning Model 和普通带 CoT 的 GPT-4 有什么本质区别？**

> 你的回答：___
>
> 参考：CoT 是外部引导（Prompt 技巧），Reasoning Model 是内部能力（RL 训练出来的）。后者自动生成 thinking token，通常隐藏不可见。用 GRPO 等 RL 训练，不需要人标注推理过程。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
