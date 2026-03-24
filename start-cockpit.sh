#!/bin/bash
# T43: Muse Cockpit — 独立家族管理服务启动脚本
#
# 用法: ./start-cockpit.sh [family-name]
# 默认: later-muse-family
#
# 环境变量:
#   COCKPIT_PORT - 端口 (默认 4200)
#   COCKPIT_HOST - 主机 (默认 127.0.0.1)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FAMILY="${1:-later-muse-family}"

export MUSE_HOME="${SCRIPT_DIR}/families"
export MUSE_FAMILY="${FAMILY}"
export MUSE_ROOT="${SCRIPT_DIR}"

# 检查 family 目录是否存在
if [ ! -d "${MUSE_HOME}/${MUSE_FAMILY}" ]; then
  echo "❌ Family 目录不存在: ${MUSE_HOME}/${MUSE_FAMILY}"
  echo "可用的 family:"
  ls -1 "${MUSE_HOME}" 2>/dev/null || echo "  (无)"
  exit 1
fi

echo "🌸 Starting Muse Cockpit..."
echo "   Family: ${MUSE_FAMILY}"
echo "   Home:   ${MUSE_HOME}"

exec node "${SCRIPT_DIR}/src/web/standalone.mjs"
