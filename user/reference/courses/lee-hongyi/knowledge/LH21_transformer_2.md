# LH21_transformer_2 — Transformer/Seq2Seq 經典手推（下）

> **來源：** [LH21] 李宏毅 ML 2021 Spring
> **視頻：** https://youtu.be/N6aRv06iv2g（~61min）
> **課件：** slides_text/LH21_transformer.txt（與上篇共享）
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Autoregressive Decoder — 自回歸解碼

[Fact] Decoder 的核心運作方式：

> "Decoder 做的事情就是產生輸出。首先你要先給它一個特殊的符號，這個特殊的符號代表**開始**（Begin of Sentence, BOS）。"

流程：
1. 輸入 `<BOS>` → 輸出第一個 token（如"機"）
2. 把"機"追加到輸入 → 輸出第二個 token（如"器"）
3. 持續追加直到輸出 `<EOS>`（End of Sentence）

> "Decoder 會把自己的輸出當作下一步的輸入。這就是 Auto-Regressive（自回歸）。"

### 2. Masked Self-Attention

[Fact] Decoder 中的 Self-Attention 和 Encoder 的差異：

- Encoder：每個位置可以看到**所有**位置
- Decoder：每個位置只能看到**它之前**的位置（masked）

> "在產生 b₂ 的時候，你不會用到 a₃ 和 a₄ 的資訊。因為在產生 b₂ 的時候，a₃ 和 a₄ 還不存在。"

### 3. Cross-Attention — Encoder 和 Decoder 的橋樑

[Fact] Cross-Attention 是 Transformer 中 Encoder-Decoder 連接的核心機制：

- **Q 來自 Decoder**：Decoder 的位置產生 query（"我需要什麼信息？"）
- **K, V 來自 Encoder**：Encoder 的輸出提供 key 和 value（"這裡有什麼信息"）
- 本質：Decoder 用 cross-attention 去"查詢"Encoder 已編碼的輸入信息

> "Decoder 產生一個 Q，去 Encoder 那邊取得需要的資訊。K 和 V 來自 Encoder 的輸出。"

### 4. Beam Search vs Greedy Search

[Fact] 生成時的搜索策略：

**Greedy Search**（貪婪搜索）
- 每一步都選概率最高的 token
- 簡單快速，但可能錯過全局最優

**Beam Search**（束搜索）
- 每一步保留概率最高的 B 個候選（B = beam size）
- 探索更多可能性，但計算量更大
- 「這不是最好的方法，但是一個實用的方法」

### 5. Teacher Forcing — 訓練時的技巧

[Fact] 訓練和推理的差異：

- **推理時**：Decoder 用自己上一步的輸出當輸入（可能越錯越離譜）
- **訓練時**：不用 Decoder 的輸出，而用 Ground Truth 當輸入（Teacher Forcing）
- 這確保訓練穩定，但造成訓練和推理的分佈不匹配

### 6. 完整 Transformer 架構總結

[Fact] 把所有部件組裝起來：

```
Input → Embedding + Positional Encoding
      → Encoder (N層 × [Self-Attention + FFN])
      → Cross-Attention bridge
      → Decoder (N層 × [Masked Self-Attention + Cross-Attention + FFN])
      → Linear + Softmax → Output Token
```

---

## 關鍵引用

> "Decoder 把自己的輸出當作下一步的輸入。這就是 Auto-Regressive。"

> "在產生 b₂ 的時候，a₃ 和 a₄ 還不存在。所以不能用到它們的資訊。"

> "Decoder 產生 Q，去 Encoder 取得 K 和 V。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Auto-Regressive | 用自己的輸出當下一步的輸入 | "自己的輸出當輸入" |
| Masked Self-Attention | 只能看到之前的位置 | "a₃ a₄ 還不存在" |
| Cross-Attention | Decoder 用 Q 查詢 Encoder 的 K/V | "去 Encoder 取得資訊" |
| Beam Search | 保留 B 個候選序列 | "實用的方法" |
| Teacher Forcing | 訓練時用 Ground Truth 當輸入 | "用正確答案當輸入" |
| BOS / EOS | 開始/結束符號 | "代表開始/結束" |

---

## 設計動機與第一性原理

- **為什麼需要 Cross-Attention？** — Decoder 每生成一個 token 都需要參考輸入信息，但 Encoder 和 Decoder 是分開的。Cross-Attention 是二者之間的唯一通道。
- **為什麼 Masked？** — 生成是逐步的，不能偷看未來。Mask 是保證因果性的硬約束。
- **Teacher Forcing 的 tradeoff** — 訓練穩定性 vs 訓練/推理分佈不匹配。是 Seq2Seq 訓練的經典問題。

---

## Muse 映射

- **N 節點：** N02 Transformer
- **與已有知識包的關係：** 本包是 Transformer 手推的**終章**。LH21_self_attention_1/2 → LH21_transformer_1/2 形成完整的從 Self-Attention 到 Transformer 的學習路線。今天的 Decoder-only LLM 省略了 Encoder 和 Cross-Attention，但理解完整架構才能理解為什麼省略。
