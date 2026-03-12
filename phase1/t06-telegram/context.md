# T06 Telegram 适配器 — 评审上下文

> 本文档为评审 agent 提供 T06 所需的全部上下文。

---

## 1. 项目背景

Muse 助手的核心交互渠道。用户通过 Telegram 私聊与 Muse 对话，Telegram Adapter 负责收消息 → 转发给 T05 Orchestrator → 将回复返回用户。

**核心原则**：适配器是"嘴巴"，不负责"大脑"工作。所有推理、记忆、意图分类都由 T05 处理。

---

## 2. T06 上游依赖

### 2.1 T05 Orchestrator (`muse/core/orchestrator.mjs`)

```javascript
class Orchestrator {
  /**
   * @param {string} text - 用户消息
   * @param {{ sessionId?: string, source?: string }} context
   * @returns {Promise<{ text: string, sessionId: string, model: string, intent: string }>}
   */
  async handleMessage(text, context = {})

  /**
   * @returns {Promise<{ ok: boolean, detail: { identity, memory, engine } }>}
   */
  async health()
}
```

**关键行为**：
- `handleMessage` 不传 `sessionId` → T05 自动创建新 session 并返回 `sessionId`
- `handleMessage` 传已失效的 `sessionId` → T05 自动重建并返回新 `sessionId`
- 返回值中的 `sessionId` 可能与传入的不同（session 被重建时），T06 应更新映射

### 2.2 T01 Config (`muse/config.mjs`)

```javascript
config.telegram = {
  botToken: 'xxx:yyy',             // Telegram Bot API token
  allowedUsers: ['123456', '789'], // 白名单用户 ID 列表
}
```

### 2.3 telegraf 框架 (v4.16+)

```javascript
import { Telegraf } from 'telegraf'

const bot = new Telegraf(token)
bot.use(middleware)              // 中间件
bot.command('name', handler)    // 命令
bot.on('text', handler)         // 文本消息
bot.launch()                    // 启动 long polling
bot.stop('reason')              // 停止
ctx.reply(text)                 // 发送消息
ctx.sendChatAction('typing')   // typing 动画
ctx.from.id                     // 用户 ID
ctx.message.text                // 消息文本
```

---

## 3. 代码风格参考

### 统一的生命周期

```javascript
class TelegramAdapter {
  constructor(config, orchestrator)
  async start()   // 注册处理器 + bot.launch()
  async stop()    // bot.stop()
  async health()  // { ok, detail: { activeSessions, uptime } }
}
```

### 统一的日志

```javascript
import { createLogger } from '../logger.mjs'
const log = createLogger('telegram')
```

### 统一的测试模式

- `node:test` + `node:assert`
- Mock orchestrator + 不真正连接 Telegram

---

## 4. Phase 1 验收标准（与 T06 相关）

1. ✅ 手机 Telegram 发消息 → 收到有人格的回复
2. ✅ 第二天继续聊 → 她记得昨天的内容
3. ✅ 问复杂问题 → 自动切换到更强模型 (T06 不感知，T05 自动处理)

---

## 5. Telegram API 限制

| 限制 | 值 |
|------|-----|
| 单条消息最大长度 | 4096 字符 |
| 每秒消息数 (同群) | 20 条/分钟 |
| 每秒消息数 (不同聊天) | 30 条/秒 |
| Bot 私聊 | 无需用户先 /start (可主动推送) |

Phase 1 单用户场景不会触及限流。

---

## 6. Phase 1 与 Phase 2 边界

| 能力 | Phase 1 | Phase 2 |
|------|---------|---------|
| 消息类型 | 纯文本 | 图片/文件/语音 |
| 轮询模式 | long polling | webhook |
| session 持久化 | 内存 Map | SQLite |
| Markdown 渲染 | 纯文本 | MarkdownV2 |
| 群聊 | 不支持 | 支持 |
| /memory 命令 | 提示待开发 | 完整实现 |
| /identity 命令 | 提示待开发 | 完整实现 |
