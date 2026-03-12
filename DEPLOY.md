# Muse 部署指南 — AI Agent 专用

> 本文档面向 AI Agent 阅读。按步骤执行即可在 Linux 服务器上部署 Muse。

## 前置条件

| 依赖 | 最低版本 | 安装命令 |
|------|---------|---------|
| Node.js | >= 22.0 | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash - && sudo apt install -y nodejs` |
| Go | >= 1.22 | `sudo apt install -y golang-go` 或从 https://go.dev/dl/ 下载 |
| OpenCode | latest | `go install github.com/opencode-ai/opencode@latest` |
| Git | any | `sudo apt install -y git` |

## 部署步骤

### 1. 克隆仓库

```bash
git clone https://github.com/<owner>/muse.git
cd muse
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须设置**以下变量:

| 变量 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | 从 Telegram @BotFather 创建新 Bot 获取 | `123456:ABC-DEF1234...` |
| `TELEGRAM_ALLOWED_USERS` | 可选 | 允许使用的 Telegram 用户 ID (逗号分隔)，留空=允许所有 | `12345678` |
| `OPENCODE_WORKSPACE` | ✅ | Muse 项目的绝对路径 | `/home/user/muse` |

其他变量使用默认值即可。

### 4. 配置 OpenCode

确保 `opencode.json` 存在于项目根目录:

```json
{
  "provider": {
    "google": { "apiKey": "env:GOOGLE_API_KEY" },
    "anthropic": { "apiKey": "env:ANTHROPIC_API_KEY" }
  }
}
```

在 `.env` 中添加 LLM API Key (至少一个):

```
GOOGLE_API_KEY=your-google-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 5. 创建 Telegram Bot

如果是全新部署 (新的 Muse 实例):

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 设置名字 (如 "我的小缪") 和 username (如 `my_muse_bot`)
4. 复制 Token → 填入 `.env` 的 `TELEGRAM_BOT_TOKEN`
5. (可选) 发送 `/setdescription` 设置 Bot 描述

### 6. 初始化身份 (可选)

默认身份是"小缪"。如需自定义:

```bash
# 编辑身份配置
nano muse/data/identity.json
```

或启动后通过 Web 驾驶舱 (`http://<server-ip>:4097`) 在线修改。

### 7. 启动 Muse

#### 方式 A: 前台运行 (测试)

```bash
./start.sh
```

#### 方式 B: systemd 服务 (生产)

```bash
# 复制 service 文件
sudo cp muse/daemon/muse.service /etc/systemd/system/

# 编辑 service 文件中的路径和用户名
sudo nano /etc/systemd/system/muse.service

# 启用并启动
sudo systemctl daemon-reload
sudo systemctl enable muse
sudo systemctl start muse

# 查看状态
sudo systemctl status muse

# 查看日志
journalctl -u muse -f
```

### 8. 验证

```bash
# 检查 Web 驾驶舱
curl http://127.0.0.1:4097/api/health

# 检查 OpenCode
curl http://127.0.0.1:4096/global/health

# 在 Telegram 搜索你创建的 Bot，发送 "你好"
# 预期: 收到带有小缪人格的回复
```

## 目录结构说明

```
muse/
├── .env.example        # 环境变量模板 (复制为 .env)
├── opencode.json       # OpenCode 配置 (LLM provider)
├── start.sh            # 启动脚本
├── muse/               # 核心代码
│   ├── index.mjs       # 主入口 (启动所有模块)
│   ├── config.mjs      # 配置加载
│   ├── logger.mjs      # 日志
│   ├── core/           # 核心模块 (identity/memory/engine/orchestrator)
│   ├── adapters/       # 触达层 (telegram)
│   ├── web/            # Web 驾驶舱
│   ├── daemon/         # 小脑守护进程
│   └── data/           # 运行时数据 (identity.json, memory.db)
├── docs/               # 用户文档
└── phase1-5/           # 设计文档
```

## 故障排除

| 症状 | 原因 | 解决 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN is required` | .env 未配置 | 检查 .env 文件 |
| opencode serve 启动失败 | Go 未安装或 opencode 不在 PATH | `which opencode`，确保在 PATH |
| 端口 4096 被占用 | opencode 已在运行 | `lsof -i:4096` 检查 |
| Telegram 无响应 | Bot Token 错误或网络问题 | 检查 Token，确认服务器能访问 api.telegram.org |
| memory.db 权限 | muse/data/ 目录无写权限 | `chmod 755 muse/data/` |

## 安全提醒

- **不要** 将 `.env` 提交到 Git
- **不要** 将 `opencode.json` 中的明文 API Key 提交到 Git (用 `env:VAR_NAME` 引用)
- Web 驾驶舱默认只监听 `127.0.0.1`，如需远程访问请设置 `WEB_HOST=0.0.0.0` 并配置防火墙
