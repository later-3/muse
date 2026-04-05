# BPE Tokenization

> **一句话定义**: Tokenization 是将原始文本转换为 LLM 可处理的整数序列的过程。BPE (Byte Pair Encoding) 是当前所有主流 LLM (GPT、Llama、Mistral) 使用的标准分词算法。

## 核心原理

### 为什么 Tokenization 至关重要

Karpathy 在 minbpe 讲座中指出，LLM 的诸多"奇怪行为"**全部归因于 Tokenization**：

- LLM 不会拼写单词 → 一个词被拆成多个 token
- LLM 不会反转字符串 → token 边界和字符边界不对齐
- 非英语语言性能差 → 同等内容消耗更多 token
- 简单算术经常出错 → 数字被任意拆分 (如 "677" 变成 "6"+"77")
- GPT-2 写 Python 困难 → 空格被不一致地 tokenize
- JSON 比 YAML 效率低 → JSON 的括号/引号消耗更多 token

**根本原因**：LLM 不是直接处理字符串，而是处理 token 序列。Tokenization 在字符串和 LLM 之间引入了一层有损且不透明的"翻译"。

### BPE 算法核心

minbpe 提供了最清晰的 BPE 实现。核心思想是**迭代合并最频繁的字节对**：

```
初始状态（字符级）:
  "aaabdaaabac" → [97, 97, 97, 98, 100, 97, 97, 97, 98, 97, 99]
                   a   a   a   b   d    a   a   a   b   a   c

第 1 次合并: (97,97) → 256  ("aa" 出现最多)
第 2 次合并: (256,98) → 257  即 ("aa","b") → "aab"
第 3 次合并: (257,97) → 258  即 ("aab","a") → "aaba"

最终:  [258, 100, 258, 97, 99]  → 5 个 token (原来 11 个)
```

### Tokenizer 的三个核心操作

```python
from minbpe import BasicTokenizer
tokenizer = BasicTokenizer()

# 1. Train: 从语料中学习合并规则
tokenizer.train(text, vocab_size=256 + 3)

# 2. Encode: 文本 → token 序列
tokenizer.encode("aaabdaaabac")  # → [258, 100, 258, 97, 99]

# 3. Decode: token 序列 → 文本
tokenizer.decode([258, 100, 258, 97, 99])  # → "aaabdaaabac"
```

### minbpe 的三层架构

| 层次 | 类 | 功能 | 对应实际模型 |
|------|------|------|------------|
| **基础** | `BasicTokenizer` | 纯 BPE | 教学用 |
| **正则** | `RegexTokenizer` | 先按类别分割再 BPE | GPT-2/3/4 |
| **生产** | `GPT4Tokenizer` | 包装 tiktoken 合并规则 | GPT-4 (cl100k_base) |

### 正则预处理

GPT-2 引入的改进：**在 BPE 之前先按正则表达式分割文本**（按字母、数字、标点、空格等类别分割），再对每个 chunk 独立做 BPE。

**为什么需要**：防止跨类别的合并。否则 "Hello" 后面的空格可能和 "w" 合并，产生无意义的 token。

### 特殊 Token

特殊 token（如 endoftext、im_start、im_end）不通过 BPE 合并得到，而是显式注册的。编码时必须显式声明是否解析特殊 token（allowed_special 参数），防止恶意注入。

### 字符级 vs BPE vs SentencePiece

| 方案 | 词汇表大小 | 序列长度 | 优势 | 劣势 |
|------|-----------|---------|------|------|
| **字符级** | ~65 | 极长 | 简单，无 OOV | 效率低 |
| **BPE** | ~50K-100K | 适中 | 平衡效率和覆盖度 | 算法复杂 |
| **SentencePiece** | ~32K-128K | 适中 | 直接处理 Unicode | Llama 专用 |

nanoGPT 的字符级示例 (Shakespeare)：
```python
chars = sorted(list(set(text)))  # 65 个字符
stoi = {ch: i for i, ch in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]
decode = lambda l: ''.join([itos[i] for i in l])
```

### Token 与模型的连接

Tokenizer 输出的整数序列直接输入 Embedding 层：
```python
self.token_embedding_table = nn.Embedding(vocab_size, n_embd)
tok_emb = self.token_embedding_table(idx)  # token_id → 向量
```

**vocab_size 选择原则**：太小→序列太长；太大→边缘 token 训练不足。实践：GPT-2=50257, GPT-4=100K+, Llama=32K。

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [minbpe](../repos/minbpe/) | README + lecture.md | ⭐⭐⭐ | BPE 完整实现 + 讲座 |
| [LLMs-from-scratch](../repos/LLMs-from-scratch/ch02/) | ch02 | ⭐⭐⭐ | 从字符级到 BPE 演进 |
| [nanoGPT](../repos/nanoGPT/) | data/prepare.py | ⭐⭐ | 训练数据预处理 |

## 概念间关系

- **上层概念**: [[transformer]] (Tokenizer 输出 → Embedding → Transformer)
- **相关概念**: [[context-engineering]] (token 数量 = 上下文窗口消耗)
- **实用知识**: [[prompt-engineering]] (理解 token 边界帮助写更好的 prompt)

## 与 Agent 的关系

| Token 概念 | Agent 影响 |
|-----------|-----------|
| **token 数量** | 直接决定 API 费用和上下文窗口消耗 |
| **vocab 效率** | 非英语 prompt 消耗更多 token |
| **特殊 token** | 控制对话格式 (ChatML 的 im_start/im_end) |
| **数字 token 化** | 解释了 LLM 算术差 → 需要 code interpreter 工具 |

## 开放问题

1. **多语言公平性**：同样的语义，中文比英文消耗更多 token。如何让 tokenizer 公平？
2. **Vision Token**：多模态模型如何 tokenize 图片？patch-based tokenization 是主流
3. **编码效率 vs 语义边界**：BPE 追求最高压缩率，但未必对齐语义边界
