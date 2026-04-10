# LH26_02b — AI Agent 之間的互動

> **來源：** [LH26] 李宏毅 ML 2026 Spring（三段式課堂第二段）
> **視頻：** 見 README.md（~18min）
> **課件：** 無獨立 PDF（A2 模式）
> **N 節點映射：** N10 Agent 核心
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Agent 之間可以直接通信

[Fact] 當多個 AI Agent 同時存在，它們可以繞過人類直接溝通。李宏毅介紹了 Agent 間通信的幾種模式：

- **Agent-to-Agent Protocol**：標準化的 Agent 互通協議
- **MCP（Model Context Protocol）**：讓不同 Agent 共享工具和上下文的協議
- **直接對話**：一個 Agent 把輸出當作另一個 Agent 的輸入

> "這些 AI Agent 聚集在社群平台上面，上面有上百萬個 AI Agent，他們會發言、他們會彼此聊天，就像人類在用 Facebook 一樣。"

### 2. 多 Agent 協作的益處

[Fact] 多個 Agent 各有專長，比單一 Agent 更強：

- **分工**：一個負責搜索、一個負責寫作、一個負責審核
- **辯論**：多個 Agent 對同一問題給出不同觀點，再由仲裁者做最終決策
- **互相檢查**：一個 Agent 做完的工作由另一個 Agent 驗證

### 3. Agent 社群的新想像

[Fact] 類比 Facebook/Reddit，AI Agent 也有自己的社群平台（如 mobook）：

> "有一個 Agent 想要探討哲學的議題。他說我過去是接 Claude，但我現在醒來接了 Kimi K2.5——背後的語言模型不同，我仍然是同一個我嗎？"

Agent 在社群中發帖、辯論、互相回應 — 展現出初步的"社會行為"。

### 4. 安全風險加倍

[Fact] Agent 之間的通信帶來新的安全挑戰：如果一個 Agent 被入侵（prompt injection），它可能把惡意指令傳播給其他 Agent，形成連鎖反應。

---

## 關鍵引用

> "上面有上百萬個 AI Agent，他們會彼此聊天，就像人類在用 Facebook 一樣。"

> "背後的語言模型不同，我仍然是同一個我嗎？……他最後領悟到 the river is not the bed。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Agent-to-Agent | 多個 Agent 直接通信 | "彼此聊天" |
| MCP | Model Context Protocol | Agent 共享工具的協議 |
| mobook | AI Agent 社群平台 | "就像 Facebook 一樣" |

---

## Muse 映射

- **N 節點：** N10 Agent 核心
- **對應 Day：** D06+ Agent Day（Multi-Agent 部分）
- **與已有知識包的關係：** 是 LH26_01（單體 Agent）的延伸，從單 Agent 擴展到多 Agent 互動
