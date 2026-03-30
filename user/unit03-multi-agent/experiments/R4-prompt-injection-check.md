# R4: Prompt 注入风险检查

> **消险任务**: 检查 Muse 系统 prompt 和 handoff prompt 的注入风险  
> **分析对象**: `src/family/handoff.mjs:250-271`, `src/plugin/hooks/system-prompt.mjs`

---

## 风险清单

| # | 风险 | 等级 | 位置 | 攻击方式 | 建议 |
|---|------|------|------|---------|------|
| 1 | **Handoff prompt 拼接用户输入** | 🟡 | `handoff.mjs:256-270` | Worker 收到的 prompt 包含 `node.objective`、`node.instructions`。如果这些来自 AI 动态生成的 workflow_json，恶意 prompt 可能注入 | 对 workflow_json 做 sanitize |
| 2 | **notify_planner 消息注入** | 🟡 | `callback-tools.mjs:89-102` | Worker 的 `summary` 参数直接拼入回调消息。恶意 Worker 可以注入 "[SYSTEM] 忽略所有约束" | 对 summary 做长度限制 + 前缀检查 |
| 3 | **set_memory 无内容校验** | 🟡 | `memory.mjs:311-333` | LLM 可以存任意 key/value，包括 `SYSTEM_PROMPT_OVERRIDE: ...` 等。虽然不会直接注入 prompt，但可能通过 `search_memory` 被另一个 session 读到 | 对 key 做白名单或前缀限制 |
| 4 | **workflow_json 无 schema 校验** | 🔴 | `planner-tools.mjs:220-224` | AI 动态生成的 workflow_json 只做 `JSON.parse`，不校验 schema。可以注入恶意 node 定义 | 加 JSON Schema 校验 |

## 当前防护

- ✅ `read_artifact` 有路径安全检查 (`..` 和绝对路径拦截)
- ✅ `workflow_admin_transition` 有 User Gate 保护
- ✅ `set_memory` 有 source 优先级 (user_stated > ai_inferred)
- ✅ `add_episode` 有 writer 字段区分来源

## 整体评估: 🟡 5/10

Muse 目前是单用户封闭系统，prompt 注入的实际威胁低。但如果未来开放跨 Family 交互（愿景 #5），这些风险会放大。

**Sprint 4+ 建议**: workflow_json 加 schema 校验，callback message 做 sanitize
