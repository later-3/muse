# Phase 1 经验文档

> 记录 Phase 1 集成过程中遇到的所有问题、根因分析和解决方案。
> 后续开发和调试时可快速查阅，避免踩同样的坑。

---

## 🔌 OpenCode API 兼容性

### BUG-001: Model 格式不匹配

| 项目 | 内容 |
|------|------|
| **现象** | Engine 发送消息时 OpenCode 报 400 |
| **根因** | 代码传 `model: "openai/gpt-5.4"` 字符串，OpenCode 期望 `{ providerID, modelID }` 对象 |
| **修复** | 创建 `normalizeModel()` 函数，统一处理字符串和对象两种格式 |
| **文件** | `muse/core/engine.mjs` |

### BUG-002: prompt_async 返回 204 空 Body

| 项目 | 内容 |
|------|------|
| **现象** | `Unexpected end of JSON input` 重试 3 次后失败 |
| **根因** | `POST /session/:id/prompt_async` 返回 **`204 No Content`**，但 `Content-Type: application/json`。`res.json()` 对空 body 抛异常 |
| **修复** | `#request()` 先检查 `204` / `Content-Length: 0`，返回 `{ ok: true }`；JSON body 改为先 `res.text()` 再 `JSON.parse` |
| **文件** | `muse/core/engine.mjs` `#request()` |
| **验证** | `curl -sv -X POST .../prompt_async` 确认 204 |

### BUG-003: /session/status 返回空对象

| 项目 | 内容 |
|------|------|
| **现象** | `sendAndWait` 轮询 120s 超时，完全无法获取回复 |
| **根因** | `/session/status` 返回 `{}`，`allStatus[sessionId]` 得到 `undefined`，旧代码 `!status` (falsy) 被当成"已完成"，但消息列表为空 → 无限循环 |
| **修复** | `undefined` 不再算"完成"，只有明确的 `idle` / `completed` 才触发消息检索。额外 fallback 到 `getSession()` 获取详细状态 |
| **文件** | `muse/core/engine.mjs` `sendAndWait()` |

### BUG-004: Health Check Endpoint 不对

| 项目 | 内容 |
|------|------|
| **现象** | Engine health check 返回 false |
| **根因** | 旧代码用 `/provider`，OpenCode v1.2.24 用 `/global/health` |
| **修复** | 优先 `/global/health`，降级 `/provider` |
| **文件** | `muse/core/engine.mjs` `healthCheck()` |

---

## 📱 Telegram 对接

### BUG-005: Telegraf handlerTimeout 导致进程崩溃

| 项目 | 内容 |
|------|------|
| **现象** | `TimeoutError: Promise timed out after 90000 milliseconds` → 进程退出 |
| **根因** | Telegraf 内部用 `p-timeout` 包装每个消息 handler，默认 `90s`。我们 `sendAndWait` 超时 120s，当轮询卡住时 Telegraf 的 90s 先触发 |
| **修复** | `bot.launch({ handlerTimeout: 150_000 })` 设为 150s（> 120s sendAndWait） |
| **文件** | `muse/adapters/telegram.mjs` `start()` |
| **教训** | **永远检查框架层的超时配置**，Telegraf 的内置机制文档不明显 |

### BUG-006: "Unhandled error" 打印原始 update 对象

| 项目 | 内容 |
|------|------|
| **现象** | 控制台直接打印 `Unhandled error while processing { update_id: ... }` |
| **根因** | Telegraf 没有注册全局 `bot.catch()` 时，用默认 handler 打印原始 update |
| **修复** | 添加 `bot.catch((err, ctx) => { ... })` 全局错误处理：记日志、发友好消息给用户 |
| **文件** | `muse/adapters/telegram.mjs` `start()` |

### BUG-007: 白名单阻止所有用户 (Dev 模式)

| 项目 | 内容 |
|------|------|
| **现象** | Telegram 消息发出去没反应，bot 没回复 |
| **根因** | `TELEGRAM_ALLOWED_USERS` 为空时，白名单中间件 `allowedUsers.has(userId)` 对空集合永远返回 false |
| **修复** | 空 `allowedUsers` = 开发模式，跳过白名单检查 |
| **文件** | `muse/adapters/telegram.mjs`, `muse/config.mjs` |

### TIP: Telegram 对接清单

1. **Bot Token** → 从 BotFather 获取，放 `.env` 的 `TELEGRAM_BOT_TOKEN`
2. **User ID** → 发 `/id` 命令获取，放 `TELEGRAM_ALLOWED_USERS`（逗号分隔）
3. **Dev 模式** → `TELEGRAM_ALLOWED_USERS` 留空，允许所有用户
4. **私聊限制** → Phase 1 中间件只处理 `chat.type === 'private'`
5. **长消息** → Telegram 限制 4096 字符，`splitMessage()` 自动按段落分割

---

## ⚙️ 配置与认证

### BUG-008: opencode.json Model ID 不合法

| 项目 | 内容 |
|------|------|
| **现象** | Schema 校验报 `openai/gpt-5.3` 不是合法值 |
| **根因** | GPT-5.3 系列只有 `gpt-5.3-codex` / `gpt-5.3-codex-spark`，没有裸 `gpt-5.3` |
| **修复** | 查阅 opencode.json 的 `$schema` 合法值列表，用正确的 model ID |
| **教训** | **始终参考 schema 的枚举值**，不要猜 model ID |

### TIP: OpenCode 认证方式

| Provider | 认证方式 | 说明 |
|----------|---------|------|
| openai | OAuth | GPT Plus 订阅，token 存 `auth.json` |
| opencode | API Key | OpenCode 官方 provider |
| openrouter | API Key | 第三方路由 |

- **认证文件**: `~/.local/share/opencode/auth.json`
- **配置文件**: 项目根目录 `opencode.json`（OpenCode 原生方式）
- **OAuth 认证不需要** `OPENAI_API_KEY` 环境变量

---

## 🔍 可观测性

### 全链路日志标签

| 标签 | 层级 | 内容 |
|------|------|------|
| `[telegram]` | 适配器层 | 📩 收到消息、📤 发送回复、✅ 送达、✖ 错误 |
| `[pipeline]` | 编排层 | ① 意图 → ② session → ③ prompt → ④ engine → ⑤ 返回 |
| `[trace:xxx]` | 引擎层 | ▶ 开始 → ✓ 已接受 → ⏳ poll → ✅ 收到回复 / ✖ 超时 |
| `[engine]` | 引擎层 | 启动/停止、health check、进程管理 |

### 排障流程

1. **看 `[telegram]` 是否收到消息** → 没有则检查 bot token / 白名单
2. **看 `[pipeline]` 走到第几步** → 意图/session/prompt/engine
3. **看 `[trace]` 轮询状态** → status=unknown 说明 OpenCode 没开始处理
4. **curl 验证 API** → 直接请求 OpenCode REST API 确认

### 关键诊断命令

```bash
# 检查 OpenCode 是否运行
curl -s http://127.0.0.1:4096/global/health

# 创建 session
curl -s -X POST http://127.0.0.1:4096/session \
  -H 'Content-Type: application/json' \
  -H 'x-opencode-directory: /path/to/project' -d '{}'

# 发送消息 (注意: 返回 204)
curl -sv -X POST http://127.0.0.1:4096/session/$SES_ID/prompt_async \
  -H 'Content-Type: application/json' \
  -H 'x-opencode-directory: /path/to/project' \
  -d '{"parts":[{"type":"text","text":"hello"}]}'

# 查看 session 状态
curl -s http://127.0.0.1:4096/session/status

# 获取消息列表
curl -s http://127.0.0.1:4096/session/$SES_ID/message
```

---

## 🔥 OpenCode 状态机与配置 (Session 2 新增)

### BUG-009: default_agent "build" 被 oh-my-opencode 重分类为 subagent

| 项目 | 内容 |
|------|------|
| **现象** | `prompt_async` 返回 204，但消息永远不被处理，status 始终 `unknown` |
| **根因** | `opencode.json` 设置 `"default_agent": "build"`，但 oh-my-opencode 插件 v3.8.5 将 `build` 重分类为 `subagent`。OpenCode 源码 `agent.ts:273` 检查 `agent.mode === "subagent"` 直接 throw。**关键**: `prompt_async` 不 await 处理函数（fire-and-forget），错误被静默吞掉，204 照常返回 |
| **修复** | 移除 `default_agent` 字段，让 OpenCode 自动选第一个 `mode:"primary"` 的 agent |
| **文件** | `opencode.json` |
| **教训** | **1)** `prompt_async` 不等待结果，内部错误是静默的——必须同时看 OpenCode 日志 `~/.local/share/opencode/log/`。**2)** 插件可能改变 agent 属性，不要假设 built-in agent 的 mode 不变 |

### BUG-010: /session/status 返回对象而非字符串

| 项目 | 内容 |
|------|------|
| **现象** | 日志打印 `status=[object Object]`，无法匹配 `"idle"` / `"completed"` |
| **根因** | `/session/status` 返回 `{ sessionId: {type:"busy"} }` 而非 `{ sessionId: "busy" }`。代码直接 `allStatus[sessionId]` 得到对象，和字符串比较永远 false |
| **修复** | 提取 `.type` 字段: `typeof raw === 'object' ? raw?.type : raw` |
| **文件** | `muse/core/engine.mjs` `sendAndWait()` |
| **教训** | **永远打印 `JSON.stringify()` 而非直接拼字符串**，`[object Object]` 是 JS 最经典的坑 |

### BUG-011: idle 状态从 status map 中删除（seenBusy 逻辑）

| 项目 | 内容 |
|------|------|
| **现象** | status 从 `busy` 变为 `unknown`（而非 `idle`），`sendAndWait` 超时 |
| **根因** | OpenCode 源码 `session/status.ts:66-71`: 当 status 设为 `idle` 时，执行 `delete state()[sessionID]`，直接从 map 删除。所以批量 `/session/status` API **只包含 busy/retry 的 session**，已完成的 session 不在返回值中 |
| **修复** | 引入 `seenBusy` 标志：先等到见过 `busy` 至少一次（说明已开始处理），之后 `unknown`（不在 map 中）= `idle`（已完成）→ 获取消息 |
| **文件** | `muse/core/engine.mjs` `sendAndWait()` |
| **教训** | **不看源码你永远猜不到 API 的行为**。`/session/status` 返回 `{}` 不是"没有 session"，而是"所有 session 都已完成"。OpenCode 的设计哲学: 只追踪"正在忙"的 session |

### TIP: OpenCode 状态生命周期

```
prompt_async 发出
    ↓
SessionStatus.set(sid, {type:"busy"})  ← 存入 state map
    ↓ (处理中)
状态查询: /session/status → {sid: {type:"busy"}}
    ↓ (处理完成)
SessionStatus.set(sid, {type:"idle"})  ← 从 state map 删除!
    ↓
状态查询: /session/status → {}  ← sid 不在了
    ↓
正确判断: session 不在 map = idle (已完成)
```

---

## 📐 架构教训

| 教训 | 说明 |
|------|------|
| **API 先验证** | 对每个 OpenCode endpoint 先 curl 验证响应格式，再写代码 |
| **框架超时** | 检查所有中间层的超时配置（Telegraf 90s, fetch 30s, sendAndWait 120s） |
| **falsy ≠ 完成** | `undefined` / `null` / `''` 不能当成"已完成"状态 |
| **空 body 安全** | HTTP 204 + `Content-Type: application/json` 是合法的，代码必须处理 |
| **全局错误处理** | 框架（Telegraf）必须注册 `.catch()` 防止未捕获错误崩溃 |
| **日志优先** | 越早加日志越好，省下的调试时间远超写日志的时间 |
| **fire-and-forget 陷阱** | `prompt_async` 不 await → 内部错误静默 → 必须看 OpenCode 日志 |
| **读源码** | 不看 OpenCode 源码不可能理解 status map 删除 idle 的行为 |
| **插件副作用** | oh-my-opencode 等插件可能修改 agent 属性，不要假设默认行为 |
| **[object Object]** | JS 日志永远用 `JSON.stringify()`，不要直接拼对象到字符串 |

---

## 🌐 T07 Web 驾驶舱

### BUG-012: 前端 Identity 数据结构不匹配

| 项目 | 内容 |
|------|------|
| **现象** | 身份页显示空白，MBTI 和性格滑块无数据 |
| **根因** | 前端读 `data.name`，后端实际返回 `data.identity.name`；traits 是 0-1 float，前端假设 1-10 int |
| **修复** | 前端改为嵌套路径读取，slider 0-100 映射 0.0-1.0 |
| **教训** | **前后端数据契约必须有测试**，不能靠"看起来对"来保证 |

### BUG-013: 记忆页默认显示空 tab

| 项目 | 内容 |
|------|------|
| **现象** | 记忆页显示"暂无记忆"，但数据库有 26 条对话 |
| **根因** | 默认 tab =「语义记忆」(0 条)，真实数据在「情景记忆」(26 条)。Mock 测试两类都返回非空，掩盖了不平衡 |
| **修复** | 默认改为「情景记忆」；增加"语义空+情景非空"测试场景 |
| **教训** | **Mock 掩盖真实数据分布** — 数据增长不对称时，测试应覆盖不对称场景 |

### BUG-014: 首屏"系统就绪"误导

| 项目 | 内容 |
|------|------|
| **现象** | 页面加载立即显示"系统就绪"，即使后端未启动 |
| **修复** | 初始化先 probe `/api/health`，3 态：加载中 → ✅ 已连接 / ❌ 未连接 |

### TIP: Web 驾驶舱设计要点

1. **WebServer 第一启动、最后关闭** — 诊断入口，其他模块挂了也能看
2. **`web.enabled` 开关** — 支持无 Web 模式
3. **适配器模式** — 不含业务逻辑，转发给核心模块
4. **语义 vs 情景** — 语义靠正则(稀疏)，情景每轮自动存(密集)，Phase 2 改 LLM 提取
