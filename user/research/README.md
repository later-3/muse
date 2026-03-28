# 研究手册

> **定位：** 研究阶段（Sprint 1-2）的方法论和资源索引。  
> **每日产出在** `dayXX/INDEX.md`，三轨道（你的+AI的）都在同一个文件夹。  
> **Sprint 3+ 转为：** Spike → 实现 → 验证 → 复盘。
>
> **格式标准（必须遵循）：**
> - 📖 研究笔记 → `.agents/workflows/research-note.md`
> - 🤖 AI 并行任务 → `.agents/workflows/ai-parallel-task.md`

---

## 🚀 核心方法论：放大你的一分钟（必须遵守）

> [!IMPORTANT]
> **你的每一分钟，必须产出 10 倍价值。这是所有 AI 必须遵循的执行准则。**

### 分工

| AI 做什么（低效动作消除） | 你做什么（高价值动作放大） |
|------------------------|------------------------|
| 读源码 → 逐行注释 → 提取精华 | 看精华笔记 → 理解 → 背诵记忆 |
| 读论文 → 摘要 + 核心图 + 数据表 | 看图 → 理解逻辑 → 能口述 |
| 跨项目对比 → 做对照表 | 看表 → 判断哪个设计更好 |
| 大佬动态 → 提取观点 + Muse 映射 | 看映射 → 思考怎么用到 Muse |
| 面试题库 → 标准答案 + Muse 实例 | 练回答 → 加自己的理解 |
| 代码审计 → 列出问题 + 改进建议 | 读建议 → 动手改 → 验证效果 |
| **实验 + 消险 → 代码 + 报告** | **忙完自己的 → 看报告 → 知道坑在哪** |

### 6 条准则

1. **AI 精华总结，你来吸收。** 不是"你去看 xxx"，而是 AI 读完 → 产出结构化笔记 → 你只需读笔记。
2. **每篇文档 = 第一性原理 + 大白话 + 示例 + 逻辑完备。** 零基础看完就能用。
3. **边做边回顾。** Muse 是你的实验 — 理论必须立即压回 Muse 设计/代码。
4. **保证质量。** 每个产出都必须面试能用、开发能指导。
5. **OpenCode 是贯穿线。** 每天至少 1 个 OC 关联点。
6. **双轨并行，AI 先踩坑。** 你到手时路已经清过，坑已经标好。

### 公式

```
理论精读 + 面试知识 + 行业动态 + 项目拆解 + Muse 实验 + OC 深挖 = 短时间成为 AI Agent 高手
```

---

## 研究增强轨道（Sprint 1-2 适用）

> Sprint 3+ 不再维护 6 轨道，转为 Spike 驱动。

| 轨道 | 代号 | 内容 | ~时长 |
|------|------|------|------|
| **a 精读** | study | 官方文档/论文精读 | 60min |
| **b 面试** | interview | 面试题 + 跨厂商对比 | 30min |
| **c 课程** | course | 跟练开源课程 | 20min |
| **d 项目拆解** | teardown | 模块源码精读 | 40min |
| **e 大佬追踪** | leaders | 帖子/论文动态 | 15min |
| **f Muse 实战** | muse | 学到的压回 Muse | 30min |

---

## 参考仓库

### 已有（`make-muse/reference/`）

| 仓库 | 路径 | 用途 |
|------|------|------|
| OpenCode | `reference/opencode/` | Muse 底座 **重点** |
| oh-my-opencode | `reference/oh-my-opencode/` | 插件生态 |
| hermes-agent | `reference/hermes-agent/` | 多 Agent 参考 |

### 待 clone

| 仓库 | URL | 用途 |
|------|------|------|
| Anthropic Cookbook | `anthropics/anthropic-cookbook` | Agent 模式代码 |
| Hello-Agents | `datawhalechina/hello-agents` | 中文 Agent 教程 (31k⭐) |
| OpenAI Swarm | `openai/swarm` | Handoff 源码 |

---

## 课程清单

| # | 课程 | 来源 | 用于 |
|---|------|------|------|
| 1 | Anthropic Courses | Anthropic 官方 | S1 Day1-3 |
| 2 | Anthropic Cookbook Agent Patterns | Anthropic 官方 | S1 Day1-5 |
| 3 | Hello-Agents | Datawhale | S1-S2 |
| 4 | HuggingFace Agents Course | HF | S1-S2 |
| 5 | DeepLearning.AI Agent Skills | Andrew Ng | S1 Day1 |

---

## 项目拆解清单

| # | 项目 | 拆什么模块 | Sprint |
|---|------|-----------|--------|
| 1 | **OpenAI Swarm** | run() + Handoff + Agent 类 | S1 |
| 2 | **Anthropic Cookbook** | Agent Patterns + Tool Use | S1 |
| 3 | **OpenCode** ⭐ | Session + Hook + Plugin + Sisyphus | S1-S3 |
| 4 | **LangGraph** | Graph 状态机 + Checkpointer | S1 |
| 5 | **CrewAI** | Agent Role + Task + Process | S1 |
| 6 | **Vercel AI SDK** | streamText + tool() | S2 |
| 7 | **Claude Code** | ACI 工具设计 | S1-S2 |

---

## 大佬追踪

### 海外

| 人物 | 身份 | 代表贡献 |
|------|------|---------|
| Andrew Ng | DeepLearning.AI | 4 Agentic Patterns |
| Andrej Karpathy | 前 Tesla AI | LLM OS |
| Lilian Weng | OpenAI VP | 《LLM Powered Autonomous Agents》 |
| Harrison Chase | LangChain CEO | Agent 工具链 |
| Erik Schluntz | Anthropic | BEA + ACI |
| Shunyu Yao 姚顺雨 | Princeton→OpenAI | ReAct + ToT |
| Dario Amodei | Anthropic CEO | AI Safety |

### 国内

| 人物 | 身份 | 代表贡献 |
|------|------|---------|
| 吴泳铭 | 阿里 CEO | Token Hub |
| 林达华 | 上海 AI Lab | InternLM Agent |
| 刘知远 | 清华 NLP | BMTools + ChatGLM |
| Datawhale | 开源教育 | Hello-Agents (31k⭐) |

---

## 必读论文

| # | 论文 | 作者 | 为什么必读 |
|---|------|------|-----------|
| 1 | **ReAct** | Yao et al. 2022 | Agent 推理+行动范式 |
| 2 | **LLM Powered Autonomous Agents** | Weng 2023 | Agent 最经典综述 |
| 3 | **Tree of Thoughts** | Yao et al. 2023 | 多路径推理 |
| 4 | **Reflexion** | Shinn et al. 2023 | Agent 自我反思 |
| 5 | **Anthropic BEA** | Schluntz & Zhang 2024 | 实战 Agent 工程 ✅ |
