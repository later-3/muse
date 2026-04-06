# 训练管线

> **一句话定义**: LLM 的训练管线是从原始文本到可对话 AI 的三阶段流程——预训练 (Pre-training) 奠定基础知识，监督微调 (SFT) 教会对话格式，对齐训练 (RLHF/DPO) 让模型行为符合人类期望。

## 核心原理

### 三阶段管线概览

```
Stage 1: Pre-training                Stage 2: SFT              Stage 3: Alignment
(无监督，海量数据)                    (有监督，精标数据)          (人类偏好优化)
                                                                
Internet Text (TB)                  Instruction-Response       Human Preferences
     ↓                              pairs (~100K)              (comparisons)
┌──────────────┐                   ┌────────────┐             ┌────────────┐
│ Base Model   │ ─── finetune ──→  │ Chat Model │ ─── align ──→ │ Final Model│
│ (next-token) │                   │ (follows   │              │ (helpful,  │
│              │                   │  instruct) │              │  harmless) │
└──────────────┘                   └────────────┘             └────────────┘
   GPT-2/124M                      ChatGPT-like               Claude/GPT-4
   训练: 4天 / 8×A100               训练: 小时级                训练: 天级
```

### Stage 1: 预训练 (Pre-training)

**目标**：学习语言的统计规律。给定前 N 个 token，预测第 N+1 个。

nanoGPT 是最简洁的预训练实现 (~300 行 train.py)：

```python
# 核心训练循环 (简化)
for iter in range(max_iters):
    # 采样一批数据
    X, Y = get_batch('train')  # X: 输入序列, Y: 目标序列 (右移一位)
    
    # 前向传播 + 计算损失
    logits, loss = model(X, Y)  # Cross-Entropy Loss
    
    # 反向传播 + 梯度更新
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

**关键数据处理**：
```python
# nanoGPT 的数据加载
data = np.memmap('train.bin', dtype=np.uint16, mode='r')
# 随机采样 block_size 长度的连续序列
ix = torch.randint(len(data) - block_size, (batch_size,))
x = torch.stack([data[i:i+block_size] for i in ix])
y = torch.stack([data[i+1:i+1+block_size] for i in ix])
```

**nanoGPT 的训练成果**：

| 配置 | 硬件 | 时间 | 效果 |
|-----|------|------|------|
| Shakespeare (字符级) | 1×A100 | 3 分钟 | 生成类似莎翁的文本 |
| GPT-2 124M (OpenWebText) | 8×A100 | 4 天 | 复现 GPT-2 的 val loss |
| Shakespeare (CPU) | MacBook | 3 分钟 | 基本的字符模式 |

### Stage 2: 监督微调 (SFT)

**目标**：教模型"对话格式"——接受指令、思考、输出结构化回复。

Open-R1 提供了 SFT 的完整实现：

```bash
# SFT 训练命令 (Open-R1)
accelerate launch --config_file=recipes/accelerate_configs/zero3.yaml \
    src/open_r1/sft.py \
    --model_name_or_path Qwen/Qwen2.5-Math-7B \
    --dataset_name open-r1/Mixture-of-Thoughts \
    --learning_rate 4.0e-5 \
    --num_train_epochs 5 \
    --max_seq_length 32768 \
    --per_device_train_batch_size 2 \
    --gradient_checkpointing \
    --bf16
```

**SFT 的关键设计决策**：
- **学习率**：比预训练低 1-2 个数量级 (4e-5 vs 6e-4)
- **数据量**：只需 ~100K 高质量指令对（vs 预训练的 TB 级）
- **Chat Template**：定义对话格式（im_start/im_end, user/assistant 标记）
- **EOS Token 对齐**：不同模型的 chat template 用不同的结束标记

### Stage 3: 对齐训练

LLMs-from-scratch ch07 详细讲解了两种主流方案：

#### RLHF (Reinforcement Learning from Human Feedback)

```
1. 人类对同一问题的多个回复排序
2. 训练 Reward Model (学习人类偏好)
3. 用 PPO 优化策略模型 → 最大化 Reward
```

#### DPO (Direct Preference Optimization)

```
不需要单独的 Reward Model
直接从偏好数据优化策略:
  Loss = -log σ(β · (log π(y_w|x)/π_ref(y_w|x) - log π(y_l|x)/π_ref(y_l|x)))
  
  y_w: 人类偏好的回复 (winner)
  y_l: 被拒绝的回复 (loser)
```

DPO 的优势：更简单、更稳定、不需要 RL 训练循环。

#### GRPO (Group Relative Policy Optimization)

DeepSeek-R1 引入的创新方法，Open-R1 完整复现：

```bash
# GRPO 训练 (Open-R1)
accelerate launch --config_file recipes/accelerate_configs/zero3.yaml \
    src/open_r1/grpo.py \
    --config recipes/DeepSeek-R1-Distill-Qwen-1.5B/grpo/config_demo.yaml \
    --vllm_mode colocate
```

**GRPO 的关键创新**：
- 组内相对排序（不需要外部 Reward Model）
- 针对数学/代码任务使用**可验证奖励** (verifiable rewards)
- 支持代码执行 sandbox (E2B/Morph) 实时验证

### 蒸馏 (Distillation)

Open-R1 的 Step 1 — 从强模型蒸馏推理能力到小模型：

```
DeepSeek-R1 (671B, MoE)
       ↓ 生成推理链 (Mixture-of-Thoughts, 350K traces)
       ↓ SFT 在小模型上
OpenR1-Distill-7B
```

**成果对比**：

| 模型 | 参数量 | AIME 2024 | MATH-500 | GPQA |
|------|--------|-----------|----------|------|
| OpenR1-Distill-7B | 7B | 52.7 | 89.0 | 52.8 |
| DeepSeek-R1-Distill-7B | 7B | 51.3 | 93.5 | 52.4 |

→ 开源复现几乎达到原版水平。

### 训练优化技术

| 技术 | 作用 | 来源 |
|------|------|------|
| **DeepSpeed ZeRO** | 分布式训练，分片优化器/参数 | Open-R1 |
| **Gradient Checkpointing** | 用计算换内存 | Open-R1 |
| **BF16 混合精度** | 减少内存，加速计算 | nanoGPT + Open-R1 |
| **torch.compile()** | PyTorch 2.0 JIT 编译 | nanoGPT |
| **Weight Decay 分组** | 2D 参数 decay，1D 参数不 decay | nanoGPT |
| **Cosine LR Schedule** | 学习率余弦退火 | nanoGPT |
| **vLLM 后端** | GRPO 中高效生成 rollout | Open-R1 |

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [nanoGPT](../../repos/nanoGPT/) | train.py + README | ⭐⭐⭐ | 预训练完整实现 (~300 行) |
| [LLMs-from-scratch](../../repos/LLMs-from-scratch/) | ch05-ch07 | ⭐⭐⭐ | 预训练+微调+DPO 全流程 |
| [open-r1](../../repos/open-r1/) | 完整 README | ⭐⭐⭐ | SFT + GRPO + 蒸馏 |
| [huggingface-course](../../repos/huggingface-course/) | 课程内容 | ⭐ | 训练基础设施 |

## 概念间关系

- **下层概念**: [[transformer]] (被训练的架构) / [[tokenization]] (训练数据预处理)
- **上层概念**: [[reasoning]] (推理能力的训练方法)
- **相关概念**: [[agent-definition]] (训练好的模型 = Agent 的 "大脑")

## 与 Agent 的关系

| 训练阶段 | Agent 影响 |
|---------|-----------|
| **Pre-training** | 决定了模型的基础能力边界 |
| **SFT** | 教会了模型遵循指令 → Agent 的 system prompt 才能生效 |
| **Alignment** | 让模型回复有帮助且安全 → Agent 的 guardrails |
| **Distillation** | 让小模型也能推理 → 降低 Agent 运行成本 |

## 开放问题

1. **数据质量 vs 数据量**：SFT 用少量高质量数据效果更好。"质量"如何定义和量化？
2. **Scaling Laws**：模型/数据/计算三者的最优配比是什么？Chinchilla 定律还适用吗？
3. **Post-training 的极限**：alignment 能改变多少模型行为？是否存在"无法通过 RLHF 修复"的问题？
4. **合成数据**：用 AI 生成训练数据训练 AI，是否存在"模型坍缩"风险？
