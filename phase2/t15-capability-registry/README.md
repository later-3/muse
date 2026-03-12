# T15: Capability Registry — 能力自知

> **第三批** — 依赖 T14 (感知层)

## 目标

Muse 知道自己有什么感官、有什么能力、每个能力由什么机制提供、当前是否可用。

## 子任务

1. CapabilityRegistry 数据结构 (senses + capabilities + status)
2. 静态注册: 启动时从 MCP/Skill/内置工具构建 registry
3. 查询接口: `queryCapability(type)` → `{ available, provider, fallback }`
4. Web 驾驶舱: 能力列表页面
5. AGENTS.md 注入: AI 知道自己的能力清单

## 验收

- 启动后 Registry 包含所有已注册的 MCP + Skill + 内置工具
- Web 驾驶舱能看到能力列表
- AI 能在对话中引用自己的能力: "我可以搜索网页但暂时不能听语音"
