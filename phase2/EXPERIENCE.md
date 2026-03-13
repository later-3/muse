# Phase 2 经验文档

> 记录 Phase 2 开发过程中的所有坑、根因分析和解决方案。
> 编号从 BUG-101 开始，和 Phase 1 (BUG-001~BUG-015) 区分。

---

## 🔧 MCP 配置

### BUG-101: opencode.json MCP 格式不匹配

| 项目 | 内容 |
|------|------|
| **现象** | `opencode mcp list` 报 `Configuration is invalid at opencode.json: Invalid input mcp.memory-server` |
| **根因** | 按 Claude Desktop 的格式写了 `"type": "stdio"` + 分离的 `command`/`args`/`env`。OpenCode 用的是自己的 zod schema (`config.ts:517-577`)，和 Claude Desktop 完全不同 |
| **正确格式** | `type` 必须是 `"local"` (不是 `"stdio"`)；`command` 是 `string[]` 合并命令和参数 (不是分开写)；环境变量键名是 `environment` (不是 `env`)；schema 是 `z.discriminatedUnion("type", [McpLocal, McpRemote])` 且 `.strict()` |
| **错误写法** | `{ "type": "stdio", "command": "node", "args": ["muse/mcp/memory.mjs"], "env": {...} }` |
| **正确写法** | `{ "type": "local", "command": ["node", "muse/mcp/memory.mjs"], "environment": {...} }` |
| **教训** | MCP 协议有标准，但各个宿主 (Claude Desktop / OpenCode / Cursor) 的配置格式互不兼容。**必须从宿主源码的 zod schema 查真实字段名**，不能靠文档猜 |

---

## 🏗️ API 设计

### BUG-102: setMemory 向后兼容断裂

| 项目 | 内容 |
|------|------|
| **现象** | 更新 `setMemory` 签名后，30 个旧测试和 orchestrator 调用全部失败 |
| **根因** | Phase 1 签名是 `setMemory(key, value, category, source)`（位置参数），Phase 2 改成了 `setMemory(key, value, opts)`（对象参数）。一改签名，所有旧调用方都挂 |
| **修复** | 第三个参数做类型嗅探：`typeof optsOrCategory === 'string'` 走旧路径，`typeof === 'object'` 走新路径。注意旧 API 用了 `arguments[3]` 取第四个位置参数 |
| **教训** | **Phase 2 修改 Phase 1 的公共 API 时，必须做 backward compat**。先跑旧测试再写新功能 |

### BUG-103: MCP server import 触发 main()

| 项目 | 内容 |
|------|------|
| **现象** | `node --test muse/mcp/memory.test.mjs` 永远挂起，不输出任何内容 |
| **根因** | 测试文件 `import { handleSetMemory } from './memory.mjs'` 时，`memory.mjs` 文件底部的 `main()` 被执行，启动了 stdio transport，吃掉了 stdin/stdout |
| **修复** | 用 `process.argv[1]` + `import.meta.url` 判断是否被直接执行：`const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))` |
| **教训** | **ESM 模块的顶层代码在 import 时会执行**。MCP server 的 `main()` 必须用 guard 保护，否则测试无法 import handler 函数 |

---

## 📐 数据建模

### BUG-104: ai_observed 用 upsert 丢失原始值

| 项目 | 内容 |
|------|------|
| **现象** | 文档要求 ai_observed "只追加 low confidence, 不覆盖已有高置信值"。但实现用了同 key upsert，实际效果是：如果旧值 confidence=low，ai_observed 直接覆盖，原始值消失 |
| **根因** | `UNIQUE(agent_id, key)` 的单行 upsert 语义天然不支持"追加待验证观察值"。"有条件覆盖 ≠ 追加" |
| **修复** | ai_observed 写入 `key__pending` 而不是 `key`（如 `fav_food__pending`）。pending 值 confidence=low, source=ai_observed。原始 `key` 不动 |
| **配套** | search_memory 和 get_user_profile 过滤 `__pending` 后缀的 key，不让 AI 把待确认值当正式事实 |
| **教训** | **单键 KV 和"多来源待确认值"是互斥语义**。如果要保留原始值 + 存观察值，必须在 key 维度做分离，不能靠覆盖守卫 |

### BUG-105: 审计承诺未落地

| 项目 | 内容 |
|------|------|
| **现象** | context.md 明确写了 "Phase 2 写入 SQLite audit 字段"，但第一版代码只在 setMemory 返回值里带了 old_value/new_value，没有任何持久化 |
| **根因** | 只关注了"功能是否能用"，没回看文档的可追踪性承诺 |
| **修复** | 新建 `memory_audit` 表 (action/target_key/old_value/new_value/source/writer/session_id/reason/blocked)。setMemory 每次调用（包括 blocked）都写审计行。暴露 `getAuditLog(key)` 和 `getRecentAudits()` 查询接口 |
| **教训** | **先实现功能再补审计 ≠ 审计不重要**。对长期关系系统，可追踪性和功能一样关键。第一版就应该把 audit 表建好 |

### BUG-106: add_episode 硬编码 writer 和 session_id

| 项目 | 内容 |
|------|------|
| **现象** | 所有 MCP 写入的 episode 都是 `session_id = mcp-{timestamp}`, `writer = 'main_session'`。后续按 session/thread 分析时完全无法区分来源 |
| **根因** | 第一版只考虑了"主对话"场景，没考虑 hook / subagent / background / family_agent 多写入者 |
| **修复** | add_episode 工具 schema 增加 `session_id` 和 `writer` 参数。不传时 session_id 自动生成，writer 默认 main_session |
| **教训** | **MCP 工具是给所有调用方用的，不只是主对话**。设计 schema 时要把所有可能的 writer 类型列为 enum |

---

## 🧪 测试

### BUG-107: pending key 泄露到搜索结果

| 项目 | 内容 |
|------|------|
| **现象** | 测试通过，但 ai_observed 写入的 `key__pending` 会出现在 search_memory 和 get_user_profile 结果中 |
| **根因** | `searchMemories()` 是全表模糊搜索，不区分正式记忆和 pending。handleGetUserProfile 的 listMemories 也不过滤 |
| **修复** | 在 MCP handler 层加 `isPendingKey()` 过滤。search_memory 的 semantic 结果 `.filter(h => !isPendingKey(h.key))`，get_user_profile 的 all 也过滤 |
| **教训** | **"写入正确" 和 "读取正确" 是两个维度**。往 pending key 里写没问题，但如果读的时候不过滤，AI 照样会把 pending 当事实用 |

---

## 🔑 经验总结

| # | 教训 | 适用范围 |
|---|------|---------|
| 1 | MCP 配置格式因宿主而异，必须看源码 zod schema | 所有 MCP 开发 |
| 2 | 改公共 API 必须 backward compat，先跑旧测试 | Phase 2+ 所有模块 |
| 3 | ESM 顶层代码 import 即执行，MCP server 需 guard | MCP server 开发 |
| 4 | 单键 KV 做不了多值待确认，需 key 维度分离 | 记忆系统设计 |
| 5 | 审计/可追踪性第一版就要做，不要后补 | 所有持久化模块 |
| 6 | MCP 工具 schema 要覆盖所有 writer，不只主对话 | 所有 MCP 工具 |
| 7 | 写入正确 ≠ 读取正确，pending 需要读侧过滤 | 记忆系统 |
