# T11: Memory MCP — 记忆工具化

> **主链第一步** — 最高优先

## 目标

Memory 从 Orchestrator 手动注入 → AI 通过 MCP 自主决定存取。

## 子任务

1. 实现 `muse/mcp/memory.mjs` — MCP stdio Server
2. 5 个工具: search_memory, set_memory, get_user_profile, get_recent_episodes, add_episode
3. opencode.json 注册
4. 降级: MCP 不可用 → Orchestrator 直接查 SQLite
5. Memory 表结构预留 capability/goal/gap 字段

## 验收

- "我叫 Later" → AI **自主调** set_memory (MCP 日志可见)
- 第二天聊天 → AI **主动** search_memory
- MCP 不可用 → 自动降级

## 详细方案

见 [context.md](./context.md)
