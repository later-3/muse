# LH26_04 — KV Cache (加快语言模型生成速度 2/2)

> **来源：** [LH26] 李宏毅 ML 2026 Spring
> **视频：** https://youtu.be/fDQaadKysSA（~39min）
> **课件：** slides_text/LH26_inference.txt（与 LH26_03 共享）
> **N 节点映射：** N05 推理优化 → D25 (未来 0502-inference-2)
> **提炼时间：** 2026-04-09

---

## 核心教学内容提炼

### 1. KV Cache 的发音与本质

[Fact] 李宏毅开场：

> "KV Cache 的 Cache 啊，它的发音跟钱的 Cash 是一样的。它确实也跟钱有一点点关联性——因为**缓存越大越费钱**。"

### 2. 语言模型生成的两个阶段

[Fact] 他把生成过程分成两段：

> - **Prefill**：输入一个很长的 Sequence（Prompt），一次性处理
> - **Decode**：一个 Token 一个 Token 地生成

> "你跟它说'李宏毅几班'，然后它 Output '大'，然后 Output '大' 之后把 '大' 再当作输入再 Output '金'……"

### 3. KV Cache 缓存什么

[Fact] 核心概念：

> "在生成第 N 个 Token 时，前面 N-1 个 Token 的 K 和 V 已经算过了。如果不缓存，每生成一个新 Token 就要重新算所有前面 Token 的 K 和 V——这是巨大的浪费。KV Cache 就是**把之前算过的 K 和 V 存起来**，下次直接用。"

### 4. KV Cache 的内存代价

[Fact] 他解释为什么 KV Cache 和"钱"有关：

> "每多生成一个 Token，就要多存一组 K 和 V 向量。Sequence 越长，缓存越大。到最后仓库（GPU 内存）就会被撑爆。这就是上节课 '730,000 token → CUDA out of memory' 的原因。"

### 5. KV Cache 压缩 — GQA/MLA

[Fact] 关于减少 KV Cache 大小的方法：

> "可以把 K 做压缩。压缩后存的是 C（compressed K）。需要用的时候再解压缩成 K。压缩所需要的额外运算会变少很多——至少它是跟 sequence 长度没有关联性的。"

这就是 **GQA (Grouped Query Attention)** 和 **MLA (Multi-Latent Attention)** 的思路。

### 6. 跨对话的 KV Cache 复用

[Fact] 他举了一个有趣的例子：

> "假设你生成了一个句子'大家好我是大金'，把 K 和 V 存下来。如果现在有另一个人 Prompt 了'大家好我是小金'——前五个 Token 是一模一样的！既然前五个 Token 一样，你已经存了这句话的 K 和 V，就可以直接复用。"

### 7. 投机解码（Speculative Decoding）

[Fact] 用小模型帮大模型加速：

> "你可以用任何的小模型搭配任何的大模型来加速大模型的速度。它不需要训练模型——这是一个随插即用的方法。代价是你需要用一个额外的小模型，消耗额外的算力。"

---

## 关键引用

| 李宏毅原话 | 大白话 |
|----------|--------|
| "Cache 跟 Cash 发音一样" | KV Cache 越大越费钱（GPU 内存 = 钱） |
| "把之前算过的 K 和 V 存起来" | KV Cache 的一句话定义 |
| "sequence 越长缓存越大" | KV Cache 是 O(L) 的内存消耗 |
| "前五个 Token 一样就可以复用" | Prefix sharing 优化 |
| "随插即用的方法" | Speculative Decoding 不需要重新训练 |
