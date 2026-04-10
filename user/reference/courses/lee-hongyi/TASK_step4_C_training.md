# Step 4 子任务 C：训练 + 后训练（7 个）

> **下发者：** Later  |  **前置：** Step 1-3 已完成  |  **参考范例：** `knowledge/LH26_01_openclaw_agent.md`

## 环境

```
工作目录: user/reference/courses/lee-hongyi/
输入: transcripts/<prefix>_transcript.txt + slides_text/<prefix>.txt
输出: knowledge/<prefix>.md + manifests/<prefix>.md
```

## 知识包模板

**严格参照** `knowledge/LH26_01_openclaw_agent.md` 的格式，包括：
- 头部元信息（来源/视频/课件/N节点映射/提炼时间）
- `## 核心教学内容提炼` — 每个主题用 `[Fact]` 标记 + 直接引用讲师原话
- `## 关键引用` — 3-5 条最有价值的原话
- `## 词汇表` — 术语 | 定义 | 李宏毅的讲法
- `## 设计动机与第一性原理`
- `## Muse 映射`

**质量要求：** 每包 2000-5000 字，必须直接引用 transcript 原话，不要编造。

## 待处理条目

| # | prefix | 标题 | mode | N节点 |
|---|--------|------|------|-------|
| 1 | `LH25_06_post_training` | Post-training + Forgetting | A1 | N08 |
| 2 | `LH25_05_multi_gpu_training` | 多 GPU 训练大型模型 | A2 | N06 |
| 3 | `LH25F_06_training_tips` | 训练神经网络的各种诀窍 | A1 | N06 |
| 4 | `LH25_10_model_editing` | Model Editing | A1 | N08 |
| 5 | `LH25_11_model_merging` | Model Merging (仅 PDF) | B1 | N08 |
| 6 | `LH25F_08_lifelong_learning` | 通用模型的终身学习 | A1 | N08 |
| 7 | `LH25_12_speech_llm` | Speech LLM | A1 | — |

**注意：**
- `LH25_05_multi_gpu_training` 是 A2 模式（无 PDF），纯从 transcript 提炼
- `LH25_11_model_merging` 是 B1 模式（仅 PDF，无 transcript），从 `slides_text/LH25_11_model_merging.txt` 提炼

## Manifest 模板

格式参照 `manifests/LH26_03_flash_attention.md`，status 设为 `done (Step 4 complete)`。

## 完成标准

- 7 个 `knowledge/<prefix>.md` 存在且 > 2000 字（B1 模式可 1500+）
- 7 个 `manifests/<prefix>.md` 存在
