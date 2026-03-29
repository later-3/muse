# 学习助手 V0 — 3 个 AI 并行开发方案

> **目标：** 用 3 个 AI 并行把 V0 尽快做完，同时避免互相踩文件。  
> **核心选择：** 采用 **OpenCode server 模式**，不直接从学习助手连外部 LLM API。

---

## 一、为什么用 OpenCode server 模式

1. 和 Muse 当前底座一致。
2. 仓库里已有现成接口可复用：
   [`standalone.mjs`](/Users/xulater/Code/assistant-agent/muse/src/web/standalone.mjs#L757)
3. 以后更容易把学习助手能力回灌到 Muse 主系统。
4. 避免再平行造一套独立 LLM provider 调用层。

---

## 二、当前已验证的事实

1. 现有独立 web 服务已经支持 OpenCode session 代理：
   - `GET /api/member/:name/oc/session`
   - `POST /api/member/:name/oc/session`
   - `POST /api/member/:name/oc/session/:sid/prompt_async`
   - `GET /api/member/:name/oc/session/:sid/message`
   见 [`standalone.mjs`](/Users/xulater/Code/assistant-agent/muse/src/web/standalone.mjs#L757)
2. 现有仓库已经有 TTS 可复用：
   [`tts.mjs`](/Users/xulater/Code/assistant-agent/muse/src/voice/tts.mjs#L1)
3. 现有 `web` 模块已经有 HTTP server 和静态页面模式：
   [`api.mjs`](/Users/xulater/Code/assistant-agent/muse/src/web/api.mjs#L1)

**结论：** 方案已经能定，不需要再做大范围前置调研。

---

## 三、唯一还要注意的技术约束

OpenCode 当前不是天然 token SSE，而是：

1. `prompt_async`
2. `轮询 session / message`
3. 再拿到完整或增量消息

所以学习助手自己的 server 需要多做一层：

1. 把 OpenCode 轮询结果
2. 转成前端需要的 SSE 或伪流式

> 这不是 blocker，只是实现细节要先说清楚。

---

## 四、推荐架构

```text
浏览器
  -> learning-assistant-server
       -> context-index (本地知识检索)
       -> notes 保存
       -> TTS
       -> OpenCode adapter
            -> standalone / member oc session API
                 -> opencode serve
```

---

## 五、3 个 AI 的分工

### AI A：前端

**目标：** 做出可用页面和语音交互壳。

**写入范围：**

1. `muse/user/projects/learning-assistant/web/index.html`
2. `muse/user/projects/learning-assistant/web/app.js`
3. `muse/user/projects/learning-assistant/web/style.css`

**负责：**

1. 页面 UI
2. 文本输入
3. 语音识别
4. 播放器
5. 笔记面板
6. 前端状态机

**必须遵守：**

1. 只按契约文档消费接口，不自创字段。
2. 先用 mock 数据把页面跑通，再接真实接口。
3. 交付时附一份“前端对接说明”。

### AI B：知识检索 / Notes / TTS

**目标：** 把“学习资料 -> 可问答上下文”这层打通。

**写入范围：**

1. `muse/user/projects/learning-assistant/server/server.mjs`
2. `muse/user/projects/learning-assistant/server/context-index.mjs`

**负责：**

1. 搜索接口
2. notes 保存接口
3. TTS 接口
4. 文档扫描
5. 片段抽取

**必须遵守：**

1. 不改前端文件。
2. 接口字段名严格按契约。
3. notes 保存路径固定，不临时换目录。
4. 交付时附一份“接口样例响应”。

### AI C：OpenCode 适配 / 测试

**目标：** 把学习助手真正接到 OpenCode server。

**写入范围：**

1. `muse/user/projects/learning-assistant/server/opencode-adapter.mjs`
2. `muse/user/projects/learning-assistant/test/server.test.mjs`
3. 只在必要时改 `muse/src/web/standalone.mjs`

**负责：**

1. 创建 session
2. `prompt_async`
3. `message` 轮询
4. SSE 转换
5. 错误处理
6. 集成测试

**必须遵守：**

1. 你是集成守门员，不只是写 adapter。
2. 你负责锁 SSE 事件格式。
3. 你负责最终 happy/degraded path 集成结论。
4. 若发现契约问题，你提 issue，不直接大改别人的模块。

---

## 六、执行顺序

1. AI B 和 AI C 先并行
   因为这两条后端链路互不冲突。
2. AI A 同时做前端壳
   先用 mock 数据或假接口跑 UI。
3. 最后统一联调
   把 A 接到 B+C 的真实接口。

### 详细联调顺序

1. AI B 先给出：
   `search/notes/tts` 可用接口 + 样例响应
2. AI C 给出：
   OpenCode adapter + `/api/chat` SSE 契约
3. AI A 按固定契约接入真实接口
4. AI C 运行集成测试并出联调报告
5. 你亲自做 5 分钟试用

---

## 七、你该怎么发任务

### 给 AI A

“你只负责前端，不要碰后端。按 `voice-chat-design.md` 和 `v0-ai-build-spec.md` 做页面、状态机、语音输入和音频播放。你必须用 mock 数据先跑通，再按固定 SSE 契约对接真实接口。交付页面文件、状态机说明、自测记录。”

### 给 AI B

“你只负责后端的本地知识检索、笔记保存和 TTS，不要碰前端和 OpenCode 适配。你必须交接口实现、接口样例响应、搜索/notes/tts 测试。字段名严格按规格，不要自创。”

### 给 AI C

“你只负责 OpenCode server 模式接入、session/prompt/message 轮询转 SSE、以及测试，不要碰前端 UI 和知识检索实现。你是集成守门员，必须交 adapter、契约测试、happy path/degraded path 集成测试、联调报告。”

### 你自己要补充的一句话

“任何人都不要为了省事修改别人的接口约定；如果发现问题，先提出来，再统一改规格。”

---

## 八、我现在的建议

1. **方案已经可以定。**
2. **不需要再做一轮大调研。**
3. 现在最重要的是把 3 个 AI 的写入范围锁死，避免冲突。

> 也就是说：现在该进入开发，不是继续讨论概念。

---

## 九、我预期他们会怎么做

### AI A 的正常产出

1. 很快先做一个可点击的静态页面。
2. 用假数据模拟 `context/token/done` 跑 UI。
3. 再接真实接口。

### AI B 的正常产出

1. 先把目录扫描和索引跑通。
2. 再做 `search/notes/tts` 三个接口。
3. 输出几份样例响应给 A 和 C 对接。

### AI C 的正常产出

1. 先验证 OpenCode session/prompt/message 链路。
2. 再做 adapter。
3. 最后写测试并负责联调收口。

### 最容易出问题的点

1. SSE 字段名漂移
2. notes 保存路径漂移
3. 语音播放和识别互相打架
4. OpenCode 轮询超时

> 所以：AI C 一定要当集成守门员，不能只是“写完自己的那部分”。
