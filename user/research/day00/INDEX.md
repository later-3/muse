# Day 00 大模型基础（前置知识）

> **这里放的是 Agent 之前的底层知识。Day 01-07 会链接到这里。**
> 不需要一次看完，按需引用。优先看 F1-F3（Karpathy 三件套）。

## 📖 AI 交付（你来吸收）

### ⭐ 优先（Karpathy 三件套 + 蒸馏部署）

| # | 课程 | 讲师 | 核心收获 | 状态 |
|---|------|------|---------|------|
| [AI✓] F1 | Intro to LLMs | Karpathy | LLM 全貌：训练/推理/能力边界/DeepSeek R1 原理 | 已交付 |
| [AI✓] F2 | Let's build GPT | Karpathy | 从零理解 Transformer/Attention | 已交付 |
| [AI✓] F3 | State of GPT | Karpathy | 预训练→SFT→RLHF+Function Calling 内部机制 | 已交付 |
| [AI✓] F9 | 蒸馏与微调 | 综合 | KD/LoRA/QLoRA/DPO + 3090 能力矩阵 | 已交付 |
| [AI✓] F10 | 小模型本地部署 | 综合 | GGUF/量化/llama.cpp/ollama + 3090 实操路线 | 已交付 |

### 推荐（按需看）

| # | 课程 | 讲师 | 核心收获 | 状态 |
|---|------|------|---------|------|
| [ ] F4 | 大模型原理 | 李宏毅 | Transformer 到 Agent（中文最佳） | 待写 |
| [ ] F5 | Neural Networks | 3Blue1Brown | 直觉理解 backprop | 待写 |
| [ ] F6 | Prompt Engineering | 吴恩达+OpenAI | 系统化 prompt 技巧 | 待写 |
| [ ] F7 | Building Systems | 吴恩达 | LLM 应用工程化 | 待写 |
| [ ] F8 | LangChain + RAG | 吴恩达 | 检索增强生成 | 待写 |

## 怎么用这个目录

```
场景 1: 你在 Day 03 读到"工具使用"
  → 不理解 LLM 怎么学会调工具的
  → 来 day00/F3-state-of-gpt.md §2（SFT 教会 Function Calling）
  → 理解了 → 回到 Day 03 继续

场景 2: 你想在 3090 上跑 qwen 蒸馏模型
  → F9: 理解蒸馏原理（Teacher 教 Student）
  → F10: 部署实操（ollama 一行命令）
  → Sprint 2 真跑

场景 3: 面试被问"DeepSeek R1 思考怎么实现的"
  → F1 §4: RL reward → 模型自动输出 <think>
  → F9 §1.3: 推理蒸馏 → 小模型也能推理
```
