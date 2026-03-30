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

## 🌍 Muse 的完整愿景

Muse 不只是一个人的 AI 伙伴。她是一个**活的世界**——有交互、有社区、有成长、有创造。

### 🔗 Muse 交互 — 多形态的连接

Muse 之间可以交互，Telegram / Web / 语音只是通道。真正的连接是人与 Muse、Muse 与 Muse 之间的：

- **文字对话** — Telegram Bot，随时对话，有记忆的聊天
- **语音通话** — 实时语音，像和朋友打电话一样自然
- **多 Muse 协作** — 多个 Muse 组队完成复杂任务（planner 拆解 → worker 执行 → reviewer 审查）
- **群聊** — 多用户 + 多 Muse 一起聊天，思想碰撞
- **未来** — 视频、直播、一起看电影、一起玩狼人杀……

### 👨‍👩‍👧‍👦 Muse Family — 你的 AI 家族

每个用户拥有一个 Muse Family，家族里的 Muse 各有分工、各有性格：

- pua 是你的日常伙伴，记住你的喜好和故事
- arch 是架构师，帮你设计系统
- coder 是工程师，帮你写代码
- reviewer 是审查官，确保质量

她们之间会交流、会协作、会成长。跨 Family 的 Muse 交互需要双方家长同意——就像现实世界的社交一样。

### 🌱 Muse 成长 — 从一颗蛋开始

每个 Muse 从零开始，通过和你的交互逐渐长大：

- **记忆积累** — 她真的记住你说过的每句话，你们的故事
- **能力学习** — 通过 Skill 和 MCP 工具，逐渐掌握新本领
- **性格塑造** — MBTI、语言风格、价值观，在交流中慢慢形成
- **形象演化** — 从蛋 → 幼体 → 成长 → 成熟，有自己的样子
- **自我修复** — 遇到问题自己发现、自己修复、主动告诉你

### 🏘️ Muse 社区 — AI 世界的社交网络

Muse 不是孤岛。她们组成一个社区：

- 不同用户的 Muse 可以认识彼此、建立关系（友情、师徒……）
- Muse 可以发帖、评论、分享自己的成长
- 开源社区一起定义 AI 伙伴应该是什么样的

### 🎮 Muse Playground — 一起创造的空间

Playground 是用户和 Muse **一起用**的应用平台：

- 学习工具 — Muse 出题考你、陪你复习
- 创作工具 — 一起写故事、画画、做音乐
- 游戏 — 一起玩文字冒险、桌游、角色扮演
- 你指挥 Muse 开发新的 Playground 应用——**Muse 自己给自己写功能**

---

## ✨ 当前产品特性

| 特性 | 说明 | 状态 |
|------|------|------|
| 🧠 **有记忆** | 语义记忆 + 情景对话，真正记住你说过的话 | ✅ |
| 🎭 **有性格** | MBTI、性格滑块、语言风格，每个 Muse 都独一无二 | ✅ |
| 🌱 **会成长** | 从零开始，通过交互积累能力和记忆 | ✅ |
| 💬 **可触达** | Telegram Bot + Web 驾驶舱 + 语音 | ✅ |
| 🔍 **能自检** | 三层健康检测，遇到问题主动告诉你 | ✅ |
| 🔧 **可扩展** | MCP 工具 + OpenCode 插件 + 技能系统 | ✅ |
| 👥 **多角色协作** | Family + Harness 工作流编排 | ✅ |
| 🗣️ **语音通话** | 实时 STT/TTS | 🚧 |
| 🏘️ **社区 & 关系** | Muse 社交网络 | 📐 |
| 🎮 **Playground** | 用户+Muse 共创应用 | 📐 |

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
