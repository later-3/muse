# T13: Orchestrator 瘦身 — 去 wrapper 认知层

> **主链第三步** — 依赖 T11 + T12

## 目标

Orchestrator 只做消息转发，不做认知决策。行数减少 50%+。

## 子任务

1. 删除手动记忆注入 (T11 Memory MCP 已接管)
2. 删除 buildSystemPrompt (T12 AGENTS.md 已接管)
3. 删除意图路由正则 + 偏好提取正则
4. 保留: 消息转发 + Telegram 格式化 + 错误降级
5. 全功能回归测试

## 验收

- Orchestrator 行数减少 50%+
- `grep "意图|intent|正则|extractKeywords|PREFERENCE_PATTERNS" orchestrator.mjs` = 0
- 全测试通过，Telegram 端到端正常
