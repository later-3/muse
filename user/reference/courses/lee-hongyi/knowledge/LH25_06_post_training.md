# LH25_06 — Post-training + Forgetting

> **來源：** [LH25] 李宏毅 ML 2025 Spring
> **視頻：** 見 README.md（~83min）
> **課件：** slides_text/LH25_06_post_training.txt
> **N 節點映射：** N08 後訓練
> **提煉時間：** 2026-04-09

---

## 核心教學內容提煉

### 1. Post-training 的定義

[Fact] Post-training 是指在 Foundation Model 預訓練完成之後，為特定需求做進一步訓練：

> "Post-training 通常是想要讓模型學會新的技能。這個技能不是一項知識，而是需要模型做比較大的改變才有辦法學會的事情。比如說新的語言，或者是使用工具，或者是做推理等等。"

### 2. 三階段訓練管線

[Fact] 通用模型的標準訓練流程：

- **Pretrain（預訓練）**：像學齡前學習，海量數據，學習語言規律
- **SFT（Supervised Fine-Tuning）**：像上學，學什麼回答才是"正確"的
- **RLHF（Reinforcement Learning from Human Feedback）**：像出社會，沒有標準答案，從人類反饋中學習

### 3. 遺忘問題 — Catastrophic Forgetting

[Fact] Post-training 最大的敵人是遺忘：

> "模型學了新的技能以後，舊的技能就忘掉了。這叫做 catastrophic forgetting（災難性遺忘）。"

具體表現：
- 學了中文，英文能力下降
- 學了用工具，對話能力退化
- 學了推理，回答速度變慢

### 4. 對抗遺忘的方法

[Fact] 幾種主流對抗遺忘的策略：

- **混合訓練數據**：新技能的訓練數據和舊能力的訓練數據按比例混合
- **正則化（Regularization）**：限制參數變化幅度，不要離原始模型太遠
- **LoRA / 低秩適應**：只訓練少量的新增參數，凍結大部分原始參數
- **Model Merging**：訓練完再合併（見 LH25_11）

### 5. Post-training 和 RAG 的取捨

[Fact] 要給模型"植入知識"有兩條路：

- **Post-training（寫入參數）**：永久修改模型，但有遺忘風險
- **RAG（寫入 Context）**：不改模型，把知識放到 Prompt 裡面，但受 Context Window 限制

---

## 關鍵引用

> "Post-training 是讓模型學會新技能。不是一項知識，而是比較大的改變。"

> "模型學了新技能以後，舊的技能就忘掉了。這叫 catastrophic forgetting。"

---

## 詞彙表

| 術語 | 定義 | 李宏毅的講法 |
|------|------|-------------|
| Post-training | Foundation Model 預訓練後的進一步訓練 | "學會新技能" |
| SFT | 用標準答案微調 | "上學" |
| RLHF | 從人類反饋中學習 | "出社會" |
| Catastrophic Forgetting | 學新忘舊 | "災難性遺忘" |
| LoRA | 低秩適應，只訓練少量參數 | 凍結大部分原始參數 |

---

## Muse 映射

- **N 節點：** N08 後訓練
- **與已有知識包的關係：** 本包 → LH25_10（Model Editing）→ LH25_11（Model Merging）→ LH25F_08（終身學習）形成"後訓練四部曲"
