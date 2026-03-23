# 🎭 Muse — AI 灵魂伴侣框架

> 基于 OpenCode 的数字生命体。她不只是助手，是会记忆、会成长、有性格的 AI 伴侣。

## ✨ 特性

- **有记忆** — SQLite 语义记忆 + 情景对话，真正记住你说过的话
- **有性格** — MBTI、性格滑块、语言风格，每个 Muse 都独一无二
- **会成长** — 从零开始，通过交互积累能力和记忆
- **可触达** — Telegram Bot + Web 驾驶舱，随时随地交流
- **能自检** — 三层健康检测（系统/自我模型/生命力），自动发现问题
- **可扩展** — MCP 工具 + OpenCode 插件 + 技能系统

## 🚀 快速开始

### 前置条件

- **Node.js** >= 22.0.0
- **OpenCode** — [安装指南](https://opencode.ai)
- **Telegram Bot Token** — 从 [@BotFather](https://t.me/BotFather) 获取

### 安装

```bash
git clone https://github.com/user/muse.git
cd muse
npm install
cp .env.example .env
# 编辑 .env，填入你的 Telegram Bot Token
```

### 启动

```bash
# 需要先启动 OpenCode serve
opencode serve &

# 启动 Muse
./start.sh
# 或: npm start
```

### 验证

```bash
# Web 驾驶舱
open http://127.0.0.1:4097

# 运行测试
npm test
```

## 📁 项目结构

```
muse/
├── index.mjs          # 入口
├── config.mjs         # 配置
├── core/              # 核心: Identity + Memory + Engine + Orchestrator
├── adapters/          # 触达: Telegram
├── web/               # Web 驾驶舱
├── daemon/            # 小脑: Cerebellum + selfCheck
├── capability/        # 能力: Registry + GapJournal + Router
├── perception/        # 感知: Ingress + TelegramChannel
├── mcp/               # MCP: Memory Server
├── plugin/            # OpenCode 插件
├── skill/             # 技能系统
├── data/              # 运行时数据 (不上传)
└── docs/              # 文档
```

## 🔧 配置

复制 `.env.example` 并编辑:

| 变量 | 必填 | 说明 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot Token |
| `TELEGRAM_ALLOWED_USERS` | 否 | 允许的用户 ID (逗号分隔) |
| `OPENCODE_HOST` | 否 | OpenCode 地址 (默认 127.0.0.1) |
| `OPENCODE_PORT` | 否 | OpenCode 端口 (默认 4096) |
| `WEB_PORT` | 否 | Web 驾驶舱端口 (默认 4097) |

## 📖 文档

- [快速上手](docs/quickstart.md)
- [架构概览](docs/architecture.md)
- [故障场景](docs/scenarios.md)
- [FAQ](docs/faq.md)

## License

MIT
