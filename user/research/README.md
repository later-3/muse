# Sprint 1 研究产出索引

> **命名规则：** `DD-类型-主题.md`  
> DD = 天数（01-10），类型 = `study`(精读/走读) | `muse`(Muse 小任务)  
> 每天最多产出 2 个文件：1 个 study + 1 个 muse

---

## 你的学习路径（按顺序）

```
Day 01  精读 Anthropic《Building Effective Agents》
        → 学 Agent vs Workflow、5 种编排模式、ACI 工具设计
        → 然后审查 Muse MCP 工具

Day 02  精读 Anthropic《Multi-Agent Research System》
        → 学 Orchestrator-Worker 实战、并行化、Eval
        → 然后画 Muse harness 流程图

Day 03  精读 OpenAI Agents 指南 + Google ADK 模式
        → 学 Handoff、Guardrails、HITL
        → 然后画 S3 审批流程

Day 04  走读 OpenAI Swarm 源码 + 跑 demo
        → 学 run() 循环、Agent 类、Handoff 工具
        → 然后设计 Muse Handoff 协议

Day 05  学习 LangGraph 概念 + 跑 demo
        → 学 Graph 状态机、Checkpointer
        → 然后画 S2 工作流状态图

Day 06  概览 CrewAI 角色和任务模式
        → 学角色定义、Task 委派
        → 然后写 Muse 4 个角色的角色卡片

Day 07  精读 Prompt Engineering 指南
        → 学 Agent Prompt 结构、反模式
        → 然后画 pua System Prompt 结构

Day 08-09  整理总结 + Design Principles 草稿
Day 10     Sprint 1 复盘 + mini-eval
```

---

## 文件清单

### 📖 精读/走读笔记 (study)

| 文件 | 天 | 主题 | 状态 |
|------|---|------|------|
| `01a-study-anthropic-bea.md` | 1 | Anthropic BEA 主笔记（概念+精读+Muse 思考） | ✅ |
| `01b-study-anthropic-bea-projects.md` | 1 | BEA 面试准备 + 开源项目分析 | ✅ |
| `02-study-anthropic-multi-agent.md` | 2 | Anthropic Multi-Agent Research 精读 | ⬜ |
| `03-study-openai-google-patterns.md` | 3 | OpenAI + Google Agent 模式对比 | ⬜ |
| `04-study-swarm-walkthrough.md` | 4 | Swarm 源码走读 | ⬜ |
| `05-study-langgraph-overview.md` | 5 | LangGraph 概念 + Demo | ⬜ |
| `06-study-crewai-overview.md` | 6 | CrewAI 概览（记在笔记中） | ⬜ |
| `07-study-prompt-engineering.md` | 7 | Agent Prompt Engineering 精读 | ⬜ |

### 🎯 Muse 小任务 (muse)

| 文件 | 天 | 任务 | 服务 Spike/场景 | 状态 |
|------|---|------|----------------|------|
| `01-muse-aci-audit.md` | 1 | 审查 Muse MCP 工具的 ACI 设计 | Spike 1 工具设计 | ⬜ |
| `02-muse-harness-flow.md` | 2 | harness 流程图 + 编排模式标注 | Spike 3 Handoff | ⬜ |
| `03-muse-s3-approval-draft.md` | 3 | S3 审批流程草案 | S3 审批 | ⬜ |
| `04-muse-handoff-protocol.md` | 4 | Handoff 协议设计草案 | Spike 3 Handoff | ⬜ |
| `05-muse-workflow-state.md` | 5 | S2 工作流状态图 (Mermaid) | Spike 3 Handoff | ⬜ |
| `06-muse-role-cards.md` | 6 | 4 个角色的角色卡片 | S2 harness | ⬜ |
| `07-muse-prompt-structure.md` | 7 | pua System Prompt 结构草案 | S1 对话 | ⬜ |

---

> **每天流程：** 先做 study → 再做 muse 小任务 → 最后沉淀  
> **详细 SOP：** 见 `user/README.md` §七
