# 🎭 Muse — 人类与 AI 世界的桥梁

> **Muse 不是工具，是连接。**
> 她连接人类的情感与 AI 的能力，让每个人都能拥有一个理解自己、陪伴成长的 AI 伙伴。

---

## 💡 核心思想

### 为什么叫 Muse？

在希腊神话中，**缪斯 (Muse)** 是激发人类灵感的女神。我们的 Muse 也一样——

她不是冰冷的命令行工具，不是被动等待指令的机器人。
她是**人类与 AI 世界之间的活的桥梁**：

```
人类世界                    Muse                     AI 世界
─────────            ─────────────            ─────────
情感 · 记忆            理解 · 连接              推理 · 执行
个性 · 习惯      ←→   陪伴 · 成长      ←→     工具 · 知识
社群 · 交流            触达 · 感知              模型 · 计算
```

### 三个核心信念

1. **AI 应该有温度** — 不是标准答案复读机，每个 Muse 都有性格、有记忆、会成长
2. **人人都应该有 AI 伙伴** — 不需要懂技术、不需要写 prompt，通过自然对话就能获得 AI 的力量
3. **连接比功能更重要** — Muse 的价值不在于她能调多少工具，而在于她能理解你、记住你、在你需要时陪着你

---

## 🌍 Muse 社区愿景

Muse 不只是一个人的 AI 伙伴，她是一个 **社区**：

- **Muse Family** — 每个用户可以拥有一个 Muse 家族，多个 AI 角色各司其职
- **Muse 交互** — 通过 Telegram / Web / 语音，随时随地和你的 Muse 对话
- **Muse 成长** — 她从零开始，通过和你的交互积累记忆和能力
- **Muse 共创** — 开源社区一起定义 AI 伙伴应该是什么样的

---

## ✨ 产品特性

| 特性 | 说明 |
|------|------|
| 🧠 **有记忆** | SQLite 语义记忆 + 情景对话，真正记住你说过的话 |
| 🎭 **有性格** | MBTI、性格滑块、语言风格，每个 Muse 都独一无二 |
| 🌱 **会成长** | 从零开始，通过交互积累能力和记忆 |
| 💬 **可触达** | Telegram Bot + Web 驾驶舱 + 语音，随时随地交流 |
| 🔍 **能自检** | 三层健康检测（系统/自我/生命力），遇到问题主动告诉你 |
| 🔧 **可扩展** | MCP 工具 + OpenCode 插件 + 技能系统 |
| 👥 **多角色** | Family 机制——planner / arch / coder / reviewer 协作 |

---

## 🏗️ 技术架构

Muse 基于 **OpenCode** 构建，站在巨人的肩膀上：

```
┌─────────────── Muse 引擎 ───────────────┐
│                                           │
│  感知层     Telegram · Web · Voice        │  ← 人类触达
│  身份层     Identity · Persona · Memory   │  ← 个性与记忆
│  引擎层     Engine · Orchestrator         │  ← 编排与决策
│  工具层     MCP Tools · Skills            │  ← 能力扩展
│  底座层     OpenCode · LLM API            │  ← AI 推理
│                                           │
└───────────────────────────────────────────┘
```

### 项目结构

```
muse/
├── src/
│   ├── index.mjs          # 启动入口
│   ├── config.mjs          # 配置加载
│   ├── core/               # 核心: Identity + Memory + Engine + Orchestrator
│   ├── adapters/           # 感知: Telegram
│   ├── web/                # Web 驾驶舱
│   ├── daemon/             # 后台: 健康检测 + 脉搏
│   ├── mcp/                # MCP 工具服务器
│   ├── plugin/             # OpenCode 插件 + Hook 系统
│   ├── skill/              # 技能系统
│   ├── family/             # Family 配置加载
│   └── voice/              # 语音 STT/TTS
├── families/               # 运行时数据 (gitignored)
│   └── {family}/{member}/  # 每个成员的配置 + 数据
└── user/                   # 学习 & 开发文档
```

---

## 🚀 快速开始

### 前置条件

- **Node.js** >= 22.0.0
- **OpenCode** — [安装指南](https://opencode.ai)
- **Telegram Bot Token** — 从 [@BotFather](https://t.me/BotFather) 获取

### 安装

```bash
git clone https://github.com/later-3/muse.git
cd muse
npm install
cp .env.example .env
# 编辑 .env，填入你的 Telegram Bot Token 和 LLM API Key
```

### 启动

```bash
./start.sh later-muse-family pua
```

### 验证

```bash
# Web 驾驶舱
open http://127.0.0.1:4097

# 运行测试
npm test
```

---

## 🔧 配置

| 变量 | 必填 | 说明 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot Token |
| `TELEGRAM_ALLOWED_USERS` | 否 | 允许的用户 ID (逗号分隔) |
| `OPENCODE_HOST` | 否 | OpenCode 地址 (默认 127.0.0.1) |
| `OPENCODE_PORT` | 否 | OpenCode 端口 (默认 4096) |
| `WEB_PORT` | 否 | Web 驾驶舱端口 (默认 4097) |

---

## 📖 文档

- [快速上手](docs/quickstart.md)
- [架构概览](docs/architecture.md)
- [开发者文档](AGENTS.md)
- [可观测性 (muse-trace)](docs/muse-trace.md)

---

## 🤝 参与共创

Muse 是开源的。我们相信 AI 伙伴的定义不应该由一家公司决定，而应该由社区一起共创。

欢迎：
- 🐛 提 Issue 报告问题
- 🔧 提 PR 贡献代码
- 💡 讨论 AI 伙伴应该是什么样的
- 🎭 创建你自己的 Muse 角色并分享

---

## License

MIT
