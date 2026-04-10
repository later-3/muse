# D09 — N03 Tokenization (2/2) + oc03 Hook 观察

> **日期：** 2026-04-16（Wed）
> **路线图位置：** Week 2 · Day 9 · N03 Tokenization（第 2 天，共 2 天）
> **定位：** 🟨 理解级（今天 1.5h = 45min 理论 + 45min 实践）· **F11 完成**

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **minbpe 的代码结构是怎样的？** 200 行 Python 怎么实现完整的 BPE？
2. **不同模型的 Tokenizer 有什么差异？** GPT-4 vs Claude vs Qwen 的 token 效率对比
3. **怎么用 hook 观察 Agent Loop？** oc03 的 event hook 在 Muse 中拦截了什么？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华 — minbpe 代码走读 | 30min | [ ] |
| 2 | 动手实验 — 对比 token 差异（可选） | 15min | [ ] |
| 3 | 📂 oc03 hook 观察（见下方实践任务） | 45min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 Karpathy [minbpe](https://github.com/karpathy/minbpe) 代码 + Tokenizer 视频后半段中提炼的核心知识。
> 今天聚焦：**代码实现 + 实际差异 + 高级话题**。

### minbpe 代码走读 — 200 行实现 BPE

[Fact] Karpathy 的 minbpe 是教学级的 BPE 实现，核心只有两个类：

**`BasicTokenizer`（最简版）：**

```python
class BasicTokenizer:
    def __init__(self):
        self.merges = {}      # {(int, int): int} — 合并规则
        self.vocab = {}       # {int: bytes}       — token → 字节

    def train(self, text, vocab_size):
        """训练：从 256 个字节开始，合并到目标词表大小"""
        tokens = list(text.encode("utf-8"))  # 文本 → 字节列表
        num_merges = vocab_size - 256

        for i in range(num_merges):
            # Step 1: 统计所有相邻 token 对的出现次数
            stats = get_stats(tokens)
            # Step 2: 找到最频繁的 token 对
            pair = max(stats, key=stats.get)
            # Step 3: 创建新 token，替换所有出现
            idx = 256 + i
            tokens = merge(tokens, pair, idx)
            self.merges[pair] = idx

    def encode(self, text):
        """编码：文本 → token IDs"""
        tokens = list(text.encode("utf-8"))
        while len(tokens) >= 2:
            stats = get_stats(tokens)
            # 按训练时的合并顺序，找当前可合并的最高优先级 pair
            pair = min(stats, key=lambda p: self.merges.get(p, float("inf")))
            if pair not in self.merges:
                break
            tokens = merge(tokens, pair, self.merges[pair])
        return tokens

    def decode(self, ids):
        """解码：token IDs → 文本"""
        tokens = b"".join(self.vocab[idx] for idx in ids)
        return tokens.decode("utf-8", errors="replace")
```

**核心辅助函数：**

```python
def get_stats(ids):
    """统计相邻 token 对的出现次数"""
    counts = {}
    for pair in zip(ids, ids[1:]):
        counts[pair] = counts.get(pair, 0) + 1
    return counts

def merge(ids, pair, idx):
    """把所有 pair 替换成 idx"""
    newids = []
    i = 0
    while i < len(ids):
        if i < len(ids) - 1 and ids[i] == pair[0] and ids[i+1] == pair[1]:
            newids.append(idx)
            i += 2
        else:
            newids.append(ids[i])
            i += 1
    return newids
```

**关键洞察：**
- 训练时 = 自底向上合并（贪心，每次合并最频繁的对）
- 编码时 = 按训练顺序重放合并（先合并编号最小/最早学到的 pair）
- 解码时 = 查表还原字节

### RegexTokenizer — 生产级改进

[Fact] Karpathy 在 minbpe 中还实现了 `RegexTokenizer`，这是 GPT-4 tiktoken 的简化版：

**为什么需要 Regex 预分词？**

纯 BPE 有一个问题：它可能把不同"类型"的字符合并在一起。比如把空格和字母合并，或把数字和标点合并 — 这在语义上不合理。

解法：先用正则表达式把文本切成"语义片段"（如单词、数字、标点），再在每个片段内部独立做 BPE。

```python
# GPT-4 使用的预分词正则（简化版）
GPT4_SPLIT_PATTERN = r"""'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+"""
```

这确保了：
- 英文缩写（"don't" → "don" + "'t"）被正确处理
- 数字最多 3 位一组（"123456" → "123" + "456"），不会合并成一个巨大的 token
- 空格和换行被独立处理

### 不同模型的 Tokenizer 对比

[Fact] 不同 LLM 使用不同的 Tokenizer：

| 模型 | Tokenizer | 词表大小 | 中文效率 |
|------|-----------|---------|---------|
| GPT-4 | tiktoken (cl100k_base) | ~100K | 一般（~2-3 token/字） |
| Claude 3 | Anthropic 自研 | ~100K | 较好 |
| Qwen-2 | 基于 tiktoken 改进 | ~152K | 好（中文训练比例高） |
| LLaMA-3 | tiktoken 改进 | ~128K | 一般 |
| DeepSeek-V2 | 自研 | ~100K | 好（中文优化） |

**关键差异：**
- 词表大小：更大的词表 = 更多 token 被预合并 = 更短的序列 = 更快，但 Embedding 层更大
- 中文优化：Qwen/DeepSeek 的训练数据包含更多中文 → 中文常见字/词被充分合并

### 特殊 Token

[Fact] 所有 LLM 都有一些特殊 token（不在 BPE 训练中产生）：

| Token | 含义 | GPT-4 中的 ID |
|-------|------|-------------|
| `<\|endoftext\|>` | 文档结束符 | 100257 |
| `<\|im_start\|>` | 消息开始 | 100264 |
| `<\|im_end\|>` | 消息结束 | 100265 |

这些特殊 token 在 Chat 格式中至关重要 — 模型通过它们区分 System/User/Assistant 消息。

### Tokenization 的前沿趋势

[Fact] 2024-2025 年的新动向：

- **Byte-Level Models**：直接在字节上做 attention（如 ByT5），完全不需要 tokenizer — 但目前太慢
- **动态词表**：根据输入语言/领域动态选择词表
- **多模态 Token**：图片/音频也变成 token（VQ-VAE），和文字 token 混合

---

## 🔧 实践任务：oc03 Hook 观察

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L1-observe/oc03-loop-observer.mjs`

**USOLB 标注：** `[O] 观察` `[L] 日志`

**任务说明：**

oc03 使用 OpenCode 的 event hook 机制拦截 Agent Loop 的事件。今天的目标是：
1. 读懂 oc03 代码中 hook 的注册方式
2. 运行它，观察输出的事件格式
3. 记录你看到的 Agent Loop 生命周期事件

**和今天理论的联系：**
- Agent 每轮发送给 LLM 的"请求"会被 Tokenizer 处理
- 你在 hook 中看到的 `usage.prompt_tokens` 就是 Tokenizer 输出的 token 数
- 越长的 Prompt → 越多的 token → 越慢 + 越贵

---

## 📖 D08-D09 合并的知识体系图

```
Tokenization 知识体系
├── D08: 原理层
│   ├── Token 的定义（子词片段）
│   ├── BPE 算法（统计→合并→重复）
│   ├── 字符 vs 子词 vs 单词的 tradeoff
│   └── 中文为什么"贵"
│
└── D09: 实现层 ← 你在这里
    ├── minbpe 代码走读（train/encode/decode）
    ├── RegexTokenizer（预分词 + 语义片段）
    ├── 不同模型的 Tokenizer 对比
    ├── 特殊 Token（EOS/BOS/消息边界）
    └── 实践：oc03 hook 观察 token usage
```

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| Karpathy Tokenizer 视频 | https://youtu.be/zduSFxRajkE | 1:00:00-1:30:00: minbpe 代码 |
| minbpe 仓库 | https://github.com/karpathy/minbpe | base.py + basic.py |
| tiktoken | https://github.com/openai/tiktoken | 生产级参考 |

---

## 🧠 与 Muse/项目 的映射

> 今天学的代码实现 + hook 观察，在 Agent 开发中体现在哪里？

- **本地代码实际做的事：**
  - oc03 的 event hook 在 Agent Loop 的关键点拦截事件
  - `src/plugin/` 下的 OpenCode plugin 可以观察到每轮 LLM 调用的 token 用量
  - 诊断工具 `trace-reader.mjs` 显示的 token 统计就是来自 API 返回的 usage 字段
- **远端模型/外部系统做的事：**
  - LLM API（OpenAI/Anthropic）在接收文本后做 tokenization，返回 token 计数
  - Tokenizer 的选择由模型决定，开发者无法控制
- **为什么 Agent 开发者需要知道这个：**
  - 做 Context Window 管理时需要估算 token 数 — 可以用 tiktoken 本地估算
  - 调试 "context length exceeded" 错误时，要知道是哪部分 prompt 占用了太多 token
- **和后续内容的关系：** D10 开始进入 Agent 核心（N10），所有之前的基础（Transformer + 训练 + Token）都会被 Agent 架构串起来

---

## ✅ 自检清单

- [ ] **能描述 minbpe 的代码结构**：train（合并循环）→ encode（按顺序重放合并）→ decode（查表还原）
- [ ] **能解释 RegexTokenizer 的改进**：预分词（语义片段内做BPE）防止跨类型合并
- [ ] **知道不同模型 Tokenizer 的差异**：词表大小、中文效率
- [ ] **知道特殊 Token**：EOS/BOS/im_start/im_end 在 Chat 中的角色
- [ ] **完成 oc03 hook 观察**：能说出 Agent Loop 中哪些事件被拦截到了
- [ ] **能把 Tokenization 和 Agent 开发联系起来**：Context 管理 + 费用估算

### 面试题积累（1 题）

**Q: Tokenizer 训练好之后就不能改了吗？如果你要给一个英文 LLM 加强中文能力，Tokenizer 层面可以做什么？**

> 你的回答：___
>
> 参考：可以扩展词表 — 在原有 BPE 词表基础上加入中文高频子词（如 Qwen 做的）。但扩展词表意味着 Embedding 层需要重新随机初始化新 token 的向量，需要额外训练来让这些新向量学到语义。这就是为什么"扩展词表 + 继续预训练"是中文化英文模型的标准做法。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
