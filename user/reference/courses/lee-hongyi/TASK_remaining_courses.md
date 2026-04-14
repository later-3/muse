# 任务书：李宏毅剩余课程资料采集

> **下发日期：** 2026-04-09
> **下发者：** Later (Planner)
> **执行者：** 任意 AI Agent
> **预估耗时：** Step 1-3 约 3-4 小时（含转写等待）
> **前置文档：** 必须先读 [TRANSCRIPT_PIPELINE.md](./TRANSCRIPT_PIPELINE.md) 的 §13-§16

---

## 一、任务目标

把李宏毅老师**尚未处理的课程**（共 20 个条目）完成 Step 1→3（音频下载 + 转写 + PDF 提取）。

**不做 Step 4（知识包合成）。** Step 4 需要 Later 确认后再由专门的 AI 执行。

---

## 二、环境检查（必须首先执行）

```bash
# 在 muse/ 目录下执行
/usr/bin/python3 --version
# 预期输出: Python 3.9.6

/usr/bin/python3 -c "from pytubefix import YouTube; import whisper; import fitz; print('✅ All deps OK')"
# 预期输出: ✅ All deps OK
```

**如果任何检查失败 → 停止，报告环境问题，不要猜测或跳过。**

---

## 三、工具位置

```
脚本目录:  user/reference/courses/lee-hongyi/scripts/
输出目录:  user/reference/courses/lee-hongyi/
  ├── raw_audio/      ← 音频
  ├── transcripts/    ← 转写文本 + 分段 JSON
  ├── slides_text/    ← PDF 提取的文本
  ├── raw_pdf/        ← 原始 PDF
  └── manifests/      ← 状态文件
```

脚本用法（不传参可看帮助）：
```bash
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py
```

---

## 四、待处理条目（共 20 个，按优先级排列）

### 批次 A — Agent + Context 相关（最高优先）

这些和当前学习路线（Agent 工程）直接相关，优先处理。

| # | prefix | 标题 | YouTube URL | PDF URL | mode |
|---|--------|------|-------------|---------|------|
| 1 | `LH26_01_openclaw_agent` | 解剖小龙虾 — AI Agent 原理 | https://youtu.be/2rcJdFuNbZQ | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/intro.pdf | A1 |
| 2 | `LH26_02_context_engineering` | Context Engineering | https://youtu.be/urwDLyNa9FU | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/agent_era.pdf | A1 |
| 3 | `LH25_01_ai_agent` | AI Agent 原理 (2025版) | https://youtu.be/M2Yg1kwPpts | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/ai_agent.pdf | A1 |
| 4 | `LH25F_02_context_agent` | CE + Agent + Reasoning 组合课 | https://youtu.be/lVdajtNpaGI | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall-course-data/Agent.pdf | A1 |

### 批次 B — Reasoning 专题

| # | prefix | 标题 | YouTube URL | PDF URL | mode |
|---|--------|------|-------------|---------|------|
| 5 | `LH25_07_reasoning` | Reasoning (深度思考) | https://youtu.be/bJFtcwLSNxI | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/reasoning.pdf | A1 |
| 6 | `LH25_08_reason_eval` | Reasoning 评估 | https://youtu.be/s266BzGNKKc | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/reason_eval.pdf | A1 |
| 7 | `LH25_09_reason_shorter` | Reasoning 缩短 | https://youtu.be/ip3XnTpcxoA | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/reason_shorter.pdf | A1 |

### 批次 C — 训练 + 后训练

| # | prefix | 标题 | YouTube URL | PDF URL | mode |
|---|--------|------|-------------|---------|------|
| 8 | `LH25_06_post_training` | Post-training + Forgetting | https://youtu.be/Z6b5-77EfGk | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/post_training.pdf | A1 |
| 9 | `LH25_05_multi_gpu_training` | 多 GPU 训练大型模型 | https://youtu.be/mpuRca2UZtI | — | A2 |
| 10 | `LH25F_06_training_tips` | 训练神经网络的各种诀窍 | https://youtu.be/mPWvAN4hzzY | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall-course-data/TrainingTip.pdf | A1 |

### 批次 D — 模型架构 + 内部机制

| # | prefix | 标题 | YouTube URL | PDF URL | mode |
|---|--------|------|-------------|---------|------|
| 11 | `LH25_02_model_inside` | Model Inside | https://youtu.be/Xnil63UDW2o | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/model_inside.pdf | A1 |
| 12 | `LH25_03_mamba` | Mamba | https://youtu.be/gjsdVi90yQo | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/mamba.pdf | A1 |
| 13 | `LH25_10_model_editing` | Model Editing | https://youtu.be/9HPsz7F0mJg | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/edit.pdf | A1 |
| 14 | `LH25_11_model_merging` | Model Merging (仅 PDF) | — | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/merging.pdf | B1 |

### 批次 E — 评估 + 终身学习 + 其他

| # | prefix | 标题 | YouTube URL | PDF URL | mode |
|---|--------|------|-------------|---------|------|
| 15 | `LH25F_04_evaluation` | 评估生成式 AI 的各种坑 | https://youtu.be/dWQVY_h0YXU | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall-course-data/Evaluation.pdf | A1 |
| 16 | `LH25F_08_lifelong_learning` | 通用模型的终身学习 | https://youtu.be/EnWz5XuOnIQ | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall-course-data/Post.pdf | A1 |
| 17 | `LH26_02b_agent_interaction` | AI Agent 之间的互动 | https://youtu.be/mmPmNezjCi0 | — | A2 |
| 18 | `LH26_02c_agent_work_impact` | AI Agent 对工作的冲击 | https://youtu.be/VqB8zMujdjM | — | A2 |
| 19 | `LH25_12_speech_llm` | Speech LLM | https://youtu.be/gkAyqoQkOSk | https://speech.ee.ntu.edu.tw/~hylee/ml/ml2025-course-data/speech.pdf | A1 |
| 20 | `LH25F_09_generation` | 影像和声音上的生成策略 | https://youtu.be/ccqCDD9LqCA | https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall-course-data/Generation.pdf | A1 |

> **不在列表中的条目**（LH25_00_intro, LH25F_00_intro, LH25F_00_policy, LH26_00_policy, LH25F_10_speech_llm）为课程说明类，优先级最低，本次不处理。

---

## 五、每个条目的标准执行流程

对**每一个条目**，严格按以下顺序执行：

### 5.1 A1 模式（有视频 + 有 PDF）— 条目 1-8,10-13,15-16,19-20

```bash
# Step 1: 下载音频
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py \
  "<YouTube_URL>" \
  <prefix>

# Step 2: 转写（中文，Whisper medium）
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py <prefix>

# Step 3: 下载 PDF 并提取文本
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py \
  --url "<PDF_URL>" \
  --output slides_text/<prefix>.txt
```

### 5.2 A2 模式（有视频，无 PDF）— 条目 9,17,18

```bash
# Step 1: 下载音频（同上）
# Step 2: 转写（同上）
# Step 3: 跳过 PDF
```

### 5.3 B1 模式（仅 PDF，无视频）— 条目 14

```bash
# Step 1: 跳过音频
# Step 2: 跳过转写
# Step 3: 只提取 PDF
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py \
  --url "<PDF_URL>" \
  --output slides_text/<prefix>.txt
```

### 5.4 每个条目完成后

创建 manifest 文件 `manifests/<prefix>.md`：

```markdown
# <prefix>

- status: done (Step 3 complete — pending knowledge)
- mode: <A1/A2/B1>
- source: [LH25/LH25F/LH26] 李宏毅
- canonical_title: <标题>
- canonical_url: <YouTube URL>
- alternate_urls:
  - bilibili_url: TBD
- related_materials:
  - pdf_url: <PDF URL 或 无>
  - course_page: <课程网页>
- mapping:
  - n_nodes: [<N 节点>]
  - learn_record_priority: P2
- output_files:
  - raw_audio: user/reference/courses/lee-hongyi/raw_audio/<prefix>.mp4
  - transcript: user/reference/courses/lee-hongyi/transcripts/<prefix>_transcript.txt
  - segments: user/reference/courses/lee-hongyi/transcripts/<prefix>_segments.json
  - slides_text: user/reference/courses/lee-hongyi/slides_text/<prefix>.txt
  - knowledge: (pending)
  - manifest: user/reference/courses/lee-hongyi/manifests/<prefix>.md
- qa_notes:
  - transcript_ready: true
  - segments_count: <实际数量>
  - audio_source: YouTube (pytubefix)
- blockers:
  - none
- updated_at: <执行日期>
```

---

## 六、执行规则

1. **按批次顺序执行**：A → B → C → D → E
2. **每个条目必须闭环再做下一个**：下载 → 转写 → PDF → manifest → 下一个
3. **幂等**：所有脚本已有产物会自动跳过，重跑不会重复下载
4. **遇到错误**：
   - YouTube 下载失败 → 重试 1 次，仍失败 → manifest 标记 `blocked`，继续下一个
   - 转写失败 → 检查音频文件是否有效（>1MB），无效则标记 `blocked`
   - PDF 下载失败 → 标记 `blocked`，转写不受影响
5. **不要做的事**：
   - ❌ 不要生成 knowledge 知识包
   - ❌ 不要修改 learn_record
   - ❌ 不要用 `python3` 代替 `/usr/bin/python3`
   - ❌ 不要用 yt-dlp 下载 YouTube

---

## 七、进度报告格式

每完成一个批次，用以下格式汇报：

```
[批次 A 完成] 4/4
  ✅ LH26_01_openclaw_agent — 2148 segs, 26K chars
  ✅ LH26_02_context_engineering — 1523 segs, 18K chars
  ✅ LH25_01_ai_agent — 3001 segs, 35K chars
  ✅ LH25F_02_context_agent — 2715 segs, 31K chars
```

---

## 八、完成标准

当所有 20 个条目的以下文件都存在时，任务完成：

- `raw_audio/<prefix>.mp4`（A1/A2 模式）
- `transcripts/<prefix>_transcript.txt`（A1/A2 模式）
- `transcripts/<prefix>_segments.json`（A1/A2 模式）
- `slides_text/<prefix>.txt`（A1/B1 模式，有 PDF 时）
- `manifests/<prefix>.md`（所有模式）

最后更新 [TRANSCRIPT_PIPELINE.md](./TRANSCRIPT_PIPELINE.md) §9 中的清单状态。

---

## 九、批量操作快捷方式（可选）

如果你更喜欢批量处理而非逐个执行：

### 9.1 批量下载所有音频

创建 JSON 任务文件后一次性下载：

```bash
cat > /tmp/lee_hongyi_batch.json << 'JSONEOF'
[
  {"url": "https://youtu.be/2rcJdFuNbZQ", "prefix": "LH26_01_openclaw_agent"},
  {"url": "https://youtu.be/urwDLyNa9FU", "prefix": "LH26_02_context_engineering"},
  {"url": "https://youtu.be/M2Yg1kwPpts", "prefix": "LH25_01_ai_agent"},
  {"url": "https://youtu.be/lVdajtNpaGI", "prefix": "LH25F_02_context_agent"},
  {"url": "https://youtu.be/bJFtcwLSNxI", "prefix": "LH25_07_reasoning"},
  {"url": "https://youtu.be/s266BzGNKKc", "prefix": "LH25_08_reason_eval"},
  {"url": "https://youtu.be/ip3XnTpcxoA", "prefix": "LH25_09_reason_shorter"},
  {"url": "https://youtu.be/Z6b5-77EfGk", "prefix": "LH25_06_post_training"},
  {"url": "https://youtu.be/mpuRca2UZtI", "prefix": "LH25_05_multi_gpu_training"},
  {"url": "https://youtu.be/mPWvAN4hzzY", "prefix": "LH25F_06_training_tips"},
  {"url": "https://youtu.be/Xnil63UDW2o", "prefix": "LH25_02_model_inside"},
  {"url": "https://youtu.be/gjsdVi90yQo", "prefix": "LH25_03_mamba"},
  {"url": "https://youtu.be/9HPsz7F0mJg", "prefix": "LH25_10_model_editing"},
  {"url": "https://youtu.be/dWQVY_h0YXU", "prefix": "LH25F_04_evaluation"},
  {"url": "https://youtu.be/EnWz5XuOnIQ", "prefix": "LH25F_08_lifelong_learning"},
  {"url": "https://youtu.be/mmPmNezjCi0", "prefix": "LH26_02b_agent_interaction"},
  {"url": "https://youtu.be/VqB8zMujdjM", "prefix": "LH26_02c_agent_work_impact"},
  {"url": "https://youtu.be/gkAyqoQkOSk", "prefix": "LH25_12_speech_llm"},
  {"url": "https://youtu.be/ccqCDD9LqCA", "prefix": "LH25F_09_generation"}
]
JSONEOF

/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py --batch /tmp/lee_hongyi_batch.json
```

### 9.2 批量转写

```bash
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py \
  LH26_01_openclaw_agent LH26_02_context_engineering LH25_01_ai_agent LH25F_02_context_agent
```

> ⚠️ 转写是 CPU 密集型。批次 A 的 4 个视频约需 40-60 分钟。可以先跑一批，利用等待时间处理 PDF。
