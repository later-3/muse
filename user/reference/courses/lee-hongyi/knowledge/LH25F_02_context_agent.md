# LH25F_02 — Context Engineering + Agent + Reasoning 組合課

> **來源：** [LH25F] 李宏毅 GenAI-ML 2025 Fall 第 2 講
> **視頻：** 見 README.md（~107min）
> **課件：** slides_text/LH25F_02_context_agent.txt
> **N 節點映射：** N10 + N11 + N09
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Context Window 的核心約束

[Fact] 這是一堂整合課，李宏毅把 Agent、Context Engineering 和 Reasoning 三個主題串聯起來。開篇從 Context Window 的物理限制出發：

語言模型的輸入+輸出總長度受限。每多一輪工具調用，歷史就要拼接更長。這直接引出 Context Engineering 的必要性。

### 2. Agent 的工作循環 — 從目標到完成

[Fact] 重申 Agent 的循環結構：人類給目標 → Agent 觀察環境 → 決定行動 → 執行 → 觀察新狀態 → 循環。

> "AI Agent 要自己想辦法達成目標。要通過多個步驟跟環境做複雜的互動才能夠完成。"

### 3. Context Engineering 的三大技巧

[Fact] 李宏毅在這堂組合課中系統梳理 CE 技巧：

- **壓縮（Compaction）**：把長歷史壓成摘要
- **按需加載**：Skill/工具說明不預先塞入 System Prompt，需要時才讀取
- **Sub-agent 隔離**：子任務放到獨立的 Context Window 執行，只把結果摘要返回主 Agent

> "這些繁瑣的過程沒有出現在大龍蝦的 Context Window 中，所以他可以更專注在更高級的任務。"

### 4. Reasoning — 深度思考的語言模型

[Fact] 介紹 o1/R1 類模型的深度思考能力：模型在回答前先輸出一段長長的"思考過程"（用 `<think>` 標籤包裹），包含自我驗證、探索其他可能性、規劃解題步驟。

> "他心裡在想什麼呢？他說首先一個蘋果加一個蘋果就是兩個蘋果，所以 1+1=2。但是下一段他又否定自己的想法……他說使用者可能只是測試我會不會想太多。"

### 5. 三者的關係

[Fact] Agent 需要 Context Engineering 來管理有限的 Context Window；Reasoning 模型在 Agent 場景中特別有價值，因為它能在行動前先"想清楚"，減少試錯次數，從而節省 Context 消耗。

三者形成正向循環：更好的 Reasoning → 更少的試錯 → 更少的 Context 消耗 → Agent 能做更複雜的任務。

---

## 關鍵引用

> "AI Agent 要自己想辦法達成目標。"

> "這些繁瑣的過程沒有出現在大龍蝦的 Context Window 中。"

> "使用者可能只是測試我會不會想太多，所以最後答案是 2。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Context Window | LLM 輸入+輸出的最大長度 | "語言模型的輸入長度是有限的" |
| Compaction | 歷史對話壓縮為摘要 | "通過語言模型變成摘要" |
| Reasoning | 模型在回答前的深度思考過程 | "內心的小劇場" |
| Think Tag | `<think>...</think>` 標記思考過程 | "為了介面呈現的方便" |

---

## 設計動機與第一性原理

- **為什麼三者要一起講？** — Agent 是框架，CE 是核心技術，Reasoning 是能力提升。三者共同解決"用有限的 Context 完成複雜任務"這一根本問題。
- **Reasoning 對 Agent 的價值** — 想清楚再行動，比行動了再修正，消耗更少的 Context。

---

## Muse 映射

- **N 節點：** N10 + N11 + N09
- **對應 Day：** 跨多個 Day 的整合課
- **與已有知識包的關係：** 本包是 LH26_01（Agent 實踐）、LH26_02（CE 理論）、LH25_07（Reasoning 深入）三者的橋樑
