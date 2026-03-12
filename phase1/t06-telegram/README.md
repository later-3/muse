# T06 Telegram 适配器 — 技术方案

> Muse 的"嘴巴" — 通过 Telegram Bot 实现用户的主要交互入口
>
> 对接 T05 Orchestrator，不直接调用 Identity/Memory/Engine

---

## 1. 需求背景

Muse 助手需要一个用户触达渠道。Phase 1 选择 **Telegram Bot** 作为首要交互入口，原因：

- 用户可从手机/PC 任意设备随时发消息
- Bot API 成熟稳定，telegraf 库生态好
- 支持 Markdown 渲染、typing 动画、文件收发
- 与 Web 驾驶舱（T07）互补：Telegram 做日常对话，Web 做管理

**Phase 1 验收标准**中 T06 相关的关键项：
> 1. 手机 Telegram 发消息 → 收到有人格的回复  
> 2. 第二天继续聊 → 她记得昨天的内容

这两条都需要 T06 正确地把消息传给 T05、返回给用户。

---

## 2. 目标

### 2.1 核心目标

- 实现完整的 Telegram Bot 交互：文字收发 + 命令系统
- 通过 `orchestrator.handleMessage()` 统一调用 T05
- 正确维护每个 Telegram 用户的 session 映射
- 安全限制：只响应白名单用户（`TELEGRAM_ALLOWED_USERS`）
- 良好的用户体验：typing 动画、长消息分割、错误友好提示

### 2.2 非目标（Phase 1 不做）

- ❌ 图片/文件收发（Phase 2）
- ❌ Inline 查询模式（Phase 2）
- ❌ 多语言支持（Phase 2）
- ❌ 群聊支持（仅私聊）
- ❌ Web hook 模式（Phase 1 用 long polling）

---

## 3. 架构位置

```
  ┌─────────────┐
  │  Telegram    │
  │  Bot API     │
  └──────┬──────┘
         │ telegraf (long polling)
  ┌──────▼──────┐
  │  Telegram   │  ← 本模块 (adapters/telegram.mjs)
  │  Adapter    │
  │             │
  │ • 命令路由   │
  │ • session 映射│
  │ • 消息分割   │
  │ • 权限检查   │
  └──────┬──────┘
         │ orchestrator.handleMessage(text, ctx)
  ┌──────▼──────┐
  │ Orchestrator│  (T05)
  │             │
  └─────────────┘
```

**职责边界**：
- Telegram Adapter **只负责**：收消息 → 转发给 Orchestrator → 回复用户
- **不直接**调用 Identity / Memory / Engine
- **不做**意图分类、模型选择、记忆检索（全部由 T05 处理）
- **管理**用户 → session 的映射关系

---

## 4. 核心实现

### 4.1 adapters/telegram.mjs

```javascript
import { Telegraf } from 'telegraf'
import { createLogger } from '../logger.mjs'

const log = createLogger('telegram')

/** Telegram 单条消息最大长度 */
const MAX_MESSAGE_LENGTH = 4096

export class TelegramAdapter {
  #bot
  #config
  #orchestrator
  #startTime
  #running = false

  /** 实例私有 session 映射: userId → sessionId */
  #userSessions = new Map()

  constructor(config, orchestrator) {
    this.#config = config
    this.#orchestrator = orchestrator
    this.#bot = new Telegraf(config.telegram.botToken)
    this.#startTime = Date.now()
  }

  async start() {
    this.#registerMiddleware()
    this.#registerCommands()
    this.#registerMessageHandler()

    await this.#bot.launch()
    this.#running = true
    log.info('Telegram Bot 已启动 (long polling)')
  }

  async stop() {
    this.#bot.stop('Muse shutdown')
    this.#running = false
    this.#userSessions.clear()
    log.info('Telegram Bot 已停止')
  }

  async health() {
    return {
      ok: this.#running,
      detail: {
        activeSessions: this.#userSessions.size,
        uptime: Math.floor((Date.now() - this.#startTime) / 1000),
      },
    }
  }
}
```

### 4.2 中间件

#### 权限检查

```javascript
#registerMiddleware() {
  // 私聊限制: Phase 1 只支持私聊
  this.#bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== 'private') return
    await next()
  })

  // 白名单检查: 只允许 TELEGRAM_ALLOWED_USERS 中的用户
  this.#bot.use(async (ctx, next) => {
    if (!ctx.from?.id) {
      log.warn('收到缺少 from.id 的更新，跳过')
      return
    }
    const userId = String(ctx.from.id)
    if (!this.#config.telegram.allowedUsers.includes(userId)) {
      log.warn(`拒绝未授权用户: ${userId}`)
      return  // 静默忽略
    }
    await next()
  })
}
```

### 4.3 命令系统

| 命令 | 功能 | 调用 |
|------|------|------|
| `/start` | 欢迎 + 简介 | 直接回复文本 |
| `/status` | 系统状态 | `orchestrator.health()` |
| `/reset` | 新建 session | 清除 userSession 映射 |
| `/memory` | 查看/搜索记忆 | 预留，Phase 1 仅提示 |
| `/identity` | 显示身份 | 预留，Phase 1 仅提示 |
| `/help` | 命令列表 | 直接回复文本 |

```javascript
#registerCommands() {
  this.#bot.command('start', async (ctx) => {
    await ctx.reply(
      '你好！我是 Muse ✨\n\n' +
      '直接发消息就可以和我聊天。\n' +
      '发 /help 查看所有命令。'
    )
  })

  this.#bot.command('help', async (ctx) => {
    await ctx.reply(
      '📋 命令列表\n\n' +
      '/start - 欢迎\n' +
      '/status - 系统状态\n' +
      '/reset - 新建对话\n' +
      '/memory - 查看记忆 (待开发)\n' +
      '/identity - 身份信息 (待开发)\n' +
      '/help - 显示此列表'
    )
  })

  this.#bot.command('status', async (ctx) => {
    try {
      const h = await this.#orchestrator.health()
      const uptime = Math.floor((Date.now() - this.#startTime) / 1000)
      const lines = [
        '📊 系统状态',
        '',
        `🧠 引擎: ${h.detail.engine.ok ? '✅ 运行中' : '❌ 不可用'}`,
        `💾 记忆: ${h.detail.memory.ok ? '✅ 正常' : '❌ 不可用'}`,
        `👤 身份: ${h.detail.identity.ok ? '✅ 已加载' : '❌ 未加载'}`,
        `⏱ 运行时间: ${uptime}s`,
        `💬 活跃会话: ${userSessions.size}`,
      ]
      await ctx.reply(lines.join('\n'))
    } catch (e) {
      log.error('获取状态失败:', e.message)
      await ctx.reply('⚠️ 暂时无法获取系统状态，请稍后再试。')
    }
  })

  this.#bot.command('reset', async (ctx) => {
    const userId = String(ctx.from.id)
    userSessions.delete(userId)
    await ctx.reply('🔄 已创建新对话。')
    log.info(`用户 ${userId} 重置了 session`)
  })

  this.#bot.command('memory', async (ctx) => {
    await ctx.reply('🧠 记忆查看功能开发中，敬请期待...')
  })

  this.#bot.command('identity', async (ctx) => {
    await ctx.reply('👤 身份查看功能开发中，敬请期待...')
  })
}
```

### 4.4 消息处理

```javascript
#registerMessageHandler() {
  this.#bot.on('text', async (ctx) => {
    const userId = String(ctx.from.id)
    const text = ctx.message.text

    // typing 动画
    await ctx.sendChatAction('typing')

    try {
      // 获取或创建 session
      const sessionId = userSessions.get(userId) || undefined

      const result = await this.#orchestrator.handleMessage(text, {
        sessionId,
        source: 'telegram',
      })

      // 关键: 每次都用返回值覆盖映射 (T05 可能在内部重建 session)
      this.#userSessions.set(userId, result.sessionId)

      // 分割长消息发送
      await this.#sendLongMessage(ctx, result.text)

    } catch (e) {
      log.error(`消息处理失败 (user=${userId}):`, e.message)
      await ctx.reply('⚠️ 抱歉，处理消息时出了点问题，请稍后再试。')
    }
  })
}
```

### 4.5 长消息分割

Telegram 单条消息上限 4096 字符。超长回复需要分割发送：

```javascript
async #sendLongMessage(ctx, text) {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    await ctx.reply(text)
    return
  }

  // 按段落分割，尽量保持语义完整
  const chunks = this.#splitMessage(text, MAX_MESSAGE_LENGTH)
  for (const chunk of chunks) {
    await ctx.reply(chunk)
  }
}

#splitMessage(text, maxLen) {
  const chunks = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // 优先按双换行分割（段落边界）
    let splitAt = remaining.lastIndexOf('\n\n', maxLen)
    // 退而求其次按单换行分割
    if (splitAt <= 0) splitAt = remaining.lastIndexOf('\n', maxLen)
    // 再退化按空格分割
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(' ', maxLen)
    // 最终硬截断
    if (splitAt <= 0) splitAt = maxLen

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }

  return chunks
}
```

### 4.6 Session 映射策略

```
┌─────────────────────────────┐
│     userSessions (Map)      │
│                             │
│  TG userId  →  OC sessionId │
│  "123456"   →  "sess-abc"   │
│  "789012"   →  "sess-def"   │
└─────────────────────────────┘
```

- **创建**：首次消息时不传 sessionId → T05 自动创建 → 存入 Map
- **复用**：后续消息从 Map 取 sessionId → 传给 T05
- **重置**：`/reset` 命令 → 从 Map 删除 → 下次消息自动创建新 session
- **失效恢复**：T05 `#isSessionError` 会自动重建 session，返回新 sessionId → 更新 Map

> **注意**：userSessions 是内存 Map，进程重启后丢失。这在 Phase 1 是可接受的（重启后用户自动进入新 session），Phase 2 可持久化到 SQLite。

---

## 5. 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | telegraf v4 | package.json 已有依赖，生态成熟 |
| 轮询模式 | long polling | Phase 1 本地运行不需要 webhook + HTTPS |
| 白名单 | 中间件层 | 一处拦截，所有命令和消息自动受保护 |
| session 存储 | 内存 Map | Phase 1 够用，重启后用户自然进入新 session |
| 消息分割 | 段落 → 换行 → 空格 → 硬截断 | 尽量保持语义完整性 |
| 未授权用户 | 静默忽略 | 不回复避免暴露 Bot 存在 |
| 命令预留 | `/memory` `/identity` 返回提示 | 不影响主流程，留给后续迭代 |
| 错误提示 | 友好中文 | 不暴露内部错误详情 |
| typing 动画 | 发消息前触发 | 告知用户正在处理，提升体验 |
| 构造函数 | `(config, orchestrator)` | 和 T02-T05 一致的注入模式 |

---

## 6. 与上游模块的接口约定

| 上游模块 | 调用的方法 | 用途 |
|---------|-----------|------|
| **Orchestrator** (T05) | `handleMessage(text, context)` | 发消息，获得回复 |
| **Orchestrator** (T05) | `health()` | `/status` 命令 |
| **Config** (T01) | `telegram.botToken` | Bot 认证 |
| **Config** (T01) | `telegram.allowedUsers` | 白名单 |

> T06 **不直接**调用 Identity / Memory / Engine，所有交互通过 T05 中转。

---

## 7. 测试方案

### 7.1 测试策略

T06 依赖 Telegram Bot API，测试时需要 **mock telegraf**：
- Mock bot: 不真正连接 Telegram
- Mock orchestrator: 返回预设回复
- 直接调用 handler 函数验证行为

```javascript
function createMockOrchestrator(reply = '你好！') {
  return {
    handleMessage: async (text, ctx) => ({
      text: reply,
      sessionId: 'mock-session-1',
      model: 'google/gemini-2.5-flash',
      intent: 'light',
    }),
    health: async () => ({
      ok: true,
      detail: {
        identity: { ok: true, detail: '小缪' },
        memory: { ok: true, detail: {} },
        engine: { ok: true, detail: 'running' },
      },
    }),
  }
}
```

### 7.2 测试矩阵

| # | 测试项 | 描述 | 类型 |
|---|--------|------|------|
| 1 | 基本消息收发 | 发 "你好" → 收到 orchestrator 回复 | 主路径 |
| 2 | session 自动创建 | 首次消息不传 sessionId → 自动创建并保存映射 | Session |
| 3 | session 复用 | 同一用户第二条消息 → 使用同一 sessionId | Session |
| 4 | /reset 重建 session | reset 后下一条消息 → 新 sessionId | 命令 |
| 5 | /start 回复欢迎 | 包含 "Muse" 和基本介绍 | 命令 |
| 6 | /help 回复命令列表 | 包含所有命令说明 | 命令 |
| 7 | /status 回复系统状态 | 包含引擎/记忆/身份状态 | 命令 |
| 8 | /status 异常处理 | orchestrator.health 抛错 → 友好错误提示 | 健壮性 |
| 9 | 白名单拦截 | 非白名单用户消息 → 不回复 | 安全 |
| 10 | 白名单通过 | 白名单用户消息 → 正常处理 | 安全 |
| 11 | 长消息分割 | 超 4096 字回复 → 分割成多条发送 | 分割 |
| 12 | 短消息不分割 | ≤4096 字 → 单条发送 | 分割 |
| 13 | 分割按段落优先 | 含双换行 → 按段落边界分割 | 分割 |
| 14 | orchestrator 异常 → 友好提示 | handleMessage 抛错 → 回复错误提示 | 健壮性 |
| 15 | session 失效后 T05 自动重建 → 更新映射 | 返回新 sessionId → Map 更新 | Session |
| 16 | start/stop 生命周期 | start 启动 → stop 停止 | 生命周期 |
| 17 | health 返回 activeSessions 和 uptime | 正确统计 | 健康检查 |
| 18 | splitMessage 纯函数测试 | 各种长度和分隔符组合 | 辅助函数 |

---

## 8. 风险与决策记录

| 风险 | 应对 |
|------|------|
| Bot token 泄露 | `.env` 管理，不入 git |
| 长时间处理无响应 | typing 动画 + T05/T03 自带 120s 超时 |
| 进程重启丢 session | Phase 1 可接受，用户自动进新 session |
| 未授权扫描 | 静默忽略 + 日志记录 |
| Telegram API 限流 | Phase 1 单用户场景不会触发 |
| Markdown 渲染不兼容 | Phase 1 先发纯文本，Phase 2 加 MarkdownV2 |

---

## 9. 完成定义 (DoD)

- [ ] `muse/adapters/telegram.mjs` TelegramAdapter 类完整实现
- [ ] 6 个命令: `/start` `/help` `/status` `/reset` `/memory` `/identity`
- [ ] 白名单中间件
- [ ] session 映射 (userId → sessionId)
- [ ] 长消息分割 (段落 → 换行 → 空格 → 硬截断)
- [ ] typing 动画
- [ ] 错误友好提示
- [ ] start/stop/health 生命周期
- [ ] 18 项单元测试通过
- [ ] git commit
