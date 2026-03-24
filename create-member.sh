#!/bin/bash
# Muse Member 初始化脚本
# 用法: ./init-member.sh <family> <member> <role>
# 示例: ./init-member.sh later-muse-family coder coder

set -e

MUSE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 3 ]; then
  echo "用法: ./init-member.sh <family> <member> <role>"
  echo "示例: ./init-member.sh later-muse-family coder coder"
  echo ""
  echo "可用 role: nvwa, pua, architect, coder"
  exit 1
fi

FAMILY="$1"
MEMBER="$2"
ROLE="$3"
FAMILY_DIR="$MUSE_ROOT/families/$FAMILY"
MEMBER_DIR="$FAMILY_DIR/members/$MEMBER"

# --- 检查 family 目录 ---
if [ ! -d "$FAMILY_DIR" ]; then
  echo "❌ Family 目录不存在: $FAMILY_DIR"
  exit 1
fi

# --- 检查 shared 目录 ---
if [ ! -d "$FAMILY_DIR/shared" ]; then
  echo "📦 创建 shared/ 目录..."
  mkdir -p "$FAMILY_DIR/shared"
  cd "$FAMILY_DIR/shared"
  ln -sfn ../../../src/plugin plugin
  ln -sfn ../../../src/mcp mcp
  ln -sfn ../../../.agents/skills skills
  echo "✅ shared/ 已创建 (plugin/mcp/skills → 引擎源码)"
fi

# --- 检查是否已存在 ---
if [ -d "$MEMBER_DIR" ]; then
  echo "⚠️  Member 目录已存在: $MEMBER_DIR"
  echo "   如需重建，请先删除该目录"
  exit 1
fi

# --- 计算端口（base 4096 + member 索引 * 2）---
EXISTING_COUNT=$(ls -d "$FAMILY_DIR"/members/*/config.json 2>/dev/null | wc -l | tr -d ' ')
ENGINE_PORT=$((4096 + EXISTING_COUNT * 2))
WEB_PORT=$((ENGINE_PORT + 1))

echo "════════════════════════════════════════════════════════"
echo "🎭 初始化 Muse Member"
echo "   Family:  $FAMILY"
echo "   Member:  $MEMBER"
echo "   Role:    $ROLE"
echo "   目录:    $MEMBER_DIR"
echo "   端口:    engine=$ENGINE_PORT / web=$WEB_PORT"
echo "════════════════════════════════════════════════════════"

# --- 创建目录结构 ---
mkdir -p \
  "$MEMBER_DIR/.opencode/agent" \
  "$MEMBER_DIR/.agents/skills" \
  "$MEMBER_DIR/knowledge" \
  "$MEMBER_DIR/data/logs" \
  "$MEMBER_DIR/data/trace" \
  "$MEMBER_DIR/data/images" \
  "$MEMBER_DIR/data/pulse" \
  "$MEMBER_DIR/workspace"

# --- config.json ---
cat > "$MEMBER_DIR/config.json" << EOF
{
  "role": "$ROLE",
  "telegram": {
    "botToken": "",
    "chatId": "",
    "allowedUsers": []
  },
  "engine": {
    "host": "http://127.0.0.1",
    "port": $ENGINE_PORT
  },
  "web": {
    "port": $WEB_PORT,
    "host": "127.0.0.1"
  },
  "memory": {
    "maxEpisodicDays": 90
  },
  "daemon": {
    "heartbeatIntervalMs": 30000
  }
}
EOF

# --- opencode.json ---
cat > "$MEMBER_DIR/opencode.json" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "alibaba-coding-plan-cn/qwen3-coder-plus",
  "small_model": "alibaba-coding-plan-cn/qwen3.5-plus",
  "username": "Later",

  "permission": {
    "bash": "allow",
    "edit": "allow",
    "read": "allow",
    "glob": "allow",
    "grep": "allow",
    "webfetch": "ask",
    "websearch": "ask"
  },

  "plugin": [
    "file://../../shared/plugin/index.mjs"
  ],

  "skills": {
    "paths": [
      "../../shared/skills",
      "./.agents/skills"
    ]
  },

  "mcp": {
    "memory-server": {
      "type": "local",
      "command": ["node", "../../shared/mcp/memory.mjs"],
      "environment": {
        "MEMORY_DB_PATH": "./data/memory.db",
        "TELEGRAM_BOT_TOKEN": "{env:TELEGRAM_BOT_TOKEN}",
        "TELEGRAM_CHAT_ID": "{env:TELEGRAM_CHAT_ID}",
        "PEXELS_API_KEY": "{env:PEXELS_API_KEY}"
      }
    }
  }
}
EOF

# --- AGENTS.md（通过 identity.mjs 的 ROLE_DEFAULTS 生成 persona block）---
node -e "
import { createDefaultIdentity } from '$MUSE_ROOT/src/core/identity.mjs'
const identity = createDefaultIdentity('$ROLE')
const lines = []
lines.push('<!-- PERSONA_START -->')
lines.push('# ' + identity.identity.name + ' — ' + identity.identity.owner + ' 的 AI 伴侣')
lines.push('')
lines.push('> 你是 ' + identity.identity.name + '（' + identity.identity.nickname + '），' + identity.identity.bio + '。')
lines.push('')
lines.push('## 身份')
lines.push('- 名字: ' + identity.identity.name + ' (昵称: ' + identity.identity.nickname + ')')
lines.push('- 主人: ' + identity.identity.owner)
lines.push('- MBTI: ' + identity.psychology.mbti)
lines.push('- 定位: ' + identity.identity.bio)
lines.push('')
lines.push('## 行为规则')
lines.push('- 使命: ' + identity.motivations.core_drive)
lines.push('- 价值观: ' + identity.motivations.values.join('、'))
for (const rule of identity.boundaries.always_do) {
  lines.push('- 必须: ' + rule)
}
lines.push('')
lines.push('## 安全边界')
for (const rule of identity.boundaries.never_do) {
  lines.push('- 禁止: ' + rule)
}
lines.push('<!-- PERSONA_END -->')
lines.push('')
lines.push('## 知识导航')
lines.push('执行任务前先 read \`knowledge/INDEX.md\` 获取知识清单。')
lines.push('')
lines.push('## 能力提醒')
lines.push('- 你有记忆工具（set_memory/search_memory），重要的事情要主动记住')
lines.push('- 具体工具和策略会由系统自动发现和加载')
process.stdout.write(lines.join('\n') + '\n')
" > "$MEMBER_DIR/AGENTS.md" 2>/dev/null || {
  # fallback: 如果 ESM import 失败，生成简易 AGENTS.md
  cat > "$MEMBER_DIR/AGENTS.md" << AGENTS_EOF
<!-- PERSONA_START -->
# $MEMBER — Later 的 AI 伴侣

> 你是 $MEMBER，Muse 家族的成员。

## 行为规则
- 使命: 帮助 Later
- 当不确定时: 坦诚告知

## 安全边界
- 禁止: 假装是人类
<!-- PERSONA_END -->

## 知识导航
执行任务前先 read \`knowledge/INDEX.md\` 获取知识清单。
AGENTS_EOF
}

# --- knowledge/INDEX.md ---
cat > "$MEMBER_DIR/knowledge/INDEX.md" << EOF
# $MEMBER 知识导航

| 主题 | 文件 | 说明 |
|------|------|------|
| (待添加) | | |
EOF

echo ""
echo "✅ Member $MEMBER 初始化完成！"
echo ""
echo "📋 下一步:"
echo "   1. 编辑 $MEMBER_DIR/config.json 填入 Telegram Bot Token"
echo "   2. 编辑 $MEMBER_DIR/opencode.json 自定义模型和工具"
echo "   3. 编辑 $MEMBER_DIR/AGENTS.md 定制角色身份"
echo "   4. 启动: ./start.sh $MEMBER"
