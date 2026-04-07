# 大模型理论路线图 — 理论 × 实践 统一视图

> **定位：** 这是理论知识（N01-N12 节点）与实践系统（unit/OC 任务）的**统一调度表**
> **用法：** 每天打开这个文档 → 看今天的行 → 知道学什么理论 + 做哪个 OC 任务
> **关系：** 本文 = 理论骨架（来自三位大师课程） + 实践肌肉（来自 SYLLABUS/unit/OC）

---

## 一、大模型知识全景图

> 大模型领域一共有哪些知识模块？你需要掌握哪些？

```
Layer 0: 数学根基          线性代数 / 微积分(反向传播) / 概率统计
Layer 1: 神经网络          MLP / CNN / RNN / 训练技巧
Layer 2: Transformer       Self-Attention / Tokenization / 位置编码 / 架构变体
Layer 3: 训练与对齐        预训练 / SFT / RLHF / 后训练
Layer 4: 推理与部署        KV Cache / Flash Attention / 量化 / 推理引擎
Layer 5: Reasoning         CoT / 深度推理 / GRPO / 可解释性
Layer 6: Agent 系统        Agent Loop / Tool Use / Context / Memory / Multi-Agent / 评估
Layer 7: 产品与应用        社交Agent / 编程Copilot / RAG产品 / 教育Agent / 垂直行业
```

**你的 12 个 N 节点覆盖 Layer 0/2/3/4/5/6，是面向 Agent 工程师的精选子集。**

---

## 二、大模型业务全景图

> 你的 4 个项目在整个大模型应用版图中的位置：

```
A. 编程辅助      代码生成 / 代码审查 / 自主软件工程师
B. 客户服务      智能客服 / 个性化推荐 / 语音交互 / ◆ Muse 社交 Agent
C. 知识管理      文档处理 / RAG 知识库 / 内容生成 / ◆ 笔记 Agent
D. 教育培训      个性化教学 / AI 导师 / ◆ 钢琴教学 Agent
E. 效率自动化    工作流自动化 / 任务管理 / ◆ 专注助手 Agent
F. 分析决策      数据分析 / 预测风控 / 研究助手
```

**4 个项目覆盖 B/C/D/E 四个类别 → 面试时能讲不同场景的落地差异。**

---

## 三、N 节点 × unit/OC/F 映射总表

> 每个理论节点对应哪些现有的 unit、OC 任务和 Foundation 文档。

| N 节点 | 定位 | unit 对应 | OC 任务 | F 文档 | 项目改进 |
|--------|------|----------|---------|--------|---------|
| N01 反向传播 | 🟩概念 | — | — | F5 | — |
| N02 Transformer | 🟥精通 | — | — | **F2** | — |
| N03 Tokenization | 🟨理解 | — | — | **F11** | — |
| N04 位置编码 | 🟩概念 | — | — | — | — |
| N05 推理优化 | 🟨理解 | — | — | **F13** | — |
| N06 训练管线 | 🟥精通 | — | — | **F1** **F3** | — |
| N07 缩放定律 | 🟩概念 | — | — | F1 附属 | — |
| N08 后训练 | 🟩概念 | — | — | F9 | — |
| N09 Reasoning | 🟥精通 | unit01 study | — | F1 §4 | — |
| N10 Agent 核心 | 🟥精通 | **unit01** | **oc01-11** | — | oc08 oc09 |
| N10 (Prompt) | 精通(分散) | **unit02** | **oc12-17** | F6 | oc16 |
| N10 (Multi-Agent) | 精通(分散) | **unit03** | **oc18-25** | — | oc24 |
| N11 Context 工程 | 🟥精通 | **unit04** | **oc26-32** | F8 | oc31 |
| N12 评估 | 🟨理解 | unit01-04 面试 | oc11/17/25/32 | F12 | — |

---

## 四、资源链接速查

### Karpathy（动手实现，只看 3+1 集）

| 看 | 标题 | 链接 | N 节点 |
|----|------|------|--------|
| ✅ | L1 Micrograd 反向传播 | [YouTube](https://www.youtube.com/watch?v=VMj-3S1tku0) | N01 |
| ✅ | **L7 Build GPT** Transformer | [YouTube](https://www.youtube.com/watch?v=kCc8FmEb1nY) | N02 |
| ✅ | L8 Build Tokenizer | [YouTube](https://www.youtube.com/watch?v=zduSFxRajkE) | N03 |
| ✅ | **State of GPT** 训练管线 | [YouTube](https://www.youtube.com/watch?v=bZQun8Y4L2A) | N06 N07 |
| — | Intro to LLMs | [YouTube](https://www.youtube.com/watch?v=zjkBMFhNj_g) | N06 补充 |
| — | 完整播放列表 | [Playlist](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhvD_r) | — |
| — | nanoGPT 代码 | `repos/nanoGPT/` | N02 |
| — | minbpe 代码 | `repos/minbpe/` | N03 |

### 李宏毅（理论广度）

**LH25F — 生成式AI与ML导论 2025 Fall** · [课程主页](https://speech.ee.ntu.edu.tw/~hylee/GenAI-ML/2025-fall.php)

| 讲 | 主题 | 链接 | N 节点 |
|----|------|------|--------|
| L1 | 生成式AI原理 | [YouTube](https://youtu.be/TigfpYPJk1s) | N06 全貌 |
| L2 | Context Engineering + Agent + Reasoning | [CE](https://youtu.be/lVdajtNpaGI) · [Agent](https://youtu.be/M2Yg1kwPpts) · [Reasoning](https://youtu.be/bJFtcwLSNxI) | N09 N10 N11 |
| L3 | 解剖LLM + Transformer竞争者 | [解剖](https://youtu.be/8iFvM7WUUs8) · [内部](https://youtu.be/Xnil63UDW2o) · [竞争者](https://youtu.be/gjsdVi90yQo) | N02 |
| L4 | 评估GenAI的坑 + 偏见 | [评估](https://youtu.be/dWQVY_h0YXU) · [偏见](https://youtu.be/MSnvknLywUc) | N12 |
| L5 | ML基础 + Backpropagation | [ML](https://youtu.be/Taj1eHmZyWw) · [BP](https://youtu.be/ibJpTrp5mcE) | N01 |
| L6 | 训练技巧 + Pretrain详解 | [技巧](https://youtu.be/mPWvAN4hzzY) · [Pretrain](https://youtu.be/lMIN1iKYNmA) | N06 |
| L7 | LLM学习历程 + RL | [LLM](https://youtu.be/YJoegm7kiUM) · [RL](https://youtu.be/XWukX-ayIrs) | N06 |
| L8 | 终身学习 + Post-Training | [终身](https://youtu.be/EnWz5XuOnIQ) · [遗忘](https://youtu.be/Y9Jay_vxOsM) | N08 |

**LH26 — 机器学习 2026 Spring** · [课程主页](https://speech.ee.ntu.edu.tw/~hylee/ml/2026-spring.php)

| 日期 | 主题 | 链接 | N 节点 |
|------|------|------|--------|
| 2/20 | 解剖小龙虾 (OpenClaw Agent) | [YouTube](https://youtu.be/2rcJdFuNbZQ) | N10 |
| 3/13 | Context Engineering + Agent互动 | [CE](https://youtu.be/urwDLyNa9FU) · [互动](https://youtu.be/mmPmNezjCi0) · [冲击](https://youtu.be/VqB8zMujdjM) | N11 |
| 3/20 | Flash Attention + KV Cache | [Flash](https://youtu.be/vXb2QYOUzl4) · [KV](https://youtu.be/fDQaadKysSA) | N05 |
| 3/27 | Positional Embedding | [YouTube](https://youtu.be/Ll-wk8x3G_g) | N04 |

### 吴恩达（应用模式）

| 课程 | 链接 | N 节点 |
|------|------|--------|
| **Agentic AI** (主课 5 模块) | [DeepLearning.AI](https://www.deeplearning.ai/courses/agentic-ai/) | N10 N12 |
| MCP: Build Rich-Context AI Apps | [短课](https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/) | N11 |
| Agent Memory | [短课](https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/) | N11 |
| Evaluating AI Agents | [短课](https://www.deeplearning.ai/short-courses/evaluating-ai-agents/) | N12 |
| Building Live Voice Agents | [短课](https://www.deeplearning.ai/short-courses/building-live-voice-agents-with-googles-adk/) | 拓展 |

### 关键博客 + 论文

| 来源 | 标题 | 链接 | N 节点 |
|------|------|------|--------|
| Lilian Weng | LLM Powered Autonomous Agents | [Blog](https://lilianweng.github.io/posts/2023-06-23-agent/) | N10 |
| Anthropic | Building Effective Agents | [Blog](https://www.anthropic.com/research/building-effective-agents) | N10 |
| Vaswani et al. | Attention Is All You Need | [arXiv](https://arxiv.org/abs/1706.03762) | N02 |
| Wei et al. | Chain-of-Thought Prompting | [arXiv](https://arxiv.org/abs/2201.11903) | N09 |
| Yao et al. | ReAct: Reasoning + Acting | [arXiv](https://arxiv.org/abs/2210.03629) | N10 |

### 已有参考仓库（`user/reference/repos/`）

| 仓库 | N 节点 | 仓库 | N 节点 |
|------|--------|------|--------|
| `nanoGPT/` | N02 | `hello-agents/` | N10 |
| `minbpe/` | N03 | `swarm/` | N10 |
| `LLMs-from-scratch/` | N02 N06 | `anthropic-cookbook/` | N10 N11 |
| `open-r1/` | N09 | `Prompt-Engineering-Guide/` | N11 |
| `introtodeeplearning/` | N01 N02 | `huggingface-course/` | N10 |
| `llm-agents-mooc/` | N10 | `ai-agents-for-beginners/` | N10 |
| `learn-claude-code/` | N10 | | |

---

## 五、6 周统一执行计划

> **每天一行 = 理论来源 + 对应 F 文档 + 对应 OC 任务 + 项目实践**

### Week 1：LLM 是什么 + Agent 第一次转动

| 天 | N 节点 | 理论来源（1h） | F 文档 | OC 任务 / 项目（1h+） |
|----|--------|---------------|--------|---------------------|
| D1 | N01 | [Karpathy Micrograd](https://www.youtube.com/watch?v=VMj-3S1tku0) 精华 | F5 | — |
| D2 | N02 (1/3) | [Karpathy Build GPT](https://www.youtube.com/watch?v=kCc8FmEb1nY) 前40min | F2 开始 | — |
| D3 | N02 (2/3) | Build GPT 40-80min | F2 续写 | **oc01** 启动 Muse + 看日志 `[U][L]` |
| D4 | N02 (3/3) | Build GPT 后段 + [李宏毅 解剖LLM](https://youtu.be/8iFvM7WUUs8) | **F2 完成** | **oc02** trace-reader 全链路 `[U][L]` |
| D5 | N06 (1/2) | [Karpathy State of GPT](https://www.youtube.com/watch?v=bZQun8Y4L2A) 前30min | F1 更新 / F3 开始 | 跑通一个最简 Agent |
| D6 | N06 (2/2) | State of GPT 后半 + [李宏毅 Pretrain](https://youtu.be/lMIN1iKYNmA) | **F3 完成** | 继续完善 Agent |
| D7 | 复习 | — | — | 面试卡片 5 道 |

**本周产出：** F2 ✅ F3 ✅ oc01 ✅ oc02 ✅ 面试卡片 5 道

---

### Week 2：Token + Agent 核心 + Reasoning

| 天 | N 节点 | 理论来源（1h） | F 文档 / study | OC 任务 / 项目（1h+） |
|----|--------|---------------|---------------|---------------------|
| D1 | N03 | [Karpathy Tokenizer](https://www.youtube.com/watch?v=zduSFxRajkE) 精华 | **F11** 开始 | 实测中英文 token 差异 |
| D2 | N03 续 | 同上 + `repos/minbpe/` 走读 | **F11 完成** | **oc03** event hook 观察 Agent Loop `[O][L]` |
| D3 | N10 (1/3) | [吴恩达 Agentic AI M1](https://www.deeplearning.ai/courses/agentic-ai/) + [BEA](https://www.anthropic.com/research/building-effective-agents) | study 01a (已✅) | **oc04** 走读 OC Session 源码 `[S]` |
| D4 | N10 (2/3) | 吴恩达 M2 Reflection + [Weng Blog](https://lilianweng.github.io/posts/2023-06-23-agent/) | study 01e (已✅) | **oc05** 走读 Muse 调用链 `[S]` |
| D5 | N10 (3/3) | 吴恩达 M3 Tool Use | — | **oc06** ACI 审计 MCP 工具 `[S][B]` |
| D6 | N09 (1/2) | [李宏毅 Reasoning](https://youtu.be/bJFtcwLSNxI) + [CoT 论文](https://arxiv.org/abs/2201.11903) | F1 §4 对照 | **oc07** Prompt 注入链走读 `[S][O]` |
| D7 | 复习 | — | — | 面试卡片 5 道 + Agent 循环流程图 |

**本周产出：** F11 ✅ oc03-07 ✅ 面试卡片 10 道累计

---

### Week 3：Context + 记忆 + Prompt 实践 + 笔记Agent

| 天 | N 节点 | 理论来源（1h） | F 文档 / study | OC 任务 / 项目（1h+） |
|----|--------|---------------|---------------|---------------------|
| D1 | N09 (2/2) | [李宏毅 Agent原理](https://youtu.be/M2Yg1kwPpts) + `repos/open-r1/` | — | **oc10** 三 Agent Loop 对比 `[S]` |
| D2 | N11 (1/3) | [李宏毅 Context Engineering](https://youtu.be/urwDLyNa9FU) | study 03b 开始 | **oc12** 参数实验 temperature `[U][B]` |
| D3 | N11 (2/3) | [吴恩达 MCP 短课](https://www.deeplearning.ai/short-courses/mcp-build-rich-context-ai-apps-with-anthropic/) | — | **oc13** 观察 Prompt 注入链 `[O]` |
| D4 | N11 (3/3) | [吴恩达 Memory 短课](https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/) | study 03a 开始 | **oc14** 走读 Prompt 组装链 `[S]` |
| D5 | N11 续 | F8 RAG 编写 + `repos/hello-agents/` RAG 章节 | **F8 完成** | 笔记 Agent：设计 RAG 架构 |
| D6 | N10 Prompt | study 04a 七层 Prompt + CoT/ToT | study 04a 完成 | **oc15** 三方 System Prompt 对比 `[S]` |
| D7 | 复习 | — | — | 面试卡片 5 道 + Context 决策树 |

**本周产出：** F8 ✅ study 03a/03b/04a ✅ oc10/12-15 ✅ 笔记Agent原型

---

### Week 4：多Agent + 推理优化 + 钢琴Agent

| 天 | N 节点 | 理论来源（1h） | F 文档 / study | OC 任务 / 项目（1h+） |
|----|--------|---------------|---------------|---------------------|
| D1 | N10 多Agent | 吴恩达 M5 + `repos/swarm/` | study 02a 开始 | **oc18** 触发 Muse Harness `[U][L]` |
| D2 | N10 多Agent | [李宏毅 OpenClaw](https://youtu.be/2rcJdFuNbZQ) | study 02b 完成 | **oc19** Swarm 跑通 demo `[U]` |
| D3 | N05 (1/2) | [李宏毅 Flash Attention](https://youtu.be/vXb2QYOUzl4) | **F13 开始** | **oc20** 走读 Harness 三件套 `[S]` |
| D4 | N05 (2/2) | [李宏毅 KV Cache](https://youtu.be/fDQaadKysSA) | **F13 完成** | **oc21** 走读 Swarm core.py `[S]` |
| D5 | N04 | [李宏毅 Positional Embedding](https://youtu.be/Ll-wk8x3G_g) | — | 钢琴教学 Agent 需求分析+原型 |
| D6 | N12 (1/2) | [吴恩达 Eval Agents](https://www.deeplearning.ai/short-courses/evaluating-ai-agents/) | **F12 开始** | **oc22** Harness vs BEA 审计 `[S]` |
| D7 | 复习 | — | — | 面试卡片 5 道 + 4 项目架构对比 |

**本周产出：** F13 ✅ F12 开始 study 02a/02b ✅ oc18-22 ✅ 钢琴Agent原型

---

### Week 5：评估 + 补全 + 专注助手Agent + 改进落地

| 天 | N 节点 | 理论来源（1h） | F 文档 | OC 任务 / 项目（1h+） |
|----|--------|---------------|--------|---------------------|
| D1 | N12 (2/2) | [李宏毅 评估的坑](https://youtu.be/dWQVY_h0YXU) | **F12 完成** | **oc23** 评估框架设计 `[S][B]` |
| D2 | N07 + N08 | [Karpathy Intro to LLMs](https://www.youtube.com/watch?v=zjkBMFhNj_g) + [李宏毅 终身学习](https://youtu.be/EnWz5XuOnIQ) | — | 专注助手 Agent 原型 |
| D3 | — | 查缺补漏 | — | **oc08** 写新 MCP 工具 `[B][U]` |
| D4 | — | — | — | **oc09** 落地 ACI 修复 `[B]` |
| D5 | — | — | — | **oc16** 优化 Muse Persona `[B][U]` |
| D6 | — | — | — | **oc26** 观察 Muse Memory `[U][L]` + **oc27** 触发 Compaction `[U][O][L]` |
| D7 | 复习 | — | — | 面试卡片 5 道 |

**本周产出：** F12 ✅ oc08/09/16/23/26/27 ✅ 专注助手Agent原型

---

### Week 6：深度实践 + 面试冲刺

| 天 | 内容 | OC 任务 / 项目 | 产出 |
|----|------|---------------|------|
| D1 | Memory 源码走读 | **oc28** 走读 memory.mjs `[S]` + **oc29** 走读 OC Compaction `[S]` | 记忆架构理解 |
| D2 | Memory 审计改进 | **oc30** Memory 审计 `[S][B]` + **oc24** 改进 Handoff `[B]` | Muse 改进 |
| D3 | Memory 改进 + 4 项目完善 | **oc31** 改进 Memory `[B]` | Muse 改进 |
| D4 | 面试：N02+N06 高频题 | **oc11** unit01 面试故事 | 10 道深度题 |
| D5 | 面试：N10+N11 高频题 | **oc17** unit02 面试故事 + **oc25** unit03 面试故事 | 10 道深度题 |
| D6 | 面试：N09+N12 高频题 | **oc32** unit04 面试故事 | 10 道深度题 |
| D7 | AI 模拟面试 + 总复盘 | 4 个项目 demo 录制 | **毕业检查** |

**本周产出：** oc24/28-32 ✅ 面试故事 4 个 ✅ 50+ 面试题 ✅

---

## 六、OC 任务全量映射表

> 32 个 OC 任务，每个标注了对应的 N 节点和所在 Week。

| OC | 任务 | N 节点 | Week | 状态 |
|----|------|--------|------|------|
| oc01 | 启动 Muse + 看日志 | N10 | W1 D3 | [AI✓] |
| oc02 | trace-reader 全链路 | N10 | W1 D4 | [AI✓] |
| oc03 | event hook 观察 Agent Loop | N10 | W2 D2 | [AI✓] |
| oc04 | 走读 OC Session 源码 | N10 | W2 D3 | [AI✓] |
| oc05 | 走读 Muse 调用链 | N10 | W2 D4 | [AI✓] |
| oc06 | ACI 审计 MCP 工具 | N10 | W2 D5 | [AI✓] |
| oc07 | Prompt 注入链走读 | N10 N09 | W2 D6 | [AI✓] |
| oc08 | 写新 MCP 工具 | N10 | W5 D3 | [ ] |
| oc09 | 落地 ACI 修复 | N10 | W5 D4 | [ ] |
| oc10 | 三 Agent Loop 对比 | N10 | W3 D1 | [AI✓] |
| oc11 | 面试 STAR 故事 | N10 | W6 D4 | [AI✓] |
| oc12 | 参数实验 temperature | N11 N09 | W3 D2 | [ ] |
| oc13 | 观察 Prompt 注入链 | N11 | W3 D3 | [ ] |
| oc14 | 走读 Prompt 组装链 | N11 | W3 D4 | [ ] |
| oc15 | 三方 System Prompt 对比 | N11 | W3 D6 | [ ] |
| oc16 | 优化 Muse Persona | N11 N09 | W5 D5 | [ ] |
| oc17 | 面试 STAR 故事 | N11 | W6 D5 | [ ] |
| oc18 | 触发 Muse Harness | N10 | W4 D1 | [ ] |
| oc19 | Swarm 跑通 demo | N10 | W4 D2 | [ ] |
| oc20 | 走读 Harness 三件套 | N10 | W4 D3 | [ ] |
| oc21 | 走读 Swarm core.py | N10 | W4 D4 | [ ] |
| oc22 | Harness vs BEA 审计 | N10 N12 | W4 D6 | [ ] |
| oc23 | 评估框架设计 | N12 | W5 D1 | [ ] |
| oc24 | 改进 Handoff | N10 | W6 D2 | [ ] |
| oc25 | 面试 STAR 故事 | N10 | W6 D5 | [ ] |
| oc26 | 观察 Muse Memory 读写 | N11 | W5 D6 | [ ] |
| oc27 | 触发 Compaction | N11 | W5 D6 | [ ] |
| oc28 | 走读 memory.mjs 源码 | N11 | W6 D1 | [ ] |
| oc29 | 走读 OC Compaction | N11 | W6 D1 | [ ] |
| oc30 | Memory 审计 | N11 N12 | W6 D2 | [ ] |
| oc31 | 改进 Memory | N11 | W6 D3 | [ ] |
| oc32 | 面试 STAR 故事 | N11 | W6 D6 | [ ] |

---

## 七、毕业检查清单

### 理论能讲清楚

- [ ] 画出 Transformer 架构图，讲清 QKV 和多头注意力 (N02)
- [ ] 画出 Pretrain→SFT→RLHF 全流程 (N06)
- [ ] 解释 Token/BPE/中文成本 (N03)
- [ ] 解释 CoT 为什么有效 + Reasoning 怎么来 (N09)
- [ ] 解释 Agent 循环 + 5 种编排模式 (N10)
- [ ] 解释 Context Window/Compaction/RAG (N11)
- [ ] 解释 KV Cache 和 Flash Attention (N05)
- [ ] 解释评估为什么是最大预测指标 (N12)

### 项目能跑起来

- [ ] Muse 社交 Agent：多通道对话 + 记忆 + 个性
- [ ] 笔记 Agent：RAG 搜索 + 文件管理 + 总结
- [ ] 钢琴教学 Agent：结构化教学 + 进度追踪
- [ ] 专注助手 Agent：定时提醒 + 状态管理

### OC 任务全部完成

- [ ] 32 个 OC 任务全部 `[x]`
- [ ] 11 个 Foundation 文档完成 (F1-F3, F5-F6, F8-F9, F11-F13)
- [ ] 50 道面试题 + 4 个 STAR 故事
