# Sprint 1-2 研究产出索引 & 作战手册

> **定位：** Phase 0+1 研究执行增强。**不替代 RDD 总路线。**  
> **适用范围：** Sprint 1-2（研究期）。Sprint 3+ 主角转为 Spike/代码/验收。  
> **命名规则：** `DD-类型-主题.md`（DD=天数，类型=study/muse/teardown）  
> **主线不变：** 📖学习 → 🎯Muse小任务 → ✏️沉淀（见 README §七）

---

## 🚀 核心方法论：放大你的一分钟

> **你的每一分钟，必须产出 10 倍价值。**

### 方法

AI 做重活，你做高价值吸收：

| AI 做什么（低效动作消除） | 你做什么（高价值动作放大） |
|------------------------|------------------------|
| 读源码 → 逐行注释 → 提取精华 | 看精华笔记 → 理解 → 背诵记忆 |
| 读论文 → 摘要 + 核心图 + 数据表 | 看图 → 理解逻辑 → 能口述 |
| 跨项目对比 → 做对照表 | 看表 → 判断哪个设计更好 |
| 大佬动态 → 提取观点 + Muse 映射 | 看映射 → 思考怎么用到 Muse |
| 面试题库 → 标准答案 + Muse 实例 | 练回答 → 加自己的理解 |
| Muse 代码审计 → 列出问题 + 改进建议 | 读建议 → 动手改 → 验证效果 |

### 准则

1. **AI 把精华总结了，你来吸收。** 不是"你去看下 xxx"，而是 AI 读完 → 产出结构化笔记 → 你只需读笔记。
2. **每篇文档 = 第一性原理 + 大白话 + 剖析 + 示例 + 好的文档结构 + 逻辑完备。** 哪怕你是零基础，看完就能用。
3. **边做边回顾，边思考。** Muse 是你的实验 — 理论必须立即压回 Muse 设计/代码。
4. **保证质量。** 不交付烂东西。每个产出都必须是能在面试中用、能指导 Muse 开发的水平。
5. **OpenCode 是贯穿线。** 每天必须有 OpenCode 相关内容（机制学习 / 源码拆解 / 对 Muse 的启发）。

### 全局公式

```
理论精读 + 面试知识 + 行业动态 + 优秀项目拆解 + Muse 实验 + OpenCode 深挖 = 短时间成为 AI Agent 高手
```

---

## 一、Sprint 1-2 研究增强轨道（6 轨道）

> ⚠️ **只在 Sprint 1-2 使用。Sprint 3+ 不再维护 6 轨道，转为 Spike 驱动。**

| 轨道 | 代号 | 内容 | ~时长 | 产出方式 |
|------|------|------|------|---------|
| **a 精读** | study | 官方文档/论文/指南精读 | 60min | 独立文件 |
| **b 面试+对比** | interview | 面试题 + 跨厂商对比 | 30min | 独立文件 |
| **c 课程巩固** | course | 跟练开源课程对应章节 | 20min | 合入 a 或独立 |
| **d 项目拆解** | teardown | 特定模块源码精读 | 40min | 独立文件（有实质拆解时） |
| **e 大佬追踪** | leaders | 帖子/论文/动态回顾 | 15min | 合入 a 末尾 |
| **f Muse 实战** | muse | 把学到的东西压回 Muse | 30min | 独立文件 |

> c/e 轻量时合入 a 笔记，不单独开文件。总计 ~3.5h/天。

---

## 二、参考仓库（`make-muse/reference/`）

### 已有

| 仓库 | 路径 | 用途 |
|------|------|------|
| OpenCode | `reference/opencode/` | Muse 底座，**重点拆解** |
| oh-my-opencode | `reference/oh-my-opencode/` | OpenCode 插件生态 |
| learn-opencode | `reference/learn-opencode/` | OpenCode 学习资料 |
| OpenClaw | `reference/openclaw/` | Claw Agent 参考 |
| ZeroClaw | `reference/zeroclaw/` | ZeroClaw Agent 参考 |
| hermes-agent | `reference/hermes-agent/` | 多 Agent 架构参考 |

### 待 clone

| 仓库 | URL | 为什么需要 |
|------|-----|-----------|
| Anthropic Cookbook | `anthropics/anthropic-cookbook` | 官方 Agent 模式代码 |
| Hello-Agents | `datawhalechina/hello-agents` | 中文体系化 Agent 教程 (31k⭐) |
| HuggingFace Agents Course | `huggingface/agents-course` | 4 单元 Agent 课程 |
| OpenAI Swarm | `openai/swarm` | Handoff 源码拆解 |

> clone 命令：`cd make-muse/reference && git clone --depth 1 <URL>`

---

## 三、课程清单

| # | 课程 | 来源 | 仓库/链接 | 用于 Sprint |
|---|------|------|----------|------------|
| 1 | **Anthropic Courses** (API/Prompt/Tool Use) | Anthropic 官方 | `github.com/anthropics/courses` | S1 Day1-3 |
| 2 | **Anthropic Cookbook Agent Patterns** | Anthropic 官方 | `anthropic-cookbook/patterns/agents/` | S1 Day1-5 |
| 3 | **Hello-Agents 从零构建智能体** | Datawhale | `datawhalechina/hello-agents` | S1-S2 |
| 4 | **HuggingFace Agents Course** | HuggingFace | `huggingface/agents-course` | S1-S2 |
| 5 | **Microsoft AI Agents for Beginners** | Microsoft | `microsoft/ai-agents-for-beginners` | S1 Day3 |
| 6 | **DeepLearning.AI Agent Skills** | Andrew Ng + Anthropic | 在线 | S1 Day1 |

---

## 四、项目拆解清单（精选 8 个）

> 不贪多。每个项目拆 2-3 个核心模块。按 Sprint 分配。

| # | 项目 | 语言 | 拆什么模块 | Sprint |
|---|------|------|-----------|--------|
| 1 | **OpenAI Swarm** | Python | ① `run()` 循环 ② Handoff ③ Agent 类 | S1 Day4 |
| 2 | **Anthropic Cookbook** | Python | ① Agent Patterns ② Tool Use ③ Memory | S1 Day1-3 |
| 3 | **OpenCode** ⭐ | Go | ① Session Engine ② Hook 系统 ③ Plugin ④ Sisyphus | **S1-S3 重点** |
| 4 | **LangGraph** | Python | ① Graph 状态机 ② Checkpointer ③ HITL | S1 Day5 |
| 5 | **CrewAI** | Python | ① Agent Role ② Task ③ Process | S1 Day6 |
| 6 | **Vercel AI SDK** | TypeScript | ① streamText ② tool() ③ Provider | S2 |
| 7 | **Pydantic AI** | Python | ① Agent 类型安全 ② Result 验证 | S2 |
| 8 | **Claude Code** | TypeScript | ① ACI 工具设计（行为观察） ② Agentic Loop | S1-S2 |

---

## 五、大佬追踪清单

### 🌍 海外

| 人物 | 身份 | 代表贡献 | 平台 |
|------|------|---------|------|
| **Andrew Ng** 吴恩达 | DeepLearning.AI | 4 Agentic Patterns | Twitter/YouTube |
| **Andrej Karpathy** | 前 Tesla AI | LLM OS 概念 | Twitter/YouTube |
| **Lilian Weng** | OpenAI VP Research | 《LLM Powered Autonomous Agents》 | Blog (Lil'Log) |
| **Harrison Chase** | LangChain CEO | Agent 工具链先驱 | Twitter/Blog |
| **Erik Schluntz** | Anthropic | BEA 作者，ACI 实践 | Twitter |
| **Jason Wei** | Meta Superintelligence | Chain-of-Thought | Twitter |
| **Shunyu Yao 姚顺雨** | Princeton → OpenAI | **ReAct** + **Tree of Thoughts** | 论文/Twitter |
| **Noah Shinn** | Northeastern | **Reflexion** Agent 自我反思 | 论文 |
| **Ofir Press** | Princeton | **SWE-bench** Agent 编码评测 | Twitter |
| **Yohei Nakajima** | BabyAGI 作者 | Agent 热潮点火者 | Twitter |
| **Simon Willison** | Datasette 作者 | LLM 工具实践派 | Blog |
| **Dario Amodei** | Anthropic CEO | AI Safety + Agent 哲学 | Blog/访谈 |
| **Sam Altman** | OpenAI CEO | AGI 路径策略 | Twitter/访谈 |

### 🇨🇳 国内

| 人物 | 身份 | 代表贡献 | 平台 |
|------|------|---------|------|
| **姚顺雨** | Princeton → OpenAI | ReAct + ToT — Agent 推理行动范式 | 论文 |
| **吴泳铭** | 阿里 CEO | Token Hub — 企业级 Agent 战略 | 演讲 |
| **杨红霞** | 阿里通义实验室 | 通义千问 Agent 能力 | 论文 |
| **朱文武** | 字节 AI Lab | 多模态 Agent / 豆包 | 论文 |
| **林达华** | 上海 AI Lab (书生) | InternLM Agent 训练 | 论文/开源 |
| **刘知远** | 清华 NLP | BMTools / ChatGLM Agent | 论文/GitHub |
| **唐杰** | 清华/智谱 | CogAgent 视觉 Agent / Agent 综述 | 论文 |
| **魏忠钰** | 复旦 NLP | ToolBench 工具评测基准 | 论文/GitHub |
| **Datawhale 社区** | 开源教育 | Hello-Agents (31k⭐) | GitHub |

---

## 六、必读论文

| # | 论文 | 作者 | 年 | 为什么必读 | Sprint |
|---|------|------|---|-----------|--------|
| 1 | **ReAct: Synergizing Reasoning and Acting** | Yao et al. | 2022 | Agent 推理+行动范式开创 | S1 |
| 2 | **LLM Powered Autonomous Agents** | Lilian Weng | 2023 | Agent 系统最经典综述 | S1 |
| 3 | **Tree of Thoughts** | Yao et al. | 2023 | LLM 多路径推理 | S1 |
| 4 | **Reflexion** | Shinn et al. | 2023 | Agent 自我反思学习 | S1-S2 |
| 5 | **Toolformer / ToolBench** | Meta / 复旦 | 2023 | 工具使用训练和评测 | S2 |
| 6 | **Agent AI Survey** | Stanford+Microsoft | 2024 | 多模态 Agent 综述 | S2 |
| 7 | **Anthropic BEA** | Schluntz & Zhang | 2024 | 实战 Agent 工程指南 | **S1 Day1 ✅** |

---

## 七、Sprint 1 每日研究分配

> 这是 Sprint 1 的 c/d/e 轨道补充。a/b/f 仍按 `sprint-1.md` 的主线不变。

| Day | c 课程巩固 | d 项目拆解 | e 大佬 |
|-----|-----------|-----------|--------|
| 1 | Cookbook: basic-workflows | — | Yao: ReAct 论文速读 |
| 2 | Hello-Agents: Ch1 基础 | Cookbook: orchestrator 代码 | Lilian Weng 博客 |
| 3 | HF Course: Unit1 | — | Ng: 4 patterns 视频 |
| 4 | — (跑 Swarm demo) | **Swarm: run() + Handoff** | — |
| 5 | HF Course: Unit2 | **LangGraph: Graph + Checkpointer** | — |
| 6 | Hello-Agents: Ch3 多Agent | **CrewAI: Role + Task** | Harrison Chase 博客 |
| 7 | — | — | Karpathy: LLM OS 视频 |
| 8-9 | — | **OpenCode: Session Engine** | — |
| 10 | — | — | — |

---

## 八、Sprint 2 拆解重点预告

| 主题 | d 项目拆解 |
|------|-----------|
| Memory 深化 | **OpenCode: Hook 系统 + Plugin 架构** |
| Prompt 实战 | **Claude Code: ACI 行为观察** |
| 工具设计 | **Vercel AI SDK: tool() + Provider** |
| 类型安全 | **Pydantic AI: Agent + Result** |
| 协议设计 | **OpenCode: Sisyphus 协议** |

---

> **Sprint 3+ 不再维护 6 轨道。** 参考仓库和论文清单可继续使用，但每日节奏转为：  
> Spike → 实现 → 验证 → 复盘（见 sprint-3.md 到 sprint-8.md）
