/**
 * format-datetime — Custom Tool 试点
 *
 * 格式化日期时间为用户友好的中文格式。
 * 纯函数，无状态，无外部依赖。
 */
export default {
  name: 'format_datetime',
  description: '格式化日期时间为用户友好的中文格式，支持相对时间（如"3分钟前"）和完整格式',
  parameters: {
    type: 'object',
    properties: {
      timestamp: {
        type: 'string',
        description: 'ISO 8601 时间字符串 (如 "2026-03-13T10:00:00+08:00")',
      },
      format: {
        type: 'string',
        enum: ['relative', 'full', 'date', 'time'],
        description: '格式类型: relative(相对), full(完整), date(日期), time(时间)',
        default: 'relative',
      },
    },
    required: ['timestamp'],
  },
  execute: async ({ timestamp, format = 'relative' }) => {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) {
      return { error: `无效的时间格式: ${timestamp}` }
    }

    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')

    switch (format) {
      case 'relative': {
        const diffMs = now - d
        const diffSec = Math.abs(Math.floor(diffMs / 1000))
        const isFuture = diffMs < 0

        if (diffSec < 60) return { formatted: isFuture ? '马上' : '刚刚' }
        if (diffSec < 3600) return { formatted: `${Math.floor(diffSec / 60)} 分钟${isFuture ? '后' : '前'}` }
        if (diffSec < 86400) return { formatted: `${Math.floor(diffSec / 3600)} 小时${isFuture ? '后' : '前'}` }
        if (diffSec < 604800) return { formatted: `${Math.floor(diffSec / 86400)} 天${isFuture ? '后' : '前'}` }
        // 超过 7 天 → 用完整日期
        return { formatted: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
      }
      case 'full':
        return {
          formatted: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        }
      case 'date':
        return {
          formatted: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
        }
      case 'time':
        return {
          formatted: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        }
      default:
        return { error: `未知格式: ${format}` }
    }
  },
}
