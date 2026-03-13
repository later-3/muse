# T11: Memory MCP — 记忆工具化

> **主链第一步** — 最高优先
> **详细方案**: [context.md](./context.md)
> **状态**: ✅ 已完成 (64 单测 + 5 E2E)

## 目标

Memory 从 Orchestrator 手动注入 → AI 通过 MCP **自主决定**存取。

这不只是"把 SQLite 接成 MCP" — 它是 Muse 长期关系、目标连续性、主动性和家族协作的**记忆底座**。

## 当前状态

| 维度 | 状态 | 说明 |
|------|------|------|
| MCP Server | ✅ | `muse/mcp/memory.mjs` 5 个工具 |
| 覆盖守卫 | ✅ | ai_inferred/ai_observed 不能覆盖 user_stated |
| ai_observed 建模 | ✅ | 写入 `key__pending`，不覆盖原值 |
| 审计持久化 | ✅ | `memory_audit` 表 + `#addAudit` |
| Pending 隔离 | ✅ | search/profile 过滤 `__pending` 键 |
| opencode.json 注册 | ✅ | `type: "local"`, OpenCode 识别并连接 |
| 单元测试 | ✅ | 64 pass (`muse/mcp/memory.test.mjs`) |
| E2E 测试 | ✅ | 5 pass (`muse/mcp/memory.e2e.mjs`) |

> [!IMPORTANT]
> **T11 只建了 MCP 基座，还没切到 Telegram 链路。**
> 当前 Telegram → Orchestrator → Engine 的链路仍然用 Phase 1 的手动记忆注入 (`#buildPrompt()`)。
> 从手动注入切换到 MCP 自主调用是 **T13 Orchestrator 瘦身** 的任务。

## 核心变化

| 从 (Phase 1) | 到 (Phase 2) |
|-------------|-------------|
| 代码正则提取偏好 | AI 自主调 set_memory |
| 每轮硬编码记忆注入 | AI 按需调 search_memory |
| N-gram 关键词搜索 | AI 自然语言搜索 |
| prompt 无限膨胀 | AI 只取需要的记忆 |

## 5 个 MCP 工具

| 工具 | 功能 | 关键设计 |
|------|------|---------|
| `search_memory` | 搜索记忆 | 支持 scope (identity/preference/goal/general)，过滤 pending |
| `set_memory` | 存储记忆 | 带 source/confidence/tags/meta/writer/session_id + 审计 |
| `get_user_profile` | 用户画像 | 结构化聚合视图，过滤低置信和 pending |
| `get_recent_episodes` | 对话摘要 | 支持 scope (related_goal/related_thread) |
| `add_episode` | 记录摘要 | 支持 caller 传入 session_id/writer |

## 关键规则

### 覆盖守卫

| 场景 | 策略 |
|------|------|
| user_stated 覆盖 user_stated | ✅ 允许 |
| user_stated 覆盖 ai_inferred | ✅ 允许 |
| ai_inferred 覆盖 user_stated | ❌ **禁止** (blocked + 审计) |
| ai_observed 写入已有高置信值 | ⚠️ 写入 `key__pending` (不覆盖) |

### 审计持久化

所有 set_memory 操作记录到 `memory_audit` 表:
- action: `set_memory` / `set_memory_blocked` / `set_memory_pending`
- target_key, old_value, new_value, source, writer, session_id, reason, blocked

### 画像聚合

- 冲突优先级: `user_stated > ai_inferred > ai_observed`
- 低置信记忆不进入 identity/preferences
- `__pending` 键从搜索和画像中隐藏
- 返回完整骨架 (空字段而非缺字段)

### 降级约束

降级是保底，**禁止**重新启用 Phase 1 的 prompt 拼接注入。

## E2E 验证结果

```
$ opencode mcp list
● ✓ memory-server connected

$ opencode run "我叫Later，我最喜欢的编程语言是JavaScript和Rust"
⚙ memory-server_set_memory {"key":"user_name","value":"Later",...}
⚙ memory-server_set_memory {"key":"favorite_programming_languages",...}

$ opencode run "我叫什么名字？"
⚙ memory-server_get_user_profile {"sections":["identity","preferences"]}
→ "你叫 Later。你喜欢的编程语言是 JavaScript 和 Rust。"
```

## 交接给 T13

T13 需要:
1. 删除 `orchestrator.mjs` 的 `#buildPrompt()` 中手动记忆注入
2. 删除 `#postProcess()` 中自动偏好写入
3. 验证 Telegram 链路的 session 能调 MCP 工具
4. 详见 [T13 README](../t13-orchestrator-slim/README.md)

## 踩坑记录

见 [phase2/EXPERIENCE.md](../EXPERIENCE.md) BUG-101 到 BUG-107。
