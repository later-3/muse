# 每日学习记录规范 — AI Agent 工程师修炼

> **用途：** 这是 `learn_record/` 目录的规范文档。**任何 AI 助手**读完本文后，都能为 Later 创建每日学习任务、检查作业、追踪进度。
> **用法：** 新开的 AI 会话中，让 AI 读取本文件，AI 即可继续执行计划。

---

## 一、Later 是谁 & 在做什么

- **身份：** 大模型小白，正在系统学习成为 Agent 开发工程师
- **时间：** 每天 2h+（1h 理论 + 1h+ 实践）
- **目标：** 6 周后能面试大厂 Agent 岗 + 做出 4 个 Agent 产品
- **4 个项目：** Muse 社交 Agent（已有代码） / 钢琴教学 Agent / 专注助手 Agent / 笔记 Agent
- **核心原则：** AI 做重活（读源码/论文/出精华），Later 吸收精华 + 在项目中验证
- **协作准则详见：** `user/README.md`

---

## 一A、README.md 核心准则（AI 必须遵循）

> 以下来自 `user/README.md`，是所有 AI 协作的最高约束。

### 7 条准则

1. **AI 精华总结，Later 来吸收** — 不甩链接说"你自己去看"。`[AI✓]` 状态才算交付
2. **四层深度** — 每篇文档必须覆盖：是什么 / 怎么做到的 / 为什么 / 例子
3. **理论立即压回 Muse/OpenCode** — 学了理论 → 找到对应代码(文件+行号) → 能改的立即改
4. **面试能用、开发能指导** — 每篇文档过 governance 检查清单
5. **USOLB 实践模型** — 每个 OC 任务标注 `[U][S][O][L][B]`
   - U(使用): 启动 OC/Muse，发消息，观察行为
   - S(源码): 读源码，标注理论对应的文件+行号
   - O(观察): 写 plugin/hook 拦截事件，打印中间状态
   - L(日志): 用 trace-reader / muse 日志观察全链路
   - B(编译): 改代码，跑起来看行为变化
6. **AI 先踩坑** — AI 踩坑 = 在 OpenCode/Muse 真实系统上实验，不造无关 demo
7. **依据参考资源做决策** — 每个知识点标注 `[ref-XX]`，能追溯到课程/论文/项目

### AI 怎么帮 Later

| AI 做什么（重活） | Later 做什么（高价值） |
|------------------|---------------------|
| 读源码 → 提取精华 | 看精华 → 理解 → 能复述 |
| 读论文 → 摘要 + 图表 | 看图 → 理解逻辑 → 能口述 |
| 搭框架 → 注释 + 走读指南 | 走读 → 改参数验证 → 面试能讲 |
| 实验 + 消险 → 代码 + 报告 | 看报告 → 知道坑在哪 |

---

## 一B、learn_record vs unit — 不要做重复的事

> **核心原则：已有的内容不重建，引导 Later 去现有位置。**

### 两套系统的分工

```
learn_record/             unit01-04/
(每日调度中心)             (实践内容仓库)
─────────────             ──────────
每日理论精华               study/ 理论研读文档
视频笔记                   oc-tasks/ 实操任务代码
Muse 映射                  README.md 通关清单
自检 + 面试题
```

- **learn_record = 每天的调度中心（理论为主）** — 精华笔记、学习笔记、自检、面试题
- **unit = 实践产出的存放地（已有大量内容）** — study/ 读它补充它，oc-tasks/ 跑它检查它

### 已有内容清单（AI 不要重复创建）

**unit01-agent-core/study/** — 5 篇，大部分已完成:
- `01a-study-anthropic-bea.md` — BEA 5种编排 ✅
- `01b-study-anthropic-bea-projects.md` — BEA 项目 ✅
- `01c-course-cookbook-workflows.md` — Cookbook 工作流 ✅
- `01e-leaders-react-weng.md` — ReAct + Weng ✅
- `01-muse-aci-audit.md` — Muse ACI 审计 ✅

**unit02-prompt-eng/study/** — 2 篇:
- `04a-prompt-architecture.md` — 七层 Prompt ✅ 有内容
- `04b-system-prompt-design.md` — System Prompt 🟡 占位

**unit03-multi-agent/study/** — 3 篇:
- `02a-orchestrator-workers.md` — Orchestrator-Workers ✅
- `02b-swarm-handoff.md` — Swarm Handoff ✅
- `02c-agent-evaluation.md` — 评估 🟡 占位

**unit04-state-memory/study/** — 2 篇:
- `03a-memory-and-vectors.md` — 记忆向量 🟡 占位
- `03b-state-machines.md` — 状态机 ✅

**unit01 oc-tasks/** — oc01-07, oc10-11 已有 `.md` + `.mjs` 文件 ✅
**unit02-04 oc-tasks/** — 目录结构已建，文件待创建

### AI 的操作规则

| 情况 | 怎么做 |
|------|--------|
| OC 文件已存在 | 引导 Later 去读，learn_record README 写 "📂 去看 → {路径}" |
| OC 文件不存在 | 在 unit 目录下创建（不是 learn_record），README 引用路径 |
| study 文档已有相关内容 | 引导 Later 去读，learn_record 做增量笔记 |
| 理论完全是新的 | learn_record 创建精华笔记 + 更新 foundations/F*.md |
| 更新 F 文档 | 在 foundations/ 下更新，不在 learn_record 重写 |

> **一句话：learn_record 是调度中心和笔记本，不是内容仓库。内容在 unit/ 和 foundations/ 里。**

---

## 二、42 天总计划（AI 必须知道的上下文）

> 以下是完整的 6 周 × 7 天计划。创建每日任务时，按此表找到对应 Day。

| Day | 日期 | Week | N节点 | 理论来源 | OC任务 | F文档 |
|-----|------|------|-------|---------|--------|------|
| D01 | 4/8 | W1 | N01 反向传播 | Karpathy [Micrograd](https://youtu.be/VMj-3S1tku0) + [LH25F] [Backprop](https://youtu.be/ibJpTrp5mcE) | — | F5 |
| D02 | 4/9 | W1 | N02 Transformer 1/3 | Karpathy [Build GPT](https://youtu.be/kCc8FmEb1nY) 前40min + [LH25F] [GenAI概览](https://youtu.be/TigfpYPJk1s) | — | F2 开始 |
| D03 | 4/10 | W1 | N02 Transformer 2/3 | Build GPT 40-80min + [LH25F] [解剖LLM](https://youtu.be/8iFvM7WUUs8) + [LH25] [Model Inside](https://youtu.be/Xnil63UDW2o) | oc01 启动Muse看日志 | F2 续写 |
| D04 | 4/11 | W1 | N02 Transformer 3/3 | Build GPT 后段 + [LH25F] [解剖LLM](https://youtu.be/8iFvM7WUUs8) + [LH25] [Mamba](https://youtu.be/gjsdVi90yQo) | oc02 trace-reader | F2 完成 |
| D05 | 4/12 | W1 | N06 训练管线 1/2 | Karpathy [State of GPT](https://youtu.be/bZQun8Y4L2A) 前30min + [LH25] [Pretrain](https://youtu.be/Ozos6M1JtIE) | 跑通最简Agent | F3 开始 |
| D06 | 4/13 | W1 | N06 训练管线 2/2 | State of GPT 后半 + [LH25F] [LLM学习历程](https://youtu.be/YJoegm7kiUM) + [LH25F] [RL概述](https://youtu.be/XWukX-ayIrs) | 完善Agent | F3 完成 |
| D07 | 4/14 | W1 | 复习 | — | 面试卡片5道 | — |
| D08 | 4/15 | W2 | N03 Tokenization | Karpathy [Tokenizer](https://youtu.be/zduSFxRajkE) | 实测token差异 | F11 开始 |
| D09 | 4/16 | W2 | N03 续 | Tokenizer + minbpe走读 | oc03 hook观察 | F11 完成 |
| D10 | 4/17 | W2 | N10 Agent 1/3 | 吴恩达 Agentic AI M1 + BEA + [LH25] [AI Agent](https://youtu.be/M2Yg1kwPpts) | oc04 走读OC Session | — |
| D11 | 4/18 | W2 | N10 Agent 2/3 | 吴恩达M2 + Weng Blog | oc05 走读Muse调用链 | — |
| D12 | 4/19 | W2 | N10 Agent 3/3 | 吴恩达M3 Tool Use + BEA | oc06 ACI审计 | — |
| D13 | 4/20 | W2 | N09 Reasoning 1/2 | [LH25] [Reasoning](https://youtu.be/bJFtcwLSNxI) + CoT论文 | oc07 Prompt注入链 | — |
| D14 | 4/21 | W2 | 复习 | — | 面试卡片5道 + 流程图 | — |
| D15 | 4/22 | W3 | N09 Reasoning 2/2 | [LH25] [Reason Eval](https://youtu.be/s266BzGNKKc) + [Reason Shorter](https://youtu.be/ip3XnTpcxoA) + open-r1 | oc10 三Loop对比 | — |
| D16 | 4/23 | W3 | N11 Context 1/3 | [LH26] [Context Engineering](https://youtu.be/urwDLyNa9FU) + [LH25F] [CE讲](https://youtu.be/lVdajtNpaGI) | oc12 参数实验 | — |
| D17 | 4/24 | W3 | N11 Context 2/3 | 吴恩达 MCP短课 | oc13 Prompt注入观察 | — |
| D18 | 4/25 | W3 | N11 Context 3/3 | 吴恩达 Memory短课 | oc14 Prompt组装链 | — |
| D19 | 4/26 | W3 | N11 RAG | hello-agents RAG章 | 笔记Agent RAG设计 | F8 完成 |
| D20 | 4/27 | W3 | N10 Prompt实践 | study 04a 七层Prompt | oc15 System Prompt对比 | — |
| D21 | 4/28 | W3 | 复习 | — | 面试卡片5道 | — |
| D22 | 4/29 | W4 | N10 多Agent | 吴恩达M5 + swarm + [LH26] [Agent互动](https://youtu.be/mmPmNezjCi0) | oc18 触发Harness | — |
| D23 | 4/30 | W4 | N10 多Agent续 | [LH26] [解剖小龙虾/OpenClaw](https://youtu.be/2rcJdFuNbZQ) | oc19 Swarm demo | — |
| D24 | 5/1 | W4 | N05 推理优化 1/2 | [LH26] [Flash Attention](https://youtu.be/vXb2QYOUzl4) | oc20 Harness走读 | F13 开始 |
| D25 | 5/2 | W4 | N05 推理优化 2/2 | [LH26] [KV Cache](https://youtu.be/fDQaadKysSA) | oc21 Swarm core.py | F13 完成 |
| D26 | 5/3 | W4 | N04 位置编码 | [LH26] [Positional Embedding](https://youtu.be/Ll-wk8x3G_g) | 钢琴Agent原型 | — |
| D27 | 5/4 | W4 | N12 评估 1/2 | 吴恩达 Eval Agents | oc22 Harness审计 | F12 开始 |
| D28 | 5/5 | W4 | 复习 | — | 面试卡片5道 | — |
| D29 | 5/6 | W5 | N12 评估 2/2 | [LH25F] [评估的坑](https://youtu.be/dWQVY_h0YXU) | oc23 评估框架 | F12 完成 |
| D30 | 5/7 | W5 | N07+N08 | Karpathy [Intro LLMs](https://youtu.be/zjkBMFhNj_g) + [LH25F] [终身学习](https://youtu.be/EnWz5XuOnIQ) + [LH25] [Post-training](https://youtu.be/Z6b5-77EfGk) | 专注助手原型 | — |

> **来源索引：** 所有课程视频 + PDF 课件的完整索引见 `user/reference/courses/`（[李宏毅](../reference/courses/lee-hongyi/README.md) · [Karpathy](../reference/courses/karpathy/README.md) · [吴恩达](../reference/courses/andrew-ng/README.md)）
| D31 | 5/8 | W5 | — | — | oc08 新MCP工具 | — |
| D32 | 5/9 | W5 | — | — | oc09 ACI修复 | — |
| D33 | 5/10 | W5 | — | — | oc16 Persona优化 | — |
| D34 | 5/11 | W5 | — | — | oc26+oc27 Memory观察 | — |
| D35 | 5/12 | W5 | 复习 | — | 面试卡片5道 | — |
| D36 | 5/13 | W6 | — | — | oc28+oc29 Memory走读 | — |
| D37 | 5/14 | W6 | — | — | oc30 Memory审计 + oc24 Handoff | — |
| D38 | 5/15 | W6 | — | — | oc31 Memory改进 | — |
| D39 | 5/16 | W6 | N02+N06 | 高频题 | oc11 面试故事 | — |
| D40 | 5/17 | W6 | N10+N11 | 高频题 | oc17+oc25 面试故事 | — |
| D41 | 5/18 | W6 | N09+N12 | 高频题 | oc32 面试故事+STAR | — |
| D42 | 5/19 | W6 | 全景复盘 | AI模拟面试 | 毕业检查 | — |

---

## 三、12 个理论节点的深度要求

> AI 创建每日任务时，必须对照此表决定深度和内容量

| N节点 | 深度 | 时间 | 看什么 | 学完要能做什么 |
|-------|------|------|--------|-------------|
| N01 反向传播 | 🟩概念 | 2h | Karpathy Micrograd 精华 | 大白话讲清反向传播、梯度、链式法则 |
| N02 Transformer | 🟥精通 | 8h | Karpathy Build GPT + 李宏毅解剖LLM | 画出完整架构图、讲清QKV/多头注意力/残差 |
| N03 Tokenization | 🟨理解 | 3h | Karpathy Tokenizer | 讲清BPE、Token≠Word、中文为什么贵 |
| N04 位置编码 | 🟩概念 | 1.5h | 李宏毅 PE | 知道RoPE、知道PE影响长上下文 |
| N05 推理优化 | 🟨理解 | 3h | 李宏毅 Flash Attn + KV Cache | 讲清KV Cache缓存什么、Flash Attention快在哪 |
| N06 训练管线 | 🟥精通 | 6h | Karpathy State of GPT + 李宏毅 | 画出Pretrain→SFT→RLHF全流程，每步解决什么 |
| N07 缩放定律 | 🟩概念 | 1h | State of GPT内含 | 知道Scaling Laws概念 |
| N08 后训练 | 🟩概念 | 1.5h | 李宏毅终身学习 | 知道灾难性遗忘和Model Editing |
| N09 Reasoning | 🟥精通 | 5h | 李宏毅Reasoning系列 | 讲清CoT为什么有效、GRPO怎么激发推理 |
| N10 Agent核心 | 🟥精通 | 10h+ | 吴恩达Agentic AI + BEA + Weng | 讲清Agent循环 + 5种编排模式 |
| N11 Context工程 | 🟥精通 | 8h+ | 李宏毅CE + 吴恩达MCP/Memory短课 | 讲清Compaction/RAG/MCP各解决什么 |
| N12 评估方法论 | 🟨理解 | 3h | 吴恩达Eval + 李宏毅评估的坑 | 知道评估方法、LLM-as-Judge |

---

## 四、资源链接索引

> AI 创建每日任务时，从这里取链接

### Karpathy
- Micrograd: https://www.youtube.com/watch?v=VMj-3S1tku0
- Build GPT: https://www.youtube.com/watch?v=kCc8FmEb1nY
- Tokenizer: https://www.youtube.com/watch?v=zduSFxRajkE
- State of GPT: https://www.youtube.com/watch?v=bZQun8Y4L2A
- Intro to LLMs: https://www.youtube.com/watch?v=zjkBMFhNj_g

### 李宏毅
- LH25F 课程主页: https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall.php
- LH26 课程主页: https://speech.ee.ntu.edu.tw/~hylee/ml/2026-spring.php
- 解剖LLM: https://youtu.be/8iFvM7WUUs8
- Pretrain详解: https://youtu.be/lMIN1iKYNmA
- Reasoning: https://youtu.be/bJFtcwLSNxI
- Agent原理: https://youtu.be/M2Yg1kwPpts
- Context Engineering: https://youtu.be/urwDLyNa9FU
- OpenClaw: https://youtu.be/2rcJdFuNbZQ
- Flash Attention: https://youtu.be/vXb2QYOUzl4
- KV Cache: https://youtu.be/fDQaadKysSA
- Positional Embedding: https://youtu.be/Ll-wk8x3G_g
- 评估的坑: https://youtu.be/dWQVY_h0YXU
- 终身学习: https://youtu.be/EnWz5XuOnIQ

### 吴恩达
- Agentic AI: https://www.deeplearning.ai/courses/agentic-ai/
- MCP短课: https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/
- Memory短课: https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/
- Eval短课: https://www.deeplearning.ai/short-courses/evaluating-ai-agents/

### 博客+论文
- Weng Agent: https://lilianweng.github.io/posts/2023-06-23-agent/
- Anthropic BEA: https://www.anthropic.com/research/building-effective-agents
- Attention Is All You Need: https://arxiv.org/abs/1706.03762
- Chain-of-Thought: https://arxiv.org/abs/2201.11903
- ReAct: https://arxiv.org/abs/2210.03629

---

## 五、OC 任务文件路径索引

> 所有路径相对于 `user/`

| OC | 路径 |
|----|------|
| oc01 | unit01-agent-core/oc-tasks/L1-observe/oc01-muse-first-run.md |
| oc02 | unit01-agent-core/oc-tasks/L1-observe/oc02-trace-analysis.md |
| oc03 | unit01-agent-core/oc-tasks/L1-observe/oc03-loop-observer.mjs |
| oc04 | unit01-agent-core/oc-tasks/L2-understand/oc04-session-walkthrough.md |
| oc05 | unit01-agent-core/oc-tasks/L2-understand/oc05-muse-callchain.md |
| oc06 | unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md |
| oc07 | unit01-agent-core/oc-tasks/L3-analyze/oc07-prompt-chain.md |
| oc08 | projects/muse-milestones/unit01/ |
| oc09 | projects/muse-milestones/unit01/ |
| oc10 | unit01-agent-core/oc-tasks/L5-synthesize/oc10-loop-comparison.md |
| oc11 | unit01-agent-core/oc-tasks/L5-synthesize/oc11-interview-stories.md |
| oc12-13 | unit02-prompt-eng/oc-tasks/L1-observe/ |
| oc14 | unit02-prompt-eng/oc-tasks/L2-understand/ |
| oc15 | unit02-prompt-eng/oc-tasks/L3-analyze/ |
| oc16 | projects/muse-milestones/unit02/ |
| oc17 | unit02-prompt-eng/oc-tasks/L5-synthesize/ |
| oc18 | unit03-multi-agent/oc-tasks/L1-observe/ |
| oc19 | reference/repos/swarm/ |
| oc20 | unit03-multi-agent/oc-tasks/L2-understand/ |
| oc21 | reference/repos/swarm/swarm/core.py |
| oc22-23 | unit03-multi-agent/oc-tasks/L3-analyze/ |
| oc24 | projects/muse-milestones/unit03/ |
| oc25 | unit03-multi-agent/oc-tasks/L5-synthesize/ |
| oc26-27 | unit04-state-memory/oc-tasks/L1-observe/ |
| oc28-29 | unit04-state-memory/oc-tasks/L2-understand/ |
| oc30 | unit04-state-memory/oc-tasks/L3-analyze/ |
| oc31 | projects/muse-milestones/unit04/ |
| oc32 | unit04-state-memory/oc-tasks/L5-synthesize/ |

---

## 六、每日目录命名规范

```
learn_record/
├── CONVENTION.md          ← 你正在看的（本文件）
├── 0408-backpropagation/  ← MMDD-英文主题（小写连字符）
│   ├── README.md          ← 每日学习计划+自检+笔记
│   └── *.md / *.mjs       ← AI精华笔记/实验代码/产出
├── 0409-transformer-1/
├── 0410-transformer-2/
└── ...
```

**命名规则：**
- 目录名 = `MMDD-主题关键词`（英文小写，用连字符）
- 每个目录必须有 `README.md`
- 其他文件按需创建（精华笔记、实验代码等）

---

## 七、README.md 模板（AI 必须按此格式创建）

> 以下是每日 README 的精确模板。AI 创建时替换 `{变量}` 部分。

```markdown
# {Day编号} — {N节点编号} {主题中文名}

> **日期：** {YYYY-MM-DD}（{星期}）
> **路线图位置：** Week {N} · Day {N} · {N节点}
> **定位：** {🟩概念 / 🟨理解 / 🟥精通}（{时间}）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. {核心问题1 — 是什么}
2. {核心问题2 — 怎么工作}
3. {核心问题3 — 为什么重要/和Agent的关系}

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（这是核心） | 40min | [ ] |
| 2 | 看视频关键段落（加深印象，可选） | 15min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |
| 4 | {OC任务/画图/实验 — 如有} | 1h | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 {来源} 中提炼的核心知识。
> 基于事实总结，第一性原理讲透，你读完这一节就掌握了今天的理论。
> 如有 unit/study 已有文档，会标注 📖 引导你去看，不重复。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| {术语1} | {一句话解释} | {今天先这样理解} | {暂时跳过什么} |
| {术语2} | {一句话解释} | {今天先这样理解} | {暂时跳过什么} |

### 🌍 背景：为什么要学这个？

{这个知识点的历史背景、它在大模型技术栈中的位置、前置知识回顾。
让 Later 理解"我为什么要学这个"和"学之前需要知道什么"。
如果和前一天有关联，明确衔接。}

### 🧑‍🔬 关键人物与事件

{谁做了什么、什么时候、为什么重要。按时间线列出。}

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| {年份} | {人名} | {事件} | {影响} |

### 第一性原理：{主题} 到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。
> 第一性原理 = 从最底层的基础概念开始，一层一层往上搭建，直到完全理解这个主题。
> Later 读完这一节，面试官追问到底层也能答出来。

**Layer 0 — 最底层前置概念**
{这个主题依赖的最基本的概念，用 1-2 句话解释清楚}

**Layer 1 — 核心问题**
{这个技术要解决的根本问题是什么？没有它之前人们怎么做？}

**Layer 2 — 核心思路**
{它的本质思路/洞察是什么？}

**Layer 3 — 完整定义**
{现在你有了所有前置知识，给出完整的、精确的定义}

### 怎么做到的？— 机制详解

{分步骤/分层次讲清楚原理。用编号列表、代码片段、简单公式辅助。}

### 为什么需要它？— 设计动机

{它解决了什么问题？没有它会怎样？历史上为什么这样设计？}

### 举例 + 发散

{用具体数字、代码、类比把抽象概念变具体。}
{至少 1 个 Later 能手算或逐步跟下来的数值例子。}

> **类比（仅类比）：** {直觉类比，必须标注"仅类比"}

### 📜 原文对照（关键论文/博客引用）

> 引用该知识点相关的经典论文或博客原文，和 AI 的通俗解读对比呈现。

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "{论文/博客的原始英文或中文句子}" — {来源} | {用 Later 能秒懂的方式重新表达} |

### 🎤 面试追问链

> 模拟面试官的追问路径。Later 读完知识精华后，这些追问都应该能答出来。

```
Q1: {表面问题}
→ 你答: {要点}
  Q1.1: {面试官追问}
  → 你答: {要点}
    Q1.1.1: {再追问}
    → 你答: {要点}
```

### 这几个概念不要混

- **{概念A} ≠ {概念B}**：{差异}
- **{概念C} ≠ {概念D}**：{差异}

### 关键概念清单

- [ ] **{概念1}**：{一句话解释}
- [ ] **{概念2}**：{一句话解释}
- [ ] **{概念3}**：{一句话解释}
（概念级 3-5 个 / 理解级 5-8 个 / 精通级 8-12 个）

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| {主要视频} | {URL} | {具体看哪段，如 1:30:00-2:00:00} |
| {补充资源} | {URL} | {可选} |

> 📖 如果有 unit/study 已有文档：**先读 → {study 路径}**

---

## 🧠 与 Muse/项目 的映射

> 今天学的 {主题}，在 Agent 开发中体现在哪里？

- **本地代码实际做的事：** {文件路径 + 行号 + 真实行为}
- **远端模型/外部系统做的事：** {哪些行为发生在仓库之外}
- **为什么 Agent 开发者需要知道这个：** {工程意义}
- **和明天内容的关系：** {衔接点}

---

## ✅ 自检清单

- [ ] {自检项1 — 能用大白话解释核心概念}
- [ ] {自检项2 — 能回答一个具体问题}
- [ ] {自检项3 — 能说出和Agent/Muse的关系}
- [ ] {自检项4 — 面试能讲（🟥精通级 额外增加2-3项）}

### 面试题积累（{当天积累N题}）

**Q: {面试题}**
> 你的回答：___

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
```

---

## 八、AI 创建任务时的规则

### 新增：学习文档质量硬规则

1. **关键结论分级标注**
   - 关键结论至少按以下之一标注：`[Fact]` `[Infer]` `[Analogy]`
   - `[Fact]` = 可由课程/论文/源码直接核对的事实
   - `[Infer]` = 基于事实的合理推断
   - `[Analogy]` = 帮助理解的类比，不能当严格定义
2. **禁止无条件绝对化表述**
   - 禁止直接写：`本质就是` `完全就是` `只需要` `不需要再看别的` `O(1)` `内部就在做`
   - 如确需使用，必须加条件、范围和来源
   - 推荐改写：`在本节范围内可先这样理解` `更准确地说`
3. **代码映射必须真实可验证**
   - “与 Muse/项目 的映射”必须分成两类：
   - `A. 本地代码实际做了什么（文件 + 行号）`
   - `B. 远端模型/外部系统做了什么`
   - 严禁把 API 调用层写成模型内部实现层
4. **每篇文档必须有 5 分钟预备词汇表**
   - 至少 4 个术语
   - 每个术语必须包含：`一句话解释 / 今天先怎么理解 / 暂时不用深究什么`
5. **每篇文档至少 1 个完整数值例子**
   - 不能只有公式
   - Later 必须能手算或逐步跟下来
6. **每篇文档必须有“这几个概念不要混”**
   - 至少 2 组容易混淆的概念
   - 明确写出差异，主动帮 Later 排雷
7. **元数据必须校验**
   - 文档头部的日期、星期、Day 编号、路线图位置，交付前必须核对一次
   - 未校验不得标记 `[AI✓]`
8. **关键知识点必须可追溯**
   - 每个关键知识点至少带 1 个 `[ref-XX]` 或原文对照
   - 文末需说明：哪些是事实、哪些是推断、哪些只是类比
9. **优先使用 user/reference 作为本地事实依据**
   - 如果 `user/reference/` 下已有相关论文、课程、实现仓库，优先引用它们
   - 最佳做法是“双证据”：
   - `A. 概念/历史来源 → 论文、课程、原文`
   - `B. 工程落地证据 → user/reference/repos 下的本地实现代码`
   - 不要只写“论文这么说”，也不要只写“某仓库这么写”，两者最好同时出现
10. **来源必须精确、链接格式必须统一**
    - 外部来源必须可直接定位到具体论文、视频、课程或文档
    - 禁止写：`YouTube 搜索`、`某论文 P3`、`网上资料`、`某博客里提到`
    - 本地文件引用统一使用绝对路径 markdown 链接，不使用 `file://`
11. **估算值必须降级表达**
    - 成本、算力、训练时长、数据规模等如果不是源码/论文明确给出，必须标注为 `[Infer]`
    - 如无法给出稳定来源，优先删去具体数字，改成区间或量级描述
    - 严禁把粗略估算值写成硬事实
12. **专业性与国际接轨，教会而不回避**
    - **专业符号**：遇到 ∂、∑、∇、argmax 等，不能删掉或替换成纯大白话。第一次出现时解释清楚，之后正常使用
      - 格式示范：`∂L/∂w（读作"L 对 w 的偏导"，意思是：w 变一丁点，L 会变多少）`
    - **专业术语**：使用学术界和工业界通用的英文术语，不造中文替代词。首次出现时 `英文（中文解释）` 并排
      - ✅ `Gradient Descent（梯度下降）`、`Causal Mask（因果遮蔽）`
      - ❌ 不要自造"坡度滑行"、"单向遮挡"之类的非标准说法
    - **专业理论**：引用定理、法则、架构时，使用原始名称和出处，不简化为模糊描述
      - ✅ `Chain Rule（链式法则）——来自微积分，Leibniz 记法：∂L/∂x = ∂L/∂y × ∂y/∂x`
      - ❌ 不要写"那个乘法规则"
    - **专业表述**：论文里怎么说、面试里怎么答，文档里就怎么写。读完文档的人应该能直接用这些表述去面试和读论文
      - 每个核心概念至少给出一个"面试级别的一句话定义"
      - 定义要和 arXiv 论文、CS224N 课件、Hugging Face 文档等权威来源对齐
    - **目标**：Later 读完文档后，能用专业符号写公式、用英文术语和面试官对话、用标准表述读懂论文。不是"看懂大白话"就够了，而是**大白话是台阶，专业表达才是目的地**
13. **先防跳步，再追求密度**
    - 面向小白的文档，优先补术语台阶、数值例子、概念边界
    - 不能为了“压缩篇幅”而跳过前置解释
14. **未过自检不得交付**
    - 必须执行“AI 交付前检查清单”
    - 任何一项未满足，先优化修复，再交付
15. **多来源内容要融入正文，不加附注**
    - 当同一主题有多个来源（如 Karpathy 代码 + 李宏毅讲解 + 论文原文），**必须把每个来源的核心内容提炼后融入「📖 知识精华」正文**
    - ❌ 禁止在资源表下面加"💡 XX补充视角"一段话了事——这是走过场，不是学习
    - ✅ 正确做法：提取来源的**具体教学内容**（公式推导、代码例子、实验数据、类比解释），作为独立的 `###` 小节插入正文
    - 每个来源贡献的内容必须有 `[Fact]` 标注，标明出处（视频+课件）
    - 来源之间的关系要显式对照（如"李宏毅的3步骤 = Karpathy Micrograd 的3个阶段"）
    - **判断标准：** Later 只读正文（不看视频），就能吸收该来源的核心知识点。如果还需要去看视频才能理解，说明提炼不够

### 必做

1. **查表第二节**找到当天的 Day 编号、N 节点、理论来源、OC 任务
2. **查表第三节**确定深度（概念/理解/精通），据此决定概念数量和自检难度
3. **查表第四节**取对应的资源链接
4. **查表第五节**取 OC 任务的文件路径
5. **查第一B节**检查 unit 目录下是否已有 study 文档或 OC 文件 → 有就引用，不重建
6. **写 3 个核心问题**：是什么 / 怎么工作 / 为什么重要
7. **写关键概念清单**：概念级 3-5 个，理解级 5-8 个，精通级 8-12 个
8. **写 Muse 映射**：今天学的东西和 `src/` 下哪个模块有关
9. **写自检清单**：每项都是可验证的（能回答什么问题/能画什么图/能讲什么故事）
10. **写面试题**：复习日积累 5 题，普通日 1-2 题
11. **遵循 README.md 7 条准则**（第一A节），特别是四层深度和 USOLB 标注
12. **执行交付前检查清单**：不满足先修，不得直接标 `[AI✓]`

### 不做

1. ❌ 不甩链接说"你自己去看"——必须出精华总结
2. ❌ 不出超过 2h 的任务量——Later 每天 2h
3. ❌ 不跳过 Muse 映射——每个理论都要压回项目
4. ❌ 不写空洞的自检项——"理解了 Transformer" 不行，"能画出 QKV 计算流程" 才行
5. ❌ 不重复创建 unit/study 已有内容——已有就引导 Later 去看
6. ❌ 不在 learn_record 里放 OC 任务文件——OC 文件放在 unit/oc-tasks/ 下

### 精华笔记的标准（最重要的产出）

> **核心理念：Later 读完 README 的"知识精华"部分，就等于看完了视频/课程。**
> 视频和课程是"可选的加深印象"，不是必须。AI 的工作量在这里。

AI 必须在 README 的 `📖 知识精华` 部分**直接写出完整的知识总结**：

1. **背景铺垫** — 历史背景、技术栈位置、前置知识回顾、和前一天的衔接
2. **第一性原理** — 用大白话从最本质的角度解释，不用术语铺垫
3. **机制详解** — 分步骤讲清原理，用编号列表/代码片段/简单公式
4. **设计动机** — 它解决什么问题？没有它会怎样？
5. **举例 + 发散** — 具体数字/代码/类比让抽象变具体（类比标注"仅类比"）
6. **原文对照** — 引用关键论文/博客的原文，旁边写 AI 的通俗解读

**质量标准：**
- ✅ 基于事实（来源于 Karpathy/李宏毅/吴恩达的实际内容），不编造
- ✅ Later 读 30-40 分钟就能掌握，效率是看视频的 3-5 倍
- ✅ 概念级写 800-1200 字，理解级 1500-2500 字，精通级 3000-5000 字
- ✅ 格式适合 Notion 展示（用 callout、表格、代码块、分级标题）
- ✅ 有背景铺垫，让 Later 知道"为什么学这个"和"这个在全局中的位置"
- ✅ 引用到论文/博客时，必须用原文对照表（原文 + 大白话并排）
- ✅ 必须有术语预备区、至少 1 个数值例子、1 个“不要混”小节
- ✅ Muse 映射必须区分“本地代码做什么”和“远端模型做什么”
- ✅ 如果 `user/reference` 有相关材料，优先补一节“本地参考实现”或在正文中直接引用本地实现行号
- ✅ 外部资源必须是明确来源，不允许写模糊入口如“搜索某视频”
- ✅ 本地文件引用统一用绝对路径 markdown 链接，不使用 `file://`
- ✅ 估算性质的数字必须标 `[Infer]`，或直接改成区间/量级表达
- ❌ 不是"摘要"——是完整的知识传递，读完不需要再看其他东西
- ❌ 不是"大纲"——每个概念都要讲透，不能只列名词
- ❌ 不是"翻译"——不要照搬原文翻译，要用 Later 的语境重新表达

### OC 任务日的 learn_record README 额外要求

当天有 OC 任务时，README 的"实践任务"部分必须：
- 写明 OC 文件的完整路径
- 标注 USOLB 属性：`[U][S][O][L][B]`
- 如果 OC 文件已存在，写 "📂 已有文件，去看 → {路径}"
- 如果 study 文档相关，写 "📖 先读 → {study 路径}"

---

## 九、AI 检查作业时的规则

当 Later 说"检查作业"或提交学习笔记时：

1. **对照自检清单**逐项检查：
   - Later 的回答是否准确？有无概念混淆？
   - 遗漏了哪些关键点？
2. **对照面试题**检查回答质量：
   - 能否在面试中站住脚？
   - 用 STAR 格式时是否有具体细节？
3. **检查 Muse 映射**：
   - 是否真的对应到了 `src/` 下的具体文件？
   - 是否能说出"我学到 X 理论后，发现 Muse 的 Y 模块就是用了这个原理"？
4. **给出评分**：
   - ⭐⭐⭐ 精通：能教别人
   - ⭐⭐ 理解：自己明白但讲不太清
   - ⭐ 了解：知道概念但细节模糊
   - 🔴 未达标：需要重学

---

## 十、AI 交付前检查清单

> **硬规则：AI 生成或修改 learn_record 文档后，必须逐项自检。**
> **只要有 1 项不满足，就先优化修复，不得标记 `[AI✓]`。**

### A. 元数据与结构

- [ ] 日期、星期、Day 编号、Week、N 节点全部核对正确
- [ ] 文档结构完整：目标 / 任务 / 知识精华 / 自检 / 面试题 / 学习笔记
- [ ] 深度级别和内容量匹配（概念 / 理解 / 精通）

### B. 事实准确性

- [ ] 没有明显事实错误、错误日期、错误人物、错误路径
- [ ] 没有把相对化问题写成绝对结论
- [ ] 关键结论已标注 `[Fact]` `[Infer]` `[Analogy]` 中的合适类型
- [ ] 原文对照、引用或 `[ref-XX]` 足以支撑关键知识点
- [ ] 如果 `user/reference` 有相关内容，已补充本地实现级证据
- [ ] 外部来源是具体可定位的标题/作者/链接，不是模糊入口
- [ ] 估算性质的数字已标 `[Infer]`，或已改成区间/量级表述

### C. 小白友好度

- [ ] 有“5 分钟预备词汇表”
- [ ] 至少有 1 个 Later 能跟下来的数值例子
- [ ] 至少有 1 个“这几个概念不要混”小节
- [ ] 没有大段术语堆砌导致 Later 必须外查才能继续

### D. 工程映射真实性

- [ ] “与 Muse/项目 的映射”包含真实文件路径和行号
- [ ] 已区分“本地代码实际做什么”和“远端模型/外部系统做什么”
- [ ] 没有把 API 调用层误写成模型内部实现层
- [ ] 本地文件引用未使用 `file://`，链接格式统一

### E. 可用性与提效

- [ ] Later 读完知识精华后，能独立回答今日 3 个核心问题中的至少 2 个
- [ ] 自检项是可验证的，不是空泛口号
- [ ] 面试题能直接拿来练，不需要再重写
- [ ] 文档能明显减少 Later 额外查资料的次数

### F. 不满足时的处理规则

1. 发现事实错误：先修正文档，再继续下一项检查
2. 发现跳步过大：补术语表、数值例子或概念边界
3. 发现映射失真：改成“本地代码 vs 远端模型”双栏说明
4. 发现引用不足：补 `[ref-XX]`、原文对照或明确标注为 `[Infer]`
5. 全部通过后，才允许标记 `[AI✓]`

---

## 十一、进度追踪

> AI 每次创建任务时更新此区域

```
Week 1: [ ][ ][ ][ ][ ][ ][ ]  0/7
Week 2: [ ][ ][ ][ ][ ][ ][ ]  0/7
Week 3: [ ][ ][ ][ ][ ][ ][ ]  0/7
Week 4: [ ][ ][ ][ ][ ][ ][ ]  0/7
Week 5: [ ][ ][ ][ ][ ][ ][ ]  0/7
Week 6: [ ][ ][ ][ ][ ][ ][ ]  0/7
                                0/42 完成
```

### 已创建的每日记录

| Day | 目录 | 状态 |
|-----|------|------|
| D01 | 0408-backpropagation/ | [ ] |
