# AI Agent 理论全景图

> **定位：** 程序员视角的 AI Agent 理论全栈  
> **方法：** 每个理论节点 = 讲得透（理论） + 做得出（实践） + 说得好（自媒体）  
> **原则：** 所有来源以事实为依据，标注版本和时间

---

## 来源约定

| 编号 | 来源 | 类型 | 状态 |
|------|------|------|------|
| **[LH26]** | 李宏毅 ML 2026 Spring | 课程 | ✅ 确认存在 |
| **[LH25]** | 李宏毅 ML 2025 Spring | 课程 | ✅ 确认存在 |
| **[LH25F]** | 李宏毅 GenAI-ML 2025 Fall | 课程 | ✅ 确认存在 |
| **[AN-AG]** | 吴恩达 Agentic AI (DeepLearning.AI) | 课程 | ✅ 5 模块 |
| **[AN-EV]** | 吴恩达 Evaluating AI Agents | 短课 | ✅ |
| **[AN-MCP]** | 吴恩达 Build AI Apps with MCP Servers | 短课 | ✅ |
| **[AN-MEM]** | 吴恩达 Agent Memory | 短课 | ✅ |
| **[AN-VOI]** | 吴恩达 Building Live Voice Agents | 短课 | ✅ |
| **[BEA]** | Anthropic "Building Effective Agents" | 博客 | ✅ |
| **[SWARM]** | OpenAI Swarm | 项目 | ✅ user/reference/repos/swarm |
| **[HELLO]** | Datawhale Hello-Agents | 课程 | ✅ user/reference/repos/hello-agents |
| **[LCC]** | Learn Claude Code | 教程 | ✅ user/reference/repos/learn-claude-code |
| **[HF]** | Hugging Face AI Agents Course | 课程 | ✅ user/reference/repos/huggingface-course |
| **[MOOC]** | Berkeley LLM Agents MOOC | 课程 | ✅ user/reference/repos/llm-agents-mooc |
| **[PEG]** | Prompt Engineering Guide | 指南 | ✅ user/reference/repos/Prompt-Engineering-Guide |
| **[LFS]** | LLMs-from-scratch | 书 | ✅ user/reference/repos/LLMs-from-scratch |
| **[NGPT]** | nanoGPT | 项目 | ✅ user/reference/repos/nanoGPT |
| **[MBPE]** | minbpe | 项目 | ✅ user/reference/repos/minbpe |
| **[ABC]** | Anthropic Cookbook | 项目 | ✅ user/reference/repos/anthropic-cookbook |
| **[OR1]** | open-r1 | 项目 | ✅ user/reference/repos/open-r1 |
| **[MIT]** | MIT 6.S191 IntroToDeepLearning | 课程 | ✅ user/reference/repos/introtodeeplearning |
| **[ABI]** | AI Agents for Beginners (Microsoft) | 课程 | ✅ user/reference/repos/ai-agents-for-beginners |

### make-muse/reference 验证项目

| 编号 | 项目 | 语言 | 定位 |
|------|------|------|------|
| **[OC]** | OpenClaw | TypeScript | 产品级个人 AI 助手（多通道 + Gateway + Skills) |
| **[OD]** | OpenCode (oh-my-opencode) | TypeScript | 终端 AI 编程助手（Agent Loop + Plugin + Sisyphus） |
| **[ZC]** | ZeroClaw | Rust | 极简 Agent 运行时（<5MB RAM，Trait-driven） |

---

## Phase 1: 为什么能 Agent — LLM 基座理论 (3-4 周)

> **目标：** 程序员能清晰解释「LLM 是什么 → 为什么能当 Agent 的大脑」

### 1.1 Transformer 架构

| 维度 | 内容 |
|------|------|
| **核心概念** | Self-Attention / QKV / 多头注意力 / 残差连接 / LayerNorm |
| **要回答的问题** | 为什么 Attention 能捕获长距离依赖？QKV 矩阵的物理意义？ |
| **来源** | [LH25F] GenAI 基础讲 · [MIT] Sequence Modeling · [LFS] 第3-4章从零实现 |
| **实践** | 用 [NGPT] 训练一个 mini GPT + 可视化 attention map |
| **自媒体** | 「手撕 Transformer：我用 200 行 Python 训了一个 GPT」 |

### 1.2 Tokenization (BPE)

| 维度 | 内容 |
|------|------|
| **核心概念** | Byte Pair Encoding / Vocabulary / Token ≠ Word |
| **要回答的问题** | 为什么中文比英文贵？为什么 token 限制是 Agent 的第一约束？ |
| **来源** | [MBPE] 极简实现 · [LFS] 第2章 · [LH25F] Token 概念 |
| **实践** | 用 [MBPE] 实现 BPE，对比中英文 token 效率 |
| **自媒体** | 「95% 的人不知道：为什么 AI 觉得中文更贵？BPE 原理拆解」 |

### 1.3 LLM 训练管线

| 维度 | 内容 |
|------|------|
| **核心概念** | Pre-training → SFT (指令微调) → RLHF/DPO → Post-training |
| **要回答的问题** | 为什么需要三阶段？每阶段解决什么问题？ |
| **来源** | [LH25] Pretrain/Alignment + Post-training/Forgetting · [LFS] 第5-7章 · [OR1] DeepSeek R1 GRPO 复现 |
| **实践** | 用 [LFS] 在 Colab 跑一次微调 · 理解 [OR1] 的 GRPO 流程 |
| **自媒体** | 「LLM 是怎么从"乱说话"变成"听指令"的：三阶段训练拆解」 |

### 1.4 推理优化

| 维度 | 内容 |
|------|------|
| **核心概念** | KV Cache / Flash Attention / Positional Embedding (RoPE) |
| **要回答的问题** | Agent 长对话时为什么会变慢？KV Cache 如何加速？ |
| **来源** | [LH26] Flash Attention + KV Cache + Positional Embedding 三讲 |
| **实践** | 用 Ollama 部署本地模型，实测有无 KV Cache 的速度差异 |
| **自媒体** | 「为什么你的 AI Agent 对话越长越慢：KV Cache 原理」 |

### 1.5 模型内部机制 + Reasoning

| 维度 | 内容 |
|------|------|
| **核心概念** | 模型可解释性 / 神经元分析 / Reasoning (深度思考) / Model Merging |
| **要回答的问题** | LLM 真的在"思考"吗？Reasoning 和 CoT 的区别？ |
| **来源** | [LH25] Model Inside + Reasoning + Reasoning Eval + Reason Shorter + Model Merging 五讲 · [LH26] 解剖小龙虾(OpenClaw) 讲 Agent 原理 |
| **实践** | 对比同一模型开/关 Reasoning 的效果差异 |
| **自媒体** | 「李宏毅拆 OpenClaw：AI Agent 到底怎么"想"的？」 |

### 1.6 Agent 核心定义

| 维度 | 内容 |
|------|------|
| **核心概念** | Agent = LLM + Tools + Memory + Planning · Agent vs Workflow · Agentic Loop (Reason→Act→Observe) |
| **要回答的问题** | 什么是 Agent？和 Workflow 的本质区别？ |
| **来源** | [BEA] 5 种模式 · [AN-AG] Module 1 · [LH26] AI Agent 专讲 · [HELLO] 第1章 · [ABI] Lesson 1 |
| **实践** | 手写最简 ReAct 循环 (纯 Node.js + LLM API) |
| **自媒体** | 「一文定义 Agent：不用框架，50 行 JS 实现 Agent 核心循环」 |
| **验证** | [OC] Gateway→Pi Agent RPC 就是 Agentic Loop · [OD] 核心 Session Engine · [ZC] daemon 模式 |

---

## Phase 2: 怎么构建 — Agent 核心技能 (4-6 周)

> **目标：** 掌握 Agent 的"零件"，独立搭一个功能 Agent

### 2.1 Prompt Engineering

| 维度 | 内容 |
|------|------|
| **核心概念** | System/User/Assistant 三角色 · CoT · Few-Shot · 7 层 Prompt 架构 · Prompt Injection 防御 |
| **要回答的问题** | 为什么 system prompt 的结构比内容更重要？ |
| **来源** | [PEG] 全景 · [AN-AG] Module 2 (Reflection) · [ABC] Prompt Engineering 系列 |
| **实践** | 设计 Muse 的 persona prompt + 对比结构化 vs 扁平 prompt |
| **自媒体** | 「系统 Prompt 的 7 层结构：为什么你写的 prompt 不如 Claude Code」 |
| **验证** | [OC] AGENTS.md/SOUL.md/TOOLS.md/USER.md 模板体系 · [OD] system-prompt Hook 动态注入 · [ZC] Identity trait (OpenClaw/AIEOS) |

### 2.2 Tool Use / Function Calling / MCP

| 维度 | 内容 |
|------|------|
| **核心概念** | Function Calling 协议 · ACI (Agent-Computer Interface) · MCP (Model Context Protocol) · Tool 注册/分发 |
| **要回答的问题** | Agent 怎么"调工具"？MCP 解决了什么问题？ |
| **来源** | [AN-AG] Module 3 (Tool Use + MCP) · [AN-MCP] 完整短课 · [BEA] Tool Use 部分 · [ABC] Tool Use recipes |
| **实践** | 实现 3 个 MCP 工具 (搜索/文件/计算) · 集成到 Muse |
| **自媒体** | 「MCP 协议：AI 的 USB 接口，让 Agent 连接一切」 |
| **验证** | [OC] Skills 平台 + ClawHub · [OD] MCP 工具服务器 · [ZC] Tool trait (shell/file/memory/git/browser/composio/hardware) |

### 2.3 Context Engineering

| 维度 | 内容 |
|------|------|
| **核心概念** | Context Window 管理 · Compaction (压缩) · RAG · 渐进式信息暴露 |
| **要回答的问题** | Agent 的上下文爆炸怎么解决？Compaction 和 RAG 的区别？ |
| **来源** | [LH26] Context Engineering 专讲 · [AN-AG] Module 4 · [HELLO] RAG 章节 · [LCC] 第7步 Context Management |
| **实践** | 实现 Compaction 策略 + 简单 RAG (向量检索) |
| **自媒体** | 「Agent 的记忆危机：Context Window 快满了怎么办？」 |
| **验证** | [OC] Session Pruning · [OD] Preemptive Compaction Hook · [ZC] Memory trait + chunking |

### 2.4 Memory 架构

| 维度 | 内容 |
|------|------|
| **核心概念** | 短期记忆 (Session) · 长期记忆 (Persistent) · 语义记忆 (Embedding + Vector) · 外部记忆 (RAG) |
| **要回答的问题** | Agent 怎么"记住"用户？语义检索 vs 关键词检索？ |
| **来源** | [AN-MEM] Agent Memory 专课 · [HELLO] Memory 章节 · [ABI] Lesson 5 (Agentic RAG) |
| **实践** | 实现 SQLite + FTS5 + Embedding 混合检索 (参考 [ZC] 实现) |
| **自媒体** | 「Agent 的三种记忆：为什么 ZeroClaw 不用 Pinecone」 |
| **验证** | [OC] Session model (main/group/activation) · [OD] Memory MCP 服务器 · [ZC] SQLite hybrid search (FTS5 + vector, 零外部依赖) |

### 2.5 Multi-Agent 编排

| 维度 | 内容 |
|------|------|
| **核心概念** | Manager-Worker / Pipeline / Handoff (Swarm) / Orchestrator-Worker / Joint Scratchpad |
| **要回答的问题** | 什么时候需要多 Agent？Handoff 协议怎么设计？ |
| **来源** | [AN-AG] Module 5 · [BEA] 5 模式 · [SWARM] Handoff/Routines · [MOOC] Multi-Agent 专题 · [ABI] Lesson 9 (Multi-Agent) |
| **实践** | 用 JS 复刻 Swarm 的 Handoff 核心 · 实现 Muse Planner-Worker 流程 |
| **自媒体** | 「多 Agent 协作：OpenAI Swarm 的 Handoff 我用 JS 重写了」 |
| **验证** | [OC] Agent-to-Agent (sessions_send) · [OD] Sisyphus 协议 (多 Agent 编排) · [ZC] daemon 模式 |

### 2.6 Reflection + 评估

| 维度 | 内容 |
|------|------|
| **核心概念** | Self-Reflection · LLM-as-Judge · Eval-Driven Development · 终态评估 |
| **要回答的问题** | 怎么知道 Agent 做得好不好？评估是 Agent 成功的最大预测指标？ |
| **来源** | [AN-AG] Module 2 (Reflection) + Module 4 (Evals) · [AN-EV] 完整短课 · [LH25] Reasoning Eval |
| **实践** | 设计 Muse 的评估套件 (3 层：单元/集成/端到端) |
| **自媒体** | 「吴恩达说评估是 Agent 成功的最大预测指标：我验证了」 |
| **验证** | [OC] Doctor 诊断 · [OD] Trace Reader (链路追踪) · [ZC] channel doctor + status |

### 2.7 Guardrails / HITL / 安全

| 维度 | 内容 |
|------|------|
| **核心概念** | Human-in-the-Loop · Sandbox · 权限白名单 · Prompt Injection 防御 · 审批门控 |
| **要回答的问题** | 怎么防止 Agent 做危险操作？HITL 怎么设计不打断用户？ |
| **来源** | [BEA] Guardrails 部分 · [ABI] Lesson 11 (Safety) · [LCC] 第10步 Safety |
| **实践** | 实现 Muse 的审批门控 (request_approval + check_approval MCP 工具) |
| **自媒体** | 「AI Agent 安全：ZeroClaw 的 14 层防御我学到了什么」 |
| **验证** | [OC] DM pairing + sandbox + elevated 切换 · [OD] permission.ask 拦截 · [ZC] 全栈安全 (pairing + sandbox + allowlist + filesystem scoping + workspace_only) |

---

## Phase 3: 真实世界怎么做 — 开源拆解 + 生产级 (4-6 周)

> **目标：** 通过拆解 openclaw / opencode / zeroclaw，掌握生产级考量

### 3.1 Agent Runtime 架构比较

| 维度 | 内容 |
|------|------|
| **核心概念** | Gateway 架构 · Client-Server 分离 · Trait-driven 抽象 · Plugin/Hook 系统 |
| **要回答的问题** | OpenClaw (TS) vs ZeroClaw (Rust) vs OpenCode (TS) 的架构差异？怎么选？ |
| **来源** | 三个项目的 README + 架构文档 |
| **实践** | 画对比架构图 · 分析各自的扩展点 |
| **自媒体** | 「三大开源 Agent 运行时深度对比：如何选择你的技术栈」 |

| 特性 | OpenClaw [OC] | OpenCode [OD] | ZeroClaw [ZC] |
|------|--------------|--------------|--------------|
| **语言** | TypeScript | TypeScript | Rust |
| **架构** | Gateway WS 控制面 + Pi Agent RPC | Session Engine + Plugin Hooks | Trait-driven 单二进制 |
| **通道** | 22+ (WhatsApp/Telegram/Slack/Discord/...) | Terminal TUI + REST API | 17+ (Telegram/Discord/Slack/WhatsApp/...) |
| **工具** | Skills 平台 + ClawHub | MCP Server + Plugin | Tool trait (shell/file/git/browser/hardware) |
| **记忆** | Session model | Memory MCP | SQLite hybrid (FTS5+vector, 零依赖) |
| **多 Agent** | sessions_send + multi-agent routing | Sisyphus 协议 | daemon + delegate tool |
| **安全** | DM pairing + sandbox | permission.ask | 全栈 (pairing+sandbox+allowlist+scoping) |
| **资源占用** | >1GB + Node.js | ~500MB + Node.js | <5MB 单二进制 |
| **部署** | Mac/Linux/Docker | Mac/Linux/Desktop | ARM/x86/RISC-V/Docker/$10 硬件 |

### 3.2 可观测性 + 调试

| 维度 | 内容 |
|------|------|
| **核心概念** | Trace / Logging / 链路追踪 / Health Check / Doctor 诊断 |
| **要回答的问题** | Agent 挂了怎么排查？怎么做到"Agent 自我修复"？ |
| **来源** | [AN-EV] Observability/Tracing · Muse docs/muse-trace.md |
| **实践** | 实现 Muse 的 3 层健康检测 + AI Health Insight |
| **自媒体** | 「Agent 的自我修复：Muse 怎么实现"遇到问题主动告诉你"」 |
| **验证** | [OC] Doctor + Logging · [OD] Trace Reader (events/tool-calls/traces) + Plugin Hooks (46+) · [ZC] zeroclaw doctor + channel doctor + status |

### 3.3 多通道集成

| 维度 | 内容 |
|------|------|
| **核心概念** | Perception / Ingress / Channel Adapter / 多模态 (文字/图片/语音/视频) |
| **要回答的问题** | 怎么让一个 Agent 同时服务 Telegram + Web + 语音？ |
| **来源** | [AN-VOI] Voice Agents · [OC] 22 通道实现 · [ZC] Channel trait |
| **实践** | Muse 的 TelegramSense + WebCockpit + 语音通道 |
| **自媒体** | 「Agent 的感知层：一个 Agent 怎么同时听懂文字、看懂图片、听懂语音」 |

### 3.4 部署 + 资源效率

| 维度 | 内容 |
|------|------|
| **核心概念** | Edge 部署 / Docker 沙箱 / Ollama 本地模型 / Tunnel (Tailscale/ngrok/Cloudflare) |
| **要回答的问题** | 怎么在 $10 的硬件上跑 Agent？本地 vs 云端怎么选？ |
| **来源** | [ZC] Benchmark 数据 · [OC] Tailscale/Docker 部署 |
| **实践** | Muse 在 Raspberry Pi 上跑 · 对比本地 Ollama vs 云端 API |
| **自媒体** | 「$10 跑 AI Agent：ZeroClaw 在树莓派上的极限测试」 |

### 3.5 Identity / Persona / 成长

| 维度 | 内容 |
|------|------|
| **核心概念** | 人格系统 / MBTI / 性格滑块 / 记忆积累 → 性格塑造 / AIEOS 标准 |
| **要回答的问题** | 怎么让 Agent 有"个性"？个性应该是静态的还是动态成长的？ |
| **来源** | [OC] SOUL.md + IDENTITY.md 模板 · [ZC] Identity trait (openclaw/aieos) · Muse 现有实现 |
| **实践** | Muse 的 Identity 三层合并 + MBTI 性格系统 |
| **自媒体** | 「AI 伙伴的灵魂：Muse 怎么让每个 Agent 都独一无二」 |

### 3.6 失败模式 + 恢复策略

| 维度 | 内容 |
|------|------|
| **核心概念** | 10 大失败模式 · Fallback Model · Context Compaction · Oracle Correction · Retry Policy |
| **要回答的问题** | Agent 的典型失败有哪些？怎么优雅恢复？ |
| **来源** | make-muse/agent-research-map.md 失败模式汇编 · [BEA] 失败恢复 |
| **实践** | Muse 的 3 层降级路径 (成功/失败/无通道) |
| **自媒体** | 「Agent 的 10 种死法：我从 3 个开源项目学到的失败恢复策略」 |
| **验证** | [OC] Model Failover + Session Pruning + Retry Policy · [OD] Preemptive Compaction · [ZC] Reliability config + hot-reload |

---

## 全景图总览

```
Phase 1: 为什么能 Agent (3-4w)          Phase 2: 怎么构建 (4-6w)              Phase 3: 真实世界 (4-6w)
────────────────────────                ────────────────────────              ────────────────────────
1.1 Transformer ─────────────────┐     2.1 Prompt Engineering ──────────┐   3.1 Runtime 架构比较
1.2 Tokenization (BPE)           │     2.2 Tool Use / MCP              │   3.2 可观测性 + 调试
1.3 训练管线 (PT→SFT→RLHF)       │     2.3 Context Engineering        │   3.3 多通道集成
1.4 推理优化 (KV Cache/Flash)    │     2.4 Memory 架构                 │   3.4 部署 + 资源效率
1.5 Model Inside + Reasoning     │     2.5 Multi-Agent 编排            │   3.5 Identity / Persona
1.6 Agent 核心定义               └──→  2.6 Reflection + 评估           │   3.6 失败模式 + 恢复
                                       2.7 Guardrails / HITL / 安全    └──→ 
                                       
    ↓ 来源: LH25/26, LFS,                ↓ 来源: BEA, AN-AG, SWARM,         ↓ 来源: OC, OD, ZC
    NGPT, MBPE, MIT, OR1                  PEG, ABC, HELLO, LCC,              + 所有理论来源
                                          MOOC, ABI, HF
```

### 关键发现 🔑

1. **李宏毅 2026 Spring 用 OpenClaw 做教学案例**（"解剖小龙虾"），这是理论和实践的完美桥梁
2. **ZeroClaw 的 Memory 实现是零外部依赖**（SQLite + FTS5 + 自制 vector search），值得深度拆解
3. **三个项目的安全模型差异巨大**：OpenClaw 靠 DM pairing，ZeroClaw 全栈防御，OpenCode 靠 Plugin 权限拦截
4. **吴恩达的核心观点"评估是 Agent 成功的最大预测指标"**贯穿所有三个项目的 Doctor/Status/Health 设计

---

## 理论 → reference 项目覆盖矩阵

| 理论节点 | user/reference 来源 | openclaw [OC] | opencode [OD] | zeroclaw [ZC] |
|---------|---------------------|---------------|---------------|---------------|
| Transformer | [LFS] [NGPT] [MIT] | — | — | — |
| Tokenization | [MBPE] | — | — | — |
| 训练管线 | [LFS] [OR1] [LH25] | — | — | — |
| 推理优化 | [LH26] | — | — | — |
| Reasoning | [LH25] [OR1] | — | — | — |
| Agent 定义 | [BEA] [AN-AG] [LH26] | ✅ Pi Agent | ✅ Session Engine | ✅ daemon |
| Prompt Eng | [PEG] [AN-AG] [ABC] | ✅ AGENTS/SOUL/TOOLS | ✅ system-prompt Hook | ✅ Identity trait |
| Tool Use/MCP | [AN-AG] [AN-MCP] [ABC] | ✅ Skills+ClawHub | ✅ MCP Server | ✅ Tool trait |
| Context Eng | [LH26] [AN-AG] | ✅ Session Pruning | ✅ Compaction Hook | ✅ Memory chunking |
| Memory | [AN-MEM] [HELLO] | ✅ Session model | ✅ Memory MCP | ✅ SQLite hybrid |
| Multi-Agent | [SWARM] [BEA] [AN-AG] | ✅ sessions_send | ✅ Sisyphus | ✅ delegate |
| Reflection | [AN-AG] | 部分 | 部分 | 部分 |
| 评估 | [AN-EV] [LH25] | ✅ Doctor | ✅ Trace Reader | ✅ doctor |
| Guardrails | [BEA] [ABI] | ✅ pairing+sandbox | ✅ permission.ask | ✅ 全栈安全 |
| 多通道 | [AN-VOI] | ✅ 22 通道 | ✅ TUI+REST | ✅ 17 通道 |
| 部署/边缘 | [ZC] 自身 | Docker/Nix | Desktop app | ✅ $10 硬件 |
| Identity | [OC] 模板 | ✅ SOUL.md | — | ✅ Identity trait |
| 失败恢复 | [BEA] agent-research-map | ✅ Model Failover | ✅ Compaction | ✅ Reliability |

### 全景图空白区（有理论，项目没覆盖）

1. **Transformer/训练/Tokenization** — 纯底层理论，三个 Agent 项目不涉及（正常，它们是应用层）
2. **Reflection 模式** — 三个项目都只有"部分"实现，没有显式的 Self-Reflection 循环
3. **Formal Planning (搜索式规划)** — 理论有但没有项目采用（都是 LLM 自然规划）

### 全景图被补充（项目有，全景图原来没有）

1. **Hardware Tools** — [ZC] 有 hardware tools，全景图原来没有覆盖"软硬件结合"
2. **Heartbeat/Cron 自动任务** — [OC] cron+wakeups, [ZC] HEARTBEAT.md，是 Agent 主动性的关键
3. **Hot Reload 配置** — [ZC] 支持运行时配置热更新，是生产级特性
4. **Browser/Computer Use** — [OC] 和 [ZC] 都有，是 Agent 自主操作 GUI 的前沿方向

> 这些补充点已融入 Phase 3 的相关章节中。
