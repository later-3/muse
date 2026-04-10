# LH21_self_attention_1 — Self-Attention 經典手推（上）

> **來源：** [LH21] 李宏毅 ML 2021 Spring
> **視頻：** https://www.youtube.com/watch?v=hYdO9CscNes（~18min）
> **課件：** slides_text/LH21_self_attention.txt（與下篇共享）
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 問題設定 — 輸入是一排向量

[Fact] 李宏毅從問題導向出發：

> "到目前為止啊，我們的 Network 的 input 都是一個向量。但假設我們遇到更複雜的問題呢？假設我們說**輸入是一排向量**呢？而且這個輸入的向量數目是會改變的呢？"

典型應用：文字處理（每個詞變成一個向量，句子長度不同）、語音處理（每幀聲學特徵）、圖結構（每個節點是一個向量）。

### 2. 詞的向量表示 — One-Hot 到 Word Embedding

[Fact] 怎麼把一個詞變成向量？

- **One-Hot**：詞表大小的向量，只有一位是 1 — 但所有詞之間沒有關係
- **Word Embedding**：學習到的低維向量 — cat 和 dog 的向量會很接近

### 3. 三種輸出模式

[Fact] 輸入一排向量後，輸出有三種可能：

- **每個輸入一個輸出**（Sequence Labeling）：詞性標注
- **整個序列一個輸出**：情感分類
- **模型自己決定輸出長度**：翻譯、語音辨識（Seq2Seq）

### 4. Self-Attention 的核心計算

[Fact] Self-Attention 完整的手推過程：

**Step 1：計算 Q, K, V**
- 每個輸入向量 aᵢ 分別乘以三個矩陣 W^q, W^k, W^v 得到 qᵢ, kᵢ, vᵢ
- q = query（我在找什麼）, k = key（我能提供什麼）, v = value（我的內容）

**Step 2：計算 Attention Score**
- α_{i,j} = qᵢ · kⱼ（dot product）
- 直覺：q 和 k 的內積越大，表示越"相關"

**Step 3：Softmax 標準化**
- 把 attention score 通過 softmax 歸一化到 0-1 之間

**Step 4：加權求和**
- bᵢ = Σⱼ α'_{i,j} · vⱼ
- 每個輸出是所有 value 的加權組合，權重就是 attention score

### 5. 矩陣化表達

[Fact] 整個 Self-Attention 可以寫成矩陣運算：

```
Q = W^q · A,  K = W^k · A,  V = W^v · A
Attention(Q, K, V) = softmax(K^T · Q / √d) · V
```

這就是為什麼 Self-Attention 可以在 GPU 上高度並行 — 全是矩陣乘法。

---

## 關鍵引用

> "假設我們的輸入是一排向量，而且數目是會改變的，這時候應該怎麼處理？"

> "q = 我在找什麼，k = 我能提供什麼，v = 我的內容。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Query (Q) | "我在找什麼" | qᵢ = W^q · aᵢ |
| Key (K) | "我能提供什麼" | kᵢ = W^k · aᵢ |
| Value (V) | "我的內容" | vᵢ = W^v · aᵢ |
| Attention Score | Q 和 K 的相關程度 | α_{i,j} = qᵢ · kⱼ |
| Softmax | 把分數歸一化 | 歸到 0-1 之間 |

---

## Muse 映射

- **N 節點：** N02 Transformer（最底層推導）
- **與已有知識包的關係：** 本包 + LH21_self_attention_2 是 Self-Attention 的完整手推。LH25_02（Model Inside）是更高層的 Transformer 全貌。
