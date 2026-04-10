# LH25F_09 — 影像和聲音上的生成策略

> **來源：** [LH25F] 李宏毅 GenAI-ML 2025 Fall 第 9 講
> **視頻：** 見 README.md（~127min）— 3 段：VAE / Diffusion / Generation Head
> **課件：** slides_text/LH25F_09_generation.txt
> **N 節點映射：** — （生成模型專題）
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. 開場 — 文字之外的生成

[Fact] 之前的課都集中在文字（語言模型），本課轉向圖片、影片和聲音：

> "到目前為止我們主要都集中在語言模型。今天要來講這些生成式 AI 怎麼產生圖片甚至影片，怎麼產生聲音、說一句話甚至唱一首歌。"

### 2. Nano Banana — 圖片生成的驚人能力

[Fact] 李宏毅用一個生動的例子展示 Google 的 Nano Banana 圖片生成能力：

> "我要求 Nano Banana 產生 PTT 八卦版鄉民貼文的截圖。它產生出來的輸出——裡面的文字都是讀得懂而且都是合理的。po 文的人是 PTT Loser，暱稱是魯蛇之王，他抱怨巷口雞腿便當漲到 160 了。下面有一堆人推文，而且這些人的帳號都是有意思的。"

> "我蠻相信他是直接產生這張圖片的，因為你看右下角有一塊小小黑色的東西，他想模擬螢幕上呈現的結果。而且如果你放大看，160 的 0 中間有一條斜線，但 100 和 130 的 0 中間沒有。"

### 3. 兩條世界線 — AR 和 Diffusion

[Fact] 影像生成有兩條技術路線：

**路線一：Autoregressive（文字接龍式）**
- 把圖片切成 token（discrete token 或 continuous token）
- 用和語言模型相同的自回歸方式一個 token 一個 token 生成
- 優勢：可以和文字統一在同一個模型框架中

**路線二：Diffusion（去噪式）**
- 從一張純噪音圖片開始，逐步去噪直到得到清晰圖片
- 代表模型：Stable Diffusion、DALL-E
- 優勢：生成質量高，可以做精細控制

### 4. VAE — Variational Autoencoder

[Fact] VAE 在生成中的核心角色：

- **Encoder**：把高維圖片壓縮到低維隱空間（latent space）
- **Decoder**：從隱空間重建圖片
- 在 Diffusion 中的作用：不在原始像素空間做去噪，而在 latent space 做 → 大幅降低計算量

### 5. Generation Head — 兩條世界線的融合

[Fact] 2025 年最重要的趨勢 — 兩條路線正在合併：

> "2025 年看到的就是兩條世界線的結合。"

**Generation Head** 的核心思想：
- 語言模型中的 token 分兩種：文字 token（離散）和生成 token（連續）
- 被 mask 的位置輸出向量（continuous token），再搭配從高斯分佈 sample 出來的噪音，經過 Generation Head 跑多個 iteration 得到最終結果
- 等同於在 AR 模型內部嵌入了 Diffusion 的機制

### 6. 應用廣泛

[Fact] Generation Head 已經擴展到多個領域：

- **文字生成音頻**（Text-to-Audio）
- **語音合成 TTS**：用 energy-based model 做更少 iteration
- **語音對話模型**（Speech LM）
- **影片生成**（Video Generation + continuous token）
- **VAR（Visual Autoregressive）**：圖片從小到大逐步生成

---

## 關鍵引用

> "到目前為止主要集中在語言模型。今天要講生成式 AI 怎麼產生圖片甚至影片。"

> "Nano Banana 產生的 PTT 鄉民貼文——文字都讀得懂而且合理。"

> "2025 年看到的就是兩條世界線的結合。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| VAE | 變分自編碼器，壓縮到 latent space | "把圖片壓到低維" |
| Diffusion | 從噪音逐步去噪生成 | "從純噪音開始去噪" |
| Autoregressive | 一個 token 接一個 token | "文字接龍式" |
| Generation Head | AR 模型中嵌入 Diffusion | "兩條世界線的結合" |
| Continuous Token | 連續向量形式的 token | 和離散文字 token 共存 |
| FlowAR | VAR + Flow Matching | "從 VAR 變成 FlowAR" |

---

## 設計動機與第一性原理

- **為什麼文字和圖片要統一？** — 統一框架 = 一個模型同時理解和生成文字/圖片/聲音。多模態大一統是 AI 的長期方向。
- **為什麼 Diffusion 更好？** — 在高維像素空間中，AR 生成的累積誤差問題嚴重。Diffusion 的全局去噪避免了這個問題。
- **Generation Head 為什麼是趨勢？** — 兼得 AR 的靈活性（和語言模型統一）和 Diffusion 的生成質量。

---

## Muse 映射

- **N 節點：** 無直接節點（生成模型專題）
- **與已有知識包的關係：** 獨立專題，和 Agent/Transformer/Training 主線關聯較弱，但和 LH25_12（Speech LLM）在語音生成部分有交集
