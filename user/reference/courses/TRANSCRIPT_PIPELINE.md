# 课程视频处理与归档管线 — 执行任务书

> **用途：** 给执行型 AI 使用的任务书。目标不是直接写 `learn_record`，而是先把 `user/reference/courses/` 下的课程视频与相关资料处理完整、归档清楚、可复用。
> **经过验证：** 2026-04-08 已在 Later 的 M4 Pro + 24GB 机器上完成端到端测试。31 分钟视频，Whisper `medium` 转写耗时约 4.7 分钟。
> **当前阶段边界：** 本文只负责 `reference` 层的资料采集、转写、提炼、归档。
> **明确不做：** 现在**不**把课程内容直接写入 `user/learn_record/`。那是后续阶段，必须等前面的参考资料处理完再做。
> **执行方式：** 执行型 AI 默认**全自动执行当前阶段**。除非遇到权限、网络、登录墙或来源失效，否则**不得**停下来追问“全自动/半自动/只规划”。

---

## 一、最终目标

我们要达成 `4` 个结果：

1. `user/reference/courses/` 下的**现有课程来源全部有明确处理策略**
2. 每个课程条目都能落到**固定路径**，不再散落
3. 每个可处理视频都至少完成：`来源登记 + 原始资料 + 转写/课件文本 + 知识提炼 + manifest`
4. 后续 AI 在写每日学习记录时，可以**直接引用整理好的 reference 层资料**，而不是重新找视频、重新听、重新查

---

## 二、任务边界

### 2.1 当前任务做到哪里算完成

当前任务的完成标准是：

1. 课程条目已登记到本任务书
2. 每个条目都有明确处理模式
3. 每个条目的归档路径是确定的
4. 对可公开处理的视频，产物已落盘到 `user/reference/courses/<source>/...`
5. 每个条目都有 `manifest`
6. 每个条目都有状态：`pending / in_progress / done / blocked`

### 2.2 当前任务明确不做什么

1. 不直接改 `user/learn_record/*.md`
2. 不把“还没归档好的内容”提前写成每日计划
3. 不只留链接不留产物
4. 不把“看过视频”当成“完成处理”

---

## 三、处理模式

所有课程条目都必须落入下面 `4` 种模式之一：

| 模式 | 适用对象 | 必须产物 |
|------|---------|---------|
| `A1 完整视频管线` | 有公开视频 + 有相关 PDF/课件/讲义 | `raw_audio/raw_video + transcript + segments + slides_text + knowledge + manifest` |
| `A2 纯视频管线` | 只有视频，没有 PDF/讲义 | `raw_audio/raw_video + transcript + segments + knowledge + manifest` |
| `B1 文档资料管线` | 非视频资料，如博客/文档/只有 PDF | `source copy or URL + extracted text + knowledge + manifest` |
| `C1 元数据占位` | 暂时无法公开下载或访问受限，但必须纳入管理 | `manifest + 来源 URL + 阻塞原因 + 待补动作` |

### 3.1 选择原则

1. 公开视频且可下载：优先 `A1/A2`
2. 有 PDF/讲义：必须把 PDF 文本也纳入，不允许只做 transcript
3. 登录墙/课程平台受限：先 `C1`，等来源可访问后再升级
4. 非视频但属于课程参考来源：走 `B1`

---

## 四、统一目录规范

从现在开始，课程资料统一按下面的目录规范归档：

```text
user/reference/courses/<source>/
├── README.md                 ← 课程索引，列出全部条目
├── raw_video/                ← 原始视频文件（可选）
├── raw_audio/                ← 原始音频文件
├── raw_pdf/                  ← 下载的 PDF/讲义（可选）
├── slides_text/              ← 从 PDF/讲义提取出的纯文本
├── transcripts/              ← Whisper 转写结果
├── knowledge/                ← AI 提炼后的参考层知识包
└── manifests/                ← 每个条目的 manifest
```

### 4.1 文件命名规范

统一前缀：

```text
<source_code>_<lecture_id>_<slug>
```

示例：

```text
LH25F_07_llm_training
LH26_03_flash_attention
KAR_02_build_gpt
ANAG_course
BEA_article
```

### 4.2 每个条目的标准产物

以 `LH25F_07_llm_training` 为例：

```text
raw_audio/LH25F_07_llm_training.m4a
raw_video/LH25F_07_llm_training.mp4              # 可选
raw_pdf/LH25F_07_llm_training.pdf                # 可选
slides_text/LH25F_07_llm_training.txt            # 有 PDF 时必须有
transcripts/LH25F_07_llm_training_transcript.txt
transcripts/LH25F_07_llm_training_segments.json
knowledge/LH25F_07_llm_training.md
manifests/LH25F_07_llm_training.md
```

### 4.3 兼容当前已有结构

当前已存在的路径：

1. [lee-hongyi/slides_text](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/slides_text)
2. [lee-hongyi/transcripts](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/transcripts)

它们继续有效，但后续执行时必须补齐缺失的：

1. `knowledge/`
2. `manifests/`
3. `raw_audio/ raw_video/ raw_pdf/`（按实际需要）

### 4.4 当前机器环境说明

当前机器上存在 `2` 套 Python：

1. **Conda base Python**
   - 路径：`/Users/xulater/miniforge3/bin/python3`
   - 版本：`Python 3.12`
   - 现状：`PyMuPDF` 可用，但 `openai-whisper` 和 `pytubefix` **不可用**
2. **系统 Python**
   - 路径：`/usr/bin/python3`
   - 版本：`Python 3.9.6`
   - 现状：`whisper`、`pytubefix`、`fitz` **已验证可导入**

执行规则：

1. 本任务书中的下载、转写、PDF 提取，默认都使用 **系统 Python**：`/usr/bin/python3`
2. 不要默认使用当前 shell 里的 `python3`，因为它可能指向 Conda Python 3.12
3. 只有在明确验证 Conda 环境已补齐依赖后，才允许切换解释器
4. 若无特殊说明，所有 Python 命令都按 `/usr/bin/python3` 理解

---

## 五、执行者必须遵守的规则

> 其他 AI 在这个任务里是**执行者**，不是自由发挥的作者。

1. 先处理 `reference`，后处理 `learn_record`
2. 任何条目未归档完成前，不得宣称“资料已整理好”
3. 任何条目都必须有 `manifest`
4. 任何条目都必须更新状态
5. 不允许把模糊来源写成“某视频”“某课程”
6. 不允许只留 URL，不落本地产物
7. 不允许把课程内容直接塞进每日计划，除非 reference 层已经完整
8. 默认直接执行当前阶段，不再向用户确认“要不要我继续”
9. 遇到已有产物时先复用，不重复下载、不重复提取、不重复转写
10. 遇到阻塞时，先写 `manifest` 标记 `blocked`，再说明阻塞原因
11. **当前批次默认执行到 `Step 3` 即可视为阶段完成**；除非用户明确要求继续做 `knowledge`，否则不要自动进入 `Step 4`

### 5.1 禁止项

1. 禁止优先用 `yt-dlp` 下载 YouTube
2. 禁止用不确定的 CLI 组合参数做 Whisper 多格式导出
3. 禁止跳过 `manifest`
4. 禁止只做 transcript 不登记来源
5. 禁止把“建议”“可选方案”写进执行步骤

---

## 六、执行流程

> 统一口径：本任务书采用 `Step 0-6` 记法，**共 7 个阶段**。其中 `Step 6` 不是继续产出内容，而是明确停止边界，防止执行型 AI 越界去改 `learn_record`。

### Step 0：登记条目

先在本任务书对应清单里找到条目，然后**立即执行下面动作**：

1. `source`
2. `title`
3. `mode`
4. `archive prefix`
5. `status`

然后：

1. 在对应 source 目录下确认这 `7` 个目录存在：
   - `raw_video/`
   - `raw_audio/`
   - `raw_pdf/`
   - `slides_text/`
   - `transcripts/`
   - `knowledge/`
   - `manifests/`
2. 若目录不存在，先创建目录
3. 先创建 `manifests/<prefix>.md`，把状态写成 `in_progress`
4. 再继续后续步骤，不要空跑

执行命令：

```bash
mkdir -p \
  user/reference/courses/<source>/raw_video \
  user/reference/courses/<source>/raw_audio \
  user/reference/courses/<source>/raw_pdf \
  user/reference/courses/<source>/slides_text \
  user/reference/courses/<source>/transcripts \
  user/reference/courses/<source>/knowledge \
  user/reference/courses/<source>/manifests
```

### Step 0.1：检查环境

执行下面检查：

```bash
which yt-dlp
/usr/bin/python3 -c "import whisper; print('whisper ok')"
/usr/bin/python3 -c "import fitz; print('pymupdf ok')"
/usr/bin/python3 -c "from pytubefix import YouTube; print('pytubefix ok')"
```

执行规则：

1. 以上检查全部通过：继续
2. 某项缺失：把条目标记为 `blocked`，在 `manifest` 中写清缺失依赖
3. 不要在依赖缺失时继续假设“环境应该没问题”
4. 不要把 `python3` 检查通过误认为是“当前 shell 的 Conda Python 可用”

### Step 1：收集来源

每个条目必须收集：

1. canonical URL
2. 备选 URL（如 B 站镜像）
3. 相关资料 URL（PDF/讲义/课程页/代码仓库）

执行规则：

1. 如果 `slides_text/<prefix>.txt` 已存在，直接登记为“PDF 文本已就绪”，不要重复下载 PDF
2. 如果 `slides_text` 不存在，但有 PDF URL，进入 PDF 下载/提取流程
3. 如果视频 URL 缺失，先把条目标记为 `blocked`

### Step 2：下载或登记原始资料

按模式执行，不要自由替换工具：

1. `A1/A2`：下载音频或视频
2. `A1/B1`：下载 PDF 或提取文本
3. `C1`：写清楚为什么暂时不能处理

下载规则：

1. **有 B 站 URL 时**：必须先用 `yt-dlp` 下载 B 站音频
2. **只有 YouTube URL 时**：必须用 `pytubefix` 下载，不使用 `yt-dlp` 直拉 YouTube
3. **已有 `slides_text` 时**：跳过 PDF 下载
4. **有 PDF 但没有 `slides_text` 时**：先下载到 `raw_pdf/`，再提取到 `slides_text/`
5. 所有原始文件必须落到固定目录，不允许放到临时目录后不归档

输出要求：

1. 音频默认落到 `raw_audio/<prefix>.m4a` 或 `raw_audio/<prefix>.mp4`
2. PDF 落到 `raw_pdf/<prefix>.pdf`
3. 已有文件时直接复用，不重复下载

### Step 3：生成结构化中间产物

1. transcript 全文
2. segments 时间戳
3. slides_text
4. 术语纠错

执行规则：

1. Whisper 默认使用 `medium`
2. 中文视频必须指定 `language="zh"`
3. 必须使用 Python 脚本输出：
   - `transcripts/<prefix>_transcript.txt`
   - `transcripts/<prefix>_segments.json`
4. 不使用不确定的 CLI 组合参数，例如 `--output_format txt json`
5. 若 `transcript` 和 `segments` 已存在，先校验文件完整性；正常则复用
6. 术语纠错在 transcript 基础上进行，但不得覆盖原始 transcript 文件

### Step 4：生成 reference 层知识包

输出到：

```text
user/reference/courses/<source>/knowledge/<prefix>.md
```

这个文件是**参考层知识包**，不是每日计划。必须包含：

1. 来源信息
2. 核心知识点
3. 讲师自己的类比/例子
4. 和 repo / paper / 其他课程的对照
5. 明确的适用节点（N 节点 / F 节点）
6. 未解决问题或待补资料

### Step 5：写 manifest

输出到：

```text
user/reference/courses/<source>/manifests/<prefix>.md
```

`manifest` 最少包含：

```md
# <prefix>

- status:
- mode:
- source:
- canonical_title:
- canonical_url:
- alternate_urls:
- related_materials:
- mapping:
- output_files:
- qa_notes:
- blockers:
- updated_at:
```

写入规则：

1. `status` 只能使用：`pending / in_progress / done / blocked`
2. `output_files` 必须写绝对路径或仓库内相对路径
3. `qa_notes` 必须写明：
   - 是否复用了已有 `slides_text`
   - 是否完成 transcript
   - 是否存在术语识别错误
4. `blocked` 状态必须写清楚具体阻塞点，不能只写“待处理”

### Step 6：停止

做到这里就停止。**不要继续改 `learn_record`。**

---

## 七、知识包质量标准

`knowledge/<prefix>.md` 必须达到下面 `6` 条：

1. Later 不看原视频，也能知道这节课讲了什么
2. 不只是“摘要”，而是结构化提炼
3. 明确区分：讲师原话/事实/推断
4. 把 PDF 和 transcript 里的信息融合，而不是二选一
5. 能告诉后续 AI：这份资料适合支撑哪些 N 节点
6. 能直接作为 `learn_record` 的上游来源，但**当前阶段不下沉**

---

## 八、当前基线

截至目前，已经验证或已有的内容：

1. [lee-hongyi/slides_text](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/slides_text) 已有 `5` 份文本：
   - `BasicML.txt`
   - `LLM_GenAI_Intro.txt`
   - `LLMtraining.txt`
   - `LLMunderstand.txt`
   - `Pretrain_Alignment.txt`
2. [lee-hongyi/transcripts](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/transcripts) 目前只有 `1` 组测试产物：
   - `backprop_test.mp4`
   - `backprop_test_transcript.txt`
   - `backprop_test_segments.json`

这说明：**下载 + Whisper 转写已经验证可行，但真正的批量归档还没完成。**

---

## 九、现有课程总清单与处理要求

> 原则：`user/reference/courses/` 下的现有来源都必须在这里有明确处理方式。

### 9.1 总览

| 来源 | 根目录 | 条目数 | 默认模式 | 说明 |
|------|--------|-------|---------|------|
| 李宏毅 | [lee-hongyi](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi) | 33 | `A1/A2/B1` | 视频最多，优先级最高 |
| Karpathy | [karpathy](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/karpathy) | 6 | `A2` | 全部是公开视频 |
| 吴恩达 | [andrew-ng](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/andrew-ng) | 5 | `C1` | 先补课程页和可访问性，再决定是否转写 |
| Anthropic | [anthropic](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/anthropic) | 1 | `B1` | 非视频课程型资料，做文档归档 |

### 9.2 李宏毅 [LH26] — ML 2026 Spring

> 源索引见 [lee-hongyi/README.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/lee-hongyi/README.md)。

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `LH26_00_policy` | 课程规则说明 | `B1` | `manifest + knowledge(规则摘要)` | `pending` |
| `LH26_01_openclaw_agent` | 解剖小龙虾 / Agent 原理 | `A1` | `audio + transcript + pdf/slides_text + knowledge + manifest` | ✅ `Step 4 done` |
| `LH26_02_context_engineering` | Context Engineering | `A1` | 同上 | ✅ `Step 4 done` |
| `LH26_02b_agent_interaction` | AI Agent 之间的互动 | `A2` | `audio + transcript + knowledge + manifest` | ✅ `Step 4 done` |
| `LH26_02c_agent_work_impact` | AI Agent 对工作的冲击 | `A2` | 同上 | ✅ `Step 4 done` |
| `LH26_03_flash_attention` | Flash Attention | `A1` | `audio + transcript + pdf/slides_text + knowledge + manifest` | ✅ `Step 4 done` |
| `LH26_04_kv_cache` | KV Cache | `A1` | 同上 | ✅ `Step 4 done` |
| `LH26_05_positional_embedding` | Positional Embedding | `A1` | 同上 | ✅ `Step 4 done` |
| `LH26_06_harness_engineering` | Harness Engineering — 有時候語言模型不是不夠聰明，只是沒有人類好好引導 | `A1` | `audio + transcript + pdf/slides_text + knowledge + manifest` | ✅ `Step 4 done` |

### 9.3 李宏毅 [LH25] — ML 2025 Spring

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `LH25_00_intro` | 课程介绍 | `B1` | `manifest + knowledge(课程定位)` | `pending` |
| `LH25_01_ai_agent` | AI Agent 原理 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_02_model_inside` | Model Inside | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_03_mamba` | Mamba | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_04_pretrain_alignment` | Pretrain + Alignment | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_05_multi_gpu_training` | 多 GPU 训练大型模型 | `A2` | 视频转写 + 知识包 + manifest | ✅ `Step 4 done` |
| `LH25_06_post_training` | Post-training + Forgetting | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_07_reasoning` | Reasoning | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_08_reason_eval` | Reasoning 评估 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_09_reason_shorter` | Reasoning 缩短 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_10_model_editing` | Model Editing | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25_11_model_merging` | Model Merging | `B1` | `pdf/slides_text + knowledge + manifest` | ✅ `Step 4 done` |
| `LH25_12_speech_llm` | Speech LLM | `A1` | 完整处理 | ✅ `Step 4 done` |

### 9.4 李宏毅 [LH25F] — GenAI-ML 2025 Fall

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `LH25F_00_intro` | 课程简介 | `B1` | `manifest + knowledge(课程定位)` | `pending` |
| `LH25F_00_policy` | 课程规定 | `B1` | `manifest + knowledge(规则摘要)` | `pending` |
| `LH25F_01_genai_intro` | 一堂课搞懂生成式 AI | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_02_context_agent` | Context Engineering / Agent / Reasoning 组合课 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_03_llm_understand` | 解剖大型语言模型 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_04_evaluation` | 评估生成式 AI 的各种坑 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_05_basic_ml` | 机器学习与深度学习基本原理 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_06_training_tips` | 训练神经网络的各种诀窍 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_07_llm_training` | 大型语言模型的学习历程 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_08_lifelong_learning` | 通用模型的终身学习 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_09_generation` | 影像和声音上的生成策略 | `A1` | 完整处理 | ✅ `Step 4 done` |
| `LH25F_10_speech_llm` | 语音语言模型发展史 | `A1` | 完整处理 | `pending` |

### 9.5 Karpathy 视频系列

> 源索引见 [karpathy/README.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/karpathy/README.md)。

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `KAR_01_micrograd` | Micrograd | `A2` | `audio/video + transcript + knowledge + manifest` | `pending` |
| `KAR_02_build_gpt` | Let's Build GPT | `A2` | 同上 | `pending` |
| `KAR_03_state_of_gpt` | State of GPT | `A2` | 同上 | `pending` |
| `KAR_04_tokenizer` | Tokenizer | `A2` | 同上 | `pending` |
| `KAR_05_intro_llms` | Intro to LLMs | `A2` | 同上 | `pending` |
| `KAR_06_deep_dive_llms` | Deep Dive into LLMs | `A2` | 同上 | `pending` |

### 9.6 吴恩达课程

> 源索引见 [andrew-ng/README.md](/Users/xulater/Code/assistant-agent/muse/user/reference/courses/andrew-ng/README.md)。
> 当前先按 `C1` 管理，因为 README 里目前只有课程级索引，还没落到可公开下载的视频粒度，且访问方式还未统一确认。
> `C1` 不是永久状态，只是临时占位。后续一旦补齐可访问的视频 URL、课程页结构或下载方式，就应升级为 `A1/A2/B1` 中的对应模式继续处理。

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `ANAG_course` | AI Agentic Design Patterns with AutoGen | `C1` | `manifest + 课程页 URL + 模块清单 + 可访问性说明` | `pending` |
| `ANEV_course` | Evaluating AI Agents | `C1` | 同上 | `pending` |
| `ANMCP_course` | Build AI Apps with MCP Servers | `C1` | 同上 | `pending` |
| `ANMEM_course` | Agent Memory | `C1` | 同上 | `pending` |
| `ANVOI_course` | Building Live Voice Agents | `C1` | 同上 | `pending` |

### 9.7 Anthropic 资料型来源

| prefix | 条目 | mode | 必做输出 | 状态 |
|--------|------|------|---------|------|
| `BEA_article` | Building Effective Agents | `B1` | `article source + extracted text/summary + knowledge + manifest` | `pending` |

---

## 十、优先级

> `P0` 的定义不是“最重要的课程本身”，而是：**已经直接进入当前学习路线、最值得优先编译成 reference 资产、能立即服务后续 learn_record 的条目。**
> 换句话说，`P0` 优先级来自“当前学习路径的直接复用价值”，而不是单纯来自学术重要性或课程知名度。

按下面顺序执行：

1. `P0`：李宏毅已在学习路径里直接用到的条目
   - `LH25F_05_basic_ml`
   - `LH25F_01_genai_intro`
   - `LH25F_03_llm_understand`
   - `LH25_04_pretrain_alignment`
   - `LH25F_07_llm_training`
   - `LH26_03_flash_attention`
   - `LH26_04_kv_cache`
   - `LH26_05_positional_embedding`
2. `P1`：Karpathy `6` 个视频
3. `P2`：李宏毅其余专题
4. `P3`：吴恩达课程页细化与可访问性登记
5. `P4`：Anthropic / 非视频课程资料归档

P0 执行顺序固定为：

1. ✅ `LH25F_05_basic_ml` — Step 4 done (knowledge → D01 增量)
2. ✅ `LH25F_01_genai_intro` — Step 4 done (knowledge → D02 增量)
3. ✅ `LH25F_03_llm_understand` — Step 4 done (knowledge → D03/D04 增量)
4. ✅ `LH25_04_pretrain_alignment` — Step 4 done (knowledge → D05 增量)
5. ✅ `LH25F_07_llm_training` — Step 4 done (knowledge 归档，D06 待创建)
6. ✅ `LH26_03_flash_attention` — Step 4 done (knowledge 归档，D24 待创建)
7. ✅ `LH26_04_kv_cache` — Step 4 done (knowledge 归档，D25 待创建)
8. ✅ `LH26_05_positional_embedding` — Step 4 done (knowledge 归档，D26 待创建)

> **P0 全四步完成 (2026-04-09)。** 总计 8 个视频，~8.6h 音频，91.4 min 转写时间。
> 所有 audio + transcript + segments + slides_text + **knowledge** 已落盘。
> 5 个已有 daily record (D01-D05) 已增量更新，3 个未来 day (D24-D26) 的知识包已归档待用。
> 下一步：P1 Karpathy 视频系列处理。

---

## 十一、新增课程接入规则

后续新增任何课程时，必须先补下面 `5` 项，才能进入执行：

1. 在对应 source 的 `README.md` 加入条目
2. 在本任务书里补一行清单
3. 指定处理模式 `A1/A2/B1/C1`
4. 指定 archive prefix
5. 指定归档目录

如果这 `5` 项没补完，执行者不得擅自处理。


---

## 十二、必须使用的工具与规则

### 12.1 下载

1. `B站优先`：用 `yt-dlp`
2. `YouTube 备选`：用 `pytubefix`
3. **不要**把 `yt-dlp` 作为 YouTube 的默认下载方案

### 12.2 转写

1. Whisper `medium` 为默认
2. 中文课程指定 `language="zh"`
3. 输出固定为：
   - `*_transcript.txt`
   - `*_segments.json`
4. 转写阶段使用 Python 脚本，不使用不确定的 CLI 多格式参数拼接
5. 执行解释器固定为 `/usr/bin/python3`

### 12.3 PDF 文本提取

有 PDF 的条目必须补：

```text
slides_text/<prefix>.txt
```

---

## 十三、环境与工具链

> ⚠️ **这个部分是其他 AI 必须首先阅读的。** 环境不对，后面全白费。

### 13.1 Python 环境

| 项目 | 值 | 说明 |
|------|-----|------|
| **Python 解释器** | `/usr/bin/python3` | macOS 系统自带，版本 3.9.6 |
| **不能用** | `python3` / `conda python` | 可能指向没装依赖的虚拟环境 |

**验证命令（每次新 session 必跑）：**

```bash
/usr/bin/python3 --version
/usr/bin/python3 -c "from pytubefix import YouTube; print('✅ pytubefix')"
/usr/bin/python3 -c "import whisper; print('✅ whisper')"
/usr/bin/python3 -c "import fitz; print('✅ pymupdf')"
```

全部输出 ✅ 才能继续。任何一个失败 → 条目标记 `blocked`。

### 13.2 ffmpeg

Whisper 依赖 ffmpeg 读取音频。本机 ffmpeg 位于：

```
/Users/xulater/Code/assistant-agent/muse/data/ffmpeg
```

转写脚本会自动把这个路径加入 `PATH`。如果该文件不存在，也可以用 `brew install ffmpeg` 安装系统版。

### 13.3 已验证的脚本清单

所有脚本都在 `user/reference/courses/lee-hongyi/scripts/` 下：

| 脚本 | 用途 | 输入 | 输出 |
|------|------|------|------|
| `download_audio.py` | YouTube 音频下载 | URL + prefix | `raw_audio/<prefix>.mp4` |
| `transcribe_audio.py` | Whisper 转写 | prefix | `transcripts/<prefix>_transcript.txt` + `_segments.json` |
| `extract_pdf_text.py` | PDF 文本提取 | URL 或本地 PDF | `slides_text/<name>.txt` |

**脚本设计原则：**
- 全部**幂等**：已有有效产物会自动跳过
- 全部有用法提示（不传参即显示）
- 全部用**相对路径**定位目录（基于脚本所在位置）
- 全部可单个或批量处理

---

## 十四、端到端执行示例（给其他 AI 的标准操作）

> 以处理一个新视频为例，演示一个条目从头到尾怎么走。

### Step 0: 环境检查

```bash
# 必须通过，否则不要继续
/usr/bin/python3 -c "from pytubefix import YouTube; import whisper; import fitz; print('✅ All deps OK')"
```

### Step 1: 下载音频

```bash
# 单个视频
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py   "https://youtu.be/VIDEO_ID"   MY_PREFIX

# 批量（传 JSON 文件）
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/download_audio.py --batch tasks.json
```

**产物：** `raw_audio/MY_PREFIX.mp4`

### Step 2: 转写

```bash
# 单个
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py MY_PREFIX

# 多个（空格分隔）
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/transcribe_audio.py PREFIX_A PREFIX_B
```

**产物：** `transcripts/MY_PREFIX_transcript.txt` + `_segments.json`

**⏱️ 耗时参考（M4 Pro CPU）：** ~10:1 压缩比（2h 视频 ≈ 12min 转写）

### Step 3: PDF 课件提取（有 PDF 时）

```bash
# 从 URL 下载并提取
/usr/bin/python3 user/reference/courses/lee-hongyi/scripts/extract_pdf_text.py   --url "https://example.com/slides.pdf"   --output slides_text/MySlides.txt
```

**产物：** `slides_text/MySlides.txt`

### Step 4: 生成知识包（AI 手动执行，无脚本）

AI 阅读 transcript + slides_text，提炼知识。

**输入：** `transcripts/<prefix>_segments.json` + `slides_text/<name>.txt`

**输出：** `knowledge/<prefix>.md`

**知识包必须包含的 6 个模块：**

1. **词汇表** — 术语 + 定义 + 讲师的解释方式
2. **第一性原理** — 讲师从哪个起点推导？核心逻辑链？
3. **机制详解** — 技术细节、公式、计算过程
4. **设计动机** — 为什么这样设计？代价是什么？
5. **讲师独有的类比/例子** — 论文和教科书里没有的直觉（最有价值）
6. **Muse 映射** — 对应哪些 N 节点？能支撑哪些 learn_record Day？

### Step 5: 写 manifest + 更新状态

创建 `manifests/<prefix>.md`，更新本任务书 §9 清单中的状态。

---

## 十五、脚本适用范围

**当前脚本在 `lee-hongyi/scripts/` 下，但可跨课程复用。**

- **同一 source 下的新条目**（如新增李宏毅视频）：直接用，无需改脚本
- **不同 source**（如 Karpathy）：复制脚本到 `karpathy/scripts/` 下
- **英文视频**：`transcribe_audio.py` 默认 `language="zh"`，需改成 `"en"`

---

## 十六、已知踩坑记录

| # | 坑 | 表现 | 解法 |
|---|-----|------|------|
| 1 | `yt-dlp` 下载 YouTube 超时 | 连接挂起 | 用 `pytubefix` |
| 2 | `python3` 指向 conda | `ModuleNotFoundError` | 强制用 `/usr/bin/python3` |
| 3 | B站没有独立音频流 | 仍然下载视频 | `yt-dlp -f 30280` |
| 4 | ffmpeg 不在 PATH | Whisper 报错 | 脚本自动加 `muse/data/ffmpeg` |
| 5 | 多条目共享同一 PDF | 重复下载 | `slides_text` 可共享 |
| 6 | Whisper 繁简混用 | "語言" vs "语言" | 不影响理解 |
| 7 | pytubefix 版本变化 | API 可能变 | 验证版本 `10.3.8` |
| 8 | 扩展名不一致 | .m4a vs .mp4 | 脚本自动查找三种 |

---

## 十七、完成定义（Definition of Done）

任一课程条目，只有同时满足下面 `7` 条，才能标记 `done`：

1. 已有 `manifest`
2. 已有原始来源 URL
3. 已有本地归档产物
4. 若是视频，已有 transcript + segments
5. 若有 PDF/讲义，已有 slides_text
6. 已有 `knowledge/<prefix>.md`
7. 已在本任务书或 source README 中更新状态

只做到 "下载了视频" 或 "写了摘要" 都不算完成。

---

## 十八、后续阶段（暂不执行）

当且仅当上面的 reference 层处理完成后，后续才进入：

1. 从 `knowledge/` 中挑选高价值来源
2. 映射到 `N` 节点与 `Day`
3. 融入 `user/learn_record/`

**现在先不要做这一步。**
