# LH25F_06 — 訓練神經網路的各種言竅

> **來源：** [LH25F] 李宏毅 GenAI-ML 2025 Fall 第 6 講
> **視頻：** 見 README.md（~132min）
> **課件：** slides_text/LH25F_06_training_tips.txt
> **N 節點映射：** N06 訓練管線
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 訓練失敗的常見原因

[Fact] 李宏毅在這堂超長課（132min）中系統梳理了訓練神經網路時的常見陷阱和解法。

關鍵直覺：訓練失敗不一定是模型或數據的問題，往往是**配方（recipe）**的問題 — learning rate、batch size、optimizer 的選擇和搭配。

### 2. Learning Rate 調度

[Fact] Learning rate 是最關鍵的超參數：

- 太大：訓練不穩定，loss 震盪甚至爆炸
- 太小：收斂太慢，被困在差的局部最優
- **Warmup**：開始時用小 learning rate 慢慢加大，避免初始訓練不穩定
- **Cosine Decay**：逐漸降低 learning rate，讓模型穩定收斂
- **Learning Rate Schedule 的重要性遠超想像** — 很多看似"模型不好"的結論其實是 LR 沒調好

### 3. Batch Size 和 Gradient Accumulation

[Fact] Batch size 的選擇影響訓練動態：

- 大 batch：梯度估計更穩定，但可能困在 sharp minima（泛化差）
- 小 batch：梯度有噪音，反而可能找到 flat minima（泛化好）
- **Gradient Accumulation**：GPU 記憶體不夠放大 batch → 多次小 batch 的梯度累加 → 等效大 batch

### 4. Optimizer 選擇

[Fact] 不同的 optimizer 適合不同場景：

- **SGD**：最基本，很多時候反而泛化效果好
- **Adam / AdamW**：自適應 learning rate，LLM 訓練的事實標準
- **8-bit Adam**：節省記憶體，表現接近
- **Weight Decay**：防止過擬合的正則化技巧，AdamW 中內建

### 5. 過擬合和正則化

[Fact] 過擬合的信號和應對：

- 訓練 loss 下降但驗證 loss 上升 = 過擬合
- **Dropout**：訓練時隨機關掉部分神經元
- **Weight Decay**：限制參數大小
- **Early Stopping**：驗證 loss 開始上升時停止訓練
- **Data Augmentation**：增加訓練數據的多樣性

### 6. 數值穩定性

[Fact] 大模型訓練中的數值問題：

- **FP16 / BF16 混合精度訓練**：節省記憶體，但需處理 gradient underflow
- **Loss Scaling**：放大 loss 再縮回梯度，解決 FP16 精度不足
- **Gradient Clipping**：限制梯度的最大範數，防止梯度爆炸

---

## 關鍵引用

> "訓練失敗不一定是模型問題，往往是配方（recipe）的問題。"

> "Learning rate schedule 的重要性遠超想像。"

> "小 batch 的噪音反而可能找到 flat minima。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Learning Rate Warmup | 訓練初期逐漸增大 LR | "慢慢加大避免不穩定" |
| Cosine Decay | LR 按餘弦曲線下降 | 讓模型穩定收斂 |
| Gradient Accumulation | 多次小 batch 梯度累加 | "等效大 batch" |
| AdamW | 內建 weight decay 的 Adam | LLM 事實標準 |
| Mixed Precision | FP16/BF16 混合精度 | 節省記憶體 |
| Gradient Clipping | 限制梯度範數上限 | 防梯度爆炸 |

---

## Muse 映射

- **N 節點：** N06 訓練管線
- **與已有知識包的關係：** 本包是訓練的"手冊"，LH25_05 是多 GPU 工程，二者從不同角度覆蓋訓練管線。D05 學習計畫直接引用本包。
