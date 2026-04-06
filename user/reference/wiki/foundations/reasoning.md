# Reasoning 机制

> **一句话定义**: Reasoning 是让 LLM 在生成最终答案之前进行显式的多步思考的机制——从 Chain-of-Thought prompting 到 DeepSeek-R1 的纯 RL 训练，模型正在从"快思考"进化到"慢思考"。

## 核心原理

### 两种思考模式

Daniel Kahneman 的双系统理论在 LLM 中的映射：

| 模式 | 人类类比 | LLM 实现 | 特点 |
|------|---------|---------|------|
| **System 1 (快)** | 直觉反应 | 标准 LLM 生成 | 快速、一步到位、容易出错 |
| **System 2 (慢)** | 深度思考 | 推理模型 (R1/o1) | 慢速、多步推理、更准确 |

### 推理技术谱系

从简单到复杂：

```
Prompt-time 技术 (不改模型):
├── Chain-of-Thought (CoT)      ← "让我们一步步思考"
├── Few-shot CoT                ← 给出推理示例
├── Self-Consistency            ← 多次采样取多数
├── Tree-of-Thought (ToT)       ← 探索多条推理路径
└── ReAct                       ← Reasoning + Action 交替

Train-time 技术 (改模型):
├── SFT on Reasoning Traces     ← 蒸馏推理链 (Open-R1 Step 1)
├── GRPO with Verifiable Rewards ← 纯 RL 训练 (Open-R1 Step 2)
└── Multi-stage Training         ← 基座→RL→对齐 (Open-R1 Step 3)
```

### Chain-of-Thought (CoT)

最简单也最有效的推理增强：

```
❌ 不用 CoT:
Q: 15% of 80 is what?
A: 12

✅ 用 CoT:
Q: 15% of 80 is what? Let's think step by step.
A: 15% means 15/100 = 0.15
   0.15 × 80 = 12
   答案是 12
```

**为什么有效**：让模型把中间推理过程显式地 token 化（写出来），相当于在 context 中给自己提供了更多信息来做最终决策。

### ReAct: 推理与行动的交替

Agent 最核心的推理模式——Reason + Act 交替进行：

```
Thought: 我需要查找巴黎的天气
Action: search("Paris weather today")
Observation: 巴黎今天 22°C，晴天
Thought: 用户可能想知道是否需要带伞
Action: respond("巴黎今天 22°C 晴天，不需要带伞")
```

**与 Agent Loop 的关系**：ReAct 本质上就是 Agent Loop (s01) 的推理维度——模型在每次工具调用前先"思考"（Thought），然后"行动"（Action），再观察结果（Observation）。

### DeepSeek-R1: 纯 RL 训练推理

Open-R1 复现了 DeepSeek-R1 的三步方案：

**Step 1: 蒸馏 (Distillation)**
```
DeepSeek-R1 (671B) 生成推理链
        ↓
  Mixture-of-Thoughts (350K traces)
  - 数学推理链
  - 代码推理链
  - 科学推理链
        ↓
  SFT on 7B base model
        ↓
  OpenR1-Distill-7B
```

**Step 2: 纯 RL (R1-Zero 复现)**
```
Base Model (无 SFT!)
        ↓
  GRPO (Group Relative Policy Optimization)
  - 可验证奖励: 数学答案 / 代码测试通过率
  - 无需人类标注
        ↓
  模型自发学会 "思考" (emerge of thinking)
```

**Step 3: 多阶段训练**
```
Base Model → RL → SFT (推理数据) → Alignment
             ↑
         关键创新：先 RL 再 SFT
```

### GRPO 的 Reward 体系

Open-R1 支持多种可验证奖励：

| 奖励类型 | 验证方式 | 适用任务 |
|---------|---------|---------|
| **数学准确性** | 对比标准答案 | AIME, MATH-500 |
| **代码执行** | 沙箱运行测试用例 | CodeForces, IOI |
| **格式奖励** | 检查 think 标签格式 | 通用 |

代码执行奖励的实现：
```python
# 支持 E2B 和 Morph 两种沙箱
provider_type: e2b   # 或 morph

# 数据集需包含 verification_info 列:
{
    "language": "python",
    "test_cases": [
        {"input": "4\n...", "output": "1\n3\n", "type": "stdin_stdout"}
    ]
}
```

### 推理能力的 Benchmark

Open-R1 的评估矩阵：

| Benchmark | 测试内容 | 采样策略 |
|-----------|---------|---------|
| **AIME 2024** | 高中数学竞赛 | 64 responses/query |
| **MATH-500** | 数学题 | 4 responses/query |
| **GPQA Diamond** | 研究生水平科学 | 8 responses/query |
| **LiveCodeBench** | 实时编程竞赛 | 16 responses/query |

**关键发现**：采样次数对准确性影响很大。AIME 只有 30 道题，需要 64 次采样才能得到稳定的 pass@1 估计。

### Test-Time Compute Scaling

"推理时间的计算量也是可以扩展的"——更多的思考 token = 更好的结果：

```
传统 Scaling: 更大的模型 + 更多训练数据
                  ↓
             更好的能力

Test-Time Scaling: 固定模型 + 更多推理 token
                  ↓
             更好的推理
```

这意味着：
- 小模型 + 多步推理 可能 > 大模型 + 直接回答
- 推理 token 是"计算换准确性"的新维度
- DeepSeek-R1 的 think 标签内容可以非常长（32K+ tokens）

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [open-r1](../../repos/open-r1/) | 完整 README | ⭐⭐⭐ | GRPO + 蒸馏 + 完整复现管线 |
| [Prompt-Engineering-Guide](../../repos/Prompt-Engineering-Guide/) | CoT 章节 | ⭐⭐⭐ | CoT/ToT/ReAct 技术详解 |
| [LLMs-from-scratch](../../repos/LLMs-from-scratch/ch07/) | ch07: DPO | ⭐⭐ | 偏好优化的原理 |
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/) | L09: Metacognition | ⭐ | Agent 自省与推理 |

## 概念间关系

- **基础设施**: [[transformer]] (被训练的架构) / [[training-pipeline]] (训练方法)
- **Agent 应用**: [[agent-definition]] (ReAct = Agent 的推理模式)
- **相关概念**: [[context-engineering]] (推理 token 消耗上下文窗口) / [[prompt-engineering]] (CoT 是 prompt 技术)

## 与 Agent 的关系

| Reasoning 概念 | Agent 影响 |
|---------------|-----------|
| **CoT Prompting** | System prompt 中加 "think step by step" 提升 Agent 推理能力 |
| **ReAct** | Agent Loop 的推理框架 (Thought → Action → Observation) |
| **think 标签** | 推理模型在回复前的内部思考，对 Agent 透明 |
| **Test-Time Scaling** | 允许 Agent 在困难任务上花更多"思考时间" |
| **Verifiable Rewards** | Agent 可以用代码执行验证自己的推理 |

## 开放问题

1. **推理效率**：长推理链消耗大量 token。如何在推理质量和效率之间取平衡？
2. **推理可靠性**：模型可能"假装思考"（Faithfulness 问题）。如何验证推理过程的真实性？
3. **推理泛化**：在数学上训练的推理能力能迁移到其他领域吗？
4. **推理的涌现**：R1-Zero 展示了推理能力可以纯通过 RL 涌现。还有哪些能力可以这样涌现？
5. **成本问题**：推理模型的 token 消耗是普通模型的 10-100 倍。如何让 Agent 智能地选择"何时深度思考"？
