#!/bin/bash
# Muse 启动脚本 — Family 多实例版
# 用法:
#   ./start.sh                         默认 family + 默认 member
#   ./start.sh nvwa                    默认 family + 指定 member
#   ./start.sh later-muse-family nvwa  指定 family + member
#   ./start.sh stop                    停止当前运行的 muse
#   FAMILY=later-muse-family ./start.sh nvwa  通过环境变量指定 family

set -e

MUSE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MUSE_JSON="$MUSE_ROOT/muse.json"

# --- 读取 muse.json 获取默认值 ---
if [ ! -f "$MUSE_JSON" ]; then
  echo "❌ 未找到 muse.json: $MUSE_JSON"
  exit 1
fi
DEFAULT_FAMILY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MUSE_JSON','utf8')).default_family)")
DEFAULT_MEMBER=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MUSE_JSON','utf8')).default_member)")

# --- 解析参数 ---
if [ "$1" = "stop" ]; then
  FAMILY="${FAMILY:-$DEFAULT_FAMILY}"
  MEMBER="$DEFAULT_MEMBER"
  PID_FILE="$MUSE_ROOT/families/$FAMILY/$MEMBER/data/muse.pid"
  if [ -f "$PID_FILE" ]; then
    MUSE_PID=$(cat "$PID_FILE")
    echo "⏹  停止 Muse $MEMBER (PID: $MUSE_PID)..."
    # T39-1.1: 注销 registry
    MUSE_HOME="$MUSE_ROOT/families" MUSE_FAMILY="$FAMILY" node "$MUSE_ROOT/src/family/registry-cli.mjs" unregister "$MEMBER" 2>/dev/null || true
    pkill -P "$MUSE_PID" 2>/dev/null || true
    kill "$MUSE_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "✅ Muse $MEMBER 已停止"
  else
    echo "⚠️  未找到 PID 文件，Muse 可能未运行"
  fi
  exit 0
fi

# 参数: ./start.sh [family] [member] 或 ./start.sh [member]
if [ $# -ge 2 ]; then
  FAMILY="${1:-$DEFAULT_FAMILY}"
  MEMBER="${2:-$DEFAULT_MEMBER}"
elif [ $# -eq 1 ]; then
  FAMILY="${FAMILY:-$DEFAULT_FAMILY}"
  MEMBER="$1"
else
  FAMILY="${FAMILY:-$DEFAULT_FAMILY}"
  MEMBER="$DEFAULT_MEMBER"
fi

MEMBER_DIR="$MUSE_ROOT/families/$FAMILY/$MEMBER"
SRC_DIR="$MUSE_ROOT/src"

# --- 验证目录存在 ---
if [ ! -d "$MEMBER_DIR" ]; then
  echo "❌ Member 目录不存在: $MEMBER_DIR"
  echo "   请先创建 $MEMBER 的配置目录"
  exit 1
fi

PID_FILE="$MEMBER_DIR/data/muse.pid"

# --- 停止命令 (带 member 参数) ---
if [ "$3" = "stop" ] || [ "$2" = "stop" ]; then
  if [ -f "$PID_FILE" ]; then
    MUSE_PID=$(cat "$PID_FILE")
    echo "⏹  停止 Muse $MEMBER (PID: $MUSE_PID)..."
    # T39-1.1: 注销 registry
    MUSE_HOME="$MUSE_ROOT/families" MUSE_FAMILY="$FAMILY" node "$SRC_DIR/family/registry-cli.mjs" unregister "$MEMBER" 2>/dev/null || true
    pkill -P "$MUSE_PID" 2>/dev/null || true
    kill "$MUSE_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "✅ Muse $MEMBER 已停止"
  else
    echo "⚠️  未找到 PID 文件"
  fi
  exit 0
fi

# --- 确保目录存在 ---
mkdir -p "$MEMBER_DIR/data/logs" "$MEMBER_DIR/data/trace" "$MEMBER_DIR/.opencode"

# --- 清理上一次的进程 ---
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "⚠️  发现上一次的 Muse 进程 (PID: $OLD_PID)，正在清理..."
    # T39-1.1: 清理旧进程时注销 registry
    MUSE_HOME="$MUSE_ROOT/families" MUSE_FAMILY="$FAMILY" node "$SRC_DIR/family/registry-cli.mjs" unregister "$MEMBER" 2>/dev/null || true
    kill -- -"$OLD_PID" 2>/dev/null || kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# --- 读取 member 配置端口 ---
MUSE_PORT=$(node -e "
try {
  const cfg = JSON.parse(require('fs').readFileSync('$MEMBER_DIR/config.json','utf8'))
  console.log(cfg.engine?.port || 4096)
} catch(e) { console.log(4096) }
")

# --- 清理残留端口 ---
if lsof -ti:"$MUSE_PORT" > /dev/null 2>&1; then
  echo "⚠️  端口 $MUSE_PORT 被占用，正在清理..."
  lsof -ti:"$MUSE_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# --- 生成 nvwa/.opencode/opencode.json（动态绝对路径：plugin + mcp + skills）---
MEMORY_DB="$MEMBER_DIR/data/memory.db"
MEMBER_IMG_DIR="$MEMBER_DIR/data/images"
PEXELS_KEY=$(node -e "
try {
  const cfg = JSON.parse(require('fs').readFileSync('$MEMBER_DIR/config.json','utf8'))
  console.log(cfg.pexels?.apiKey || '')
} catch(e) { console.log('') }
")
BOT_TOKEN=$(node -e "
try {
  const cfg = JSON.parse(require('fs').readFileSync('$MEMBER_DIR/config.json','utf8'))
  console.log(cfg.telegram?.botToken || '')
} catch(e) { console.log('') }
")
CHAT_ID=$(node -e "
try {
  const cfg = JSON.parse(require('fs').readFileSync('$MEMBER_DIR/config.json','utf8'))
  console.log(cfg.telegram?.chatId || '')
} catch(e) { console.log('') }
")

node -e "
const mem = '$MEMBER_DIR';
const src = '$SRC_DIR';
const root = '$MUSE_ROOT';

// 读取 member 的 adminSkills 字段（基础设施决定能力边界，不依赖 AI 自律）
let isAdmin = false;
try {
  const cfg = JSON.parse(require('fs').readFileSync(mem + '/config.json', 'utf8'));
  isAdmin = !!cfg.adminSkills;
} catch(e) {}

// Skills 三层：引擎级 → admin-skills（仅管理员）→ member 专属
const skillPaths = [root + '/.agents/skills'];
if (isAdmin) skillPaths.push(root + '/.agents/admin-skills');
skillPaths.push(mem + '/.agents/skills');

const config = {
  plugin: ['file://' + src + '/plugin/index.mjs'],
  skills: { paths: skillPaths },
  mcp: {
    'memory-server': {
      type: 'local',
      command: ['node', src + '/mcp/memory.mjs'],
      environment: {
        MEMORY_DB_PATH: '$MEMORY_DB',
        TELEGRAM_BOT_TOKEN: '$BOT_TOKEN',
        TELEGRAM_CHAT_ID: '$CHAT_ID',
        PEXELS_API_KEY: '$PEXELS_KEY'
      }
    }
  }
};
require('fs').writeFileSync(mem + '/.opencode/opencode.json', JSON.stringify(config, null, 2));
console.log('✅ .opencode/opencode.json 已生成, admin=' + isAdmin + ', skills=' + skillPaths.length + '层');
"

# --- 日志 ---
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="$MEMBER_DIR/data/logs/muse_${TIMESTAMP}.log"

echo "════════════════════════════════════════════════════════"
echo "🎭 Muse 启动"
echo "   Family:    $FAMILY"
echo "   Member:    $MEMBER"
echo "   目录:      $MEMBER_DIR"
echo "   日志:      $LOG_FILE"
echo "   Trace:     $MEMBER_DIR/data/trace"
echo "   查看日志:  tail -f $LOG_FILE"
echo "   查看Trace: MUSE_TRACE_DIR=$MEMBER_DIR/data/trace node $MUSE_ROOT/src/plugin/trace-reader.mjs --tools"
echo "   停止:      ./start.sh stop 或 Ctrl+C"
echo "════════════════════════════════════════════════════════"

# --- 设置环境变量传递给 node 进程 ---
export MUSE_HOME="$MUSE_ROOT/families"
export MUSE_FAMILY="$FAMILY"
export MUSE_MEMBER="$MEMBER"
export MUSE_MEMBER_DIR="$MEMBER_DIR"
export MUSE_ROOT
# MUSE_TRACE_DIR: Plugin 进程（OpenCode 子进程）用此路径写 trace 日志
# 必须 export 才能传递给 OpenCode serve 启动的 Plugin 进程
export MUSE_TRACE_DIR="$MEMBER_DIR/data/trace"

# --- 启动（从 member 目录启动，OpenCode 读 member 的 opencode.json）---
cd "$MEMBER_DIR"
node "$SRC_DIR/index.mjs" 2>&1 | tee "$LOG_FILE" &
MUSE_PID=$!
echo $MUSE_PID > "$PID_FILE"

# --- T39-1.1: 启动后注册到 Family Registry ---
# 用 if 包裹命令替换，避免 set -e 下失败直接中断启动
if MUSE_ROLE=$(node -e "
try {
  const cfg = JSON.parse(require('fs').readFileSync('$MEMBER_DIR/config.json','utf8'))
  if (!cfg.role) { console.error('❌ config.json 缺少 role 字段'); process.exit(1) }
  console.log(cfg.role)
} catch(e) { console.error('❌ 读取 config.json 失败:', e.message); process.exit(1) }
"); then
  node "$SRC_DIR/family/registry-cli.mjs" register "$MEMBER" "$MUSE_ROLE" "http://127.0.0.1:$MUSE_PORT" "$MUSE_PID" 2>/dev/null || echo "⚠️  Registry 注册失败（非致命）"
else
  echo "⚠️  Registry 注册跳过：无法读取 role"
fi

# --- 优雅退出 ---
cleanup() {
  echo ""
  echo "⏹  正在停止 Muse $MEMBER..."
  # T39-1.1: 注销 registry
  node "$SRC_DIR/family/registry-cli.mjs" unregister "$MEMBER" 2>/dev/null || true
  kill -- -"$MUSE_PID" 2>/dev/null || { pkill -P "$MUSE_PID" 2>/dev/null; kill "$MUSE_PID" 2>/dev/null; } || true
  rm -f "$PID_FILE"
  echo "✅ Muse $MEMBER 已停止"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $MUSE_PID 2>/dev/null
# T39-1.1: wait 自然退出时也注销
node "$SRC_DIR/family/registry-cli.mjs" unregister "$MEMBER" 2>/dev/null || true
rm -f "$PID_FILE"
