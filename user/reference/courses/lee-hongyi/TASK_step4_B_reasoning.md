# Step 4 子任务 B：Reasoning + 评估（4 个）

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
| 1 | `LH25_08_reason_eval` | Reasoning 评估 | A1 | N12 |
| 2 | `LH25_09_reason_shorter` | Reasoning 缩短 | A1 | N09 |
| 3 | `LH25F_04_evaluation` | 评估生成式 AI 的各种坑 | A1 | N12 |
| 4 | `LH25F_09_generation` | 影像和声音上的生成策略 | A1 | — |

## Manifest 模板

格式参照 `manifests/LH26_03_flash_attention.md`，status 设为 `done (Step 4 complete)`。

## 完成标准

- 4 个 `knowledge/<prefix>.md` 存在且 > 2000 字
- 4 个 `manifests/<prefix>.md` 存在
