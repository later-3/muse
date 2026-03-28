# F11: Tokenization — 分词原理

> **来源：** Karpathy "Let's build the GPT Tokenizer" + HuggingFace NLP Course
> **状态：** ⏳ 占位 · 待填充
> **一句话：** LLM 看到的不是文字而是 token，理解分词才能理解成本和多语言问题。

---

## ⚡ 3 分钟速读版

```
一句话: [待填充]
3 个关键概念: BPE算法 / Token≠字 / 中文成本
对 Muse 最重要的: 上下文窗口是 token 数不是字数, 中文约 1.5x 英文
面试必记: "BPE 从字符开始，反复合并最高频的字符对，直到词汇表达到目标大小"
```

---

## 核心章节框架

### 1. 为什么需要 Tokenization
> LLM 不能直接处理文字。文字 → token ID → embedding → 模型。
> "hello" = 1 个 token, "你好" = 2 个 token。

### 2. BPE 算法（Byte Pair Encoding）
> 从最小单元（字符/字节）开始
> 统计所有相邻对的频率
> 合并最高频的对 → 得到一个新 token
> 重复直到达到词汇表大小（GPT-4: 100K tokens）

### 3. 中文 vs 英文 token 成本
> 英文：~4 字符 ≈ 1 token
> 中文：~1.5 字符 ≈ 1 token → 贵 ~2.5x
> 影响 API 成本和上下文窗口利用率

### 4. Tokenization 的坑
> "胶水"问题（glue token）
> 空格敏感
> 数字不稳定（"123" 可能 1-3 个 token）

---

## 💼 面试必答

[待填充]

---

## 🔗 被引用于

- `foundations/F2` — Transformer 的输入层就是 token
- `foundations/F10` — 本地推理速度用 tok/s 衡量
- `unit01-agent-core/` — Prompt 长度优化
