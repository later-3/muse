# LH25_12 — 語音語言模型的發展

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~89min）
> **課件：** slides_text/LH25_12_speech_llm.txt
> **N 節點映射：** — （Speech LLM 專題）
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Speech LLM 的願景

[Fact] 李宏毅開篇定位 Speech LLM 的目標：

> "語音語言模型希望做到的事情就是讓語言模型可以**聽懂聲音**，它也可以**產生聲音**。聲音相較於文字有更多的資訊 — 不只有文字內容，還有是什麼樣的人在講話、他的情緒是什麼、甚至根據環境音推測他在哪裡。"

代表產品：ChatGPT Voice Mode、Gemini Live、Moshi 等。

### 2. 語音 Token 化的挑戰

[Fact] 語音和文字最大的差異在於 Token 化：

- 文字有天然的離散單位（字/詞）
- 語音是連續信號，需要額外的編碼器（如 HuBERT、Whisper encoder）把它壓成離散或連續 token
- 語音 token 的序列長度遠超文字（同樣一句話，語音 token 數量可能是文字的 10-50 倍）

### 3. 三種架構

[Fact] Speech LLM 的三大架構路線：

**Cascaded（級聯式）**
- ASR → LLM → TTS
- 語音先轉文字，LLM 處理文字，再把文字轉回語音
- 延遲高、情緒/語調信息在 ASR 環節就丟失了

**端到端（End-to-End）**
- 直接吃語音 token，輸出語音 token
- 保留語調、情緒等非文字信息
- 訓練困難，需要大量語音-語音配對數據

**混合式**
- 輸入端用語音 token（保留聲音信息）
- 中間用文字 token 做推理（利用 LLM 的文字能力）
- 輸出端用語音 token（生成自然語音）

### 4. 語音生成的技術

[Fact] 語音如何被 LLM "說出來"：

- **離散語音 token + Autoregressive**：和文字接龍一樣，一個 token 接一個 token
- **連續語音 token + Flow Matching / Diffusion**：類似圖片生成（見 LH25F_09）
- **TTS 驗證循環**：生成語音 → 語音辨識檢查 → 不對就重來（OpenClaw 的 TTS_check 就是這個思路）

### 5. 實時對話的計術挑戰

[Fact] 實時語音對話需要解決的工程問題：

- **低延遲**：使用者說完到模型回應的時間 < 1 秒
- **打斷處理（Barge-in）**：使用者隨時可能打斷 AI 講話
- **Full Duplex（全雙工）**：同時聽和說，不是一問一答
- **Moshi 是最早真正釋出的 Speech LLM**

---

## 關鍵引用

> "語音語言模型讓 LLM 聽懂聲音也能產生聲音。聲音比文字有更多資訊。"

> "Moshi 應該是最早真正釋出的語音語言模型。GPT-4o 只是做了一個 demo，並沒有真的釋出模型。"

> "語音 token 的序列長度遠超文字，同樣一句話可能是文字的 10-50 倍。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Speech LLM | 能聽能說的語言模型 | "聽懂聲音也產生聲音" |
| Cascaded | ASR→LLM→TTS 級聯 | "先轉文字再處理" |
| End-to-End | 語音輸入→語音輸出 | "保留語調情緒" |
| Barge-in | 使用者打斷 AI | "隨時可能打斷" |
| Full Duplex | 同時聽和說 | "全雙工" |
| HuBERT | 語音 token 編碼器 | 把聲音壓成 token |

---

## Muse 映射

- **N 節點：** 無直接節點（Speech LLM 專題）
- **與已有知識包的關係：** 和 LH25F_09（生成策略）在語音生成部分有交集。與 Agent 主線關聯 — OpenClaw 的 TTS_check 就是 Speech LLM 的實際應用。
