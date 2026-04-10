# LH21_transformer_1 — Transformer/Seq2Seq 經典手推（上）

> **來源：** [LH21] 李宏毅 ML 2021 Spring
> **視頻：** https://www.youtube.com/watch?v=n9TlOhRjYoc（~33min）
> **課件：** slides_text/LH21_transformer.txt（與下篇共享）
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Sequence-to-Sequence 問題

[Fact] Transformer 要解決的問題 — 輸入一個序列，輸出另一個序列，且輸出長度由模型自己決定：

> "我們不知道應該要 output 多長，由機器自己決定 output 的長度。"

應用：語音辨識（聲音→文字）、機器翻譯（一個語言→另一個語言）、語音合成（文字→聲音）。

### 2. Encoder 的結構

[Fact] Encoder 的工作就是把輸入序列編碼成一組向量表示：

- 輸入一排向量（如聲音幀或文字 embedding）
- 經過多層 Transformer Block（Self-Attention + FFN + Residual + LayerNorm）
- 輸出同樣長度的一排向量

> "Encoder 做的事情就是輸入一個 Vector Sequence，輸出另外一個 Vector Sequence。"

### 3. Transformer Block 的組成

[Fact] 每一個 Encoder Block：

1. **Multi-Head Self-Attention**
2. **Residual Connection**：輸出 = attention 輸出 + 輸入
3. **Layer Normalization**
4. **FFN**（全連接）
5. 再一次 Residual + LayerNorm

這就是 "Attention Is All You Need" 論文中的結構。

### 4. 堆疊多層

[Fact] 實際模型中 Encoder 和 Decoder 各堆疊很多層。每一層的結構相同但參數不同。層數越多，模型越強，但計算量也越大。

---

## 關鍵引用

> "我們不知道應該要 output 多長，由機器自己決定 output 的長度。"

> "Encoder 做的事情就是輸入一個 Vector Sequence，輸出另外一個 Vector Sequence。"

> "Transformer 就是那個變形金剛。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Seq2Seq | 序列到序列模型 | "輸出長度由機器決定" |
| Encoder | 把輸入序列編碼成向量 | "輸入向量序列，輸出向量序列" |
| Transformer Block | Self-Attention + FFN + Residual + Norm | 基本構建單位 |

---

## Muse 映射

- **N 節點：** N02 Transformer
- **與已有知識包的關係：** LH21_self_attention_1/2 提供 Self-Attention 底層推導。本包開始講完整的 Encoder-Decoder 架構。下篇（LH21_transformer_2）講 Decoder + Cross-Attention + Beam Search。
