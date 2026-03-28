# Muse RDD 总览：目标 + Sprint + 每日计划

> **4 个月 = 8 个 Sprint = ~80 天**  
> **核心目标：** 做出一个能自开发自己的 Muse（Self-Development MVP）  
> **支撑能力：** S1 会话记忆 + S2 任务协作 + S3 审批治理 → 共同支撑 S2b 自开发闭环  
> **副目标：** 形成可面试展示的项目证明包（demo + postmortem + 技术博客）  
> **执行哲学：** AI 做重活，你做高价值吸收。放大你的每一分钟。  
> **并行模式：** 你学习的同时，AI 并行做验证/消险/预建。你到手时已是清过的路。

---

## 双轨并行模式

```
你的轨道（学习+判断）:  理论精读 → 吸收 → Muse 设计判断 → 动手实践
AI 的轨道（验证+消险）:  精华提取 → 代码验证 → Bug发现 → 坑点文档 → 预设计

两条轨同时跑，不是你学完了 AI 才开始验证。
你到手时，路已经清过、坑已经标好、代码已经预验过。
```

---

## Sprint → Phase 映射（以实际 sprint-X.md 为准）

```
                          你做什么                    AI 并行做什么
Sprint 1  (01-10) Phase 0  学理论+吸收            │ ├─ 测现有链路 Bug
                            ← 你在这里             │ ├─ 预跑 Spike 1 概念验证
                                                   │ └─ 坑点报告 R1-R6
Sprint 2  (11-20) Phase 1  案例剖析+深化           │ ├─ Spike 1 (Core Loop) 原型
                                                   │ ├─ Spike 2 (Memory) 概念验证
                                                   │ └─ 消险 R7-R10
Sprint 3  (21-30) Phase 3  Spike 1+3 动手验证      │ ← AI 已预验，你接手
Sprint 4  (31-40) Phase 3  Spike 2 + 场景锚定      │ AI 测边缘用例
Sprint 5  (41-50) Phase 4  架构重设计              │ 重构代码 + 回归测试
Sprint 6  (51-60) Phase 5  S1+S2 端到端实现        │ 集成测试
Sprint 7  (61-70) Phase 5  S3+S2b+S4 Spike        │ ← 📱 手机指挥 Muse!
Sprint 8  (71-80) Phase 6+7 Eval + Portfolio       │ 文档整理 + demo 录制
```

> ⚠️ **注意：** Phase 2 (设计原则) 和 Phase 2.5 (场景锚定) 穿插在 Sprint 2-4 中完成，不单独占 Sprint。

---

## Sprint 1 每日计划总表（Day 01-10）

> **Sprint 目标：** 吃透 Agent Core Loop + Multi-Agent 编排理论，跑通 1 个 demo  
> **退出条件：** 能用自己的话解释 10 个 Agent 核心概念  
> **详细内容：** `user/sprint-1.md`  
> **研究材料：** `user/research/` 下对应编号的文件

| Day | 主题 | AI 先交付 | 你来做 | 🧪实验 | 🔧消险 |
|-----|------|----------|-------|-------|-------|
| **01** | Anthropic BEA 精读 | 01a+01b+01c+01e | 吸收 + ACI 审计 | exp01 | R1 notify |
| **02** | 多 Agent + Orchestrator | 02(编排+harness审查) | 吸收 + 复述 | exp02 | R2 handoff |
| **03** | OpenAI + Google 模式 | 03(跨厂商+S3设计) | 吸收 + S3 判断 | exp03 | R3 MCP |
| **04** | Swarm 源码走读 | 04(Swarm+Handoff+Hook) | 跑 demo + 吸收 | exp04 | R4 prompt |
| **05** | LangGraph 概念 | 05(Graph+状态图+压缩) | 跑 demo + 吸收 | exp05 | R5 harness |
| **06** | CrewAI 概览 | 06(角色卡片+Prompt组装) | 吸收 + 判断 | exp06 | R6 memory |
| **07** | Prompt Engineering | 07(7层+pua骨架) | 吸收 + 判断 | exp07 | — |
| **08-09** | 总结 + 设计原则草稿 | 汇总 + Spike 输入清单 | 审核 + 判断 | — | 汇总报告 |
| **10** | Sprint 1 复盘 | mini-eval 题 | 回答 + 复盘 | — | — |

---

## Sprint 2 每日计划预览（Day 11-20）

> **Sprint 目标：** Memory 深化 + Prompt 实战 + 工具设计  
> **退出条件：** research-map v2 覆盖 ≥6 案例 + 跑通 ≥2 个开源项目 demo  
> **详细内容：** `user/sprint-2.md`

| Day | 主题 | 你来做 | 🧪实验 | 🔧消险 |
|-----|------|-------|-------|-------|
| 11 | Memory 分层设计 | 吸收 + memory.mjs 审查 | exp11 | R7 Spike1 预跑 |
| 12 | RAG 基础 | 检索策略判断 | exp12 | R8 Spike2 预跑 |
| 13 | Tool/Function Calling | MCP 规范 v2 | — | R9 Spike3 预跑 |
| 14 | Vercel AI SDK | Provider 判断 | exp14 | — |
| 15 | Pydantic AI | 类型校验判断 | exp15 | — |
| 16 | Prompt 实战 | 写 pua prompt v1 | — | R10 S3 原型 |
| 17 | Sisyphus 协议 | 对比 harness | — | — |
| 18 | Claude Code ACI | 工具最佳实践 | — | — |
| 19-20 | Design Principles + 复盘 | 定稿 + 复盘 | — | Sprint 2 汇总 |

---

## Sprint 3-8 里程碑总览

| Sprint | Phase | 你做什么 | AI 并行做什么 | 里程碑 |
|--------|-------|---------|------------|--------|
| **3** | 3 | **Spike 1 (Core Loop) + Spike 3 (Handoff)** | AI 已预验，你接手 | 🧪 第一行新代码！ |
| **4** | 3+2.5 | **Spike 2 (Memory) + MVP 场景锚定** | 边缘用例测试 | 🧪 3 Spike ≥2 pass |
| **5** | 4 | **Architecture v2 + 资产处置矩阵** | 重构 + 回归测试 | 📐 架构定稿 |
| **6** | 5 | **S1 (日常对话) + S2 (任务协作) 实现** | 集成测试 | 🚀 S1+S2 跑通 |
| **7** | 5 | **S3 (审批) + S2b (自开发闭环) + S4 语音 Spike** | Eval + 基准测试 | 🚀 **Muse Basic v1** + 📱 |
| **8** | 6+7 | **Eval 固化 + Portfolio + 面试准备** | 文档 + demo 录制 | 📦 可面试 |

---

## 北极星：Muse Self-Development MVP

> **Muse 的核心目标不是完成 3 个分散功能，而是具备自开发自己的能力。**
> S1/S2/S3 是 S2b 的基础设施，不是并列的独立目标。

```
北极星: S2b 自开发闭环
  ├─ Muse 发现自身问题
  ├─ planner 自动立项
  ├─ worker 修改自己的 docs/code/test
  ├─ reviewer 审查
  ├─ 高风险修改走审批 (S3)
  ├─ 全链路可追踪
  └─ 汇报给 Later

基础设施:
  S1 会话与记忆  ── 让 Muse "想起来"自己是谁、记住上下文
  S2 任务协作    ── 让 planner 能派单、worker 能执行、结果能回传
  S3 审批治理    ── 让高风险动作不会失控
```

| 能力 | 角色 | 验收标准 | 实现于 |
|------|------|---------|--------|
| **S2b** 自开发闭环 | ⭐ 北极星 | 手机 Telegram 指挥 Muse 修改自己的代码 | Sprint 7 |
| S1 会话记忆 | 基础设施 | 多轮对话 + 跨 session 记忆 + 人格一致 | Sprint 6 |
| S2 任务协作 | 基础设施 | Handoff 成功 + Worker 独立执行 + 结果回传 | Sprint 6 |
| S3 审批治理 | 基础设施 | 拦截 → 审批请求 → 批准/拒绝 → 执行/阻止 | Sprint 7 |
| 可观测性 | 基础设施 | 关键链路 trace，成功率/延迟/错误可查 | Sprint 7 |

---

## 文件导航

| 文件 | 内容 |
|------|------|
| `user/Research-Driven Development.md` | RDD 方法论全文（Phase 定义 + Exit Criteria） |
| `user/overview.md` | **本文件** — 总览地图 |
| `user/map.md` | 知识-功能映射 |
| `user/sprint-1.md` ~ `sprint-8.md` | 各 Sprint 每日详细计划 |
| `user/research/README.md` | 研究手册（方法论 + 参考仓库） |
| `user/research/01-07*.md` | Day 1-7 完整研究材料 |
| `make-muse/ai-parallel-track.md` | AI 并行轨道详细计划（实验 + 消险） |
