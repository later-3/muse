# LH25_02 — Model Inside（語言模型的內部運作）

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~108min）
> **課件：** slides_text/LH25_02_model_inside.txt
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 語言模型的黑盒子裡面有什麼？

[Fact] 本講是 Transformer 架構的"內部導覽" — 打開黑盒子看裡面到底發生了什麼。

語言模型的核心流程：Token → Embedding → 多層 Transformer Block → 接龍預測下一個 Token

### 2. Transformer Block 的拆解

[Fact] 每一層 Transformer Block 由兩個子層組成：

**Self-Attention 子層**
- 讓每個 Token 能"看到"序列中所有其他 Token
- 計算 Q/K/V，做 attention score → weighted sum
- Multi-Head：多組 Q/K/V 各關注不同面向

**FFN（Feed-Forward Network）子層**
- 兩層全連接：升維 → 非線性激活（ReLU/GELU）→ 降維
- 每個 Token 獨立通過同一個 FFN
- 被認為是"知識存儲"的主要位置

### 3. Residual Connection 和 Layer Normalization

[Fact] 每個子層都有：
- **殘差連接**：輸出 = 子層輸出 + 輸入（跳過連接）
- **LayerNorm**：穩定訓練的標準化操作
- Pre-Norm vs Post-Norm：現代模型偏好 Pre-Norm（先 Norm 再進子層）

### 4. Embedding 和反嵌入

[Fact] Token 進出模型的方式：

- **Input Embedding**：把離散 Token ID 映射成連續向量（查表）
- **Output Layer**：把最後一層的向量映射回詞表大小的 logits
- 很多模型的 input embedding 和 output layer **共享權重**（weight tying）

### 5. Causal Mask — 為什麼只能看到前面的 Token

[Fact] 語言模型做"文字接龍"的技術保障：

- Causal（因果）Mask：每個位置只能 attend 到它**之前**的位置
- 確保在預測第 t 個 token 時，不會偷看第 t+1 及之後的 token
- 這就是 Decoder-only 和 Encoder 的核心區別

### 6. 規模的力量 — Scaling Laws

[Fact] 更大的模型 = 更好的表現。典型的大模型：

- 參數量：7B → 70B → 400B+
- 層數：32 → 80 → 128+
- Hidden dimension：4096 → 8192+
- 這些數字的增長遵循 Scaling Laws（Chinchilla 等研究）

---

## 關鍵引用

> "語言模型做的事情就是文字接龍。但黑盒子裡面是怎麼做接龍的？"

> "FFN 被認為是知識存儲的主要位置。"

> "Causal Mask 確保模型只能看到前面的 Token，不能偷看未來。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Transformer Block | 一層 Self-Attention + FFN | 黑盒子裡的基本單位 |
| Self-Attention | 每個 Token 看所有其他 Token | Q/K/V + attention score |
| FFN | 兩層全連接層 | "知識存儲的位置" |
| Causal Mask | 只看前面不看後面 | "不能偷看未來" |
| Weight Tying | input/output embedding 共享 | 節省參數 |
| Scaling Laws | 模型越大表現越好的規律 | "規模的力量" |

---

## Muse 映射

- **N 節點：** N02 Transformer
- **與已有知識包的關係：** 本包是 Transformer 的內部視角。LH21 Self-Attention 講底層推導，本包講工程全貌。LH25_03（Mamba）是非 Attention 的替代方案。
