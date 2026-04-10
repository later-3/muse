# LH26_03 — Flash Attention (加快语言模型生成速度 1/2)

> **来源：** [LH26] 李宏毅 ML 2026 Spring
> **视频：** https://youtu.be/vXb2QYOUzl4（~50min）
> **课件：** slides_text/LH26_inference.txt（与 LH26_04 共享）
> **N 节点映射：** N05 推理优化 → D24 (未来 0501-inference-1)
> **提炼时间：** 2026-04-09

---

## 核心教学内容提炼

### 1. 工作台 vs 仓库 — GPU 内存的两级结构

[Fact] 李宏毅用"工作台和仓库"来解释 GPU 内存层级：

> - **工作台（SRAM）**：很小（~20MB），但存取超快 → 计算在这里发生
> - **仓库（HGM/DRAM）**：很大（~80GB），但存取慢 → 数据长期存放在这里
> - **计算时**：从仓库搬到工作台 → 在工作台上计算 → 把结果搬回仓库

> "Flash Attention 的核心思想就是：**减少工作台和仓库之间搬运数据的次数**。"

### 2. 标准 Attention 的问题

[Fact] 标准 Attention 的做法（Q×K^T → Softmax → ×V）需要：
1. 把 Q 和 K 从仓库搬到工作台
2. 算完 Attention Score 搬回仓库
3. 再搬出来做 Softmax
4. 搬回仓库
5. 再搬出来和 V 相乘
6. 最后结果搬回仓库

> "搬运次数太多了！而且中间的 Attention Matrix 大小是 L×L（L=sequence length），长序列时这个矩阵巨大无比。"

### 3. Flash Attention 的核心技巧 — Chunk 处理

[Fact] Flash Attention 的核心：

> "不是一次处理整个序列，而是**分 Chunk**（块）。每次只把一小块 Q、K、V 搬到工作台上，在工作台上尽可能算完所有需要的东西，然后再搬下一块。"

> "工作台上**不能放任何跟长度 L 有关的东西**。"这是 Flash Attention 的硬约束。

### 4. Online Softmax — 分块计算 Softmax

[Fact] 最大的技术挑战是 Softmax 需要看到所有值才能归一化：

> "找 Amax 的方法是：一次先 Load 一个 Chunk 里面的 A，看看这个 Chunk 里面谁最大，存为 D1。然后 Load第二个 Chunk，比较谁更大，更新 D。这样就可以分块找到 max 值。"

> 同样的思路用于分块计算 sum 和归一化 — 这叫 **Online Softmax**。

### 5. 实测结果

[Fact] 在 Colab 演示中：

> "把 sequence 设到 730,000 个 Token 跑一下看会发生什么事——CUDA out of memory！这个 out of memory 不是工作台的 memory 而是那个仓库。当 sequence 太长的时候你终究会把仓库撑爆——那就是我们下一堂课讲 KV Cache 的时候再跟大家讲。"

---

## 关键引用

| 李宏毅原话 | 大白话 |
|----------|--------|
| "减少工作台和仓库之间搬运数据的次数" | Flash Attention 的一句话本质 |
| "工作台上不能放跟长度 L 有关的东西" | 内存复杂度从 O(L²) 降到 O(1) 的约束条件 |
| "将错就错继续做下去" | 分块计算时先用近似，后面修正 — 工程思维 |
| "730,000 token → CUDA out of memory" | Flash Attention 解决计算效率，不解决存储瓶颈 |
