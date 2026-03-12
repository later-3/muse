# T00 OpenCode 操作指南 — Muse 的大脑如何运转

> Muse 的核心引擎是 OpenCode，本文档记录如何启动、配置、对接 Telegram，以及 Skill/MCP 扩展机制
>
> 整理自：`assistant-prep/opencode/`、`learn-opencode/docs/5-advanced/`、`research/telegram-bot/`、`research/opencode-trace/`

---

## 一、OpenCode 是什么

OpenCode 是开源 AI Coding Agent 框架，提供：
- **44 个内置工具**（读写文件、跑命令、搜索代码、LSP 等）
- **Session 持久化**（SQLite，重启不丢对话）
- **自动 Context Compaction**（长对话自动压缩，不爆上下文窗口）
- **多 Provider 统一接口**（Claude / Gemini / GPT / DeepSeek / MiniMax…）
- **Plugin / Hook / Skill / MCP** 四层扩展

Muse 通过 **REST API** 与 OpenCode 交互，不改源码。

---

## 二、启动 OpenCode Serve

### 2.1 前置条件

```bash
# 1. 安装 OpenCode CLI
#    参考: https://opencode.ai
#    或: brew install opencode

# 2. 配置 LLM Provider 认证（首次）
opencode         # 启动 TUI
# 进入 TUI 后:
#   /connect → 选 provider → 输 API key
#   /models  → 选默认模型
# 认证信息存储在: ~/.local/share/opencode/auth.json
```

### 2.2 Serve 模式启动

```bash
# 基本启动
opencode serve --port 4096 --hostname 127.0.0.1

# 带日志（调试用）
opencode serve --port 4096 2>&1 | tee /tmp/opencode.log

# 后台运行
nohup opencode serve --port 4096 > /tmp/opencode.log 2>&1 &
```

### 2.3 验证服务

```bash
# 健康检查
curl http://127.0.0.1:4096/global/health
# → {"healthy":true,"version":"1.0.48"}

# 列出所有 Provider
curl http://127.0.0.1:4096/provider
# → {"all":[...],"default":{"model":"..."},"connected":["anthropic","google",...]}

# 列出所有可用 Agent
curl http://127.0.0.1:4096/agent
# → [{"id":"build",...},{"id":"plan",...},{"id":"explore",...}]

# OpenAPI 文档（浏览器打开）
open http://127.0.0.1:4096/doc
```

### 2.4 安全认证

```bash
# 生产环境设密码
export OPENCODE_SERVER_PASSWORD="your-secret"
export OPENCODE_SERVER_USERNAME="muse"   # 可选，默认 "opencode"
opencode serve --port 4096

# Muse 请求时带 Basic Auth
curl -u muse:your-secret http://127.0.0.1:4096/provider
```

---

## 三、opencode.json 配置

### 3.1 配置文件位置（7 级优先级，后覆盖前）

| 优先级 | 位置 | 说明 |
|-------|------|------|
| 1 (最低) | 远程 `.well-known/opencode` | 组织默认 |
| 2 | `~/.config/opencode/opencode.json` | 全局用户配置 |
| 3 | `OPENCODE_CONFIG` 环境变量 | 自定义路径 |
| 4 | `./opencode.json` | 项目根目录 |
| 5 | `./.opencode/opencode.json` | 项目 .opencode 目录 |
| 6 | `OPENCODE_CONFIG_CONTENT` 环境变量 | 内联 JSON 字符串 |
| 7 (最高) | 受管配置目录 | 企业部署 |

### 3.2 核心配置字段

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // ── 模型 ──
  "model": "anthropic/claude-sonnet-4",           // 主模型 (格式: provider/model)
  "small_model": "anthropic/claude-haiku-4-5",    // 轻量模型 (生成标题等)
  "default_agent": "build",                        // 默认 Agent

  // ── Provider 配置 ──
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}",       // 变量替换: 环境变量
        "baseURL": "https://api.anthropic.com",    // 自定义 API 地址
        "timeout": 600000                          // 超时 (ms)
      }
    },
    "google": {
      "options": {
        "apiKey": "{file:~/.secrets/google-key}"   // 变量替换: 文件内容
      }
    }
  },

  // ── Provider 黑白名单 ──
  "disabled_providers": ["openai"],                // 禁用的 Provider
  "enabled_providers": ["anthropic", "google"],    // 只启用这些

  // ── 其他 ──
  "username": "Later",                             // 用户名
  "autoupdate": false                              // 禁用自动更新
}
```

### 3.3 Muse 的双模型配置策略

Muse 的 Orchestrator 做意图分类后，通过 `model` 参数告诉 OpenCode 用哪个模型：

```javascript
// engine.sendAndWait(sessionId, prompt, { model })
// model 格式: { providerID: 'anthropic', modelID: 'claude-sonnet-4' }
// 或字符串: 'anthropic/claude-sonnet-4'

// 轻量任务 (闲聊、简单问答)
{ providerID: 'google', modelID: 'gemini-2.5-flash' }

// 重型任务 (代码、架构、复杂推理)
{ providerID: 'anthropic', modelID: 'claude-sonnet-4' }
```

### 3.4 大脑 vs 小脑的配置区别

| | 大脑 (OpenCode serve) | 小脑 (Cerebellum) |
|---|---|---|
| 进程 | `opencode serve --port 4096` | `node daemon/cerebellum.mjs` |
| 模型 | 按需: Gemini Flash / Claude Sonnet | 不使用 LLM |
| 配置 | `opencode.json` + `auth.json` | Muse 的 `.env` / `config.mjs` |
| 职责 | 推理、工具调用、对话 | 监控、重启、清理 |
| 升级 | 独立升级 OpenCode | 跟随 Muse 代码更新 |

---

## 四、REST API 核心操作

### 4.1 Session 管理

```bash
# 创建 Session
curl -X POST http://127.0.0.1:4096/session \
  -H "Content-Type: application/json" \
  -H "x-opencode-directory: /Users/xulater/Code/assistant-agent" \
  -d '{}'
# → {"id":"ses_abc123","title":"","..."}

# 列出所有 Session
curl http://127.0.0.1:4096/session

# 删除 Session
curl -X DELETE http://127.0.0.1:4096/session/ses_abc123

# 手动压缩上下文
curl -X POST http://127.0.0.1:4096/session/ses_abc123/summarize \
  -H "Content-Type: application/json" \
  -d '{"providerID":"anthropic","modelID":"claude-haiku-4-5"}'
```

### 4.2 发送消息

```javascript
const reply = await fetch(`http://127.0.0.1:4096/session/${sessionId}/message`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-opencode-directory': '/Users/xulater/Code/assistant-agent'  // ⚠️ 必须！
  },
  body: JSON.stringify({
    // ⚠️ model 必须是嵌套对象（不是字符串！）
    model: { providerID: 'google', modelID: 'gemini-2.5-flash' },
    agent: 'build',                    // 可选: build / plan / explore
    system: '你是小缪，友好的AI助手',   // 可选: system prompt 注入
    parts: [{ type: 'text', text: '你好' }]
  }),
  signal: AbortSignal.timeout(600_000)  // 10 分钟超时
});
const msg = await reply.json();
```

### 4.3 消息 Parts 类型

响应的 `parts` 数组包含多种类型：

| 类型 | 含义 | 关键字段 |
|------|------|---------|
| `text` | 文本回复 | `text` |
| `reasoning` | 思维链 | `text` |
| `tool` | 工具调用 | `tool`, `callID`, `state.status`, `state.input` |
| `patch` | 文件变更 | `hash`, `files[]` |
| `step-start` | 推理开始 | `snapshot` (git hash) |
| `step-finish` | 推理结束 | `reason`, `tokens: { input, output }`, `cost` |

### 4.4 异步消息 & SSE 事件流

```bash
# 异步发送（不等待回复，搭配 SSE 使用）
curl -X POST http://127.0.0.1:4096/session/ses_abc123/prompt_async \
  -H "Content-Type: application/json" \
  -d '{"parts":[{"type":"text","text":"hello"}]}'
# → 204 No Content

# SSE 事件流（实时监听）
curl -N http://127.0.0.1:4096/event
# → event: message.created
# → data: {"sessionID":"ses_abc123",...}
```

### 4.5 其他常用 API

```bash
# 获取配置
curl http://127.0.0.1:4096/config

# 动态更新配置
curl -X PATCH http://127.0.0.1:4096/config \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-2.5-flash"}'

# 列出所有工具
curl "http://127.0.0.1:4096/experimental/tool/ids"

# 列出模型可用工具（含 JSON Schema）
curl "http://127.0.0.1:4096/experimental/tool?provider=anthropic&model=claude-sonnet-4"

# 搜索文件
curl "http://127.0.0.1:4096/find/file?query=config&limit=10"

# MCP Server 状态
curl http://127.0.0.1:4096/mcp
```

---

## 五、对接 Telegram

### 5.1 创建 Bot

1. Telegram 搜索 `@BotFather` → 发 `/newbot`
2. 按提示输入名称和用户名
3. 拿到 Bot Token (格式: `1234567890:ABCdefGhijk...`)

**当前已有 Bot**:
- Token: `8704521883:AAGgSxRHS--Uiz77t46YXjbjuoxuh8Izl00`
- Bot: `@later_nexus_bot` (可能需确认)

### 5.2 获取用户 ID

在 Telegram 对 Bot 发 `/id` 命令即可拿到你的数字用户 ID（用于白名单）。

### 5.3 对接架构

```
┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  Telegram    │ ←→  │  Muse (Node.js)          │ ←→  │  OpenCode    │
│  手机/电脑   │     │                          │     │  serve :4096 │
│              │     │  TelegramAdapter (T06)   │     │              │
│              │     │       ↓                  │     │  44 个工具   │
│              │     │  Orchestrator (T05)      │     │  Session DB  │
│              │     │  Identity/Memory (T02/04)│     │  Compaction  │
│              │     │       ↓                  │     │  Multi-Model │
│              │     │  Engine (T03) → REST API │ →→  │              │
└──────────────┘     └──────────────────────────┘     └──────────────┘
```

### 5.4 启动步骤

```bash
# 1. 启动 OpenCode 大脑
opencode serve --port 4096 --hostname 127.0.0.1

# 2. 配置 .env
cat > /Users/xulater/Code/assistant-agent/.env << 'EOF'
TELEGRAM_BOT_TOKEN=8704521883:AAGgSxRHS--Uiz77t46YXjbjuoxuh8Izl00
TELEGRAM_ALLOWED_USERS=你的TG用户ID
OPENCODE_HOST=http://127.0.0.1
OPENCODE_PORT=4096
EOF

# 3. 启动 Muse
npm start
```

### 5.5 核心功能

| 功能 | 实现方式 |
|------|---------|
| **typing 动画** | `ctx.sendChatAction('typing')` + 4s 间隔 |
| **长消息分割** | `splitMessage(text, 4096)` 按换行符分割 |
| **文件路径检测** | 正则匹配 `/Users/...` 路径 → 自动发给用户 |
| **图片识别** | 下载到 `/tmp/` → 告诉 OpenCode 路径 → AI 用工具读取 |
| **截屏** | 通过 Skill 教 AI 用 `screencapture` |
| **白名单** | `ALLOWED_USERS` 环境变量，空值=开发模式允许所有 |

---

## 六、Skills 系统

### 6.1 什么是 Skill

Skill = 可教的文档式技能 (.md 文件)。不改 OpenCode 源码，教 AI 新能力。

### 6.2 SKILL.md 格式

```markdown
---
name: screenshot
description: Take screenshots on macOS
---
# Screenshot Skill

<skill-instruction>
## macOS 截屏

全屏截屏:
screencapture ~/Desktop/screenshot.png

指定窗口:
screencapture -l <windowID> output.png

截取选区:
screencapture -i output.png
</skill-instruction>
```

**只有 `<skill-instruction>` 标签内的内容才会被注入 AI Context**。标签外的内容供人类阅读。

### 6.3 6 级优先级

```
1. builtin         — oh-my-opencode 内置 (最低)
2. config          — opencode.json 配置
3. user            — ~/.opencode/skills/
4. opencode        — .opencode/skills/
5. project         — .agent/skills/ (推荐)
6. opencode-project — 最高优先级
```

同名 Skill 高优先级覆盖低优先级 → 项目可覆盖内置行为。

### 6.4 两种加载方式

| 方式 | 时机 | 用法 |
|------|------|------|
| `load_skills=["name"]` | Agent 启动时预加载到 System Prompt | 全程需要的规则 |
| `skill("name")` | 运行中动态加载 | 按需获取 |

### 6.5 MCP Skill（可执行能力包）

普通 Skill 只提供"知识"，MCP Skill 还能启动工具服务：

```yaml
# .agent/skills/database-helper/skill.json
name: database-helper
mcpConfig:
  db-query-server:
    type: command
    command: node
    args: [./mcp-server.js]
```

加载时自动启动 MCP Server → AI 可直接调用数据库查询等外部工具。

### 6.6 Muse 未来可用的 Skill 方向

| Skill | 功能 |
|-------|------|
| `screenshot` | macOS 截屏发回 Telegram |
| `muse-memory` | 教 AI 如何查询 Muse 的记忆系统 |
| `weekly-report` | 生成周报的模板和格式 |
| `code-audit` | 代码审查清单和规范 |
| `reminder` | 用 osascript 创建提醒 → iCloud 同步 iPhone |

---

## 七、Muse 使用 OpenCode 的关键要点

### 7.1 `x-opencode-directory` Header

每次请求必须带此 Header，告诉 OpenCode 工作区路径：
```javascript
headers: { 'x-opencode-directory': '/Users/xulater/Code/assistant-agent' }
```

### 7.2 model 格式必须嵌套

```javascript
// ✅ 正确
{ model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' } }

// ❌ 错误
{ providerID: 'anthropic', modelID: 'claude-sonnet-4' }
```

### 7.3 system prompt 注入

消息 API 支持 `system` 字段，可选注入系统提示：
```javascript
body: {
  system: '你是小缪，Later的终身AI搭档...',
  parts: [{ type: 'text', text: '用户消息' }]
}
```

> **Phase 1 现状**: Muse 把 persona + 记忆拼在 text 里发送。Phase 2 应改为 `system` 字段注入或 Hook 注入。

### 7.4 Session 复用节省 Token

同一个 `sessionId` → 保留对话历史 → 不需要重复读文件/上下文 → **节省 70%+ token**。

### 7.5 自动 Compaction

当 Context Window 接近满载时，OpenCode 自动：
1. 总结历史消息为摘要
2. 保留最近 N 条消息
3. 继续工作（用户无感）

oh-my-opencode 的 Hook 可在压缩时保护 TODO 列表不丢失。

### 7.6 前置认证信息

```
~/.local/share/opencode/auth.json    — API Key 存储
~/.config/opencode/opencode.json     — 全局配置
./opencode.json                      — 项目级配置
```

---

## 八、之前的实现记录

### 8.1 版本一：Codex SDK Bot (`research/telegram-bot/bot.mjs`)

```
Codex SDK thread.run()  ←→  Telegraf  ←→  Telegram @later_nexus_bot
```

- 大脑: GPT-5.3-Codex，in-process thread 对象
- 优点: API 最简洁，秒启动
- 缺点: 内存级 session（重启丢失），token 不自动压缩
- 特色: 截屏、图片识别、设提醒 (osascript → iCloud)

### 8.2 版本二：OpenCode REST Bot (`research/opencode-trace/telegram-bot.mjs`)

```
opencode serve :4096  ←→  fetch REST  ←→  Telegraf  ←→  Telegram
```

- 大脑: antigravity-gemini-3-flash，通过 REST API 交互
- 优点: SQLite 持久化、自动 Compaction、44 工具、支持 Sisyphus 多 Agent
- 缺点: 需先启动 `opencode serve`

### 8.3 Muse 的升级（当前 T01-T06）

| 维度 | 旧版 | Muse |
|------|------|------|
| 记忆 | 无 / session 级 | 4层认知记忆 (SQLite) |
| 人格 | 硬编码 system context | 可调 identity.json |
| 路由 | 固定一个模型 | 自动意图分类 → light/heavy |
| 架构 | 单文件脚本 | 模块化 6 层 |
| 守护 | 手动 nohup | 大脑/小脑 + launchd |
| 测试 | 无 | 152 项 |
