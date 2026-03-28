# Foundations — 大模型知识全景

> **用法：从 unit 入手，碰到不懂的回来查。不需要通读。**

---

## 知识层级图

```
Layer 0: 数学/神经网络基础
  └─ F5  Neural Networks (backprop/gradient)              ⏳ 占位

Layer 1: Transformer 内部
  ├─ F2  Transformer 架构 (Attention/FFN)                 ✅ 已写
  └─ F11 Tokenization (BPE/分词/中文成本)                 ⏳ 占位

Layer 2: LLM 训练
  ├─ F1  LLM 全貌 (next-token/能力边界/CoT/R1/o1)        ✅ 已写
  ├─ F3  训练管线 (预训练→SFT→RLHF/Function Calling)     ✅ 已写
  └─ F9  蒸馏与微调 (KD/LoRA/QLoRA/DPO)                  ✅ 已写

Layer 3: LLM 使用
  ├─ F4  李宏毅大模型课 (中文深入)                        ⏳ 占位
  ├─ F6  Prompt Engineering (吴恩达)                      ⏳ 占位
  ├─ F7  Building Systems (吴恩达)                        ⏳ 占位
  └─ F12 评测与基准 (MMLU/Arena/SWE-Bench)                ⏳ 占位

Layer 4: LLM 增强
  ├─ F8  RAG + Embedding + 向量搜索                       ⏳ 占位
  └─ F13 推理优化 (Flash Attention/KV-Cache)              ⏳ 占位

Layer 5: LLM 部署
  └─ F10 量化/GGUF/本地部署 (3090实操)                    ✅ 已写

Layer 6: LLM 前沿
  ├─ F14 多模态 (Vision-Language)                         ⏳ 占位
  └─ F15 AI Safety & 对齐                                ⏳ 占位
```

---

## 从 Unit 来查的速查表

| 你在看 | 碰到什么不懂 | 来这里 |
|--------|------------|--------|
| unit01 Agent 核心 | LLM 怎么"规划"的 | F1 §4 (CoT/R1/o1) |
| unit01 Agent 核心 | 上下文窗口为什么有限 | F2 §3 (Attention O(n²)) |
| unit01 Agent 核心 | Function Calling 怎么来的 | F3 §2 (SFT) |
| unit01 Agent 核心 | temperature=0.1 为什么 | F6 §4 (参数选择) |
| unit01 Agent 核心 | util.py 里 XML 为什么比 JSON 好 | F6 §2 (结构化输出) |
| unit02 多 Agent | Prompt Injection 怎么防 | F15 §3-4 |
| unit03 状态/记忆 | 向量数据库怎么工作 | F8 §2-3 |
| unit03 状态/记忆 | 记忆 ≠ Attention 怎么理解 | F2 §2 + F1 §3 |
| unit04 Prompt | Prompt 基本原则是什么 | F6 §1-2 |
| 想跑本地模型 | 蒸馏是什么原理 | F9 §1 |
| 想跑本地模型 | 3090 能跑什么模型 | F10 §3-4 |
| 想跑本地模型 | 量化后怎么评估质量 | F12 |
| 准备面试 | Token 成本怎么算 | F11 §3 |
| 准备面试 | 怎么评价模型好坏 | F12 §4-6 |

---

## 状态统计

| 状态 | 数量 | 文件 |
|------|------|------|
| ✅ 已写 | 5 | F1, F2, F3, F9, F10 |
| ⏳ 占位 | 10 | F4, F5, F6, F7, F8, F11, F12, F13, F14, F15 |
