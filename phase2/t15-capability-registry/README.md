# T15: Capability Registry — 能力自知

> **第三批** — 依赖 T14 (感知层)

## 目标

Muse 知道自己有什么感官、有什么能力、每个由什么机制提供、当前是否可用。

## 器官 vs 能力 (不要混)

### 器官 (Senses) — 她怎么接收外界

| 器官 | 接收什么 | 状态 |
|------|---------|------|
| telegram_text | 文字消息 | ✅ available |
| telegram_photo | 图片 | ✅ available |
| telegram_audio | 语音 | ❌ unavailable |
| camera | 视频流 | ❌ not_connected |
| filesystem | 文件变更 | ❌ not_connected |

### 能力 (Capabilities) — 她怎么处理输入或完成任务

| 能力 | 提供者 | 工具/机制 |
|------|--------|----------|
| understand_text | native | LLM |
| remember_user | mcp | memory-server |
| search_web | builtin | websearch |
| describe_image | native/bridge | 多模态 LLM (T14.5) |
| transcribe_audio | none | **missing** |
| create_subagent | builtin | task 工具 |

## 子任务

1. CapabilityRegistry 数据结构 (senses + capabilities，分开)
2. 静态注册: 启动时从 MCP/Skill/内置工具构建 registry
3. 查询接口: `queryCapability(type)` → `{ available, provider, fallback }`
4. 查询接口: `querySense(organ)` → `{ status, adapter }`
5. Web 驾驶舱: 能力列表 + 器官列表页面
6. AGENTS.md 注入: AI 知道自己的能力和器官清单

## 验收

- Registry 包含所有 senses 和 capabilities (分开列出)
- Web 驾驶舱能看到两份列表
- AI 在对话中能引用: "我可以搜索网页但暂时不能听语音"
