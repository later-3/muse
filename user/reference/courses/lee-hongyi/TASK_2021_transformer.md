# 任务书：李宏毅 ML 2021 Spring — Self-Attention & Transformer 拉取

> **下发日期：** 2026-04-09
> **下发者：** Later (Planner)
> **执行者：** 任意 AI Agent
> **预估耗时：** Step 1-3 约 30-40 分钟（含转写）

---

## 一、任务目标

从李宏毅 **ML 2021 Spring** 课程中拉取 4 个视频（Self-Attention 上下 + Transformer 上下），完成 Step 1→3（音频下载 + 转写 + PDF 提取）。

**不做 Step 4（知识包合成）。**

### 为什么需要 2021 版

2025/2026 的课程里**没有从零推导 Self-Attention 和 Transformer 架构**。2021 版是李宏毅最经典的手推版本：
- Q/K/V 矩阵怎么来的
- Multi-Head Attention 怎么拼
- Encoder-Decoder + Cross-Attention
- Masked Self-Attention + Beam Search

这些内容直接补上我们 D02-D03（Transformer Day 1-2）最缺的底层推导。

---

## 二、环境检查（必须首先执行）

```bash
/usr/bin/python3 -c "from pytubefix import YouTube; import whisper; import fitz; print('✅ All deps OK')"
```

**失败 → 停止，报告问题。**

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

---

## 四、待处理条目（4 个视频 + 2 个 PDF）

| # | prefix | 标题 | YouTube URL | 时长 |
|---|--------|------|-------------|------|
| 1 | `LH21_self_attention_1` | Self-Attention (上) | https://www.youtube.com/watch?v=hYdO9CscNes | ~30min |
| 2 | `LH21_self_attention_2` | Self-Attention (下) | https://www.youtube.com/watch?v=gmsMY5kc-zw | ~30min |
| 3 | `LH21_transformer_1` | Transformer / Seq2Seq (上) | https://www.youtube.com/watch?v=n9TlOhRjYoc | ~30min |
| 4 | `LH21_transformer_2` | Transformer / Seq2Seq (下) | https://youtu.be/N6aRv06iv2g | ~30min |

对应的 PDF 课件：

| PDF URL | 对应条目 | slides_text 输出名 |
|---------|---------|-------------------|
| https://speech.ee.ntu.edu.tw/~hylee/ml/ml2021-course-data/self_v7.pdf | #1 + #2 共享 | `LH21_self_attention.txt` |
| https://speech.ee.ntu.edu.tw/~hylee/ml/ml2021-course-data/seq2seq_v9.pdf | #3 + #4 共享 | `LH21_transformer.txt` |

---

## 五、执行步骤

### Step 1: 下载音频（4 个）

```bash
# 逐个下载
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py \
  "https://www.youtube.com/watch?v=hYdO9CscNes" LH21_self_attention_1

/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py \
  "https://www.youtube.com/watch?v=gmsMY5kc-zw" LH21_self_attention_2

/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py \
  "https://www.youtube.com/watch?v=n9TlOhRjYoc" LH21_transformer_1

/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py \
  "https://youtu.be/N6aRv06iv2g" LH21_transformer_2
```

或者用批量 JSON：

```bash
cat > /tmp/lh21_download.json << 'EOF'
[
  {"url": "https://www.youtube.com/watch?v=hYdO9CscNes", "prefix": "LH21_self_attention_1"},
  {"url": "https://www.youtube.com/watch?v=gmsMY5kc-zw", "prefix": "LH21_self_attention_2"},
  {"url": "https://www.youtube.com/watch?v=n9TlOhRjYoc", "prefix": "LH21_transformer_1"},
  {"url": "https://youtu.be/N6aRv06iv2g", "prefix": "LH21_transformer_2"}
]
EOF
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py --batch /tmp/lh21_download.json
```

### Step 2: 转写（4 个）

```bash
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py \
  LH21_self_attention_1 LH21_self_attention_2 LH21_transformer_1 LH21_transformer_2
```

### Step 3: PDF 提取（2 个）

```bash
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py \
  --url "https://speech.ee.ntu.edu.tw/~hylee/ml/ml2021-course-data/self_v7.pdf" \
  --output slides_text/LH21_self_attention.txt

/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py \
  --url "https://speech.ee.ntu.edu.tw/~hylee/ml/ml2021-course-data/seq2seq_v9.pdf" \
  --output slides_text/LH21_transformer.txt
```

### Step 4: 创建 Manifest（4 个）

每个条目创建 `manifests/<prefix>.md`：

```markdown
# <prefix>

- status: done (Step 3 complete — pending knowledge)
- mode: A1
- source: [LH21] ML 2021 Spring — 李宏毅
- canonical_title: <标题>
- canonical_url: <YouTube URL>
- related_materials:
  - course_page: https://speech.ee.ntu.edu.tw/~hylee/ml/2021-spring.php
  - pdf_url: <对应的 PDF URL>
  - slides_text_note: 与 <另一个条目> 共享同一 PDF
- mapping:
  - n_nodes: [N02]
  - learn_record_days: [D02, D03]
- output_files:
  - raw_audio: user/reference/courses/lee-hongyi/raw_audio/<prefix>.mp4
  - transcript: user/reference/courses/lee-hongyi/transcripts/<prefix>_transcript.txt
  - segments: user/reference/courses/lee-hongyi/transcripts/<prefix>_segments.json
  - slides_text: user/reference/courses/lee-hongyi/slides_text/<对应的 slides_text 文件>
  - knowledge: (pending)
  - manifest: user/reference/courses/lee-hongyi/manifests/<prefix>.md
- qa_notes:
  - transcript_ready: true
  - segments_count: <实际数量>
  - audio_source: YouTube (pytubefix)
- updated_at: 2026-04-09
```

**注意 slides_text 的对应关系：**
- `LH21_self_attention_1` 和 `LH21_self_attention_2` → `slides_text/LH21_self_attention.txt`
- `LH21_transformer_1` 和 `LH21_transformer_2` → `slides_text/LH21_transformer.txt`

---

## 六、执行规则

1. **按顺序执行**：先全部下载 → 再全部转写 → 再处理 PDF → 最后写 manifest
2. **不要用 `python3`**，统一用 `/usr/bin/python3`
3. **遇到下载失败**：重试 1 次，仍失败 → manifest 标记 `blocked`
4. **不要做 Step 4 知识包合成**

---

## 七、完成标准

以下文件全部存在：

```
raw_audio/LH21_self_attention_1.mp4
raw_audio/LH21_self_attention_2.mp4
raw_audio/LH21_transformer_1.mp4
raw_audio/LH21_transformer_2.mp4
transcripts/LH21_self_attention_1_transcript.txt
transcripts/LH21_self_attention_1_segments.json
transcripts/LH21_self_attention_2_transcript.txt
transcripts/LH21_self_attention_2_segments.json
transcripts/LH21_transformer_1_transcript.txt
transcripts/LH21_transformer_1_segments.json
transcripts/LH21_transformer_2_transcript.txt
transcripts/LH21_transformer_2_segments.json
slides_text/LH21_self_attention.txt
slides_text/LH21_transformer.txt
manifests/LH21_self_attention_1.md
manifests/LH21_self_attention_2.md
manifests/LH21_transformer_1.md
manifests/LH21_transformer_2.md
```

### 验证命令

```bash
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/check_progress.py
```

---

## 八、进度报告

完成后汇报：

```
[LH21 拉取完成] 4/4
  ✅ LH21_self_attention_1 — XX segs, XX chars
  ✅ LH21_self_attention_2 — XX segs, XX chars
  ✅ LH21_transformer_1 — XX segs, XX chars
  ✅ LH21_transformer_2 — XX segs, XX chars
  PDF: self_v7.pdf (XX slides), seq2seq_v9.pdf (XX slides)
```
