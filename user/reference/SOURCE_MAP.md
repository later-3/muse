# 源材料分类映射 — 每个知识点从哪里来

> **原则：** 学习文档的每一段内容都必须有来源。这个文件明确"写 F6 的时候，去哪个 repo 的哪个文件找素材"。
> **路径前缀：** `repos/` = `user/reference/repos/`

---

## F1: LLM 入门

| 知识点 | 首选来源（本地） | 补充来源 | 状态 |
|--------|---------------|---------|------|
| LLM 是什么 / 两个文件 | `repos/LLMs-from-scratch/ch01/` [B1] | C1 Karpathy YouTube | ✅ 已写 |
| Next-token prediction | `repos/LLMs-from-scratch/ch01/` [B1] | C1 Karpathy | ✅ 已写 |
| Transformer 概述 | `repos/LLMs-from-scratch/ch03/` [B1] | [W1] Jay Alammar Illustrated Transformer | ✅ 简述 |
| 训练三阶段 (Pre/SFT/RLHF) | `repos/LLMs-from-scratch/ch05-07/` [B1] | C3 State of GPT, P3 InstructGPT | ✅ 已写 |
| 发展脉络 (GPT-1→o1) | P2 Scaling Laws 论文 | C1 Karpathy, [W3] Raschka | ✅ 已写 |
| CoT 原理 (Prompt CoT) | P4 Wei et al. 2022 论文 | `repos/Prompt-Engineering-Guide/` CoT 章节 [G16] | ✅ 已写 |
| GRPO / DeepSeek R1 思考 | `repos/open-r1/` [G10] | P5 R1 论文, [W6] philschmid Mini-R1 | ✅ 已重写 |
| Agent Loop / Claude Code | [W5] Anthropic BEA | `repos/anthropic-cookbook/patterns/agents/` | ✅ 已写 |

---

## F2: Transformer 从零构建

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| Self-Attention 数学 | `repos/LLMs-from-scratch/ch03/01_main-chapter-code/` [B1] | [W1] Illustrated Transformer |
| Q/K/V 矩阵 | `repos/LLMs-from-scratch/ch03/` [B1] | [W1] Alammar Blog, U1 CS224N slides |
| Multi-Head Attention | `repos/LLMs-from-scratch/ch03/02_bonus_efficient-multihead-attention/` [B1] | P1 Attention 论文 |
| 完整 GPT 架构 | `repos/nanoGPT/model.py` [G1] (极简实现) | `repos/LLMs-from-scratch/ch04/` [B1] |
| 位置编码 | `repos/LLMs-from-scratch/ch02/` 嵌入部分 [B1] | U1 CS224N |
| 训练循环 | `repos/nanoGPT/train.py` [G1] | `repos/LLMs-from-scratch/ch05/` [B1] |
| GQA / KV-Cache | `repos/LLMs-from-scratch/ch04/03_kv-cache/`, `ch04/04_gqa/` [B1] | 无 |
| MoE 架构 | `repos/LLMs-from-scratch/ch04/07_moe/` [B1] | 无 |
| MIT Lab 动手 | `repos/introtodeeplearning/lab1/` [U4] | U4 MIT 视频 |

---

## F3: 训练管线 (Pre→SFT→RLHF→DPO)

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| 预训练完整代码 | `repos/LLMs-from-scratch/ch05/01_main-chapter-code/` [B1] | C3 State of GPT |
| SFT 对话格式训练 | `repos/LLMs-from-scratch/ch07/01_main-chapter-code/` [B1] | P3 InstructGPT |
| RLHF → DPO | `repos/LLMs-from-scratch/ch07/04_preference-tuning-with-dpo/` [B1] | P3 InstructGPT |
| 学习率调度 | `repos/LLMs-from-scratch/ch05/04_learning_rate_schedulers/` [B1] | 无 |
| 分布式训练概念 | U5 Berkeley CS285 slides | C3 State of GPT |

---

## F6: Prompt 工程

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| Zero-Shot / Few-Shot | `repos/Prompt-Engineering-Guide/guides/prompts-basic-usage.md` [G16] | [W11] OpenAI Guide |
| Chain-of-Thought | `repos/Prompt-Engineering-Guide/guides/prompts-advanced-usage.md` [G16] | P4 CoT 论文 |
| 对抗性 Prompt / 越狱 | `repos/Prompt-Engineering-Guide/guides/prompts-adversarial.md` [G16] | [W10] Anthropic |
| System Prompt 设计 | `repos/anthropic-cookbook/` 相关 examples | [W10] Anthropic Prompt Library |
| Prompt 可靠性 | `repos/Prompt-Engineering-Guide/guides/prompts-reliability.md` [G16] | D4 Building Systems |
| 实际应用案例 | `repos/Prompt-Engineering-Guide/guides/prompts-applications.md` [G16] | C6 Andrew Ng 短课 |

---

## F8: RAG

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| RAG 架构和原理 | `repos/anthropic-cookbook/capabilities/retrieval_augmented_generation/` | P9 RAG 论文 |
| 嵌入和向量检索 | `repos/anthropic-cookbook/capabilities/contextual-embeddings/` | D1 Agentic RAG |
| 知识图谱 RAG | `repos/anthropic-cookbook/capabilities/knowledge_graph/` | 无 |
| Agentic RAG | `repos/ai-agents-for-beginners/05-agentic-rag/` [C8] | D1 LlamaIndex 短课 |

---

## F9: 微调 (LoRA/QLoRA)

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| 分类微调 | `repos/LLMs-from-scratch/ch06/01_main-chapter-code/` [B1] | D5 Finetuning 短课 |
| 指令微调 | `repos/LLMs-from-scratch/ch07/01_main-chapter-code/` [B1] | P3 InstructGPT |
| DPO 偏好微调 | `repos/LLMs-from-scratch/ch07/04_preference-tuning-with-dpo/` [B1] | 无 |
| HuggingFace 生态 | `repos/huggingface-course/chapters/` [U6] | U6 HF Course 网站 |
| Anthropic 微调 | `repos/anthropic-cookbook/finetuning/` | 无 |
| LoRA/QLoRA 理论 | P7 LoRA + P8 QLoRA 论文 | [W3] Raschka Blog |

---

## F10: 部署 / 量化

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| GGUF 格式 | llama.cpp 文档 (在线) | [W8] 量化可视化 |
| 权重加载优化 | `repos/LLMs-from-scratch/ch05/08_memory_efficient_weight_loading/` [B1] | 无 |
| HuggingFace 部署 | `repos/huggingface-course/` 部署相关章节 [U6] | U6 HF Course |
| Ollama/LM Studio | 在线文档 | 无 |

---

## F11: Tokenization

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| BPE 算法实现 | `repos/minbpe/` 全部 ⭐ [G2] | C4 Karpathy Tokenizer |
| BPE 练习 | `repos/minbpe/exercise.md` [G2] | C4 视频跟练 |
| Text → Token 数据处理 | `repos/LLMs-from-scratch/ch02/01_main-chapter-code/` [B1] | 无 |
| 扩展分词器 | `repos/LLMs-from-scratch/ch05/09_extending-tokenizers/` [B1] | 无 |

---

## unit01: Agent Core (Agent 循环 / 工具调用 / 模式对比)

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| Agent 三要素 (Planning/Memory/Tools) | [W4] Weng Blog (在线) | `repos/ai-agents-for-beginners/01-intro-to-ai-agents/` [C8] |
| Agent 循环 (Reason→Act→Observe) | `repos/anthropic-cookbook/patterns/agents/README.md` [G5] | P6 ReAct 论文 |
| 5 种 Agent 模式 | `repos/anthropic-cookbook/patterns/agents/` ⭐ [G5] | [W5] Anthropic BEA 博客 |
| ├─ Prompt Chaining | `repos/anthropic-cookbook/patterns/agents/basic_workflows.ipynb` | 无 |
| ├─ Orchestrator-Workers | `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` | 无 |
| └─ Evaluator-Optimizer | `repos/anthropic-cookbook/patterns/agents/evaluator_optimizer.ipynb` | 无 |
| Tool Use / Function Calling | `repos/ai-agents-for-beginners/04-tool-use/` [C8] | D1 LlamaIndex |
| ReAct 模式 | P6 论文 + `repos/ai-agents-for-beginners/` 相关 | 无 |
| Agentic 设计模式 | `repos/ai-agents-for-beginners/03-agentic-design-patterns/` [C8] | [W5] BEA |
| Berkeley Agent 全景 | `repos/llm-agents-mooc/slides/intro.pdf` [U2] | U2 视频 |
| Agent 可信赖 | `repos/ai-agents-for-beginners/06-building-trustworthy-agents/` [C8] | 无 |
| Context Engineering | `repos/ai-agents-for-beginners/12-context-engineering/` [C8] | 无 |

---

## unit02: 多 Agent 协作

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| Orchestrator-Worker 实现 | `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` [G5] | 无 |
| Handoff 协议 | `repos/swarm/swarm/` 核心代码 ⭐ [G6] | `repos/swarm/examples/triage_agent/` |
| Swarm run() 函数 | `repos/swarm/swarm/core.py` [G6] | 无 |
| Swarm 示例 | `repos/swarm/examples/` (airline → personal_shopper) [G6] | 无 |
| 多 Agent 系统 | `repos/ai-agents-for-beginners/08-multi-agent/` [C8] | D2 crewAI 短课 |
| Agent 规划 | `repos/ai-agents-for-beginners/07-planning-design/` [C8] | U2 Berkeley slides |
| 元认知 | `repos/ai-agents-for-beginners/09-metacognition/` [C8] | 无 |
| Agent 协议 | `repos/ai-agents-for-beginners/11-agentic-protocols/` [C8] | 无 |
| multi-modal agent | `repos/llm-agents-mooc/slides/Multimodal_Agent_caiming.pdf` [U2] | 无 |
| software agents | `repos/llm-agents-mooc/slides/neubig24softwareagents.pdf` [U2] | 无 |

---

## unit03: 状态 + 记忆

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| Agent 记忆 | `repos/ai-agents-for-beginners/13-agent-memory/` [C8] | [W4] Weng Blog 记忆部分 |
| 向量嵌入 | `repos/anthropic-cookbook/capabilities/contextual-embeddings/` [G5] | 无 |
| LangGraph 状态机 | D3 LangGraph 短课 (在线) | C7 LangChain 短课 |
| Hello-Agents 记忆章节 | `repos/hello-agents/docs/chapter10-13/` [G7] | 无 |
| 生产环境 Agent | `repos/ai-agents-for-beginners/10-ai-agents-production/` [C8] | 无 |
| Microsoft Agent 框架 | `repos/ai-agents-for-beginners/14-microsoft-agent-framework/` [C8] | 无 |

---

## unit04: Prompt 工程

| 知识点 | 首选来源（本地） | 补充来源 |
|--------|---------------|---------|
| 7 层 Prompt 架构 | `repos/Prompt-Engineering-Guide/` 全部 ⭐ [G16] | C6 Andrew Ng |
| Zero/Few-Shot | `repos/Prompt-Engineering-Guide/guides/prompts-basic-usage.md` [G16] | 无 |
| CoT / ToT / Self-Consistency | `repos/Prompt-Engineering-Guide/guides/prompts-advanced-usage.md` [G16] | P4 论文 |
| System Prompt 最佳实践 | `repos/anthropic-cookbook/` + [W10] Anthropic Library | [W11] OpenAI Guide |
| Prompt Injection 防御 | `repos/Prompt-Engineering-Guide/guides/prompts-adversarial.md` [G16] | 无 |
| Hello-Agents Prompt 章节 | `repos/hello-agents/docs/chapter5-6/` [G7] | 无 |
| Extended Thinking | `repos/anthropic-cookbook/extended_thinking/` [G5] | 无 |
| 评估和调试 | D6 Eval+Debug 短课 (在线) | `repos/ai-agents-for-beginners/06-building-trustworthy-agents/` |

---

## 快速查表 — "我要写 XX 知识点，去哪里找素材？"

```
要写 Attention 机制？
  → repos/LLMs-from-scratch/ch03/ (代码) + W1 Alammar (图)

要写 Agent 循环？
  → repos/anthropic-cookbook/patterns/agents/ (代码) + W4 Weng (理论)

要写 Handoff？
  → repos/swarm/ (完整实现) + repos/swarm/examples/triage_agent/

要写 GRPO？
  → repos/open-r1/ (复现代码) + P5 论文 (理论)

要写 Prompt CoT？
  → repos/Prompt-Engineering-Guide/ CoT 章节 + P4 论文

要写微调？
  → repos/LLMs-from-scratch/ch06-07/ (代码) + repos/huggingface-course/ (生态)

要写 Tokenizer？
  → repos/minbpe/ (实现) + repos/LLMs-from-scratch/ch02/ (数据处理)

要写 Agent 模式对比？
  → repos/ai-agents-for-beginners/03-agentic-design-patterns/ + Berkeley slides
```
