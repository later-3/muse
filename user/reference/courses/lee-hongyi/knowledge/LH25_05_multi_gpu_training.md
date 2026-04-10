# LH25_05 — 多 GPU 訓練大型模型

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~44min）
> **課件：** 無獨立 PDF（A2 模式，純 transcript）
> **N 節點映射：** N06 訓練管線
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 為什麼需要多 GPU

[Fact] 現代大型語言模型的參數量從數十億到上千億，單張 GPU 的記憶體根本放不下。訓練時需要分散到多張 GPU 上。

### 2. 三種並行策略

[Fact] 多 GPU 訓練的三大並行範式：

**Data Parallelism（數據並行）**
- 每張 GPU 上放**完整模型的複本**
- 不同 GPU 處理不同 batch 的數據
- 定期同步梯度
- 限制：模型太大時，一張 GPU 放不下整個模型

**Model Parallelism / Tensor Parallelism（模型並行 / 張量並行）**
- 把模型的**每一層**拆分到多張 GPU
- 計算時各 GPU 處理同一層的不同部分
- 需要頻繁的 GPU 間通信

**Pipeline Parallelism（流水線並行）**
- 把模型的**不同層**分配到不同 GPU
- 像工廠流水線一樣，前面的 GPU 處理完一批數據傳給下一個
- 存在"氣泡"問題（部分 GPU 閒置等待）

### 3. 混合並行

[Fact] 實際訓練中往往**混合使用**三種策略：

- 節點內用 Tensor Parallelism（GPU 間通信快）
- 節點間用 Pipeline + Data Parallelism（節點間通信慢）
- 這需要精細的工程調優

### 4. ZeRO — 消除冗餘

[Fact] ZeRO（Zero Redundancy Optimizer）是 Data Parallelism 的改進：

- 傳統 Data Parallelism 中，每張 GPU 都存完整的 optimizer state → 巨大浪費
- ZeRO 把 optimizer state / gradient / parameters 分散存儲到不同 GPU
- 需要時再互相通信獲取 → 用通信換記憶體

### 5. 實際工程考量

[Fact] 多 GPU 訓練的工程挑戰：

- GPU 間通信是瓶頸（NVLink vs InfiniBand vs Ethernet 速度差異巨大）
- Checkpoint 存檔策略（GPU 故障後如何恢復）
- 混合精度訓練（FP16/BF16 節省記憶體，但需注意數值穩定性）

---

## 關鍵引用

> "單張 GPU 的記憶體放不下整個模型，必須分散到多張 GPU。"

> "三種並行各有代價：Data Parallelism 浪費記憶體，Tensor Parallelism 通信頻繁，Pipeline Parallelism 有氣泡。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Data Parallelism | 同一模型複本處理不同數據 | "每張 GPU 放完整模型" |
| Tensor Parallelism | 一層拆分到多張 GPU | "處理同一層的不同部分" |
| Pipeline Parallelism | 不同層在不同 GPU | "工廠流水線" |
| ZeRO | 消除冗餘的優化器 | "用通信換記憶體" |
| Bubble | Pipeline 中 GPU 閒置時間 | "部分 GPU 閒置等待" |

---

## Muse 映射

- **N 節點：** N06 訓練管線
- **與已有知識包的關係：** 本包是訓練的工程實現面，LH25F_06（訓練諀竅）是訓練的技巧面，二者互補
