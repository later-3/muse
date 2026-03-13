# Custom Tool 定位文档

> Custom Tool 是 `.agents/tools/*.js` 文件，用于轻量、无状态的纯函数计算。

## 定位

| 维度 | Custom Tool | MCP Server |
|------|-------------|------------|
| 复杂度 | 单文件 JS | 独立进程 |
| 状态 | **无状态** | 可有状态 (DB, WebSocket) |
| 适用 | 格式化, 计算, 转换 | 记忆, 外部 API, 持久服务 |
| Muse 策略 | **轻量例外** | **主力** |

## 何时用 Custom Tool

✅ 适合:
- 日期/时间格式化
- 数学计算
- 字符串转换
- JSON/CSV 格式转换

❌ 不适合 (用 MCP):
- 需要数据库访问
- 需要网络请求
- 需要持久状态
- 需要认证/密钥

## 格式

```javascript
// .agents/tools/tool-name.js
export default {
  name: "tool_name",
  description: "工具描述",
  parameters: {
    type: "object",
    properties: { /* JSON Schema */ },
    required: ["..."],
  },
  execute: async (params) => {
    // 纯函数计算
    return { result: "..." }
  },
}
```

## Phase 2 原则

Phase 2 以 MCP 为主力扩展机制。Custom Tool 仅用于确实不需要状态的纯函数场景。
避免把有状态逻辑写进 Custom Tool，绕开 MCP 主线。
