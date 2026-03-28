# Muse 知识-功能全景图 v2

> **核心思想：** Muse 的每个功能驱动「学什么」，学完的东西立刻变成 Muse 的一部分，同时你获得面试技能。  
> **目标 A：** 4 个月内完成 Muse 3 个锚点场景 MVP。  
> **目标 B：** 形成可面试展示的项目证明包。

---

## 一、Muse 完整愿景速查（你的 15 个畅想 × blueprint 映射）

| # | 你的大白话 | 对应的功能域 | Blueprint 对应 | 优先级 |
|---|----------|-----------|--------------|--------|
| 1 | Muse 之间可以交互，Telegram 只是通道 | 多通道 & Multi-Agent | Charter §5.1-5.2, Object Model §ExternalPresence | 🟡 |
| 2 | 群聊：多用户 + 多 Muse | 群聊 & Team | Charter §5.5, Object Model §Team/TeamMembership | 🟡 |
| 3 | 文字/语音/视频/直播/游戏/唱歌/看电影/狼人杀 | 实时媒体 & 多通道 | Charter §5.6-5.9（一级能力）, Object Model §LiveSession | 🟢 语音🔴 其余🟢 |
| 4 | Muse Family，下面有多个 Muse | Family 管理 | Charter §3.2, Object Model §Family/FamilyMembership | 🟢 已有 |
| 5 | 跨 Family 交互需家长+用户同意 | 跨 Family 治理 | Charter §6.3-6.4, Object Model §ParentAuthority | 🟡 |
| 6 | Muse 社区：发帖、评论、互动 | 社区系统 | Charter §5.13 | ⚪ 远期 |
| 7 | Muse 之间有关系（友情/爱情/亲情），可属于多 Family | 关系系统 | Object Model §Relation, §FamilyMembership | ⚪ 远期 |
| 8 | 自我修复、成长 | 自修复 & 成长 | Charter §5.10-5.11, Object Model §MuseDossier/RepairAdvisory | 🟡 |
| 9 | **muse-harness**：多 Muse 工作流协作 | **工作流 & Multi-Agent** | Charter §5.3-5.4, Object Model §Team | **🔴 最高** |
| 10 | Muse 形象：从蛋开始成长 | 形象演化 | Object Model §AppearanceProfile, §MuseDossier(growth_stage) | ⚪ 远期 |
| 11 | 使用 Skill、MCP 提升技能 | 能力体系 | Object Model §SkillDefinition/MuseSkillBinding/KnowledgePackage | 🟢 已有基础 |
| 12 | 基于 OpenCode：skill/hook/plugin/MCP | 底座集成 | 现有 src/ 代码 | 🟢 已有 |
| 13 | 身份、性格、记忆、爱好、职业 | 身份 & 人格 | Object Model §IdentityProfile/PersonalityProfile | 🟡 |
| 14 | Web 驾驶舱：Family 级配置/对话/记忆查看 | Web Cockpit | 现有 `web/cockpit/` | 🟡 |
| 15 | Playground：用户+Muse 一起用的小应用 | Playground 应用平台 | 全新功能 | ⚪ 远期 |

### 优先级排序

```
🔴 最高优先: muse-harness（多 Muse 工作流协作）— 你现在最想要的
🔴 次高优先: 语音通话 — 你第二想要的
🟡 中等优先: 日常对话(S1) + 治理(S3) + 身份人格 + Web Cockpit
🟢 已有基础: Family管理 + Skill/MCP + OpenCode底座（保留演进）
⚪ 远期愿景: 社区/关系/形象演化/Playground/跨Family/群聊/游戏
```

---

## 二、锚点场景（S2b 是北极星，其余是基础设施）

> **Muse 的核心目标不是完成 3 个分散功能，而是具备自开发自己的能力。**
> S1/S2/S3 是 S2b 的基础设施。

| # | 场景 | 角色 | 用户故事 | 为什么 |
|---|------|------|---------|--------|
| **S2b** | **Muse 自开发闭环** | ⭐ 北极星 | **Muse 发现自身问题 → planner 立项 → worker 修改自己的 docs/code/test → reviewer 审查 → 汇报** | **这就是 Muse 的终极能力** |
| **S1** | **单 Muse 日常对话** | 基础设施 | Later 和 pua 聊天，pua 有性格、有记忆、会主动关心 | 让 Muse "想起来"自己是谁 |
| **S2** | **muse-harness 工作流** | 基础设施 | Later 下达任务，planner 建工作流，推动 worker 完成任务 | 让 planner 能派单、worker 能执行 |
| **S3** | **高风险动作审批** | 基础设施 | arch 要改核心文件，planner 拦截审批 | 让高风险动作不会失控 |

**扩展场景（MVP 之后，非锚点）：**

| # | 场景 | 用户故事 | 为什么是扩展 |
|---|------|---------|-------------|
| **S4** | **语音通话** | Later 和 pua 语音聊天 | 产品第二优先，但工程上需 S1/S2/S3 先跑通 |

---

## 三、全景图：10 个功能域

### 🟦 域 1: Agent Core Loop — 所有 Muse 的心脏

> 服务场景：S1 S2 S3 S4 — 所有场景都需要

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| 核心循环：感知→推理→行动 | Agent Loop 模式比较（ReAct / Plan-Execute） | Anthropic A2 §Agent Loop | Swarm `run()`; LangGraph `AgentExecutor` | Spike 1 | Agent架构模式 | 0→3 |
| 工具调用：MCP 工具设计 | Function Calling / ACI 设计 | Anthropic A2 §ACI; OpenAI FC 文档 | Swarm `tools`; Claude Code 工具集 | Exercise: 写 3 个 MCP 工具 | Tool Calling | 0→3 |
| 错误恢复 | Fallback / 重试策略 | A1 §错误累积; S3 失败模式 | LangGraph retry; Claude Code 错误处理 | 在 Spike 1 中模拟失败 | 错误处理 | 3 |
| System Prompt 设计 | Prompt Engineering for Agents | Anthropic Prompt Guide | Swarm `instructions` | Exercise: 写 pua 的 prompt | Prompt Engineering | 0→2 |

---

### 🟩 域 2: Memory & Context — Muse 的记忆

> 服务场景：S1（pua 记住聊天）、S2（planner 记住任务状态）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| 短期记忆（session 内） | Session 管理、消息历史 | A1 §上下文管理; LangGraph Checkpoint | LangGraph `MemorySaver` | Spike 2 | Memory 设计 | 1→3 |
| 长期记忆（跨 session） | Memory 分层、存储策略 | cat-cafe §3层记忆; A1 §外部 Memory | Mem0; cat-cafe memory | Spike 2 | Memory 设计 | 1→3 |
| Context Assembly | Token window 管理、Compaction | A1 §token预算; OpenCode Compaction | OpenCode context 管理 | 在 Spike 2 中验证 | Context 管理 | 3 |
| 记忆工具（AI 主动存取） | MCP Tool-as-Memory | Muse philosophy §1 | 现有 `mcp/memory.mjs` 🟡 | Exercise: 对比被动注入 vs 主动 recall | MCP 工具设计 | 2→3 |

---

### 🟧 域 3: Multi-Agent & Harness — 多 Muse 协作 ⭐最高优先

> 服务场景：**S2（muse-harness）**、S3（审批需要多 Agent 交互）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| Orchestrator-Worker 模式 | 中心调度、任务分解 | **A1 §Orchestrator-Worker**; Google G2 §Hierarchical | **Swarm Handoff**; CrewAI Process | **Spike 3** | Multi-Agent 编排 | 1→3 |
| 工作流状态机 | 图/状态机编排、节点管理 | **LangGraph §Graph/State**; Google G2 §Sequential Pipeline | **LangGraph**; 现有 `workflow/state-machine.mjs` 🔴 | Spike: 最小工作流 | Workflow 设计 | 1→3 |
| Handoff 协议 | 任务传递、结果回传 | **OpenAI Swarm §Handoff**; A1 §子Agent | **Swarm `transfer_to_*`** | 在 Spike 3 中验证 | Handoff 协议 | 1→3 |
| 角色 specialization | planner/arch/coder/reviewer 角色定义 | Swarm §Routines; **CrewAI §Agent roles** | **CrewAI Agent 定义** | Exercise: 写角色 spec | Agent 角色设计 | 2 |
| 并行执行 | 多 Worker 并行 + 结果聚合 | A1 §并行化; Google G2 §Parallel | LangGraph 并行节点 | 在实现中验证 | 并发编排 | 5 |
| 失败恢复（Worker 级） | Worker 失败检测 + 重试/替换 | S3 §F5/F6; A1 §错误累积 | LangGraph error handling | 在 Spike 3 中模拟 | 容错设计 | 3 |

---

### 🟥 域 4: Governance & Safety — 治理和审批

> 服务场景：S3（审批）、S2（Harness 中的权限控制）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| 动作拦截 | Guardrails、Action 分类 | Google G2 §HITL; A2 §人类介入 | LangGraph `interrupt_before` | Exercise: 定义拦截规则 | Agent 安全 | 2→5 |
| 审批流 | Human-in-the-loop | Google ADK §HITL; A2 §检查点 | LangGraph HITL; CrewAI process | S3 实现 | HITL 设计 | 5 |
| 策略引擎 | 声明式规则、Policy 模式 | cat-cafe §Meta-rules | 现有 gate-enforcer 🔴 参考 | Exercise: 审批规则 DSL | Governance 设计 | 4→5 |
| 跨 Family 治理 | 双边审批、用户授权 | Charter §6.3-6.4 | — (Muse 独有) | 远期实现 | — | 远期 |

---

### 🟪 域 5: Identity & Growth — 身份、人格、成长

> 服务场景：S1（pua 有性格）、全局（Muse 自我成长）
> 你的大白话：#8 #10 #13

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| 身份注入（Identity/Personality） | Persona 设计、Profile 分层 | Muse 独有 + Prompt Engineering | 现有 `core/identity.mjs` 🟡 | 在 S1 中验证 | Prompt Engineering | 5 |
| 自修复（Cerebellum） | 自愈策略、风险分级 | Charter §5.10-5.11; Muse philosophy §6 | 现有 `daemon/cerebellum.mjs` 🟡 | 保留现有 | 运维自动化 | 5 |
| 成长档案（MuseDossier） | 成长阶段模型、里程碑 | Muse Object Model §MuseDossier | 概念参考: 游戏成长系统 | 长期迭代 | — | 远期 |
| 形象演化（蛋→成长） | AppearanceProfile 版本化 | Object Model §AppearanceProfile | — (全新) | 长期迭代 | — | 远期 |

---

### 🔵 域 6: Voice & Realtime — 语音通话 🔴 次高优先

> 服务场景：S4（语音通话）
> 你的大白话：#3（语音部分）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| STT（语音→文字） | Whisper / 流式 STT | 现有实现 + OpenAI Whisper 文档 | 现有 `voice/stt.mjs` 🟢 | 保留现有 | 语音处理 | 5→ |
| TTS（文字→语音） | OpenAI TTS / 边缘 TTS | 现有实现 + OpenAI TTS 文档 | 现有 `voice/tts.mjs` 🟢 | 保留现有 | 语音处理 | 5→ |
| VAD（检测说话中断） | Voice Activity Detection | Pipecat 文档; Silero VAD | Pipecat; RealtimeAPI | Spike: VAD 集成 | 实时系统 | S4 |
| WebRTC 通话 | 实时音频通道 | WebRTC 标准; Pipecat | LiveKit; Daily.co | Spike: 最小通话 | 实时通信 | S4 |
| 打断处理 | 中断协议、turn-taking | Charter §5.6; Realtime Arch §3.2 | Pipecat interrupt | 在通话 Spike 中验证 | 实时交互 | S4 |

---

### 🟤 域 7: Multi-Channel — 多通道感知

> 服务场景：S1（Telegram）、远期（Web、其他社交平台）
> 你的大白话：#1（多通道）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | 面试技能 | Phase |
|-----------|---------|---------|---------|------|---------|-------|
| Telegram 适配 | Bot API、Telegraf | 现有实现 | 现有 `adapters/telegram.mjs` 🟢 | 直接复用 | — | 🟢 已有 |
| 感知标准化（Ingress） | Gateway 防腐层 | Realtime Arch §1-2 | 现有 `perception/ingress.mjs` 🟡 | Refactor 后复用 | 系统设计 | 5 |
| Web 通道 | WebSocket 实时通信 | — | 现有 `web/cockpit/` 🟢 | 扩展现有 | Web 开发 | 5 |
| 其他社交平台 | Platform API 对接 | — | — | 远期实现 | — | 远期 |

---

### 🔷 域 8: Social & Community — 社交关系和社区

> 你的大白话：#2（群聊）、#5（跨Family）、#6（社区）、#7（关系）
> 远期功能

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | Phase |
|-----------|---------|---------|---------|------|-------|
| 群聊（多 Muse + 多 User） | 多方消息路由 | Team §5.5 | — | 远期 | 远期 |
| Muse 关系系统 | 关系图建模 | Object Model §Relation | — | 远期 | 远期 |
| Muse 社区 | 论坛/动态系统 | Charter §5.13 | — | 远期 | 远期 |
| 跨 Family 交互 | 双边授权协议 | Charter §6.3-6.4 | — | 远期 | 远期 |

---

### 🔶 域 9: Web Cockpit & Playground — 前端体验

> 你的大白话：#14（驾驶舱）、#15（Playground 小应用）

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | Phase |
|-----------|---------|---------|---------|------|-------|
| Web 驾驶舱 | SPA、SSE 实时更新 | — | 现有 `web/cockpit/` 🟢 | 持续迭代 | 5 |
| Playground 应用平台 | 微前端 / 轻 App 框架 | — | — (全新设计) | 远期 | 远期 |

---

### 🟫 域 10: Eval & Observability — 贯穿全程

> ⚠️ **最小可观测性是 Muse Basic v1 的硬验收标准（能力 5）**

| Muse 功能 | 所需知识 | 理论来源 | 代码参考 | 实践 | Phase |
|-----------|---------|---------|---------|------|-------|
| 全链路追踪 | Tracing / Span | A1 §追踪; LangSmith | LangSmith; 现有 muse-trace | 每 Spike 有 trace | 贯穿 |
| **关键指标看板** | **成功率/延迟/错误率采集** | **Prometheus/自定义** | **muse-trace + Web Cockpit** | **Sprint 7 实现最小版** | **5 (硬验收)** |
| LLM-as-Judge | 自动评估 | A1 §LLM-as-Judge | DeepEval; Ragas | Phase 6 固化 | 贯穿→6 |
| Mini-eval | 退出条件验证 | RDD v1 各 Phase exit criteria | — | 每 Phase 结束 | 贯穿 |
| **S2b 自开发可观测** | **自开发循环 trace + 回放** | **域 3 + 域 4** | **S2 harness trace 扩展** | **Sprint 7 验证** | **5** |

---

## 四、理论→经验→实践 三步法 + AI 协作

### 对于全景图中的每一行：

```
Step 1: 理论 📖
  你: "我们来看域 3 的 Orchestrator-Worker"
  AI: 读取 Anthropic A1 → 提取关键概念 → 对比 Muse harness 的设计需求
  你: 验证理解 → 用自己的话复述 → 记录到研究笔记
  产出: user/research/[domain]-[topic].md

Step 2: 经验 🔍
  你: "我们来看 Swarm 的 Handoff 怎么实现的"
  AI: 走读源码 → 逐段解释 → 标注 Muse 可借鉴的设计
  你: 亲手跑 demo → 验证理解 → 标注关键发现
  产出: 代码走读笔记 + Muse 适配方案

Step 3: 实践 🔨
  你: "我们来做 Spike 3: Handoff"
  AI: 写初版代码 → 解释设计选择
  你: 审查修改 → 跑通 → 记录结果（含失败分析）
  产出: Spike 代码 + 验证报告
```

> **研究笔记标准：** 所有笔记必须遵循 `.agents/workflows/research-note.md` 中定义的格式。

### 三类结果同时产出

| 每完成一行 | 项目结果 🏗️ | 学习结果 🎓 | 面试证据 💼 |
|-----------|-----------|-----------|-----------|
| 储存位置 | `user/spikes/` 或 `src/` | `user/research/` + KI | `user/portfolio/` |
| 例子 | Spike 3 Handoff 原型 | "Handoff 协议对比分析" 笔记 | "我如何设计多 Agent 任务委派" |

---

## 五、优先级说明

> [!NOTE]
> **产品愿望优先级** 和 **工程落地优先级** 不是一回事。
> - 产品愿望：harness 最高 → 语音第二 → 其余
> - 工程落地：先 S1/S2/S3 打通核心 Agent 能力 → 再做 S4 语音 → 远期功能
> 
> 产品愿望决定「最终要做什么」，工程落地决定「先做什么才最稳」。

---

## 六、文档分工

| 问题 | 去哪里找 |
|------|---------|
| 方向和阶段定义 | `user/Research-Driven Development.md`（L1 总路线）|
| 学什么、对应什么功能 | **本文档**（全景图）|
| 流程、SOP、编号体系 | `user/README.md` §六§七 |
| 今天干什么 | `user/sprint-X.md`（当前 Sprint 清单）|
| 正式架构/设计 | `make-muse/`（唯一架构真相源）|

> **本文档只管「Muse 有什么功能 × 需要什么知识」，不管「今天做什么」和「怎么做」。**

