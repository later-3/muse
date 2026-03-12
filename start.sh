#!/bin/bash
# Muse 助手启动脚本
# 用法: ./start.sh
# 日志保存到 logs/ 目录，按时间戳命名

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建日志目录
mkdir -p logs

# 日志文件名 (时间戳)
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
LOG_FILE="logs/muse_${TIMESTAMP}.log"

# 杀掉占用 4096 端口的旧进程
if lsof -ti:4096 > /dev/null 2>&1; then
  echo "⚠️  发现端口 4096 被占用，正在清理..."
  lsof -ti:4096 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "════════════════════════════════════════════════════════"
echo "🎭 Muse 助手启动"
echo "   日志: $LOG_FILE"
echo "   查看: tail -f $LOG_FILE"
echo "   停止: Ctrl+C"
echo "════════════════════════════════════════════════════════"

# 启动并将日志同时输出到终端和文件
node muse/index.mjs 2>&1 | tee "$LOG_FILE"
