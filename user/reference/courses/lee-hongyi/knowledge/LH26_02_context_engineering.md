# LH26_02 — Context Engineering：AI Agent 的核心技術

> **來源：** [LH26] 李宏毅 ML 2026 Spring
> **視頻：** 見 README.md（~44min，本講為三段式課堂的第一段）
> **課件：** slides_text/LH26_02_context_engineering.txt
> **N 節點映射：** N11 Context 工程 → D?? Context Engineering Day
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Context Engineering 的定義 — "語言模型的經紀人"

[Fact] 李宏毅用一個精確的比喻定位 Context Engineering：

> "AI Agent 就是攔截在語言模型跟人類、或者是語言模型要執行的環境之間的一個介面。他就像是語言模型的**守門人**、語言模型的**經紀人**，他決定語言模型會看到什麼。"

核心問題：語言模型的輸入長度有上限（Context Window），但每一輪互動都要把之前所有歷史串起來。所以 Agent 必須管理這個輸入 — 不能太長（超限），也不能太短（丟失信息）。

> "對 AI Agent 來說，他需要產生一個**長度合適的輸入**，不能太長也不能太短。這件事情就叫做 Context Engineering。"

### 2. 形式化表達 — 一個 for 迴圈 + 大 F

[Fact] 李宏毅用偽代碼把 Context Engineering 講得極其清晰：

沒有 CE 的版本：
```
for t = 1 to ∞:
    O_t = LLM(C_t + I_t)
    C_{t+1} = C_t + I_t + O_t   // 直接拼接，會越來越長
```

有 CE 的版本：
```
for t = 1 to ∞:
    O_t = LLM(C_t + I_t)
    C_{t+1} = F(C_t, I_t, O_t)  // 用大 F 做複雜操作
```

> "你唯一改變的只有最後這一行。其他部分運作都還是一樣的。至於這個大 F 要做什麼，那就要問你自己。這個就是 Context Engineering，也就是一個 AI Agent 要做的事情。"

### 3. 壓縮（Compression）— "這裡曾經有個工具的輸出"

[Fact] 最粗暴的壓縮方法居然真的有效：

> "有一個非常簡單粗暴的方式：如果某一段文字它原來是某一個工具的輸出，就把那一段長篇大論改成**'這裡曾經有個工具的輸出'**就結束了。上週講到這邊的時候我看同學笑了，你可能覺得這什麼爛方法……**神奇的事情是這個方法還真的有用。**"

論文在 SWE-bench 上的實驗顯示，這種粗暴壓縮的表現居然和用語言模型做精細摘要差不多。

### 4. Context 的兩層結構 — N（硬碟）和 P（Prompt）

[Fact] Context 不是鐵板一塊，而是分兩層：

- **N（enduring context）**：存在硬碟裡的長期信息 — .md 文字檔、記憶、Skill 等
- **P（prompt context）**：真正被塞進 Prompt 送給語言模型的部分

Agent 做的事情就是從 N 中按需選取內容加載到 P 中。這正是 Skill 按需讀取的原理。

### 5. 工具按需加載 — "語言模型自己決定需要什麼工具"

[Fact] 類似 Skill 的概念在學術界叫做動態工具發現：

> "我們何不讓語言模型用 AI **動態的決定他自己需要什麼工具**？讓語言模型輸出他想要什麼，用這個工具的需求去操控搜尋引擎，讓搜尋引擎找出他需要的工具。這件事情其實就是 OpenClaw 裡面所用的 Skill 的概念。Skill 也是按需加載的。"

### 6. Agentic Context Engineering — "把 CE 也交給語言模型"

[Fact] 最前沿的方向：讓語言模型自己做自己的 Context Engineering：

> "有沒有辦法把 Context Engineering 也交給語言模型？也不給人類設計，直接交給語言模型，讓他自己想辦法幫自己做 Context Engineering。"

三個代表性工作：
- **Dynamic Cheat Sheet**：語言模型維護一張"小抄"，用 Prompt Engineering 來做 Context Engineering
- **Agentic CE（Playbook）**：三個語言模型模組協作修改一本"員工手冊"
- **Recursive LM**：把超長 context 存硬碟，語言模型自己寫程式做 RAG 搜索

> "如果你仔細去讀它的 Prompt 的話……只差沒有教語言模型說你直接做 RAG，它花了蠻多力氣不斷地暗示語言模型說你可以做 RAG。"

---

## 關鍵引用

> "AI Agent 就是語言模型的守門人、語言模型的經紀人。"

> "Context Engineering 唯一改變的只有最後那一行程式。大 F 要做什麼，那就是 AI Agent 要做的事情。"

> "把長篇大論改成'這裡曾經有個工具的輸出'——這個方法還真的有用。"

> "OpenClaw 只是初代的 AI Agent。以後再回頭看 OpenClaw，就好像今天你拿著 iPhone 去看過去的 Nokia 手機一樣。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Context Engineering | 管理語言模型輸入長度和內容的技術 | "大 F 要做什麼" |
| Compaction | 用 LLM 摘要壓縮舊對話 | "通過語言模型變成摘要" |
| Hard Clear / Soft Trim | 粗暴刪除或截斷工具輸出 | "這裡曾經有個工具的輸出" |
| N (enduring) | 存在硬碟的長期 context | ".md 檔、記憶" |
| P (prompt) | 真正送進 LLM 的 context | "真的被放到 Prompt 裡面的" |
| Agentic CE | 讓 LLM 自己做 CE | "把 CE 也交給語言模型" |
| Dynamic Cheat Sheet | 語言模型維護的動態小抄 | "會隨時間變化的小抄" |

---

## 設計動機與第一性原理

- **為什麼 CE 是核心？** — Context Window 是語言模型唯一的感知通道。Agent 的一切能力（記憶、工具、Skill）都要通過這個窗口呈現。管好這個窗口 = 管好一切。
- **粗暴方法為什麼有效？** — 語言模型靠的是模式匹配而非精確記憶。"這裡有過輸出"這個信號已足夠讓模型知道流程進展到哪了。
- **Agentic CE 的風險** — System Prompt（身份信息）不能被 LLM 自己修改，否則 Agent 會"失去自我"。

---

## Muse 映射

- **N 節點：** N11 Context 工程
- **對應 Day：** 未來 Context Engineering Day
- **與已有知識包的關係：** 本包是 CE 的理論框架，`LH26_01`（OpenClaw）已展示了 CE 的工程實踐（Sub-agent、Skill 按需讀取、Compaction），二者互補
