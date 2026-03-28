# Muse RDD 总览：目标 + Sprint + 每日计划

> **4 个月 = 8 个 Phase = ~80 天**  
> **总目标 A：** 完成 Muse 的 3 个锚点场景 MVP（日常对话 / 任务协作 / 审批治理）+ S2b 自开发闭环  
> **总目标 B：** 形成可面试展示的项目证明包（demo + postmortem + 技术博客）  
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

## Phase → Sprint → Day 映射

```
                         你做什么                    AI 并行做什么
Phase 0  Sprint 1  (01-10)  学理论+吸收            │ ├─ 测 Muse 现有链路，发现 Bug
                             ← 你在这里           │ ├─ 预跑 Spike 1 概念验证
                                                  │ └─ 坑点报告: notify_planner 可靠性
Phase 1  Sprint 2  (11-20)  案例剖析+深化          │ ├─ Spike 1 (Core Loop) 原型
                                                  │ ├─ Spike 2 (Memory) 概念验证
                                                  │ └─ Handoff 可靠性修复验证
Phase 2  Sprint 3  (21-30)  设计原则+场景锚定      │ ├─ Spike 3 (Handoff) 原型
                                                  │ └─ S3 审批流程预建
Phase 3  Sprint 4-5 (31-50) 你动手 Spike（路已清）  │ ← 你接手时 Spike 已预验过
Phase 4  Sprint 6   (51-60) 架构重设计              │
Phase 5  Sprint 7   (61-70) S1/S2/S3 + S2b 跑通   │ ← 📱 手机指挥 Muse 干活!
Phase 6-7 Sprint 8  (71-80) Eval + Portfolio       │
```

---

## Sprint 1 每日计划总表（Day 01-10）

> **Sprint 目标：** 吃透 Agent Core Loop + Multi-Agent 编排理论，跑通 1 个 demo  
> **退出条件：** 能用自己的话解释 10 个 Agent 核心概念  
> **详细内容：** `user/sprint-1.md`  
> **研究材料：** `user/research/` 下对应编号的文件

| Day | 主题 | AI 先交付 | 你来做 | OC 关联 | Muse 实战 |
|-----|------|----------|-------|---------|----------|
| **01** | Anthropic BEA 精读 | 01a(精读笔记) + 01b(面试) + 01c(Cookbook) + 01e(ReAct+Weng) | 吸收 + ACI 审计 | — | ACI 审计 |
| **02** | 多 Agent + Orchestrator | 02(编排模式详解+代码+Muse映射) | 吸收 + 复述 + 判断 | Agent 系统(Session隔离) | harness 代码审查 |
| **03** | OpenAI + Google 模式 | 03(跨厂商对比表+S3设计) | 吸收 + S3 审批方案判断 | MCP 配置解读 | S3 vs Permission 对比 |
| **04** | Swarm 源码走读 | 04(Swarm核心100行+Handoff协议) | 跑 Swarm demo + 吸收 | Hook 系统(46+) | Handoff 对比 |
| **05** | LangGraph 概念 | 05(Graph+State+Checkpoint+状态图) | 吸收 + 跑 LangGraph demo | Compaction 压缩 | 状态机设计 |
| **06** | CrewAI 概览 | 06(Role/Task+角色卡片+Prompt组装) | 吸收 + 判断哪种更适合 Muse | System Prompt 组装 | 角色卡片审查 |
| **07** | Prompt Engineering | 07(7层结构+pua prompt骨架+模板对比) | 吸收 + 判断 Muse prompt 改进 | Prompt 模板对比 | pua prompt 审查 |
| **08-09** | 总结 + Design Principles 草稿 | 汇总所有发现 + Spike 输入清单 | 审核 + 判断优先级 | Session Engine 走读 | Muse 设计原则草稿 |
| **10** | Sprint 1 复盘 | mini-eval 自检题 | 回答 + 复盘 | — | sprint-1-retro.md |

---

## Sprint 2 每日计划预览（Day 11-20）

> **Sprint 目标：** Memory 深化 + Prompt 实战 + 工具设计 + Eval 框架  
> **退出条件：** research-map v2 覆盖 ≥6 案例 + 跑通 ≥2 个开源项目 demo  
> **详细内容：** `user/sprint-2.md`（待创建）

| Day | 主题 | 关键内容 | OC 关联 |
|-----|------|---------|---------|
| 11 | Memory 分层设计 | 短期/长期/语义记忆 + Muse memory.mjs 审查 | Hook 系统 + Plugin |
| 12 | RAG 基础 | 向量检索 + Embedding + Muse 检索改进 | — |
| 13 | Tool/Function Calling 深入 | 多平台对比 + MCP 工具规范 v2 | MCP 进阶 |
| 14 | Vercel AI SDK 走读 | streamText + tool() + Provider 模式 | SDK Reference |
| 15 | Pydantic AI 走读 | 类型安全 Agent + Result 验证 | — |
| 16 | Prompt 实战 | 写 Muse pua prompt v1 + 测试 | System Prompt 深入 |
| 17 | OpenCode Sisyphus 协议 | 多 Agent 编排核心 | Sisyphus 深度拆解 |
| 18 | Claude Code ACI 行为观察 | 工具设计最佳实践 | Custom Tools |
| 19-20 | Design Principles 定稿 + Sprint 2 复盘 | 原则v2 + Spike输入清单最终版 | — |

---

## Sprint 3-8 里程碑总览

| Sprint | Phase | 你做什么 | AI 并行做什么 | 里程碑 |
|--------|-------|---------|------------|--------|
| **3** | 2+2.5 | 设计原则定稿 + 3 场景锚定 | Spike 3 原型 + S3 预建 | 🎯 设计收敛 |
| **4** | 3 | 你接手 Spike 1+2（路已清） | 你做的同时 AI 测边缘用例 | 🧪 动手写代码 |
| **5** | 3 | 你接手 Spike 3 (Handoff) | 端到端集成测试 | 🧪 3 Spike 至少 2 pass |
| **6** | 4 | 架构重设计 + 资产矩阵 | 重构代码 + 回归测试 | 📐 架构定稿 |
| **7** | 5+6 | S1/S2/S3/S2b 端到端跑通 | Eval 框架 + 基准测试 | 🚀 **Muse Basic v1** + 📱手机指挥 |
| **8** | 7 | Portfolio + 博客 + 面试 | 文档整理 + demo 录制 | 📦 可面试 |

---

## 3 个锚点场景（所有工作的北极星）

| 场景 | 一句话 | 验收标准 |
|------|-------|---------|
| **S1** 日常对话 | Later 和 pua 聊天，pua 记住过去、有性格、主动问候 | 多轮对话 + 跨 session 记忆 + 人格一致 |
| **S2** 任务协作 | Later 让 planner 安排 arch/coder 完成代码任务 | Handoff 成功 + Worker 独立执行 + 结果回传 |
| **S3** 审批治理 | 高风险动作需要 Later 审批 | 拦截 → 审批请求 → 批准/拒绝 → 执行/阻止 |

---

## 文件导航

| 文件 | 内容 |
|------|------|
| `user/Research-Driven Development.md` | RDD 方法论全文（Phase 定义 + Exit Criteria） |
| `user/map.md` | 知识-功能映射 |
| `user/sprint-1.md` | Sprint 1 每日详细计划 |
| `user/research/README.md` | 研究手册（6轨道 + 方法论 + 参考仓库） |
| `user/research/01-07*.md` | Day 1-7 完整研究材料 |
