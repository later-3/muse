# Unit 02: 多 Agent 协作

> **对应 Sprint 1 Day 02-04** · Orchestrator + OpenAI/Google + Swarm

## 学习目标

1. Orchestrator-Worker 模式怎么工作？
2. OpenAI/Anthropic/Google 三家的 Agent 哲学有什么不同？
3. Swarm 的 Handoff 协议和 Muse 的有什么区别？

## 📖 学习材料

| 文件 | 内容 | 状态 |
|------|------|------|
| `02-study-multi-agent-orchestrator.md` | Orchestrator-Worker + Muse harness | [AI✓] |
| `03-study-openai-google-patterns.md` | 跨厂商对比 + S3 设计 | [AI✓] |
| `04-study-swarm-hooks.md` | Swarm 源码 + Handoff 协议 | [AI✓] |

## 🎯 你的任务

- [ ] harness 流程图 + 编排模式标注
- [ ] S3 审批流程草案
- [ ] Swarm demo 跑通

## 🤖 AI 并行产出

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp02 | `exp02-orchestrator.mjs` | 4/4 ✅ |
| 🧪 exp03 | `exp03-hitl-gate.mjs` | 6/6 ✅ |
| 🧪 exp04 | `exp04-swarm-mini.mjs` | 5/5 ✅ |
| 🔧 R2 | `R2-handoff-timeout.md` | 评估 6/10 |
| 🔧 R3 | `R3-mcp-tool-completeness.md` | 评估 7/10 |
| 🔧 R4 | `R4-prompt-injection-check.md` | 评估 5/10 |
