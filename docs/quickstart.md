# 快速上手

## 环境要求

- Node.js >= 22
- OpenCode CLI (`go install github.com/opencode-ai/opencode@latest`)
- Telegram Bot Token (从 [@BotFather](https://t.me/BotFather) 获取)

## 安装

```bash
git clone <repo-url> && cd assistant-agent
cp .env.example .env
# 编辑 .env，填入 TELEGRAM_BOT_TOKEN
npm install
```

## 启动方式

### 启动 Muse

```bash
cd muse && ./start.sh
```

一个命令启动所有模块: Web 驾驶舱 → Identity → Memory → Engine → Cerebellum (小脑守护) → Telegram Bot。

### launchd 托管 (可选，生产环境)

如果希望 Muse 开机自启、crash 自恢复:

```bash
cp muse/daemon/com.later.muse.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.later.muse.plist
```

## 验证

```bash
# 检查 Web 驾驶舱
open http://127.0.0.1:4097

# 检查 OpenCode serve
curl http://127.0.0.1:4096/global/health

# 运行测试
node --test muse/
```

## 日常使用

- **Telegram**: 直接跟 Bot 聊天，她会自动注入记忆和人格
- **Web 驾驶舱**: `http://127.0.0.1:4097` — 概览/身份/对话/系统/设置
- **身份编辑**: Web 驾驶舱身份页可实时修改名字/性格，保存后立即生效
- **日志**: `tail -f logs/muse_*.log`

## 停止

```bash
# 停止 Muse 主进程
# 在 start.sh 终端按 Ctrl+C

# 停止 launchd 托管的小脑
launchctl bootout gui/$(id -u)/com.later.muse
```
