# Step 4 子任务 D：Transformer 内部 + LH21 经典手推（6 个）

> **下发者：** Later  |  **前置：** Step 1-3 已完成  |  **参考范例：** `knowledge/LH26_01_openclaw_agent.md`

## 环境

```
工作目录: user/reference/courses/lee-hongyi/
输入: transcripts/<prefix>_transcript.txt + slides_text/<对应文件>.txt
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

| # | prefix | 标题 | mode | N节点 | slides_text 文件 |
|---|--------|------|------|-------|-----------------|
| 1 | `LH25_02_model_inside` | Model Inside | A1 | N02 | `LH25_02_model_inside.txt` |
| 2 | `LH25_03_mamba` | Mamba | A1 | N02 | `LH25_03_mamba.txt` |
| 3 | `LH21_self_attention_1` | Self-Attention (上) | A1 | N02 | `LH21_self_attention.txt`（共享） |
| 4 | `LH21_self_attention_2` | Self-Attention (下) | A1 | N02 | `LH21_self_attention.txt`（共享） |
| 5 | `LH21_transformer_1` | Transformer/Seq2Seq (上) | A1 | N02 | `LH21_transformer.txt`（共享） |
| 6 | `LH21_transformer_2` | Transformer/Seq2Seq (下) | A1 | N02 | `LH21_transformer.txt`（共享） |

**注意 LH21 系列：**
- LH21 来自 **ML 2021 Spring** 课程（不是 2025/2026）
- `#3 + #4` 共享 `slides_text/LH21_self_attention.txt`（来自 self_v7.pdf）
- `#5 + #6` 共享 `slides_text/LH21_transformer.txt`（来自 seq2seq_v9.pdf）
- 这 4 个是李宏毅**最经典的 Self-Attention / Transformer 手推讲解**，重点提炼 Q/K/V 推导、Multi-Head、Cross-Attention、Beam Search 等底层直觉

## 额外任务：每日计划融合

完成知识包后，更新以下 3 个 learn_record（**只做增量添加，不修改已有内容**）：

| Day | README.md 路径 | 新增知识包 |
|-----|---------------|----------|
| D02 | `user/learn_record/0409-transformer-1/README.md` | `LH25_02_model_inside` |
| D03 | `user/learn_record/0410-transformer-2/README.md` | `LH25_03_mamba` |
| D05 | `user/learn_record/0412-training-pipeline-1/README.md` | `LH25F_06_training_tips`（来自子任务 C，如已完成则添加链接） |

在 README.md 末尾添加：
```markdown
### 补充资源 — 李宏毅知识包

- [<prefix> — <标题>](../../reference/courses/lee-hongyi/knowledge/<prefix>.md)
  - 核心价值：<一句话说明>
```

## Manifest 模板

格式参照 `manifests/LH26_03_flash_attention.md`，status 设为 `done (Step 4 complete)`。

## 完成标准

- 6 个 `knowledge/<prefix>.md` 存在且 > 2000 字
- 6 个 `manifests/<prefix>.md` 存在
- D02, D03 的 README.md 已增量更新
