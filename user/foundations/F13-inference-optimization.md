# F13: 推理优化 — Flash Attention / KV-Cache / 投机解码

> **来源：** 综合（Flash Attention 论文 + vLLM + llama.cpp 源码）
> **状态：** ⏳ 占位 · 待填充
> **一句话：** 让模型跑得更快更省的工程技术，3090 性能翻倍的关键。

---

## ⚡ 3 分钟速读版

```
一句话: [待填充]
3 个关键概念: Flash Attention / KV-cache / 投机解码
对 Muse 最重要的: 本地部署性能优化
面试必记: [待填充]
```

---

## 核心章节框架

### 1. KV-Cache 管理
> 为什么推理越长越慢？每次生成都要重算 Attention？
> KV-Cache: 缓存已计算的 Key/Value，只算新 token 的。
> 显存代价: KV-Cache 会吃掉大量显存。

### 2. Flash Attention
> 标准 Attention 的显存瓶颈: O(n²) 的 attention matrix。
> Flash Attention: 分块计算, 不保存完整 attention matrix。
> 效果: 速度 2-4x, 显存 5-20x 节省。

### 3. 投机解码（Speculative Decoding）
> 用小模型快速生成候选 → 大模型一次性验证。
> 速度提升 2-3x，输出质量不变。

### 4. 连续批处理（Continuous Batching）
> 多请求共享 GPU, 不等最慢的完成才开始新的。
> vLLM 的核心优化。

### 5. 量化推理加速
> INT8/INT4 矩阵乘法硬件加速（Tensor Cores）。
> 与 F10 量化理论的工程对应。

---

## 💼 面试必答

[待填充]

---

## 🔗 被引用于

- `foundations/F2` — Attention O(n²) 瓶颈的解法
- `foundations/F10` — 本地部署性能调优
