# 学习助手 V0 — 3 个 AI 派工文案

> 你可以直接把下面 3 段分别发给 3 个 AI。

---

## AI A：前端

你只负责前端，不要碰后端。

请基于以下文件开发：

1. [`voice-chat-design.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/voice-chat-design.md)
2. [`v0-ai-build-spec.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/v0-ai-build-spec.md)
3. [`parallel-build-plan.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/parallel-build-plan.md)

你的写入范围只有：

1. `muse/user/projects/learning-assistant/web/index.html`
2. `muse/user/projects/learning-assistant/web/app.js`
3. `muse/user/projects/learning-assistant/web/style.css`

你要完成：

1. 页面布局
2. 文本输入
3. Web Speech API 语音输入
4. `idle/listening/thinking/speaking` 状态机
5. SSE 消费
6. 音频播放
7. 笔记面板 UI

要求：

1. 先用 mock 数据跑通，不要等后端。
2. 只能消费固定 SSE 事件：
   `context`
   `token`
   `done`
3. 不要自创接口字段。
4. 交付时必须带：
   页面文件
   状态机说明
   前端自测记录

---

## AI B：后端检索 / Notes / TTS

你只负责后端的本地知识检索、notes、tts，不要碰前端和 OpenCode 适配。

请基于以下文件开发：

1. [`voice-chat-design.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/voice-chat-design.md)
2. [`v0-ai-build-spec.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/v0-ai-build-spec.md)
3. [`parallel-build-plan.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/parallel-build-plan.md)

你的写入范围只有：

1. `muse/user/projects/learning-assistant/server/server.mjs`
2. `muse/user/projects/learning-assistant/server/context-index.mjs`

你要完成：

1. 本地学习资料扫描与索引
2. `GET /api/context/search`
3. `POST /api/notes`
4. `POST /api/tts`

要求：

1. 不改前端文件。
2. 接口字段严格按规格。
3. notes 保存路径固定。
4. 交付时必须带：
   接口实现
   搜索/notes/tts 测试
   样例响应

---

## AI C：OpenCode 适配 / 测试 / 集成

你只负责 OpenCode server 模式接入、session/prompt/message 轮询转 SSE、以及集成测试，不要碰前端 UI 和知识检索实现。

请基于以下文件开发：

1. [`v0-ai-build-spec.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/v0-ai-build-spec.md)
2. [`parallel-build-plan.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/parallel-build-plan.md)

你的写入范围只有：

1. `muse/user/projects/learning-assistant/server/opencode-adapter.mjs`
2. `muse/user/projects/learning-assistant/test/server.test.mjs`
3. 只在必要时最小改动 `muse/src/web/standalone.mjs`

你要完成：

1. 创建或复用 tutor/xiaomiu member session
2. `prompt_async`
3. `message` 轮询
4. 转换成学习助手前端使用的 SSE
5. 契约测试
6. happy path / degraded path 集成测试
7. 联调报告

要求：

1. 你是集成守门员。
2. 你锁定 SSE 契约，不允许随意漂移。
3. 不直接改前端 UI。
4. 不直接重写知识检索逻辑。
5. 交付时必须带：
   adapter 代码
   契约测试
   集成测试
   联调报告

---

## 统一补充

发给 3 个人时，都加这句：

**任何人都不要为了省事修改别人的接口约定；如果发现问题，先提出来，再统一改规格。**
