# D15 — N09 Reasoning (2/2)

> **日期：** 2026-04-22（Tue）
> **路线图位置：** Week 3 · Day 15 · N09 Reasoning（第 2 天，共 2 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **怎么评估 Reasoning Model？** 为什么 GSM8K 的分数不再可信？
2. **Reasoning 的成本问题怎么解？** "让模型少想一点"的技术方案有哪些？
3. **Agent 中应该怎么选择模型？** 什么时候用快模型、什么时候用 Reasoning 模型？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（评估 + 成本优化） | 40min | [ ] |
| 2 | 📂 oc10 三 Loop 对比（见下方） | 45min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 李宏毅 [Reasoning 评估](https://youtu.be/s266BzGNKKc) + [Reasoning Shorter](https://youtu.be/ip3XnTpcxoA) + DeepSeek open-r1 项目中提炼。
> 今天是 Reasoning 第二天：**评估的坑 + 成本优化 + 实际选型**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Benchmark Saturation** | 基准测试分数接近满分，不再能区分模型 | 考试太简单了，学霸们都满分 | 新 benchmark 的设计 |
| **Data Contamination** | 测试题出现在训练数据中 | 考前看到了考题 = 分数虚高 | 检测污染的方法 |
| **Process Reward Model (PRM)** | 对推理的每一步打分（不只看最终答案） | 改作文时逐句批改，不只看结尾 | 训练 PRM 的数据成本 |
| **Budget Forcing** | 限制模型的 thinking token 数量来控制成本 | 规定"最多想 30 秒就要回答" | 具体实现机制 |
| **Difficulty-Aware Routing** | 根据问题难度选择不同模型 | 简单题用快模型，难题才用 Reasoning 模型 | 难度估计的方法 |

### Reasoning 评估的三大陷阱

[Fact] 李宏毅在 LH25_08 中系统揭露了评估的问题：

#### 陷阱 1：Benchmark Saturation（基准饱和）

[Fact] GSM8K（小学数学的事实标准）在 2024 年已经被"做烂了"：

```
GPT-3.5 (2023):  57%  → 还有区分度
GPT-4 (2023):    92%  → 快满分了
o1 (2024):       95%+ → 满分附近
多个开源模型:     90%+ → 大家都很高

→ GSM8K 已经无法区分"好模型"和"很好的模型"
```

> "當你發現一個 Benchmark 的分數大家都很高的時候，它就失去了區分能力。"

**新一代 benchmark：** MATH-500、AIME 2024、Codeforces 竞赛题 — 更难、更少被污染。

#### 陷阱 2：Data Contamination（数据污染）

[Fact] 训练数据中可能包含了测试题：

> "GSM8K 的題目在很多網上資源都有出現。如果模型的訓練數據包含了這些資源，它就像是考前看過考卷。"

**检测方法：**
- 同一个问题改一下数字 → 如果答案跟着变对说明真会做，如果变错说明是背的
- 比较模型在"原题"和"变体题"上的表现差距

#### 陷阱 3：Overthinking（过度思考）

[Fact] 李宏毅在 LH25_09 中揭示：

> "很多題目根本不需要 Reasoning 的能力。但 Reasoning Model 對所有問題都想很久。簡單題想太久反而可能把自己繞糊塗。"

```
问题: "1 + 1 = ?"
普通模型: "2"                        → 正确，0.001秒
o1:       "让我想想... 首先...      → 正确，但花了 3 秒 + 500 thinking tokens
           1是自然数... 加法定义..."
```

### Reasoning 的成本问题

[Fact] Reasoning Model 的成本远高于普通模型：

| 模型 | 输入成本 ($/1M token) | 输出成本 | Thinking Token |
|------|-------------------|---------| -------------- |
| GPT-4o-mini | $0.15 | $0.60 | 无 |
| GPT-4o | $2.50 | $10 | 无 |
| o1-mini | $3 | $12 | 有，通常 5-10x output |
| o1 | $15 | $60 | 有，可能 10-20x output |

**关键问题：** 一个简单问题用 o1 回答，可能花 10 美分（500 thinking token + 50 output token）。用 GPT-4o-mini 只要 0.01 美分。**100 倍的费用差距**。

### 成本优化的三大方案

#### 方案 1：Difficulty-Aware Routing（难度感知路由）

[Fact] 李宏毅在 LH25_09 中介绍的核心思路：

```
用户问题 → [难度评估器] → 简单 → GPT-4o-mini（快+便宜）
                       → 中等 → GPT-4o（平衡）
                       → 困难 → o1（强推理，贵）
```

**难度评估器的实现：**
- 用一个小模型先做难度判断（如分 1-5 级）
- 基于规则：数学关键词 → 难，闲聊 → 简单
- 用 embedding 相似度和历史成功率

成本降低 **60-80%**，效果损失 < 5%。

#### 方案 2：Budget Forcing（预算约束）

[Fact] 限制 Reasoning Model 的 thinking token 数量：

```
# 不同预算的效果
Budget = 100 tokens:  简单题准确率 95%，复杂题 60%
Budget = 500 tokens:  简单题准确率 96%，复杂题 80%
Budget = 2000 tokens: 简单题准确率 95%，复杂题 90%（但贵 4x）
```

关键洞察：**简单题给再多 budget 也没用**，复杂题的 budget 增加有明显收益但边际递减。

#### 方案 3：Reasoning Token 蒸馏

[Fact] 用大 Reasoning Model 的推理过程训练小模型：

```
1. 用 o1 对 10K 道难题生成详细推理过程
2. 用这些推理过程 SFT 小模型（如 Qwen-7B）
3. 小模型学会"像 o1 那样想" → 推理能力接近但成本 1/100
```

DeepSeek-R1 就是这样做的 — R1-32B 蒸馏自 R1-671B。

### Agent 中的模型选型实战

[Fact] 综合 D13-D15 的知识，Agent 中的模型选型：

```
Agent 任务类型 → 模型选择

1. 简单工具路由         → GPT-4o-mini  (最快最便宜)
   "帮我查天气"

2. 日常对话+工具使用    → GPT-4o / Claude Sonnet  (平衡)
   "分析这份报告"

3. 复杂规划+多步推理    → o1 / R1  (最强推理)
   "设计一个系统架构"

4. 混合策略 (最佳实践)  → Routing Model
   → 快速判断难度
   → 按难度路由到不同模型
   → 成本降低 60-80%
```

**Muse 的启示：**
- System Prompt 理解 + 简单对话 → GPT-4o-mini 就够
- 需要复杂工具编排时 → 动态升级到更强模型
- 预算有限时 → 固定用一个平衡模型（Claude Sonnet）

### 举例 + 发散

**数值例子：Routing 的成本节省**

假设 Agent 每天处理 1000 个请求：
```
不做 Routing (全用 o1):
  1000 × $0.10 = $100/天

做 Routing:
  800 简单 × $0.001 (mini)  = $0.80
  150 中等 × $0.01 (4o)     = $1.50
  50 困难 × $0.10 (o1)      = $5.00
  总计 = $7.30/天

→ 节省 93%！效果损失 < 5%
```

> **类比（仅类比）：** 不是每个病人都要看"专家门诊"。轻微感冒去社区诊所就行，疑难杂症才需要专家。Routing = 分级诊疗。

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "GSM8K 的分數大家都很高的時候，它就失去了區分能力。" — 李宏毅 LH25_08 | 考试太简单了 = 无法区分优劣 |
| "Reasoning Model 對所有問題都想很久。簡單題想太久反而繞糊塗。" — 李宏毅 LH25_09 | 杀鸡用牛刀会把鸡踩碎 |
| "如果改一下數字答案就變了，代表模型是背的不是真的理解。" — 李宏毅 LH25_08 | 检测模型是"背题"还是"会做题" |

### 🎤 面试追问链

```
Q1: 如果一个 Agent 的推理成本太高，你怎么优化？
→ 你答: 三种方案：1)难度感知路由（简单题用小模型） 2)Budget Forcing（限制thinking token） 3)蒸馏（大模型推理过程训练小模型）
  Q1.1: 难度感知路由怎么实现？
  → 你答: 用小模型或基于规则做难度评估，按等级路由到不同模型。实践中可降本60-80%。
    Q1.1.1: 路由器判断错了怎么办？
    → 你答: 简单题误判为困难 → 只是浪费钱，结果不影响。困难题误判为简单 → 可能答错。所以路由器应偏向"宁可判难不可判简"。

Q2: GSM8K 为什么不再是好的 Reasoning 评估标准？
→ 你答: 两个原因：1)分数饱和（大模型都>90%，无法区分） 2)数据污染（题目在互联网广泛传播，可能被训练数据覆盖）
```

### 这几个概念不要混

- **Benchmark Saturation ≠ Data Contamination**：Saturation = 题太简单，Contamination = 考前看题。两者都让分数不可信但原因不同
- **Process RM ≠ Outcome RM**：Process RM 逐步打分（更精准但标注贵），Outcome RM 只看最终结果
- **Budget Forcing ≠ Early Stopping**：Budget Forcing 是限制 thinking token 数量，Early Stopping 是在 Loss 不再下降时停止训练（完全不同的概念）
- **Routing ≠ Ensemble**：Routing 是选一个模型处理，Ensemble 是多个模型同时处理再合并

### 关键概念清单

- [ ] **评估三陷阱**：基准饱和 / 数据污染 / 过度思考
- [ ] **成本三方案**：Difficulty-Aware Routing / Budget Forcing / 蒸馏
- [ ] **Agent 模型选型**：按任务难度路由到不同模型
- [ ] **Routing 的 ROI**：成本降 60-80%，效果损失 < 5%
- [ ] **Process RM vs Outcome RM**：逐步打分 vs 只看结果
- [ ] **D13-D15 完整 Reasoning 图谱**：原理(CoT) → 训练(GRPO) → 评估(陷阱) → 优化(成本)

---

## 🔧 实践任务：oc10 三 Loop 对比

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L5-synthesize/oc10-loop-comparison.md`

**USOLB 标注：** `[S] 源码` `[O] 观察` `[L] 日志`

**任务说明：**
1. 阅读 oc10 文档，理解 OpenCode / Muse / Swarm 三个 Agent 系统的核心循环对比
2. 标注每个系统的 Reasoning 策略：哪个依赖模型推理？哪个有硬编码逻辑？
3. 思考：如果给 Muse 加 difficulty-aware routing，代码该改哪里？

**和今天理论的联系：**
- 三个系统的"规划"差异 = 对 Reasoning 的不同利用策略
- 成本优化的 routing 方案可以在 Muse 的 engine.mjs 中实现

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 李宏毅 Reason Eval | https://youtu.be/s266BzGNKKc | 评估陷阱 + Process RM |
| 李宏毅 Reason Shorter | https://youtu.be/ip3XnTpcxoA | Budget Forcing + 难度路由 |
| open-r1 | https://github.com/huggingface/open-r1 | 开源 Reasoning Model 训练 |

---

### 补充资源 — 李宏毅知识包

- [LH25_08_reason_eval — Reasoning 评估的坑](../../reference/courses/lee-hongyi/knowledge/LH25_08_reason_eval.md)
  - 核心价值：GSM8K 泄漏、数据污染检测、Process RM 挑战
- [LH25_09_reason_shorter — 降低推理成本](../../reference/courses/lee-hongyi/knowledge/LH25_09_reason_shorter.md)
  - 核心价值：Budget Forcing、Difficulty-Aware Thinking、蒸馏降本

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/core/engine.mjs` — 模型选择。当前是固定模型，未来可加 routing
  - `src/config.mjs` — 配置不同模型。可以为不同任务类型配置不同模型
- **远端模型/外部系统做的事：**
  - OpenAI/Anthropic 的 Reasoning Model 在内部决定 thinking token 数量
  - API 的 `max_completion_tokens` 参数可以间接实现 Budget Forcing
- **未来可以做的事：**
  - 给 Muse 加 difficulty-aware routing（简单对话用 mini，复杂任务用 Sonnet）
  - 监控每次调用的 token 用量，找到成本优化的甜蜜点

---

## ✅ 自检清单

- [ ] **能列出评估三陷阱**：基准饱和 + 数据污染 + 过度思考
- [ ] **能列出成本三方案**：Routing + Budget Forcing + 蒸馏
- [ ] **能估算 Routing 的成本节省**：60-80%，效果损失 < 5%
- [ ] **能给 Agent 做模型选型**：简单→mini，日常→4o，困难→o1
- [ ] **完成 oc10 三 Loop 对比**
- [ ] **能串联 D13-D15**：原理→训练→评估→优化

### 面试题积累（2 题）

**Q1: 你的 Agent 推理成本太高，老板让你砍 50% 成本，你怎么做？**

> 你的回答：___
>
> 参考：加 Difficulty-Aware Routing。80%的请求是简单问题 → 用4o-mini($0.001/次)。只有复杂规划才用o1。实践中可砍90%+ 成本。

**Q2: 有人说"o1 在 GSM8K 上 95%，所以推理能力已经接近人类了"，这个说法对吗？**

> 你的回答：___
>
> 参考：不完全对。两个问题：1)GSM8K 可能有数据污染（改数字后可能变差） 2)GSM8K 太简单（基准饱和），要看 AIME/Codeforces 等更难的 benchmark。95%≠真正理解。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
