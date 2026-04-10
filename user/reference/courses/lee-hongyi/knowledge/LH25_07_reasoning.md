# LH25_07 — Reasoning（深度思考的語言模型）

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~65min）
> **課件：** slides_text/LH25_07_reasoning.txt
> **N 節點映射：** N09 Reasoning
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 什麼是"深度思考" — 內心的小劇場

[Fact] 李宏毅用一個生動的例子開場：

> "當你問 DeepSeek R1 '1+1 等於多少'的時候，他當然會回答 2。但是你會發現他出現一個框框，然後說'以深度思考'。他心裡在想什麼呢？他說首先一個蘋果加一個蘋果就是兩個蘋果，所以 1+1=2。但是下一段他又否定自己的想法——等一下，這會不會有什麼陷阱？讓我想想看，在二進位中 1+1=10。但第三段他又再否定了上一段——使用者只是寫了 1+1，可能只是測試我會不會想太多。所以最後的答案是 2。"

代表模型：ChatGPT o 系列、DeepSeek R 系列、Gemini Flash Thinking、Claude Extended Thinking。

### 2. Think Tag — 技術實現

[Fact] 深度思考用 `<think>...</think>` 標籤包裹：

> "之所以要加這些符號，是為了介面呈現的方便。在設計介面的時候可以選擇要不要把 think 裡面的內容呈現出來。"

思考過程中模型的典型行為：
- **驗證**："Let me check the answer"
- **探索**：嘗試其他可能性
- **規劃**：如果要解這個題目需要哪些步驟

### 3. Reasoning ≠ Inference

[Fact] 李宏毅特別澄清了兩個容易混淆的術語：

> "Inference 翻成推論，Reasoning 翻成推理。Inference 指的是你使用一個模型就叫做 Inference。Reasoning 是指模型在回答問題之前，先進行一段思考的過程。"

### 4. 怎麼讓模型學會深度思考

[Fact] 訓練深度思考能力的方法：

- **蒸餾（Distillation）**：讓一個強模型（如 o1）生成大量帶思考過程的回答，再用這些數據微調一個弱模型
- **強化學習（RL）**：給模型一個可驗證的目標（如數學題有正確答案），用 RL 鼓勵模型自己發展出有效的思考策略

> "DeepSeek R1 的 paper 就展示了，如果你只用 RL 來訓練，模型真的會自己發展出深度思考的行為。"

### 5. 深度思考的代價

[Fact] 深度思考不是免費的：

- **更多 token** = 更多推理時間 = 更多成本
- 並非所有問題都需要深度思考 — 簡單問題反而可能因為"想太多"而答錯
- 模型自己不一定知道什麼時候該深度思考、什麼時候不該

### 6. Test-Time Compute Scaling

[Fact] 深度思考開啟了一個新的 scaling 維度 — **推理時 compute 的 scaling**：

傳統 scaling 是增加訓練數據和模型參數。現在發現，給模型更多"思考時間"（允許更多 token 的思考過程）也能提升表現。這意味著即使模型本身不變，增加推理時的計算量也能解更難的問題。

---

## 關鍵引用

> "他心裡在想什麼呢？首先一個蘋果加一個蘋果就是兩個蘋果——但等一下，在二進位中 1+1=10——使用者可能只是測試我會不會想太多。"

> "Inference 是使用模型，Reasoning 是模型在回答前先想。"

> "如果你只用 RL 來訓練，模型真的會自己發展出深度思考的行為。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Reasoning | 模型在回答前的深度思考過程 | "內心的小劇場" |
| Inference | 使用模型做預測的過程 | "你使用一個模型就叫做 inference" |
| Think Tag | `<think>...</think>` 標記 | "為了介面呈現的方便" |
| Distillation | 從強模型學習思考模式 | "讓強模型生成帶思考的數據" |
| Test-Time Compute | 推理時投入更多計算量 | "給模型更多思考時間" |
| RL for Reasoning | 用 RL 訓練思考能力 | "模型真的會自己發展出深度思考" |

---

## 設計動機與第一性原理

- **為什麼深度思考有效？** — 語言模型是 auto-regressive 的，每個 token 依賴之前所有 token。更多的中間思考 token = 更豐富的上下文 = 最終答案更準確。
- **代價和權衡** — Reasoning 消耗更多 token（Context Window + API 費用）。Agent 場景中 Reasoning 模型特別有價值：想清楚再行動 = 減少試錯 = 節省 Context。
- **兩種 Scaling 定律** — 傳統 training-time scaling（更大模型）+ 新興 test-time scaling（更多思考）。二者互補。

---

## Muse 映射

- **N 節點：** N09 Reasoning
- **對應 Day：** 未來 Reasoning Day
- **與已有知識包的關係：** 本包是 Reasoning 深入講解，LH25F_02 中的 Reasoning 部分是概覽。LH25_08 是 Reasoning 的評估，LH25_09 是 Reasoning 的縮短（cost reduction）
