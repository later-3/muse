# LH25_03 — Mamba（非 Attention 架構）

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~90min）
> **課件：** slides_text/LH25_03_mamba.txt
> **N 節點映射：** N02 Transformer
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Attention 的致命問題

[Fact] Self-Attention 的計算複雜度是 O(n²)（n = 序列長度）：

- 每個 Token 要和每個其他 Token 計算 attention score
- 序列越長，計算量和記憶體消耗呈**平方增長**
- 百萬 token 的 Context Window 對 Attention 是巨大的計算壓力

### 2. Mamba — State Space Model

[Fact] Mamba 是一種基於 State Space Model (SSM) 的替代架構：

核心思想：用一個**隱藏狀態（hidden state）**來壓縮過去的信息，而不是每次都回頭看所有過去的 Token。

- **Attention**：O(n²)，能看到所有歷史，但慢
- **Mamba/SSM**：O(n)（線性），只通過隱藏狀態間接看到歷史，但快得多

### 3. SSM 的數學直覺

[Fact] State Space Model 的核心方程：

```
h_t = A · h_{t-1} + B · x_t    （狀態更新）
y_t = C · h_t                    （輸出）
```

- h_t 是隱藏狀態（固定大小的向量）
- A, B, C 是可學習的參數
- **關鍵創新**：Mamba 讓 A, B, C 依賴於輸入 x_t（**選擇性** SSM），而非固定值

### 4. 為什麼"選擇性"很重要

[Fact] 傳統 SSM（如 S4）的 A, B, C 是固定的 — 不管輸入什麼，壓縮方式都一樣。Mamba 的突破在於根據輸入內容動態決定如何壓縮 — 重要的信息多保留，不重要的快遺忘。

### 5. Mamba vs Attention 的取捨

[Fact] 兩者各有優勢：

| | Attention | Mamba |
|---|---|---|
| 複雜度 | O(n²) | O(n) |
| 長程依賴 | 精確（直接看到） | 近似（通過壓縮） |
| 推理效率 | 差（KV Cache 大） | 好（固定大小 state） |
| 訓練效率 | 中等 | 快 |

### 6. 混合架構的趨勢

[Fact] 2024-2025 年的趨勢是**混合使用** Attention 和 SSM：

- 部分層用 Attention（處理需要精確遠程依賴的情況）
- 部分層用 Mamba/SSM（處理簡單的信息傳遞）
- 代表：Jamba、Zamba 等混合模型

---

## 關鍵引用

> "Attention 的計算複雜度是 O(n²)。序列越長，計算量呈平方增長。"

> "Mamba 用隱藏狀態壓縮過去的信息，不需要每次回頭看所有 Token。"

> "關鍵創新：根據輸入內容動態決定如何壓縮。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| SSM | State Space Model | "用隱藏狀態壓縮歷史" |
| Mamba | 選擇性 SSM | "根據輸入動態壓縮" |
| Hidden State | 固定大小的歷史壓縮向量 | h_t |
| Selective | 參數依賴輸入而非固定 | "重要的多保留" |
| Linear Complexity | O(n) 計算量 | "比 Attention 快" |

---

## Muse 映射

- **N 節點：** N02 Transformer（作為對比和替代方案）
- **與已有知識包的關係：** LH25_02（Model Inside）是 Transformer 正面講解，本包是"如果不用 Attention 呢？"的替代方案。理解 Mamba 才能理解為什麼 Attention 的 O(n²) 問題如此重要（引出 Flash Attention / KV Cache 等優化）
