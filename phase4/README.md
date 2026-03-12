# Phase 4 — 受控自我开发 + 家族

> **前置**: Phase 3 (主动性 + 自我成长基础) 完成
> **一句话**: 小缪能给自己写功能，她还有了家族成员。

---

## 背景

Phase 3 让 Muse 具备了主动行为和目标管理。Phase 4 将能力拓展到**多 Agent 协作**和**自我进化**——多个 Agent 共享核心记忆但有独立人格，Muse 能自我改进自己的代码和能力。

## 主要内容

### Agent Family (多 Agent 家族)

- 基于 Phase 1 已预留的 `agent_id` 字段
- 每个 Agent 复用同一套基础设施 (OpenCode / Cerebellum / SQLite)
- 独立的 Identity + 独立的情景记忆 + 共享的核心记忆
- 家族成员示例: 小缪 (综合)、工匠 (技术)、书虫 (研究)
- 基于 Sisyphus 6 Pillars 的任务委派协议

### 自主活动引擎

- Background Session — 小缪在空闲时间自主学习/创作
- 产出存储: journal/notebooks/creations/skills
- 和用户的"朋友式分享"

### 受控自我开发 (深化 Phase 2 技能系统)

- develop 能力 ≠ deploy 权力
- Muse 能研究、写 patch、跑测试、生成提案
- 合并和上线需人类审批

### 认知成长

- 回顾对话质量、调整 prompt
- 根据用户反馈自动优化性格参数

## 与其他 Phase 的关系

| Phase | 关系 |
|-------|------|
| Phase 1 | SQLite agent_id 预留 + DI 架构 |
| Phase 2 | 依赖 MCP 工具 + 技能系统 + 自我成长基础 |
| Phase 3 | 依赖 Pulse 引擎 + Goal 系统 |

## 详细设计

- Agent Family 和自我进化见 [ARCHITECTURE.md](../ARCHITECTURE.md) 第七~九章
- Web Family Hub 见 [phase1/t07-web-cockpit/README.md](../phase1/t07-web-cockpit/README.md) Part II
