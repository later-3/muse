# Muse 核心模块

> Muse 是基于 OpenCode 的 AI 伴侣框架。本文档说明启动流程、消息生命周期和架构。

---

## 启动流程

运行 `./start.sh` 或 `npm start` 后，系统按依赖顺序启动 5 个模块（Web 优先，确保诊断入口可用）：

```mermaid
flowchart TD
    START["./start.sh / npm start"] --> CFG["validateConfig()"]
    CFG --> I["① Identity.start()<br/>加载 identity.json<br/>小缪/缪缪 人设"]
    I --> M["② Memory.start()<br/>初始化 SQLite<br/>记忆数据库"]
    M --> E["③ Engine.start()<br/>检测/启动 opencode serve<br/>health check"]
    E --> T["④ Telegram.start()<br/>注册中间件/命令/handler<br/>bot.launch() long polling"]
    T --> READY["🎭 Muse 已就绪"]

    style START fill:#1e1e2e,color:#cdd6f4
    style READY fill:#1e1e2e,color:#a6e3a1
```

### 启动细节

| 阶段 | 模块 | 做了什么 | 失败影响 |
|------|------|---------|---------|
| ① | Identity | 读 `identity.json` → 人设/名字/性格 | 启动失败 |
| ② | Memory | 创建/打开 `muse/data/memory.db` (SQLite) | 启动失败 |
| ③ | Engine | `curl /global/health` 探活 → 已在跑就 attach，否则 `spawn opencode serve --port 4096` | 启动失败 |
| ④ | Telegram | 注册中间件（私聊/白名单）→ 注册命令 → 注册消息 handler → `bot.launch()` | 启动失败 |

---

## 消息生命周期

当你从 Telegram 发一条消息到 bot，完整链路如下：

```mermaid
sequenceDiagram
    participant U as 👤 Telegram
    participant T as TelegramAdapter
    participant O as Orchestrator
    participant E as Engine
    participant OC as OpenCode Serve

    U->>T: 发送消息 "你叫啥名字"
    Note over T: [telegram] 📩 收到消息<br/>记录 userId, chatId, text
    T->>T: sendChatAction('typing')
    T->>O: handleMessage(text, {source:'telegram'})

    Note over O: [pipeline] ▶ 收到消息
    O->>O: ① classifyIntent(text) → light/heavy
    O->>O: ② resolveSession() → 新建或复用
    O->>O: ③ buildPrompt() → 注入人设+记忆+摘要
    Note over O: [pipeline] ④ 调用 Engine

    O->>E: sendAndWait(sessionId, prompt, {model})
    Note over E: [trace] ▶ sendAndWait 开始

    E->>OC: POST /session/:id/prompt_async
    OC-->>E: 204 No Content (已接受)
    Note over E: [trace] ✓ prompt_async 已接受

    loop 轮询 (每1秒)
        E->>OC: GET /session/status
        OC-->>E: {sessionId: "busy"/"idle"}
        Note over E: [trace] ⏳ poll status
    end

    E->>OC: GET /session/:id/message
    OC-->>E: [{role:"assistant", parts:[...]}]
    Note over E: [trace] ✅ 收到回复

    E-->>O: {text, message, sessionId}
    Note over O: [pipeline] ⑤ Engine 返回

    O->>O: postProcess() → 存记忆+提取偏好
    O-->>T: {text, sessionId, model, intent}

    Note over T: [telegram] 📤 发送回复
    T->>U: bot.reply("我叫小缪...")
    Note over T: [telegram] ✅ 回复已送达
```

---

## 日志标签速查

| 标签 | 层级 | 含义 |
|------|------|------|
| `[telegram]` | 适配器 | 📩 收到 / 📤 发送 / ✅ 送达 / ✖ 错误 |
| `[pipeline]` | 编排器 | ① 意图 → ② session → ③ prompt → ④ engine → ⑤ 返回 |
| `[trace:xxx]` | 引擎 | ▶ 开始 → ✓ 已接受 → ⏳ poll → ✅ 收到 / ✖ 超时 |
| `[engine]` | 引擎 | 启动/停止/health check |
| `[identity]` | 身份 | 加载人设 |
| `[memory]` | 记忆 | 数据库操作 |

---

## 模块依赖图

```mermaid
graph TD
    CONFIG["config.mjs<br/>环境变量 + .env"]
    IDENTITY["Identity<br/>identity.json"]
    MEMORY["Memory<br/>SQLite"]
    ENGINE["Engine<br/>↕ OpenCode REST API"]
    ORCH["Orchestrator<br/>意图·Session·Prompt"]
    TG["TelegramAdapter<br/>Telegraf"]
    OC["OpenCode Serve<br/>:4096"]

    CONFIG --> IDENTITY
    CONFIG --> MEMORY
    CONFIG --> ENGINE
    ENGINE <--> OC
    ORCH --> IDENTITY
    ORCH --> MEMORY
    ORCH --> ENGINE
    TG --> ORCH

    style OC fill:#313244,color:#f9e2af,stroke:#f9e2af
    style TG fill:#313244,color:#89b4fa,stroke:#89b4fa
    style ORCH fill:#313244,color:#a6e3a1,stroke:#a6e3a1
```

---

## 文件结构

```
muse/
├── index.mjs          # 入口: createModules() → startAll() → shutdown
├── config.mjs         # 配置加载 + normalizeModel()
├── logger.mjs         # 日志工具 (createLogger)
├── core/
│   ├── identity.mjs   # 人设加载 (identity.json)
│   ├── memory.mjs     # SQLite 记忆系统
│   ├── engine.mjs     # OpenCode REST API 客户端
│   └── orchestrator.mjs # 消息编排 (意图·Session·Prompt·后处理)
├── adapters/
│   └── telegram.mjs   # Telegram Bot (Telegraf)
└── data/
    ├── identity.json   # 小缪人设定义
    └── memory.db       # SQLite 记忆数据库 (自动创建)
```

---

## 关键配置

| 文件 | 作用 |
|------|------|
| `opencode.json` | OpenCode 原生配置 (model, username) |
| `.env` | 环境变量 (Telegram Token, 模型, 端口) |
| `muse/data/identity.json` | 人设 (名字, 性格, MBTI, 风格) |

---

## 启动方式

```bash
# 推荐: 自动保存日志到 logs/
./start.sh

# 或直接启动 (日志仅在终端)
npm start
```

日志文件: `logs/muse_YYYY-MM-DD_HHMMSS.log`

---

## 排障流程

```
消息没回复？
    ↓
看 [telegram] 📩 → 没有? → 检查 bot token / 白名单
    ↓
看 [pipeline] → 卡在哪步?
    ↓
看 [trace] → status=unknown? → 检查 OpenCode 日志
    ↓
OpenCode 日志: ~/.local/share/opencode/log/
```
