# T13: Orchestrator 瘦身 — 去 wrapper 认知层

> **主链第三步** — 依赖 T11 + T12

## 目标

Orchestrator 只做消息转发，不做认知决策。行数减少 50%+。

## 背景

Phase 1 的 Orchestrator 是一个 "wrapper" — 它在发消息之前手动搜记忆塞进 prompt，用正则做意图分类，用关键词提取偏好。Phase 2 后这些能力已经原生化：

| 能力 | Phase 1 做法 | Phase 2 替代 |
|------|------------|------------|
| 记忆注入 | `#buildPrompt()` 手动搜 SQLite 拼接 | AI 自主调 MCP `search_memory` / `get_user_profile` |
| 记忆写入 | `#postProcess()` 正则提取偏好 | AI 自主调 MCP `set_memory` |
| 人格注入 | `#identity.buildSystemPrompt()` | AGENTS.md 原生注入 (T12) |
| 意图路由 | `classifyIntent()` 正则分类 | AI 自主选模型/agent |

## 关键切换点

### 1. 删除 `#buildPrompt()` 里的手动记忆注入

**当前代码** (`orchestrator.mjs:232-262`):
```
#buildPrompt(userText) {
  systemPrompt = this.#identity.buildSystemPrompt()   ← T12 删除
  semanticHits = this.#searchSemanticMemories(keywords) ← T11 MCP 替代
  summaries = this.#memory.getRecentSummaries(3)        ← T11 MCP 替代
  // 拼成一个 enriched prompt
}
```

**目标**: `#buildPrompt()` 只做 `return userText`，记忆由 AI 自主通过 MCP 取。

### 2. 删除 `#postProcess()` 里的自动偏好写入

**当前代码** (`orchestrator.mjs:270-320`):
```
#postProcess(sessionId, userText, reply) {
  extractKeywords(userText) → memory.setMemory()  ← AI 自主调 set_memory
  memory.addEpisode(sessionId, ...)               ← AI 自主调 add_episode
}
```

**目标**: `#postProcess()` 清空或删除。AI 自主决定要不要记忆。

### 3. 删除意图路由正则

**当前代码** (`orchestrator.mjs:18-35`):
```
classifyIntent(text) { HEAVY_PATTERNS.some(...) → 'heavy'/'light' }
```

**目标**: 删除 `classifyIntent`、`HEAVY_PATTERNS`、`PREFERENCE_TERMS`、`extractKeywords` 全部辅助函数。

### 4. 确认 Engine session 能看到 MCP 工具

**前提**: OpenCode serve 必须加载 opencode.json 里的 MCP config。

T11 E2E 已验证:
- `opencode mcp list` → `✓ memory-server connected`
- `opencode run "我叫Later"` → AI 自主调 `set_memory`

T13 需验证:
- Telegram → Orchestrator → Engine → OpenCode serve 的 session 同样能调 MCP 工具
- 即: 删除手动注入后，AI 在 Telegram 对话中仍能记忆

### 5. 降级策略

- MCP 不可用时 → Orchestrator **只做转发**，不回退到 Phase 1 拼接注入
- 原因: Phase 1 拼接注入会导致 prompt 无限膨胀，与 MCP 设计目标矛盾
- AI 此时无法使用记忆工具，但对话本身不受影响

## 子任务

1. 删除 `#buildPrompt()` 中 semanticBlock / episodicBlock / systemPrompt 注入
2. 删除 `#postProcess()` 中 extractKeywords + 自动 setMemory + addEpisode
3. 删除 `classifyIntent()` + `HEAVY_PATTERNS` + `PREFERENCE_TERMS` + `extractKeywords`
4. 删除对 `this.#identity.buildSystemPrompt()` 的依赖 (T12 AGENTS.md 接管)
5. 保留: 消息转发 + Telegram 格式化 + 错误降级 + session 管理
6. 验证: Telegram E2E — 小缪在 Telegram 里依然记住用户偏好 (通过 MCP)
7. 全功能回归测试

## 验收

| # | 标准 |
|---|------|
| 1 | Orchestrator 行数减少 50%+ |
| 2 | `grep "意图\|intent\|正则\|extractKeywords\|PREFERENCE_PATTERNS\|HEAVY_PATTERNS\|buildSystemPrompt" orchestrator.mjs` = 0 |
| 3 | Telegram 发 "我叫Later" → MCP 日志显示 `set_memory` 调用 |
| 4 | Telegram 发 "我叫什么" → MCP 日志显示 `get_user_profile` 调用 |
| 5 | MCP 不可用 → 对话正常 (无记忆但不 crash) |
| 6 | 全测试通过 |
