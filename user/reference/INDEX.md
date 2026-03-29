# 参考资料总索引 — 知识源头地图

> **核心原则：** 所有文档的内容都必须有权威来源。AI 的工作是深加工（整合、翻译、举例、联系 Muse），不是自己编。
> **引用规范：** 文档中统一用 `[ref-XX]` 标注出处，读者可追溯到原始材料。

---

## 📚 分层架构

```
层级 1: 权威书籍 + 论文            ← 理论根基，不可动摇
层级 2: 大佬课程 + 技术博客         ← 讲透原理，图文并茂  
层级 3: 官方文档 + Cookbook         ← 工程落地，可直接跑
层级 4: 开源项目源码               ← 拆解学习，理解真实实现
```

---

## 一、📕 权威书籍

| ID | 书名 | 作者 | GitHub | 用于 |
|----|------|------|--------|------|
| **B1** | **Build a Large Language Model (From Scratch)** ⭐⭐⭐ | Sebastian Raschka | [rasbt/LLMs-from-scratch](https://github.com/rasbt/LLMs-from-scratch) | F1-F3, F11: 从零构建 LLM 的完整代码 |
| **B2** | **Neural Networks: Zero to Hero** (视频课) | Andrej Karpathy | [karpathy/nn-zero-to-hero](https://github.com/karpathy/nn-zero-to-hero) | F1-F2, F11: 神经网络到 GPT 的完整路径 |

### 📥 Clone 指令

```bash
cd user/reference/repos/
git clone https://github.com/rasbt/LLMs-from-scratch.git    # B1
git clone https://github.com/karpathy/nn-zero-to-hero.git    # B2
```

---

## 二、🎓 大佬课程 + 视频

| ID | 课程 | 作者 | URL | 用于 |
|----|------|------|-----|------|
| **C1** | Intro to LLMs (1h) | Karpathy | [YouTube](https://youtube.com/watch?v=zjkBMFhNj_g) | F1 全文基础 |
| **C2** | Let's build GPT from scratch (2h) | Karpathy | [YouTube](https://youtube.com/watch?v=kCc8FmEb1nY) | F2 Transformer 构建 |
| **C3** | State of GPT (45m) | Karpathy | [YouTube](https://youtube.com/watch?v=bZQun8Y4L2A) | F3 训练管线 |
| **C4** | Let's build the GPT Tokenizer (2h) | Karpathy | [YouTube](https://youtube.com/watch?v=zduSFxRajkE) | F11 Tokenization |
| **C5** | Neural Networks (系列) | 3Blue1Brown | [YouTube Playlist](https://youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi) | F1/F2 直觉理解 |
| **C6** | Prompt Engineering (短课) | Andrew Ng + OpenAI | [DeepLearning.AI](https://learn.deeplearning.ai/chatgpt-prompt-eng) | F6, unit04 Prompt 工程 |
| **C7** | LangChain for LLM Application Development | Harrison Chase + Andrew Ng | [DeepLearning.AI](https://learn.deeplearning.ai/langchain) | unit03 LangGraph |
| **C8** | Microsoft AI Agents for Beginners (12课) | Microsoft | [GitHub](https://github.com/microsoft/ai-agents-for-beginners) | unit01-02 OC 课程练习 |

---

## 三、📝 论文 (按重要性排)

| ID | 论文 | 年份 | 链接 | 用于 | 重要度 |
|----|------|------|------|------|--------|
| **P1** | **Attention Is All You Need** | 2017 | [arxiv 1706.03762](https://arxiv.org/abs/1706.03762) | F2 Transformer 架构 | ⭐⭐⭐ |
| **P2** | **Scaling Laws for Neural LMs** | 2020 | [arxiv 2001.08361](https://arxiv.org/abs/2001.08361) | F1 §1.5 发展拐点 | ⭐⭐ |
| **P3** | **Training Language Models to Follow Instructions (InstructGPT)** | 2022 | [arxiv 2203.02155](https://arxiv.org/abs/2203.02155) | F3 RLHF 训练 | ⭐⭐⭐ |
| **P4** | **Chain-of-Thought Prompting** | 2022 | [arxiv 2201.11903](https://arxiv.org/abs/2201.11903) | F1 §4 CoT | ⭐⭐ |
| **P5** | **DeepSeek R1 技术报告** | 2024 | [arxiv 2501.12948](https://arxiv.org/abs/2501.12948) | F1 §4 GRPO/思考机制 | ⭐⭐⭐ |
| **P6** | **ReAct: Synergizing Reasoning and Acting** | 2023 | [arxiv 2210.03629](https://arxiv.org/abs/2210.03629) | unit01 Agent 核心循环 | ⭐⭐⭐ |
| **P7** | **LoRA: Low-Rank Adaptation** | 2021 | [arxiv 2106.09685](https://arxiv.org/abs/2106.09685) | F9 微调 | ⭐⭐ |
| **P8** | **QLoRA: Efficient Finetuning** | 2023 | [arxiv 2305.14314](https://arxiv.org/abs/2305.14314) | F9 微调 + F10 部署 | ⭐⭐ |
| **P9** | **Retrieval-Augmented Generation (RAG)** Lewis et al. | 2020 | [arxiv 2005.11401](https://arxiv.org/abs/2005.11401) | F8 RAG 原理 | ⭐⭐ |
| **P10** | **FlashAttention** | 2022 | [arxiv 2205.14135](https://arxiv.org/abs/2205.14135) | F13 推理优化 | ⭐ |

---

## 四、🌐 技术博客 (按主题分)

### Transformer / 模型架构

| ID | 标题 | 作者 | URL | 用于 |
|----|------|------|-----|------|
| **W1** | **The Illustrated Transformer** ⭐⭐⭐ | Jay Alammar | [jalammar.github.io](https://jalammar.github.io/illustrated-transformer/) | F2 可视化理解 Attention |
| **W2** | The Illustrated GPT-2 | Jay Alammar | [jalammar.github.io](https://jalammar.github.io/illustrated-gpt2/) | F2 GPT 架构 |
| **W3** | Understanding LLMs (系列) | Sebastian Raschka | [magazine.sebastianraschka.com](https://magazine.sebastianraschka.com/) | F1-F3 全面参考 |

### Agent / 多 Agent

| ID | 标题 | 作者 | URL | 用于 |
|----|------|------|-----|------|
| **W4** | **LLM Powered Autonomous Agents** ⭐⭐⭐ | Lilian Weng | [lilianweng.github.io](https://lilianweng.github.io/posts/2023-06-23-agent/) | unit01 Agent 三要素 |
| **W5** | **Building Effective Agents** ⭐⭐⭐ | Anthropic | [anthropic.com](https://anthropic.com/research/building-effective-agents) | unit01 BEA 5种模式 |

### 训练 / 微调 / DeepSeek R1

| ID | 标题 | 作者 | URL | 用于 |
|----|------|------|-----|------|
| **W6** | **Mini-R1: Reproduce DeepSeek R1** ⭐⭐⭐ | Philipp Schmid | [philschmid.de/mini-r1](https://philschmid.de/mini-r1) | F1 §4 GRPO 实操复现 |
| **W7** | Open-R1: Fully Open Reproduction | HuggingFace | [huggingface.co/blog/open-r1](https://huggingface.co/blog/open-r1) | F1 §4 / F9 蒸馏 |
| **W8** | A Visual Guide to Quantization | Maarten Grootendorst | [newsletter.maartengrootendorst.com](https://newsletter.maartengrootendorst.com/p/a-visual-guide-to-quantization) | F10 量化可视化 |

### Prompt 工程

| ID | 标题 | 作者 | URL | 用于 |
|----|------|------|-----|------|
| **W9** | **Prompt Engineering Guide** ⭐⭐⭐ | DAIR.AI | [promptingguide.ai](https://www.promptingguide.ai/) | F6, unit04 |
| **W10** | Anthropic Prompt Library | Anthropic | [docs.anthropic.com](https://docs.anthropic.com/en/prompt-library) | unit04 OC oc26 |
| **W11** | OpenAI Prompt Engineering Guide | OpenAI | [platform.openai.com](https://platform.openai.com/docs/guides/prompt-engineering) | F6, unit04 |

---

## 五、🔧 GitHub 项目 (可 clone + 拆解)

### 底层工具 / 基础设施

| ID | 项目 | 用于 | Clone 命令 |
|----|------|------|-----------|
| **G1** | [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) | F2 从零构建 GPT | `git clone https://github.com/karpathy/nanoGPT.git` |
| **G2** | [karpathy/minbpe](https://github.com/karpathy/minbpe) | F11 BPE 分词器 | `git clone https://github.com/karpathy/minbpe.git` |
| **G3** | [karpathy/llm.c](https://github.com/karpathy/llm.c) | F2 C 语言实现 GPT-2 | `git clone https://github.com/karpathy/llm.c.git` |
| **G4** | [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) | F10 本地部署/量化 | `git clone https://github.com/ggml-org/llama.cpp.git` |

### Agent 框架 / 课程

| ID | 项目 | 用于 | Clone 命令 |
|----|------|------|-----------|
| **G5** | [anthropics/anthropic-cookbook](https://github.com/anthropics/anthropic-cookbook) | unit01-04 OC 课程练习 | `git clone https://github.com/anthropics/anthropic-cookbook.git` |
| **G6** | [openai/swarm](https://github.com/openai/swarm) | unit02 Handoff 拆解 | `git clone https://github.com/openai/swarm.git` |
| **G7** | [datawhalechina/hello-agents](https://github.com/datawhalechina/hello-agents) | unit01-04 OC 课程 | `git clone https://github.com/datawhalechina/hello-agents.git` |
| **G8** | [ysymyth/ReAct](https://github.com/ysymyth/ReAct) | unit01 ReAct 原始实现 | `git clone https://github.com/ysymyth/ReAct.git` |
| **G9** | [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners) | unit01-02 OC 课程 | `git clone https://github.com/microsoft/ai-agents-for-beginners.git` |

### 训练 / 复现

| ID | 项目 | 用于 | Clone 命令 |
|----|------|------|-----------|
| **G10** | [huggingface/open-r1](https://github.com/huggingface/open-r1) | F1 §4 GRPO 复现 | `git clone https://github.com/huggingface/open-r1.git` |
| **G11** | [FareedKhan-dev/train-deepseek-r1](https://github.com/FareedKhan-dev/train-deepseek-r1) | F1 §4 训练流程图 | `git clone https://github.com/FareedKhan-dev/train-deepseek-r1.git` |
| **G12** | [artidoro/qlora](https://github.com/artidoro/qlora) | F9 QLoRA 原始代码 | `git clone https://github.com/artidoro/qlora.git` |

### 拆解目标（OC 项目拆解）

| ID | 项目 | 用于 | Clone 命令 |
|----|------|------|-----------|
| **G13** | [paul-gauthier/aider](https://github.com/paul-gauthier/aider) | unit01 oc08 Git Agent 拆解 | `git clone https://github.com/paul-gauthier/aider.git` |
| **G14** | [cline/cline](https://github.com/cline/cline) | unit02 oc10 Plan&Act 拆解 | `git clone https://github.com/cline/cline.git` |
| **G15** | [continuedev/continue](https://github.com/continuedev/continue) | unit02 oc11 多模型 拆解 | `git clone https://github.com/continuedev/continue.git` |

### Prompt 工程

| ID | 项目 | 用于 | Clone 命令 |
|----|------|------|-----------|
| **G16** | [dair-ai/Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide) | F6, unit04 Prompt 大全 | `git clone https://github.com/dair-ai/Prompt-Engineering-Guide.git` |

---

## 六、📐 引用规范

### 文档中引用格式

```markdown
> **来源: [P5] DeepSeek R1 技术报告 §2.2**
> 原文: "We propose Group Relative Policy Optimization (GRPO)..."
> 解读: GRPO 的核心是让一组回答互相比较，不需要额外的 Critic 模型。
```

```markdown
> **来源: [W1] Jay Alammar, The Illustrated Transformer**
> [配图描述]
> 解读: Q/K/V 的直觉理解是...
```

### 来源类型标记

| 前缀 | 含义 |
|------|------|
| B | 书籍 (Book) |
| C | 课程 (Course) |
| P | 论文 (Paper) |
| W | 博客/网页 (Web) |
| G | GitHub 项目 (Git) |

---

## 七、📊 覆盖矩阵 — 每个文档的底子

| 文档 | 主题 | 书籍/课程底子 | 论文 | 博客 | 项目 |
|------|------|-------------|------|------|------|
| **F1** | LLM 入门 | C1 Karpathy Intro, B1 Raschka | P2 Scaling, P4 CoT, P5 R1 | W3 Raschka, W6 Mini-R1 | G10 open-r1 |
| **F2** | Transformer | C2 Build GPT, B1 Ch3-4 | P1 Attention | W1 Illustrated, W2 GPT-2 | G1 nanoGPT, G3 llm.c |
| **F3** | 训练管线 | C3 State of GPT, B1 Ch5-7 | P3 InstructGPT | W3 Raschka | — |
| **F6** | Prompt 工程 | C6 Andrew Ng | — | W9 DAIR.AI, W10 Anthropic, W11 OpenAI | G16 Prompt Guide |
| **F8** | RAG | B1 Ch-RAG | P9 RAG | — | — |
| **F9** | 微调 | B1 Ch6-7 | P7 LoRA, P8 QLoRA | W3 Raschka | G12 qlora |
| **F10** | 部署 | — | — | W8 量化可视化 | G4 llama.cpp |
| **F11** | Tokenization | C4 Karpathy Tokenizer | — | — | G2 minbpe |
| **F13** | 推理优化 | — | P10 FlashAttention | — | — |
| **unit01** | Agent Core | — | P6 ReAct | W4 Weng, W5 BEA | G5 Cookbook, G8 ReAct, G13 Aider |
| **unit02** | Multi-Agent | C8 MS Agents | — | W5 BEA | G6 Swarm, G7 Hello, G14 Cline |
| **unit03** | State/Memory | C7 LangChain | — | — | G7 Hello |
| **unit04** | Prompt Eng | C6 Andrew Ng | — | W9 DAIR.AI | G5 Cookbook, G16 Prompt Guide |

---

## 八、📥 一键 Clone 核心资源

```bash
mkdir -p user/reference/repos && cd user/reference/repos

# 书籍代码
git clone --depth 1 https://github.com/rasbt/LLMs-from-scratch.git       # B1
git clone --depth 1 https://github.com/karpathy/nn-zero-to-hero.git       # B2

# Karpathy 系列
git clone --depth 1 https://github.com/karpathy/nanoGPT.git                # G1
git clone --depth 1 https://github.com/karpathy/minbpe.git                 # G2

# Agent 课程
git clone --depth 1 https://github.com/anthropics/anthropic-cookbook.git    # G5
git clone --depth 1 https://github.com/openai/swarm.git                    # G6
git clone --depth 1 https://github.com/datawhalechina/hello-agents.git     # G7
git clone --depth 1 https://github.com/dair-ai/Prompt-Engineering-Guide.git # G16

# 训练复现
git clone --depth 1 https://github.com/huggingface/open-r1.git             # G10

echo "✅ 核心参考资源 clone 完成"
```

> **注意：** `--depth 1` 只拉最新一个 commit，节省空间和时间。
