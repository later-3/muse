# 学习助手 V0 — 给其他 AI 的开发清单

> **目标：** 用最小工作量做一个你今天/明天就能开始用的网页学习助手。  
> **定位：** 支线项目，不阻塞 `Muse Self-Development MVP` 主线。  
> **原则：** 先可用，再好看；先单页，再扩展；先文本+语音，再做截图/视觉。

---

## 一、V0 验收标准

### 必须完成

1. 打开网页后可以输入文本提问。
2. 浏览器可以语音输入，识别结果能自动发问。
3. 服务端能基于本地学习资料回答问题。
4. 回复能流式显示。
5. 回复能转语音播放。
6. 对话内容可导出为 Markdown 笔记。

### 明确不做

1. 屏幕共享
2. 框选截图
3. 复杂 RAG
4. 长期记忆
5. 并回 Muse 主系统
6. 声音克隆

---

## 二、建议实现位置

### 代码位置

1. 前端：
   `muse/user/projects/learning-assistant/web/index.html`
   `muse/user/projects/learning-assistant/web/app.js`
   `muse/user/projects/learning-assistant/web/style.css`
2. 后端：
   `muse/user/projects/learning-assistant/server/server.mjs`
3. 知识索引：
   `muse/user/projects/learning-assistant/server/context-index.mjs`
4. OpenCode 适配层：
   `muse/user/projects/learning-assistant/server/opencode-adapter.mjs`
4. 测试：
   `muse/user/projects/learning-assistant/test/server.test.mjs`

### 文档位置

1. 设计输入：[`voice-chat-design.md`](/Users/xulater/Code/assistant-agent/muse/user/projects/learning-assistant/voice-chat-design.md)
2. 任务说明：本文件

---

## 三、技术方案

### 前端

1. 单页 HTML，不引入框架。
2. 浏览器语音识别使用 Web Speech API。
3. 通过 `EventSource` 或 `fetch + ReadableStream` 消费流式回复。
4. TTS 音频用 `audio` 标签或 `Audio` 对象播放。
5. UI 只做 4 个区块：
   对话区
   输入区
   语音控制区
   笔记区

### 后端

1. Node 原生 HTTP server 即可。
2. 暴露 4 个接口：
   `POST /api/chat`
   `POST /api/tts`
   `GET /api/context/search?q=`
   `POST /api/notes`
3. 读取本地目录：
   `muse/user/foundations/`
   `muse/user/unit01-agent-core/`
   `muse/user/unit02-multi-agent/`
   `muse/user/unit03-state-memory/`
   `muse/user/unit04-prompt-eng/`

### 知识检索

V0 不做向量库，只做：
1. 启动时扫描上述目录的 `.md` 文件。
2. 为每个文件构建：
   `id / title / path / keywords / headings / preview`
3. 简单匹配策略：
   文件名命中
   一级标题命中
   关键词命中
   内容前 2-3 个匹配段落
4. 命中后只注入：
   文件标题
   命中段落
   最多 1-2 个相邻段落

### 模型调用（改为 OpenCode Server 模式）

1. **不直接从学习助手调用外部 LLM API。**
2. **统一走 OpenCode server 模式。**
3. 复用现有 `standalone.mjs` 已有的 OpenCode 代理接口：
   `POST /api/member/:name/oc/session`
   `POST /api/member/:name/oc/session/:sid/prompt_async`
   `GET /api/member/:name/oc/session/:sid/message`
4. 学习助手自己的 server 负责：
   本地知识检索
   prompt 组装
   notes 保存
   TTS
   把 prompt 投递给 OpenCode
5. 建议为学习助手配置一个独立 member，例如：
   `tutor` 或 `xiaomiu`

### OpenCode 集成约束

1. V0 不直接依赖 token 级 SSE。
2. 因为 OpenCode 当前链路是：
   `prompt_async -> 轮询 message`
3. 所以 V0 可接受两种返回模式：
   `A. 伪流式`：后端轮询拿到完整回复后再分段吐给前端
   `B. 半流式`：后端短轮询消息数组，发现 assistant 文本增长就增量推送
4. **优先选 B**，但如果实现复杂，先落 A，不阻塞可用性。

### TTS

1. 首选复用现有 [`tts.mjs`](/Users/xulater/Code/assistant-agent/muse/src/voice/tts.mjs#L1)
2. 如果集成成本高，再临时直连 MiniMax TTS
3. 必须支持“关闭自动播报”

---

## 四、交互状态机

必须明确 4 个状态：

1. `idle`
2. `listening`
3. `thinking`
4. `speaking`

### 强约束

1. `speaking` 时必须暂停语音识别，避免回声回灌。
2. `thinking` 时不能再次发新请求。
3. 流式回复结束后，才允许进入 `speaking`。

---

## 五、接口定义

### `POST /api/chat`

请求：

```json
{
  "message": "self-attention 是怎么工作的？",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "mode": "study"
}
```

流式事件建议：

```json
{ "type": "context", "items": [{ "file": "F2-build-gpt", "section": "Self-Attention" }] }
{ "type": "token", "content": "Self-Attention 的核心是..." }
{ "type": "done", "fullText": "..." }
```

> 说明：
> 实现上允许学习助手 server 在内部先调用 OpenCode session API，再把结果转成 SSE 给前端。

**契约冻结：**

1. 前端只认这 3 类事件：
   `context`
   `token`
   `done`
2. 不允许开发过程中私自改事件名。
3. 如果要新增事件，必须兼容旧事件。

### `GET /api/context/search?q=attention`

响应：

```json
{
  "ok": true,
  "items": [
    {
      "id": "F2-build-gpt",
      "title": "Transformer",
      "path": "user/foundations/F2-build-gpt.md",
      "snippet": "Self-Attention 的核心..."
    }
  ]
}
```

### `POST /api/tts`

请求：

```json
{
  "text": "Self-Attention 的核心是让 token 之间彼此建立关联。",
  "voice": "default"
}
```

### `POST /api/notes`

请求：

```json
{
  "title": "2026-03-28 学习助手笔记",
  "content": "## 要点\n- ...\n"
}
```

保存位置建议：

`muse/user/projects/learning-assistant/notes/`

### 契约统一规则

1. 所有 JSON 响应默认包含：
   `ok`
2. 错误响应默认包含：
   `ok: false`
   `error`
3. SSE 结束必须有：
   `done`
4. 前后端对接以本节字段名为唯一标准，不看个人实现习惯。

---

## 六、System Prompt 最小要求

1. 角色：
   学习助手，不是泛化聊天机器人。
2. 目标：
   帮 Later 理解 AI Agent / LLM / Muse 相关知识。
3. 风格：
   中文口语化、简洁、适合语音播报。
4. 约束：
   优先基于本地知识文件回答。
   不确定时明确说不确定。
   回答尽量 100-180 字，必要时引导继续追问。
5. 输出习惯：
   少用列表，术语给中英双语。

---

## 七、开发任务拆解

### A. 基础骨架

1. 创建前端静态页面。
2. 创建独立 server。
3. 能打开页面并返回健康检查。

### B. 文本聊天

1. 接通 `/api/chat`。
2. 通过 OpenCode session API 发起会话。
3. 支持“OpenCode 结果 → 学习助手 SSE”转换。
4. 支持 10 轮内历史。

### C. 语音输入

1. 接 Web Speech API。
2. 支持按键开始/停止。
3. 显示中间识别结果。

### D. TTS 播放

1. 接 `/api/tts`。
2. 回复完成后可自动播报。
3. 增加“自动播报开关”。

### E. 本地知识检索

1. 扫描学习资料目录。
2. 构建简单索引。
3. 命中后把片段拼入 prompt。

### G. OpenCode 适配

1. 创建或复用 tutor/xiaomiu member session。
2. 把 system prompt + 检索片段 + history + user message 组装成最终 prompt。
3. 调 `prompt_async`。
4. 轮询 `message`。
5. 把 OpenCode 结果转成前端可消费的 SSE。

### F. 笔记

1. 前端侧栏或弹层。
2. 一键导出 Markdown。

---

## 八、测试要求

### 单元测试

1. 索引构建：
   能扫描文件
   能返回标题/摘要
2. 搜索接口：
   查询命中返回结果
   空查询返回空数组
3. 笔记保存：
   文件名清洗
   文件落盘成功
4. OpenCode 适配：
   session 创建请求格式正确
   消息轮询增量提取正确
5. 前端状态机：
   `idle -> listening -> thinking -> speaking -> idle`

### API 测试

1. `GET /api/context/search`
2. `POST /api/notes`
3. `POST /api/chat` 至少验证流开始/结束格式
4. `POST /api/tts` 在无依赖时返回明确降级错误或可用结果
5. OpenCode 适配层在 member 离线时返回清晰错误

### 契约测试

1. `POST /api/chat`
   - 必须返回 `context/token/done`
   - `done.fullText` 必须存在
2. `GET /api/context/search`
   - `items` 必须是数组
   - 每项至少有 `id/title/path/snippet`
3. `POST /api/notes`
   - 成功时返回 `ok: true`
   - 返回保存后的路径或文件名
4. `POST /api/tts`
   - 成功时返回音频
   - 失败时返回可解释错误

### 集成测试

1. Happy Path
   - 文本提问
   - 检索命中
   - OpenCode 有回复
   - 前端收到 `done`
   - TTS 可播报
2. Degraded Path
   - OpenCode 离线
   - 页面不崩
   - 后端返回清晰错误
3. Recovery Path
   - 自动播报开启
   - 语音识别在 speaking 阶段暂停
   - 播放结束后恢复 listening

### 手工验证

1. 文本提问 3 轮连续可用
2. 语音识别可触发提问
3. 自动播报时不会把自己的声音重新识别进去
4. “记一下”之后可以导出一份 Markdown 笔记

### 集成守门规则

1. 不接受“各模块都能跑，但合起来没测过”。
2. 必须至少通过：
   `1 个 happy path`
   `1 个 degraded path`
3. 没有集成测试结论，不算 V0 完成。

---

## 九、完成定义

满足以下 6 条才算 V0 完成：

1. 本地启动命令清晰
2. 页面可打开
3. 文本问答可用
4. 语音输入可用
5. 语音播报可用
6. 笔记导出可用

---

## 十、工作量判断

如果由熟悉本仓库的 AI 来做，**工作量不大**。

我的判断：

1. 最小可用骨架：`0.5 - 1 天`
2. 加知识检索和笔记：`0.5 天`
3. 补测试和打磨：`0.5 天`

> 也就是：**1-2 天内做出可用 V0 是现实的。**

---

## 十一、3 个 AI 并行分工建议

> 原则：按**互不冲突的写入范围**拆，不要 3 个人同时改同一份文件。

### AI 1：前端 UI / 语音交互

**负责文件：**

1. `muse/user/projects/learning-assistant/web/index.html`
2. `muse/user/projects/learning-assistant/web/app.js`
3. `muse/user/projects/learning-assistant/web/style.css`

**负责内容：**

1. 页面布局
2. 文本输入
3. Web Speech API
4. 状态机 `idle/listening/thinking/speaking`
5. SSE 消费
6. 音频播放与自动播报开关
7. 笔记面板 UI

**不负责：**

1. 知识检索
2. OpenCode API 适配
3. TTS 服务端实现

**必须交付：**

1. 前端页面文件
2. 状态机说明
3. 对接接口字段清单
4. 1 份前端自测记录

### AI 2：后端知识检索 / Notes / TTS

**负责文件：**

1. `muse/user/projects/learning-assistant/server/server.mjs`
2. `muse/user/projects/learning-assistant/server/context-index.mjs`

**负责内容：**

1. `GET /api/context/search`
2. `POST /api/notes`
3. `POST /api/tts`
4. 本地文件扫描与索引
5. 检索片段拼装

**不负责：**

1. 前端页面
2. OpenCode session/prompt/message 适配

**必须交付：**

1. server/context-index 代码
2. 搜索接口测试
3. notes 接口测试
4. tts 可用或降级说明

### AI 3：OpenCode 适配 / 测试 / 集成

**负责文件：**

1. `muse/user/projects/learning-assistant/server/opencode-adapter.mjs`
2. `muse/user/projects/learning-assistant/test/server.test.mjs`
3. 视需要补 `muse/src/web/standalone.mjs` 的最小集成点

**负责内容：**

1. 创建/复用 OpenCode session
2. `prompt_async` + `message` 轮询适配
3. SSE 转换
4. member 离线/超时/无消息 等错误处理
5. 集成测试与契约测试

**不负责：**

1. 前端 UI 细节
2. 本地知识索引实现

**必须交付：**

1. OpenCode adapter 代码
2. `/api/chat` 契约测试
3. happy path 集成测试
4. degraded path 集成测试
5. 最终联调报告

### 主集成顺序

1. AI 2 先把检索/notes/tts 路由壳做出来
2. AI 3 并行做 OpenCode 适配层
3. AI 1 最后对接真实 API

### 最后由谁收口

建议由一个主 AI 或你自己做最终集成，只做：

1. 路径修正
2. 路由挂接
3. 测试跑通
4. 启动命令整理

### 最终完成定义

以下 4 条同时满足，才算 3 个 AI 真正合体成功：

1. 契约测试通过
2. happy path 集成测试通过
3. degraded path 集成测试通过
4. 你本人手工试用通过
