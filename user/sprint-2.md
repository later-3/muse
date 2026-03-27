# Sprint 2：Memory + 案例补全 + Prompt 深化

> **Sprint 目标：** 完成 Memory 和 Prompt Engineering 的理论研究，补全剩余案例，完成 research-map v2。  
> **服务于：** 全景图域 2（Memory）+ 域 1 补全（Prompt）+ 域 3 补全（角色定义）  
> **前置条件：** Sprint 1 完成

---

## 每日任务清单

### 第 1 天：Memory 理论研究

- [ ] 精读 cat-cafe 3 层记忆架构
- [ ] 精读 Anthropic 指南中「外部 Memory」相关章节
- [ ] 产出研究笔记：`user/research/memory-architecture-patterns.md`
- [ ] 沉淀：短期 vs 长期 vs 共享记忆的区别，对 Muse 的适用性

### 第 2 天：LangGraph 深度走读

- [ ] 走读 LangGraph 核心：Graph 状态机、Checkpointer、MemorySaver
- [ ] 跑通 LangGraph 的 Agent + Memory demo
- [ ] 产出走读笔记：`user/research/langgraph-deep-dive.md`
- [ ] 沉淀：LangGraph 的状态管理模式对 Muse harness 的启发

### 第 3 天：CrewAI 角色模式走读

- [ ] 走读 CrewAI：Agent 角色定义、Task 委派、Process 模式
- [ ] 对比 CrewAI 角色和 Muse 的 planner/arch/coder/reviewer
- [ ] 产出走读笔记：`user/research/crewai-role-patterns.md`
- [ ] 沉淀：写 planner/arch/coder/reviewer 的角色 spec 草案

### 第 4 天：Prompt Engineering 深化

- [ ] 精读 Anthropic/OpenAI 的 Prompt 指南（Agent 专项）
- [ ] 实验：写 pua 的 system prompt，对比不同写法效果
- [ ] 实验：写 3 个 MCP 工具的 description，测试 LLM 调用准确率
- [ ] 产出：`user/research/prompt-engineering-for-agents.md`

### 第 5 天：Claude Code / Cline 分析

- [ ] 分析 Claude Code 的工具设计和上下文管理策略
- [ ] 标注 Muse 可借鉴的错误恢复和工具设计
- [ ] 产出：`user/research/claude-code-analysis.md`

### 第 6 天：cat-cafe-tutorials 分析

- [ ] 精读 cat-cafe 的多 Agent 协作实现
- [ ] 重点关注 Session 隔离、失败模式、记忆管理
- [ ] 产出：`user/research/cat-cafe-analysis.md`

### 第 7-8 天：research-map v2 整合

- [ ] 把 Sprint 1+2 的所有研究整合到 `user/research/agent-research-map-v2.md`
- [ ] 加入证据分级（高共识 / 有分歧 / 仅特定场景）
- [ ] 确保覆盖 ≥6 个案例
- [ ] 校准 philosophy.md，标注哪些原则得到验证、哪些需要修改

### 第 9 天：Design Principles v1 定稿

- [ ] 从所有研究中提炼设计原则（每条追溯 ≥2 个案例）
- [ ] 产出：`user/design-principles-v1.md`

### 第 10 天：Sprint 2 复盘 + Phase 0+1 退出评审

- [ ] mini-eval 自检：
  - [ ] research-map v2 覆盖 ≥6 案例 + 证据分级？
  - [ ] 跑通 ≥2 个 demo（Swarm + LangGraph）？
  - [ ] 能口述 10 个 Agent 核心概念？
  - [ ] Design Principles v1 每条有 ≥2 案例支撑？
- [ ] 写复盘：`user/sprint-2-retro.md`
- [ ] **判断：Phase 0+1 退出条件是否达标？**

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/research/memory-architecture-patterns.md` | [ ] |
| 2 | `user/research/langgraph-deep-dive.md` | [ ] |
| 3 | `user/research/crewai-role-patterns.md` | [ ] |
| 4 | `user/research/prompt-engineering-for-agents.md` | [ ] |
| 5 | `user/research/claude-code-analysis.md` | [ ] |
| 6 | `user/research/cat-cafe-analysis.md` | [ ] |
| 7 | `user/research/agent-research-map-v2.md` | [ ] |
| 8 | `user/design-principles-v1.md` | [ ] |
| 9 | `user/sprint-2-retro.md` | [ ] |
| 10 | LangGraph demo 跑通 | [ ] |

## 不做清单

- ❌ 不写 Spike 代码（Sprint 3）
- ❌ 不改 Muse 现有代码
- ❌ 不重写 Blueprint（Sprint 5）
