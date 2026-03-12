# T08 小脑 (Cerebellum) — 上下文文档

> 开发 T08 时需要参考的现有系统行为、API 约定和已知问题。

---

## 1. Engine 真实 API 行为

### 健康检查 (BUG-004)

```
优先: GET /global/health    ← 无需 workspace header, 返回 { healthy: true, version: '...' }
降级: GET /provider          ← 需 x-opencode-directory header, 返回 provider 列表
```

Engine.#healthCheck() 当前实现 (engine.mjs:328-344):
- 先试 `/global/health`，成功就返回 true
- 再试 `/provider`，成功返回 true
- 都失败返回 false
- **小脑必须复用此策略，否则会误判大脑状态**

### Session 状态生命周期 (BUG-011)

```
prompt_async 发出 → status map 写入 {type:"busy"}
处理中            → GET /session/status 返回 {sid: {type:"busy"}}
处理完成          → status map 删除 sid (不是设为 idle!)
                  → GET /session/status 返回 {} (sid 不在了)
```

**小脑清理 session 时注意**: `/session/status` 不包含 idle session，需要通过 `GET /session` 获取全量列表。

### prompt_async 204 (BUG-002)

`POST /session/:id/prompt_async` 返回 `204 No Content`，是正常行为。内部错误是静默的 (fire-and-forget)。

---

## 2. Telegram/Web 当前能力边界

### Telegram 适配器

- **只处理 `text` 类型** — `bot.on('text', handler)`
- photo, voice, sticker, document 等消息类型**无 handler，会被静默丢弃**
- 消息长度限制 4096 字符，已有 `splitMessage()` 处理
- 白名单 + 私聊限制中间件已就绪
- `handlerTimeout: 150_000` (Telegraf 默认 90s，已调高)

### Web 驾驶舱

- 启动策略: **Web 优先启动** (Phase 1 of startAll)，其他模块挂了也能用
- 当前暴露 API: `/api/health`, `/api/identity`, `/api/memory`, `/api/sessions`
- Web 挂了不影响 Telegram，反之亦然

---

## 3. T07 暴露的启动和诊断问题

| 问题 | 现状 | T08 应解决 |
|------|------|-----------|
| BUG-014 首屏"系统就绪"误导 | 已修复: 3 态探测 | 小脑应提供更丰富的状态给 Web |
| 上下文膨胀 (Backlog) | 每轮重复注入 ~1K persona | session GC 定期清理可缓解 |
| 大脑挂了无感知 | Telegram 会报超时错误 | 小脑心跳检测 + 自动重启 |
| 没有重启历史 | 日志是唯一记录 | health() 应返回 lastRestartTime |

---

## 4. config.mjs daemon 配置 (已存在)

```javascript
daemon: {
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
  maxFailures: parseInt(process.env.MAX_HEARTBEAT_FAILURES || '3', 10),
}
```

- `validateConfig()` 已校验 `heartbeatIntervalMs >= 5000`
- 默认 30s 心跳，3 次连续失败触发重启

---

## 5. Phase 2 对 T08 的期望

| Phase 2 需求 | T08 的预留 |
|-------------|-----------|
| Pulse 主动消息触发 | 小脑的 cron/event 触发框架 |
| 多 Agent 实例管理 | 心跳可扩展为多进程监控 |
| 背景 Session (记忆整理) | 小脑创建 OpenCode session 的能力 |
| SSE 事件替代轮询 | 小脑可监听 SSE 作为深度探针 |

---

## 6. 参考文件索引

| 文件 | 参考点 |
|------|--------|
| `muse/core/engine.mjs` L328-344 | healthCheck 双端点策略 |
| `muse/core/engine.mjs` L285-326 | spawn opencode serve 逻辑 |
| `muse/config.mjs` L44-48 | daemon 配置项 |
| `muse/index.mjs` L41-68 | startAll 启动顺序 |
| `muse/web/api.mjs` | Web API 路由 |
| `phase1/EXPERIENCE.md` BUG-004,009,011 | 健康检查、静默错误、状态删除 |
