# Step 4 子任务 A：Agent + Context Engineering（6 个）

> **下发者：** Later  |  **前置：** Step 1-3 已完成  |  **参考范例：** `knowledge/LH26_01_openclaw_agent.md`（已完成）

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

| # | prefix | 标题 | mode | N节点 | YouTube |
|---|--------|------|------|-------|---------|
| 1 | `LH26_02_context_engineering` | Context Engineering | A1 | N11 | 见 README.md |
| 2 | `LH25_01_ai_agent` | AI Agent 原理 (2025版) | A1 | N10 | 见 README.md |
| 3 | `LH25F_02_context_agent` | CE + Agent + Reasoning 组合课 | A1 | N10+N11+N09 | 见 README.md |
| 4 | `LH26_02b_agent_interaction` | AI Agent 之间的互动 | A2 | N10 | 见 README.md |
| 5 | `LH26_02c_agent_work_impact` | AI Agent 对工作的冲击 | A2 | — | 见 README.md |
| 6 | `LH25_07_reasoning` | Reasoning (深度思考) | A1 | N09 | 见 README.md |

## Manifest 模板

每个知识包写完后立即创建 `manifests/<prefix>.md`，格式参照 `manifests/LH26_03_flash_attention.md`，status 设为 `done (Step 4 complete)`。

## 执行顺序

按列表顺序，逐个闭环（读 transcript → 读 slides → 写 knowledge → 写 manifest）。

## 完成标准

- 6 个 `knowledge/<prefix>.md` 存在且 > 2000 字
- 6 个 `manifests/<prefix>.md` 存在
- 每个知识包至少 5 个 `[Fact]` 标记和 3 个直接引用
