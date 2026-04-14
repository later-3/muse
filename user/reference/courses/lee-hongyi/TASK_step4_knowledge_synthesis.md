# 任务书：李宏毅课程 Step 4 — 知识包合成 + Manifest + 每日计划融合

> **下发日期：** 2026-04-09
> **下发者：** Later (Planner)
> **执行者：** 任意 AI Agent
> **前置条件：** Step 1-3 已全部完成（20/20 闭环），verify_alignment.py 输出全绿

---

## 一、任务总览

共三个子任务，必须**按顺序执行**：

| 子任务 | 输入 | 输出 | 条目数 |
|--------|------|------|--------|
| **A. 知识包合成** | transcripts/ + slides_text/ | knowledge/*.md | 20 个 |
| **B. Manifest 创建** | knowledge/ + 已有产物 | manifests/*.md | 20 个 |
| **C. 每日计划融合** | knowledge/ | learn_record/*/README.md 增量更新 | 5 个 Day |

---

## 二、子任务 A — 知识包合成（最重的部分）

### A.1 输入文件

每个条目有 2-3 个输入：

```
transcripts/<prefix>_transcript.txt    — 口语全文
transcripts/<prefix>_segments.json     — 带时间戳分段
slides_text/<prefix>.txt               — PDF 课件提取文本（A2 模式无此文件）
```

### A.2 输出文件

```
knowledge/<prefix>.md
```

### A.3 知识包模板（严格遵循）

以下是已经验证过的格式，参考 `knowledge/LH26_03_flash_attention.md`：

```markdown
# <prefix> — <课程标题>

> **来源：** [LH25/LH25F/LH26] 李宏毅 <系列全名>
> **视频：** <YouTube URL>（~<时长>min）
> **课件：** slides_text/<对应文件>
> **N 节点映射：** <N节点> → <对应的 Day>
> **提炼时间：** 2026-04-09

---

## 核心教学内容提炼

### 1. <主题一的标题>

[Fact] 李宏毅用"<类比/例子>"来解释<概念>：

> "<直接引用讲师原话或近似原话>"

### 2. <主题二的标题>

（同上格式）

### 3. ...

---

## 关键引用

> "<最有价值的原话 1>"
> — 时间戳: segments.json 中对应位置

> "<最有价值的原话 2>"

---

## 词汇表

| 术语 | 定义 | 李宏毅的讲法 |
|------|------|-------------|
| <Term> | <标准定义> | <老师用的比喻或解释> |

---

## 设计动机与第一性原理

- 为什么需要 <这个技术>？解决什么问题？
- 代价是什么？trade-off 在哪里？
- 和其他方案的关系？

---

## Muse 映射

- **N 节点：** <N编号 + 名称>
- **对应 Day：** <day 编号 + 主题>（如果已有）
- **与已有知识包的关系：** <和哪些其他 knowledge 互补/递进>
```

### A.4 知识包质量要求

1. **必须用 `[Fact]` 标记**来源于讲师的核心观点（区别于你的总结）
2. **必须直接引用讲师原话**（从 transcript 中提取，不是你编的）
3. **重点提炼讲师独有的类比和例子** — 这是知识包最有价值的部分，教科书里没有
4. **不要复述教科书内容** — 只记录李宏毅的独特讲法和直觉
5. **每个知识包 2000-5000 字**，不要太短（走过场）也不要太长（堆砌）

### A.5 待处理的 20 个条目

| # | prefix | 标题 | mode | N 节点 |
|---|--------|------|------|--------|
| 1 | `LH26_01_openclaw_agent` | 解剖小龙虾 — AI Agent 原理 | A1 | N10 |
| 2 | `LH26_02_context_engineering` | Context Engineering | A1 | N11 |
| 3 | `LH25_01_ai_agent` | AI Agent 原理 (2025版) | A1 | N10 |
| 4 | `LH25F_02_context_agent` | CE + Agent + Reasoning 组合课 | A1 | N10+N11+N09 |
| 5 | `LH25_07_reasoning` | Reasoning (深度思考) | A1 | N09 |
| 6 | `LH25_08_reason_eval` | Reasoning 评估 | A1 | N12 |
| 7 | `LH25_09_reason_shorter` | Reasoning 缩短 | A1 | N09 |
| 8 | `LH25_06_post_training` | Post-training + Forgetting | A1 | N08 |
| 9 | `LH25_05_multi_gpu_training` | 多 GPU 训练大型模型 | A2 | N06 |
| 10 | `LH25F_06_training_tips` | 训练神经网络的各种诀窍 | A1 | N06 |
| 11 | `LH25_02_model_inside` | Model Inside | A1 | N02 |
| 12 | `LH25_03_mamba` | Mamba | A1 | N02 |
| 13 | `LH25_10_model_editing` | Model Editing | A1 | N08 |
| 14 | `LH25_11_model_merging` | Model Merging (仅 PDF) | B1 | N08 |
| 15 | `LH25F_04_evaluation` | 评估生成式 AI 的各种坑 | A1 | N12 |
| 16 | `LH25F_08_lifelong_learning` | 通用模型的终身学习 | A1 | N08 |
| 17 | `LH26_02b_agent_interaction` | AI Agent 之间的互动 | A2 | N10 |
| 18 | `LH26_02c_agent_work_impact` | AI Agent 对工作的冲击 | A2 | — |
| 19 | `LH25_12_speech_llm` | Speech LLM | A1 | — |
| 20 | `LH25F_09_generation` | 影像和声音上的生成策略 | A1 | — |

### A.6 执行顺序

按 N 节点与当前学习路线的关联度排序：

1. **最高优先（Agent 相关）：** #1, #2, #3, #4, #17
2. **高优先（Reasoning）：** #5, #6, #7
3. **中优先（训练 + 后训练）：** #8, #9, #10, #13, #14, #16
4. **中优先（Transformer 内部）：** #11, #12
5. **低优先（评估 + 其他）：** #15, #18, #19, #20

---

## 三、子任务 B — Manifest 创建

每个条目完成知识包后，**立即**创建对应的 manifest 文件。

### B.1 Manifest 模板

文件路径：`manifests/<prefix>.md`

```markdown
# <prefix>

- status: done (Step 4 complete — knowledge package ready)
- mode: <A1/A2/B1>
- source: [LH25/LH25F/LH26] <系列全名> — 李宏毅
- canonical_title: <课程标题>
- canonical_url: <YouTube URL>
- alternate_urls:
  - bilibili_url: TBD
- related_materials:
  - course_page: <课程网页 URL>
  - pdf_url: <PDF URL 或 无>
- mapping:
  - n_nodes: [<N 节点列表>]
  - learn_record_priority: P2
- output_files:
  - raw_audio: user/reference/courses/lee-hongyi/raw_audio/<prefix>.mp4
  - transcript: user/reference/courses/lee-hongyi/transcripts/<prefix>_transcript.txt
  - segments: user/reference/courses/lee-hongyi/transcripts/<prefix>_segments.json
  - slides_text: user/reference/courses/lee-hongyi/slides_text/<prefix>.txt
  - knowledge: user/reference/courses/lee-hongyi/knowledge/<prefix>.md
  - manifest: user/reference/courses/lee-hongyi/manifests/<prefix>.md
- qa_notes:
  - transcript_ready: true
  - segments_count: <从 segments.json 读取实际数量>
  - audio_source: YouTube (pytubefix)
- blockers:
  - none
- updated_at: 2026-04-09
```

### B.2 参考信息

课程网页 URL 对照表：

| 系列 | 课程网页 |
|------|---------|
| LH26 | https://speech.ee.ntu.edu.tw/~hylee/ml/2026-spring.php |
| LH25 | https://speech.ee.ntu.edu.tw/~hylee/ml/2025-spring.php |
| LH25F | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall.php |

YouTube URL 请从 `lee-hongyi/README.md` 中查找。

---

## 四、子任务 C — 每日计划融合

### C.1 当前 learn_record 结构

```
user/learn_record/
├── 0408-backpropagation/README.md     ← D01
├── 0409-transformer-1/README.md       ← D02
├── 0410-transformer-2/README.md       ← D03
├── 0411-transformer-3/README.md       ← D04
├── 0412-training-pipeline-1/README.md ← D05
```

### C.2 融合规则

1. **只做增量添加，不修改已有内容**
2. 在 README.md 的 `## 资源` 或末尾添加知识包链接
3. 只添加和该 Day 主题**直接相关**的知识包
4. 格式参考已有的融合方式（D01-D05 已经有李宏毅内容）

### C.3 Day → 知识包映射

| Day | 主题 | 已有李宏毅内容 | 新增知识包（本次） |
|-----|------|---------------|-----------------|
| **D01** 0408 | 反向传播 | LH25F_05 ✅ | — （无新增） |
| **D02** 0409 | Transformer 1 | LH25F_01 ✅ | `LH25_02_model_inside`（Transformer 内部机制） |
| **D03** 0410 | Transformer 2 | LH25F_03 ✅ | `LH25_03_mamba`（Transformer 竞争者，对比理解） |
| **D04** 0411 | Transformer 3 | LH25F_03 link ✅ | — （无新增） |
| **D05** 0412 | 训练管线 | LH25_04 + LH25F_07 ✅ | `LH25F_06_training_tips`（训练诀窍补充） |

### C.4 融合格式

在对应 Day 的 README.md 末尾添加：

```markdown
### 补充资源 — 李宏毅知识包

> 以下知识包提供了本 Day 主题的额外直觉和讲师独有讲解。

- [LH25_02_model_inside — Model Inside](../../reference/courses/lee-hongyi/knowledge/LH25_02_model_inside.md)
  - 核心价值：<一句话说明这个知识包对本 Day 的价值>
```

### C.5 未来 Day 的知识包预映射（不要现在做，仅做记录）

以下映射写入 manifest 即可，等 Day 创建后再融合：

| 未来 Day | 主题 | 对应知识包 |
|----------|------|----------|
| D06+ Agent | Agent 核心 | LH26_01, LH25_01, LH25F_02, LH26_02b |
| D?? Context Engineering | Context 工程 | LH26_02, LH25F_02 |
| D?? Reasoning | Reasoning | LH25_07, LH25_09, LH25F_02 |
| D?? 推理优化 | Flash Attention + KV Cache | LH26_03 ✅, LH26_04 ✅ |
| D?? 后训练 | Post-training | LH25_06, LH25_10, LH25_11, LH25F_08 |
| D?? 评估 | Evaluation | LH25_08, LH25F_04 |

---

## 五、执行规则

1. **每个条目闭环再做下一个**：读 transcript → 读 slides_text → 写 knowledge → 写 manifest → 下一个
2. **知识包质量 > 速度**：宁可只做 10 个做得好，不要 20 个走过场
3. **B1 模式**（#14 Model Merging）只有 PDF 没有 transcript，知识包从 slides_text 提炼
4. **A2 模式**（#9, #17, #18）没有 PDF，知识包纯从 transcript 提炼
5. **不要编造内容** — 所有 `[Fact]` 标记的内容必须能在 transcript 中找到出处
6. **子任务 C 只做 D02, D03, D05 三个 Day 的增量更新**，其他 Day 暂不创建

---

## 六、进度报告格式

每完成 5 个条目，用以下格式汇报：

```
[知识包进度] 5/20
  ✅ LH26_01_openclaw_agent — 3200 字, 8 个 [Fact], 5 个引用
  ✅ LH26_02_context_engineering — 2800 字, 6 个 [Fact], 4 个引用
  ✅ LH25_01_ai_agent — 4100 字, 10 个 [Fact], 7 个引用
  ✅ LH25F_02_context_agent — 3500 字, 9 个 [Fact], 6 个引用
  ✅ LH26_02b_agent_interaction — 2200 字, 5 个 [Fact], 3 个引用
```

---

## 七、完成标准

全部完成的定义：

- [ ] 20 个 `knowledge/<prefix>.md` 文件存在且内容 > 2000 字
- [ ] 20 个 `manifests/<prefix>.md` 文件存在且 status = done
- [ ] D02, D03, D05 的 README.md 已增量更新
- [ ] `TRANSCRIPT_PIPELINE.md` §9 中 20 个条目状态更新为 `done`
- [ ] 运行 `verify_alignment.py` 全绿

---

## 八、验证命令

完成后执行：

```bash
# 检查产物完整性
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/verify_alignment.py

# 检查知识包字数
wc -c user/reference/courses/lee-hongyi/knowledge/*.md | sort -n

# 检查 manifest 数量
ls user/reference/courses/lee-hongyi/manifests/ | wc -l
# 预期: 28 (8 已有 + 20 新增)
```
