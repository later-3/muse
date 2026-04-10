# LH25_10 — Model Editing（植入知識）

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~46min）
> **課件：** slides_text/LH25_10_model_editing.txt
> **N 節點映射：** N08 後訓練
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Model Editing 的定義

[Fact] Model Editing 是"幫模型植入一項知識"而非"教模型新技能"：

> "Model Editing 希望做到的事情是幫模型植入一件知識。也許是為了更新它舊有的知識。比如說美國總統拜登換成了川普。有時候甚至你想讓它學到一些與事實不合的東西，比如說'全世界最帥的人是李宏毅'。"

### 2. 為什麼不能直接 Fine-tune

[Fact] 直接用 Post-training 做 Model Editing 的核心困難：

> "做 Model Editing 的時候，通常你的訓練資料就只有一筆。你做一筆訓練資料訓練下去以後，不管你問他什麼問題，他的回答都會變成是'李宏毅'了。"

這就是 **overfitting on one sample** — 模型從一筆數據中過度學習，污染了所有輸出。

### 3. Model Editing 的方法

[Fact] 主要的 Model Editing 技術：

**直接修改參數法**
- **ROME（Rank-One Model Editing）**：找到存儲某個事實的特定 layer 和 neuron，精準修改那一小部分參數
- 核心假設：知識存儲在 FFN 層中的特定位置

**外掛記憶法**
- 不修改模型參數，而是在外部加一個可編輯的記憶模組
- 查詢時先檢查外掛記憶，有新知識就用新的，沒有就用模型原來的回答
- 更安全，但增加了推理時的複雜度

### 4. Model Editing 的評估指標

[Fact] 評估 Model Editing 成功與否的三個維度：

- **Efficacy**（效力）：直接問"美國總統是誰"，能答對嗎？
- **Generalization**（泛化）：換個問法"誰在白宮？"，也能答對嗎？
- **Specificity**（特異性）：只改了目標知識，其他知識沒被破壞嗎？

### 5. 與 RAG 的對比

[Fact] Model Editing vs RAG — 兩種"更新知識"的路徑：

| | Model Editing | RAG |
|---|---|---|
| 改變什麼 | 模型參數 | Prompt 內容 |
| 持久性 | 永久（直到再次修改） | 每次調用都要帶上 |
| 風險 | 可能破壞其他知識 | Context Window 限制 |
| 適用場景 | 少量核心事實更新 | 大量動態知識查詢 |

---

## 關鍵引用

> "Model Editing 的訓練資料通常就只有一筆。訓練下去以後，不管問什麼，回答都變成李宏毅了。"

> "Post-training 是學技能，Model Editing 是植入知識。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Model Editing | 精準修改模型中的特定知識 | "植入一件知識" |
| ROME | 基於 rank-one 分解的定點參數修改 | "找到存儲事實的神經元" |
| Efficacy | 直接問目標問題的正確率 | "能答對嗎" |
| Generalization | 換問法仍能答對 | "也能答對嗎" |
| Specificity | 其他知識不受影響 | "沒被破壞嗎" |

---

## Muse 映射

- **N 節點：** N08 後訓練
- **與已有知識包的關係：** LH25_06（Post-training）→ 本包（精準知識更新）→ LH25_11（Model Merging 多技能合併）形成遞進鏈
