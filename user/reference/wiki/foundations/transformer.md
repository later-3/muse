# Transformer 架构

> **一句话定义**: Transformer 是一种基于自注意力机制 (Self-Attention) 的神经网络架构，它摒弃了循环结构 (RNN)，通过并行计算序列中所有位置的关系，成为现代 LLM 的基础骨架。

## 核心原理

### Transformer 的完整结构 (nanoGPT 视角)

nanoGPT 用 ~300 行代码定义了完整的 GPT 模型，是理解 Transformer 最简洁的参考实现：

```python
@dataclass
class GPTConfig:
    block_size: int = 1024    # 上下文长度（最大序列长度）
    vocab_size: int = 50304   # 词汇表大小
    n_layer: int = 12         # Transformer 层数
    n_head: int = 12          # 注意力头数
    n_embd: int = 768         # 嵌入维度
    dropout: float = 0.0
    bias: bool = True
```

### 信息流：从 token 到预测

```
输入序列 [token_ids]
    ↓
┌─────────────────────────────────┐
│  Token Embedding (wte)          │  token_id → 向量 (vocab_size × n_embd)
│  + Position Embedding (wpe)     │  位置 → 向量 (block_size × n_embd)
│  → Dropout                      │
├─────────────────────────────────┤
│  Block × n_layer                │  ← 核心：重复 N 次
│  ├── LayerNorm → Attention      │
│  │   (残差连接)                  │
│  └── LayerNorm → MLP            │
│      (残差连接)                  │
├─────────────────────────────────┤
│  Final LayerNorm (ln_f)         │
│  → Linear Head (lm_head)        │  n_embd → vocab_size
│  → Cross Entropy Loss           │
└─────────────────────────────────┘
    ↓
预测下一个 token 的概率分布
```

nanoGPT 的实现对应：

```python
class GPT(nn.Module):
    def __init__(self, config):
        self.transformer = nn.ModuleDict(dict(
            wte = nn.Embedding(config.vocab_size, config.n_embd),
            wpe = nn.Embedding(config.block_size, config.n_embd),
            drop = nn.Dropout(config.dropout),
            h = nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
            ln_f = LayerNorm(config.n_embd, bias=config.bias),
        ))
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
        # Weight Tying: 输入嵌入和输出层共享权重
        self.transformer.wte.weight = self.lm_head.weight
```

### 自注意力机制 (Self-Attention)

LLMs-from-scratch ch03 详细讲解了注意力的演进，nanoGPT 给出了工程实现：

```python
class CausalSelfAttention(nn.Module):
    def __init__(self, config):
        # Q, K, V 三个投影矩阵合并为一个
        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd)
        self.c_proj = nn.Linear(config.n_embd, config.n_embd)

    def forward(self, x):
        B, T, C = x.size()
        # 一次线性变换生成 Q, K, V
        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
        # 重塑为多头: (B, T, C) → (B, n_head, T, head_size)
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)

        # Flash Attention (PyTorch >= 2.0 自动优化)
        y = F.scaled_dot_product_attention(
            q, k, v, dropout_p=self.dropout, is_causal=True
        )
```

**核心公式**：
```
Attention(Q, K, V) = softmax(QK^T / √d_k) · V
```

**因果掩码 (Causal Mask)**：确保每个位置只能看到自己和之前的 token，不能"偷看未来"。

### Transformer Block = Attention + MLP

```python
class Block(nn.Module):
    def forward(self, x):
        x = x + self.attn(self.ln_1(x))   # 注意力 + 残差连接
        x = x + self.mlp(self.ln_2(x))    # 前馈网络 + 残差连接
        return x
```

**Pre-Norm 设计**：LayerNorm 在 Attention/MLP 之前（而非之后），这是 GPT-2 的改进，训练更稳定。

### MLP (前馈网络)

```python
class MLP(nn.Module):
    def forward(self, x):
        x = self.c_fc(x)      # n_embd → 4 * n_embd (扩展)
        x = self.gelu(x)      # GELU 激活函数
        x = self.c_proj(x)    # 4 * n_embd → n_embd (压缩回来)
        x = self.dropout(x)
        return x
```

**4× 隐层**：MLP 中间层是嵌入维度的 4 倍，这是 Transformer 的标准设计。

### GPT 模型族的参数规模

nanoGPT 支持直接加载 OpenAI 的 GPT-2 预训练权重：

| 模型 | 层数 | 头数 | 嵌入维度 | 参数量 | val loss (OWT) |
|------|------|------|---------|--------|----------------|
| gpt2 | 12 | 12 | 768 | 124M | 3.12 |
| gpt2-medium | 24 | 16 | 1024 | 350M | 2.84 |
| gpt2-large | 36 | 20 | 1280 | 774M | 2.67 |
| gpt2-xl | 48 | 25 | 1600 | 1558M | 2.54 |

### 生成过程 (Autoregressive Generation)

```python
@torch.no_grad()
def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
    for _ in range(max_new_tokens):
        # 裁剪到最大上下文长度
        idx_cond = idx if idx.size(1) <= self.config.block_size \
                   else idx[:, -self.config.block_size:]
        # 前向传播获取 logits
        logits, _ = self(idx_cond)
        # 取最后一个位置的预测
        logits = logits[:, -1, :] / temperature
        # Top-K 采样
        if top_k is not None:
            v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
            logits[logits < v[:, [-1]]] = -float('Inf')
        # softmax → 概率 → 采样
        probs = F.softmax(logits, dim=-1)
        idx_next = torch.multinomial(probs, num_samples=1)
        idx = torch.cat((idx, idx_next), dim=1)
    return idx
```

**关键洞察**：
- 生成是**自回归**的 — 一次只预测一个 token，然后把它加到输入序列中
- **temperature** 控制随机性：低 = 确定性，高 = 创造性
- **top_k** 限制候选词范围，避免低概率的奇怪输出

### 关键优化技术 (LLMs-from-scratch bonus)

| 技术 | 章节 | 作用 |
|------|------|------|
| **KV Cache** | ch04/03_kv-cache | 避免重复计算历史 K, V |
| **GQA (Grouped Query Attention)** | ch04/04_gqa | 多个 Q 头共享 K,V 头，减少内存 |
| **MLA (Multi-head Latent Attention)** | ch04/05_mla | DeepSeek-V2 的低秩压缩注意力 |
| **Flash Attention** | nanoGPT | CUDA 优化，减少内存访问 |
| **Weight Tying** | nanoGPT | 输入嵌入和输出层共享权重 |
| **torch.compile()** | nanoGPT | PyTorch 2.0 编译加速 (250ms→135ms) |

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [nanoGPT](../repos/nanoGPT/model.py) | model.py (~300 行) | ⭐⭐⭐ | 完整 GPT 工程实现 + 生成 + 训练 |
| [LLMs-from-scratch](../repos/LLMs-from-scratch/) | ch02-ch04 | ⭐⭐⭐ | 从零构建 + 注意力机制详解 |
| [introtodeeplearning](../repos/introtodeeplearning/) | Lecture notes | ⭐ | MIT 课程视角的 Transformer |

## 概念间关系

- **下层概念**: [[tokenization]] (Transformer 输入的前处理)
- **上层概念**: [[training-pipeline]] (如何训练 Transformer)
- **相关概念**: [[context-engineering]] (上下文窗口 = block_size)
- **应用概念**: [[agent-definition]] (LLM 是 Agent 的大脑)

## 与 Agent 的关系

作为 Agent 开发者，理解 Transformer 的价值在于：

| 架构概念 | Agent 影响 |
|---------|-----------|
| **block_size (上下文长度)** | 决定 Agent 一次能处理多少信息 → Context Engineering |
| **自回归生成** | Agent 的每次回复都是逐 token 生成的，解释了 streaming |
| **self-attention** | 解释了为什么长上下文中"中间容易被忽略" (Lost in the Middle) |
| **temperature / top_k** | Agent 行为的随机性控制 |

## 开放问题

1. **二次复杂度**：Self-Attention 的 O(n²) 复杂度限制了上下文长度。线性注意力 / Ring Attention 能否突破？
2. **位置编码**：从绝对位置 (GPT-2 wpe) 到旋转位置编码 (RoPE, Llama)，哪种更好？
3. **MoE vs Dense**：Mixture-of-Experts (如 DeepSeek-V3) vs 密集模型，如何选择？
4. **推理效率**：KV Cache + 量化 + 推测解码，推理优化的组合策略是什么？
