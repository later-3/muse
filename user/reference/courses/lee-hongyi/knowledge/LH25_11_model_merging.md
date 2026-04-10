# LH25_11 — Model Merging（模型合併）

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（僅 PDF，B1 模式）
> **課件：** slides_text/LH25_11_model_merging.txt
> **N 節點映射：** N08 後訓練
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Model Merging 解決什麼問題

[Fact] 你有多個 fine-tuned 模型（各擅長一個任務），想合成一個什麼都會的模型，但又不想重新訓練。Model Merging 的核心承諾是：

> "不用訓練資料！不用做任何模型訓練！"

### 2. Task Vector — 核心概念

[Fact] 從投影片中可以提取出 Model Merging 的數學基礎：

- Foundation Model 參數：θ
- 在任務 A 上 fine-tune 後：θ_A
- **Task Vector**：τ_A = θ_A − θ（fine-tune 學到的"差異"）
- 合併：θ_merged = θ + α·τ_A + β·τ_B

類比：**接枝**（grafting）。李宏毅引用了「接枝王」的比喻 — 把一棵樹的優良特性嫁接到另一棵樹上。

> "類神經網路參數豈是如此不便之物！"（引自 Task Vector 論文的精神）

### 3. 實際案例

[Fact] 投影片中展示的實際應用：

- 把中文能力（中文數據 fine-tune）和 Alignment 能力（RLHF）分別訓練
- 用 Task Vector 相加，得到一個既懂中文又有 Alignment 的模型
- Base model: LLaMA-2-base → Chinese fine-tune + LLaMA-2-Chat 的 alignment vector → 合併

### 4. 局限性

[Fact] Model Merging 的限制：

- 所有要合併的模型必須來自**同一個 Foundation Model**（否則參數空間不對齊）
- 不同 Task Vector 之間可能衝突（一個改變的參數可能正好損害另一個任務）
- 加權係數（α, β）需要調整才能找到最佳組合

### 5. 和遺忘問題的關係

[Fact] Model Merging 是解決 catastrophic forgetting 的方法之一：

不用在一個模型上連續訓練多個任務（容易遺忘），而是每個任務獨立訓練，最後合併。這從根本上繞過了遺忘問題。

---

## 關鍵引用

> "不用訓練資料！不用做任何模型訓練！"

> "類神經網路參數豈是如此不便之物！"

> "接枝 — 把不同能力嫁接到同一個模型上。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Task Vector | fine-tune 後與原模型的參數差 | τ = θ_A − θ |
| Model Merging | 把多個 task vector 相加 | "接枝" |
| Foundation Model | 所有 fine-tune 的共同起點 | θ |

---

## Muse 映射

- **N 節點：** N08 後訓練
- **與已有知識包的關係：** LH25_06（Post-training）→ LH25_10（Model Editing）→ 本包（Model Merging）→ LH25F_08（終身學習）
