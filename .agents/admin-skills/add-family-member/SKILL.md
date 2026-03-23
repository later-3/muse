---
name: add-family-member
description: 在 Muse Family 下新建一个成员。当 Later 说“新建一个叫 xxx 的 Muse”或“加一个 family member”时，用这个 Skill 一步步完成。
---

# add-family-member Skill — 新建 Muse 家族成员

## 第一步：收集信息

在执行前，必须向 Later 确认以下信息（可以一次问全）：

| 信息 | 说明 | 示例 |
|------|------|------|
| `member` | 成员名字（小写英文）| `coder` |
| `family` | family 名（默认 `later-muse-family`）| `later-muse-family` |
| `engine_port` | OpenCode server 端口（不能和其他成员冲突）| `4098` |
| `web_port` | Web Cockpit 端口 | `4099` |
| `bot_token` | Telegram bot token（BotFather 申请）| `123456:ABC...` |
| `persona` | 这个成员的定位/专长（一句话）| "专注代码开发和审查" |

**已知端口占用**（避开）:
- nvwa: engine=4096, web=4097

## 第二步：创建目录结构

```bash
MUSE_ROOT="/Users/xulater/Code/assistant-agent/muse"
MEMBER_DIR="$MUSE_ROOT/families/{family}/{member}"

mkdir -p "$MEMBER_DIR/data/logs"
mkdir -p "$MEMBER_DIR/data/trace"
mkdir -p "$MEMBER_DIR/data/images"
```

## 第三步：写 config.json

```bash
cat > "$MEMBER_DIR/config.json" << 'EOF'
{
  "telegram": {
    "botToken": "{bot_token}",
    "chatId": "8651741012",
    "allowedUsers": []
  },
  "engine": {
    "host": "http://127.0.0.1",
    "port": {engine_port}
  },
  "web": {
    "port": {web_port},
    "host": "127.0.0.1"
  },
  "memory": {
    "maxEpisodicDays": 90
  },
  "daemon": {
    "heartbeatIntervalMs": 30000
  },
  "pulse": {
    "enabled": false
  }
}
EOF
```

> `chatId` 默认用 Later 的 Telegram ID（8651741012）。
> `pulse.enabled` 新成员默认关闭，稳定后再开。

## 第四步：写 AGENTS.md（persona）

```bash
cat > "$MEMBER_DIR/AGENTS.md" << 'EOF'
# {member} — {persona}

## 定位
{persona_detail}

## 能力重点
- 代码开发：通过 start_dev_task 发起开发任务
- 代码审查：读取 diff，给出具体改进建议
- 技术方案：分析架构，提出设计决策

## 沟通风格
- 简洁直接，以结论优先
- 技术问题给出具体可执行的方案
- 不确定时主动说明，附上推理依据
EOF
```

## 第五步：验证

```bash
cd "$MUSE_ROOT"
# 干跑验证（检查配置能否加载，不真正启动）
node -e "
process.env.MUSE_MEMBER_DIR = '$MEMBER_DIR';
import('./src/config.mjs').then(m => {
  console.log('✅ config loaded, port:', m.config.engine.port)
}).catch(e => console.error('❌ config error:', e.message))
"
```

## 第六步：启动并告知 Later

```bash
cd "$MUSE_ROOT"
./start.sh {family} {member}
```

启动成功后回复 Later：
```
✅ {member} 已创建并启动！

配置：
- Engine port: {engine_port}
- Telegram bot: 请向 @{bot_username} 发消息测试
- 数据目录: families/{family}/{member}/data/

如需修改 persona，编辑：
families/{family}/{member}/AGENTS.md
```

## 注意事项

- **端口冲突**：如果端口已被占用，start.sh 会自动 kill 旧进程 → 确保新端口没有被其他 member 使用
- **bot token**：每个 member 建议用独立 bot（向 BotFather 申请），否则同一 bot 无法区分发消息给谁
- **pulse**：新 member 暂时关闭 pulse，等 Later 确认 member 运行正常再开
- **families/ 已 gitignore**：member 目录不会被 git 追踪，这是设计如此（含 secrets）
