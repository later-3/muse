# Muse 部署指南 — AI Agent 专用

> 本文档面向 AI Agent 阅读。按步骤执行即可在 Linux 服务器上部署 Muse。
> 每个步骤标记了 `// turbo` 的命令可自动执行。

## 前置条件

| 依赖 | 最低版本 | 安装命令 |
|------|---------|---------| 
| Node.js | >= 22.0 | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash - && sudo apt install -y nodejs` |
| OpenCode | latest | `npm install -g opencode-ai` |
| Git | any | `sudo apt install -y git` |

## 部署步骤

### 1. 克隆仓库

```bash
git clone https://github.com/later-3/muse.git
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
| `TELEGRAM_CHAT_ID` | ✅ | 你的 Telegram 用户 ID | `12345678` |
| `OPENCODE_WORKSPACE` | ✅ | Muse 项目的**绝对路径** | `/home/user/muse` |

其他变量使用默认值即可。

### 4. 配置 OpenCode (关键!)

Muse 的大脑是 OpenCode。模型配置分 **两处**，都要改：

#### 4a. 认证 LLM Provider

```bash
cd /path/to/muse
opencode auth login
# 选择 provider (如 MiniMax / OpenAI / Anthropic)
# 输入 API Key
```

验证认证:
```bash
opencode auth list
# 应该看到你刚配的 provider
```

#### 4b. 配置 oh-my-opencode.json (决定实际用哪个模型)

> **⚠️ 这是最大的坑：oh-my-opencode.json 的 agent-level model 优先级高于 opencode.json！**
> 不改这个文件 = 模型不会切换。详见 `.agents/skills/opencode-config/SKILL.md`

```bash
# 查看 provider ID (注意: 显示名 ≠ ID, 如 MiniMax 的 ID 是 minimax-cn)
cat ~/.local/share/opencode/auth.json | grep -o '"[^"]*":' | head

# 确认 oh-my-opencode.json 存在
cat ~/.config/opencode/oh-my-opencode.json
```

如果文件不存在，先运行一次 `opencode` TUI 让它自动生成，然后退出。

```bash
# 批量替换为你的 provider/model
cd ~/.config/opencode
sed -i 's|openai/gpt-5.3-codex|你的provider/你的model|g' oh-my-opencode.json
sed -i 's|openai/gpt-5.2|你的provider/你的model-fast|g' oh-my-opencode.json
```

同时确认全局配置有 oh-my-opencode 插件:
```bash
cat ~/.config/opencode/opencode.json
# 应包含: "plugin": ["oh-my-opencode@latest"]
```

### 5. 创建 Telegram Bot

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`
3. 设置名字和 username
4. 复制 Token → 填入 `.env` 的 `TELEGRAM_BOT_TOKEN`
5. 给 Bot 发一条消息，获取你的 Chat ID:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool | grep '"id"'
   ```
6. 填入 `.env` 的 `TELEGRAM_CHAT_ID`

### 6. 自定义身份

默认身份是"小缪"。如部署为其他角色 (如"服务器管家"):

```bash
mkdir -p data
cat > data/identity.json << 'EOF'
{
  "id": "muse-custom",
  "schemaVersion": "1.0",
  "updatedAt": "2026-03-16T00:00:00Z",
  "identity": {
    "name": "服务器管家",
    "nickname": "管家",
    "bio": "服务器管家，负责提供算力服务",
    "owner": "Later"
  },
  "psychology": {
    "mbti": "ISTJ",
    "traits": { "humor": 0.3, "warmth": 0.5, "initiative": 0.7, "precision": 0.9, "verbosity": 0.3 }
  },
  "linguistics": {
    "style": "简洁高效，执行力强",
    "formality": "professional",
    "catchphrases": ["收到", "已执行", "报告完毕", "运行正常"],
    "forbidden_words": [],
    "language": "zh-CN"
  },
  "motivations": {
    "core_drive": "管理服务器资源，为家族提供算力服务",
    "values": ["高效", "稳定", "安全", "可靠"]
  },
  "boundaries": {
    "never_do": ["假装是人类", "泄露隐私", "执行危险命令", "伪造记忆或经历"],
    "always_do": ["记住对话上下文", "主动报告异常", "不确定时坦诚说明"]
  }
}
EOF
```

启动后 Muse 会自动从 `identity.json` 加载身份并注入到 AI 的 system prompt。

### 7. 网络配置 (可选: Tailscale)

如需与其他 Muse 实例通信 (如 Mac 上的小缪):

```bash
# 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
# 记录分配的 IP (100.x.x.x)
tailscale ip -4
```

### 8. 启动 Muse

#### 方式 A: 前台运行 (测试)

```bash
./start.sh
```

#### 方式 B: systemd 服务 (生产)

```bash
cat > /etc/systemd/system/muse.service << EOF
[Unit]
Description=Muse AI Companion
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/start.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable muse
sudo systemctl start muse
```

### 9. 验证

```bash
# 检查进程
ps aux | grep opencode

# 检查 OpenCode Engine
curl http://127.0.0.1:4096/global/health

# 检查日志
tail -30 logs/muse_*.log

# 在 Telegram 给 Bot 发 "你好" 和 "你是谁"
# 预期: 收到对应身份的回复 (小缪 或 服务器管家)

# 验证模型
# 在 Telegram 问 "你用的什么模型"
# 预期: 不应该是 gpt-5.3-codex (如果是,说明 oh-my-opencode.json 没改)
```

## 同步更新

当源代码有更新时:

```bash
cd /path/to/muse
git pull origin main
npm install  # 有新依赖时
# 重启
sudo systemctl restart muse
```

## 目录结构

```
muse/                     # 项目根
├── .agents/              # AI Agent Skills & Workflows
│   ├── skills/           # 自我开发技能 (mcp-tool-pattern, opencode-config 等)
│   └── workflows/        # 开发工作流 (dev-impl, dev-verify 等)
├── AGENTS.md             # 人格注入 + 任务路由策略
├── opencode.json         # OpenCode 项目配置
├── .env.example          # 环境变量模板
├── start.sh              # 启动脚本
├── index.mjs             # 主入口
├── config.mjs            # 配置加载 (支持 FAMILY_HOME 模式)
├── core/                 # identity / memory / engine / orchestrator
├── adapters/             # Telegram 适配器
├── mcp/                  # MCP Server (记忆 / 工具)
├── capability/           # 能力注册表 / Gap Journal / Router
├── daemon/               # 小脑 (self-check / pulse / health)
├── family/               # FAMILY_HOME 初始化 / 配置加载 / 迁移
├── voice/                # STT (Whisper) / TTS
├── plugin/               # OpenCode Plugin (Hooks)
├── data/                 # 运行时数据 (不上传 Git)
└── docs/                 # 文档
```

## 故障排除

| 症状 | 原因 | 解决 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN is required` | .env 未配置 | `cat .env` 检查 |
| opencode serve 启动失败 | opencode 未安装 或不在 PATH | `which opencode` |
| 端口 4096 被占用 | 旧进程未退出 | `lsof -i:4096` 然后 `kill` |
| Telegram 无响应 | Bot Token 错误 / 网络 | 检查 Token + `curl api.telegram.org` |
| 模型还是旧的 | 没改 oh-my-opencode.json | 见 Step 4b |
| memory.db 权限 | data/ 无写权限 | `chmod 755 data/` |

## 安全提醒

- **不要** 将 `.env` 提交到 Git
- Web 驾驶舱默认只监听 `127.0.0.1`，远程访问需设 `WEB_HOST=0.0.0.0` + 防火墙
- `data/` 目录包含记忆和身份数据，属于隐私数据
