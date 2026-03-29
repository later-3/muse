# Unit 02: 多 Agent 协作

> **对应 Sprint 1 Day 02-04** · Orchestrator + OpenAI/Google + Swarm

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| Handoff 怎么实现的 | `foundations/F3` §2 (Function Calling) |
| Prompt Injection 怎么防 | `foundations/F15` §3-4 |
| 多 Agent 的 Token 成本 | `foundations/F11` §3 (分词成本) |

## 学习目标

1. Orchestrator-Worker 模式怎么工作？
2. OpenAI / Anthropic / Google 三家 Agent 哲学的区别？
3. Swarm 的 Handoff 协议和 Muse harness 怎么对应？

---

## 📖 学习文档（AI 为你准备）

| 文件 | 内容 | 状态 |
|------|------|------|
| `02-study-multi-agent-orchestrator.md` | Orchestrator-Worker + Muse harness | [AI✓] |
| `03-study-openai-google-patterns.md` | 跨厂商对比 + S3 设计 | [AI✓] |
| `04-study-swarm-hooks.md` | Swarm 源码 + Handoff 协议 | [AI✓] |

## 🎯 你的任务

- [ ] harness 流程图 + 编排模式标注
- [ ] S3 审批流程草案
- [ ] Swarm demo 跑通

## 🤖 AI 并行任务

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp02 | `exp02-orchestrator.mjs` | 4/4 ✅ |
| 🧪 exp03 | `exp03-hitl-gate.mjs` | 6/6 ✅ |
| 🧪 exp04 | `exp04-swarm-mini.mjs` | 5/5 ✅ |
| 🔧 R2 | `R2-handoff-timeout.md` | 评估 6/10 |
| 🔧 R3 | `R3-mcp-tool-completeness.md` | 评估 7/10 |
| 🔧 R4 | `R4-prompt-injection-check.md` | 评估 5/10 |

## 🔧 OC 基础小任务（学了就练）

| # | 任务 | 练什么 | 状态 |
|---|------|--------|------|
| oc04 | 用 OC 创建两个 session，A 的输出喂给 B | 多 session 编排 | [ ] |
| oc05 | 实现一个简易 Handoff：A 遇到代码问题 → 切到 B | Handoff 模式 | [ ] |
| oc06 | 用 OC Plugin hook 拦截消息，做审批 Gate | Hook + 审批 | [ ] |

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 harness 多 Agent 流程，标注 Muse 用了哪几种模式 | [ ] |
| **学习助手** | V1 加上下文索引（索引表 + load_context 按需加载） | [ ] |
