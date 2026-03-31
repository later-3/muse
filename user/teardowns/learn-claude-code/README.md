# T1: learn-claude-code 拆解

> **项目:** [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) (⭐44k)
> **一句话:** 用 12 个渐进式 Python session，从零构建一个类 Claude Code 的 Agent Harness
> **核心观点:** Agent = 模型 (训练出来的智能), Harness = 代码 (给模型提供工具/知识/权限)
> **源码位置:** `reference/repos/learn-claude-code/`

---

## 全景架构

```
Phase 1: THE LOOP              Phase 2: PLANNING & KNOWLEDGE
  s01 Agent Loop [1 tool]        s03 TodoWrite [5 tools]
      → bash is all you need        → 先列计划再执行
  s02 Tool Use [4 tools]         s04 Subagent [5 tools]
      → dispatch map 扩展            → 子任务隔离，上下文独立
                                  s05 Skill Loading [5 tools]
                                     → 按需加载，不塞 system prompt
                                  s06 Context Compact [5 tools]
                                     → 三层压缩，无限对话

Phase 3: PERSISTENCE           Phase 4: TEAMS
  s07 Task System [8 tools]     s09 Agent Teams [9 tools]
      → 文件持久化 + 依赖图          → JSONL 信箱 + 线程
  s08 Background Tasks [6]      s10 Team Protocols [12 tools]
      → 后台线程 + 完成通知          → 关停 + 计划审批 FSM
                                  s11 Autonomous Agents [14 tools]
                                     → 空闲轮询 + 自动认领
                                  s12 Worktree Isolation [16 tools]
                                     → 任务↔工作树绑定
```

## 核心设计原则

```
1. Loop 不变         — s01 到 s12 的 while 循环一模一样
2. 新能力 = 新工具   — 添加能力只需注册到 dispatch map
3. 模型决定          — 何时调工具、何时停止，由 LLM 决定
4. Harness 不思考    — Harness 只执行，不做决策
```

## Muse 映射总览

| learn-claude-code | Muse 对应 | 文件 |
|-------------------|----------|------|
| s01 agent_loop | engine.sendAndWait | `src/core/engine.mjs` |
| s02 tool dispatch | MCP tool handlers | `src/mcp/` |
| s04 subagent | Harness harnessSend | `src/core/orchestrator.mjs` |
| s06 context compact | OpenCode compaction | OpenCode 内部 |
| s09 agent teams | Muse Harness 多 Agent | `src/core/orchestrator.mjs` |

---

## 拆解笔记

| Session | 主题 | 状态 |
|---------|------|------|
| [s01](s01-agent-loop.md) | Agent Loop — 一个 while 循环就是 Agent | [AI✓] |
| [s02](s02-tool-use.md) | Tool Use — dispatch map 扩展工具 | [AI✓] |
| [s04](s04-subagent.md) | Subagent — 上下文隔离的子任务 | [AI✓] |
| [s06](s06-context-compact.md) | Context Compact — 三层压缩策略 | [AI✓] |
| [s09](s09-agent-teams.md) | Agent Teams — JSONL 信箱多 Agent | [AI✓] |
| s03 | TodoWrite — 计划能力 | [ ] |
| s05 | Skill Loading — 按需知识注入 | [ ] |
| s07 | Task System — 持久化任务图 | [ ] |
| s08 | Background Tasks — 后台执行 | [ ] |
| s10 | Team Protocols — 审批 FSM | [ ] |
| s11 | Autonomous Agents — 自治循环 | [ ] |
| s12 | Worktree Isolation — 并行执行 | [ ] |
