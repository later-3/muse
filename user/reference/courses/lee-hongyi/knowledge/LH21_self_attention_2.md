# LH21_self_attention_2 — Self-Attention 經典手推（下）

> **來源：** [LH21] 李宏毅 ML 2021 Spring
> **視頻：** https://www.youtube.com/watch?v=gmsMY5kc-zw（~46min）
> **課件：** slides_text/LH21_self_attention.txt（與上篇共享）
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 複習 — b₂ 的計算和 b₁ 完全一樣

[Fact] 李宏毅開篇強調：

> "從這一排 vector 得到 b₁ 跟從這一排 vector 得到 b₂，它的操作是**一模一樣的**。而且 b₁ 到 b₄ 並不需要依序產生，它們是**一次同時被計算出來的**。"

這正是 Self-Attention 可以高度並行的原因。

### 2. Multi-Head Self-Attention

[Fact] 為什麼需要 Multi-Head？

- 不同的 head 關注不同面向的關係
- 每個 head 有自己的 W^q, W^k, W^v
- 各 head 的輸出拼接後通過一個線性層融合

> "有些問題也許需要很多不同種類的相關性。不是用同一組 Q/K/V 就能處理所有問題。"

計算過程：
1. 每個 head 獨立算出 Q^i, K^i, V^i
2. 各 head 獨立做 Self-Attention 得到 b^{i,1}, b^{i,2}, ...
3. 拼接所有 head 的輸出：[b^{1,i}; b^{2,i}; ...]
4. 乘以 W^O 做最終映射

### 3. Positional Encoding — Self-Attention 的致命缺陷

[Fact] Self-Attention 天生**沒有位置概念**：

> "到目前為止我們的 Self-Attention 裡面沒有位置的資訊。打亂輸入順序，輸出不會改變。"

解決方案：在 input embedding 上加入 positional encoding（位置向量），告訴模型每個 token 的位置：

- **Sinusoidal PE**：用 sin/cos 函數生成，原始 Transformer 論文使用
- **Learned PE**：直接學習位置向量
- 更新方案（如 RoPE）在 LH26_05 中講解

### 4. Self-Attention vs CNN vs RNN

[Fact] 李宏毅做了系統的比較：

| | Self-Attention | CNN | RNN |
|---|---|---|---|
| 感受野 | 全局 | 局部（kernel size） | 需要多步傳播 |
| 並行性 | 完全並行 | 完全並行 | 不能並行 |
| 計算複雜度 | O(n²·d) | O(n·k·d) | O(n·d²) |
| 長程依賴 | 直接 | 需要堆疊層 | 梯度消失 |

> "CNN 其實是 Self-Attention 的特例。Self-Attention 可以學到 CNN 做的事情，反過來不一定。"

### 5. Truncated Self-Attention — 加速的思路

[Fact] 可以限制每個 Token 只 attend 到附近的 Token（而非全部），類似 local attention：

- 犧牲長程依賴能力
- 換取更快的速度
- 為後來的 Flash Attention、Sparse Attention 等方法埋下伏筆

---

## 關鍵引用

> "b₁ 到 b₄ 是一次同時被計算出來的。"

> "Self-Attention 裡面沒有位置的資訊。打亂順序，輸出不變。"

> "CNN 其實是 Self-Attention 的特例。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Multi-Head | 多組 Q/K/V 各看不同面向 | "不同種類的相關性" |
| Positional Encoding | 注入位置信息 | "告訴模型 Token 的位置" |
| Sinusoidal PE | sin/cos 函數生成的位置向量 | 原始 Transformer 用法 |

---

## Muse 映射

- **N 節點：** N02 Transformer
- **與已有知識包的關係：** 本包完成了 Self-Attention 手推（上篇算 Q/K/V 和 attention score，本篇加入 Multi-Head 和 Positional Encoding）。下接 LH21_transformer_1/2 講完整 Transformer（Encoder-Decoder + Cross-Attention）。
