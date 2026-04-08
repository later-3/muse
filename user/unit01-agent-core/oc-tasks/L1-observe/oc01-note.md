# oc01-note: OpenCode Agent Loop 拆解

> 对 OpenCode **Session → Loop → LLM 调用** 完整链路的拆解分析。
> 这是 OpenCode 的核心功能：**把用户的一句话变成一次或多次 LLM 调用，并处理工具调用循环**。

---

## 一、这是在拆解 OpenCode 的什么功能？

OpenCode 的 **Session Prompt 处理管线**（session/prompt.ts + session/llm.ts + session/processor.ts），它负责：

1. 接收用户消息
2. 组装发给 LLM 的完整请求（system prompt + 消息历史 + 工具 + 参数）
3. 处理 LLM 的流式响应（文本、思考、工具调用）
4. 如果 LLM 调了工具，执行工具后重新调 LLM（循环）
5. 直到 LLM 说"我回答完了"，循环结束

---

## 二、整体架构：三个层

```
┌─────────────────────────────────────────────────┐
│  Prompt 层 (prompt.ts)                           │
│  负责: 消息管理、Agent Loop 循环、工具调度         │
│  关键函数: prompt() → loop()                     │
├─────────────────────────────────────────────────┤
│  LLM 层 (llm.ts)                                │
│  负责: 拼装 system prompt、参数、headers、调 API   │
│  关键函数: LLM.stream()                          │
├─────────────────────────────────────────────────┤
│  Processor 层 (processor.ts)                     │
│  负责: 解析流式响应、分发事件、执行工具回调         │
│  关键函数: processor.process()                   │
└─────────────────────────────────────────────────┘
```

调用关系：`prompt.ts:loop()` → `processor.process()` → `LLM.stream()` → Vercel AI SDK `streamText()`

---

## 三、发给 LLM 的完整内容（6 类）

最终 `streamText()` 的调用（llm.ts:173-256），这就是 OpenCode 发给 LLM API 的全部内容：

### 模型能"看到"的（影响 AI 行为）

#### 1. messages — 系统指令 + 对话历史

```ts
// llm.ts:226-234
messages: [
  // system prompt（1-2 段，拼在 messages 最前面）
  ...system.map(x => ({ role: "system", content: x })),
  // 对话历史（用户消息、AI 回复、工具结果……）
  ...input.messages,
]
```

**System Prompt 的拼装**（llm.ts:68-81）：

```
system[0] = agent.prompt         // Agent 的行为规范（如 Sisyphus 的 37KB prompt）
           + input.system[]      // 环境信息 + 技能描述 + AGENTS.md 指令
           + input.user.system   // 用户自定义 system（如果有）
```

其中 `input.system` 是在 prompt.ts:654-660 构造的：
```ts
const system = [
  ...SystemPrompt.environment(model),  // OS/Shell/CWD/Git 等环境
  ...SystemPrompt.skills(agent),       // 可用技能描述
  ...InstructionPrompt.system(),       // AGENTS.md 等指令文件
]
```

**用户的消息** 在 `input.messages` 里，是 `{ role: "user", content: "你好！" }` 的格式。

> **Hook**: `experimental.chat.messages.transform` (prompt.ts:652) 拦截消息历史
> **Hook**: `experimental.chat.system.transform` (llm.ts:84) 拦截 system prompt

#### 2. tools — 工具定义

```ts
// llm.ts:204-205
activeTools: Object.keys(tools).filter(x => x !== "invalid"),
tools,  // ~30 个工具：read, edit, bash, glob, grep, task, webfetch...
```

工具在 `resolveTools()` 中解析（llm.ts:151），发生在 `chat.params` hook **之后**。

> **Hook**: `tool.definition` (tool/registry.ts:163) 可修改单个工具的 description/parameters

#### 3. 采样参数

```ts
// llm.ts:200-203
temperature: params.temperature,  // 采样温度
topP: params.topP,                // nucleus sampling
topK: params.topK,                // top-k sampling
providerOptions: {...},           // provider 特定选项（如 thinking、effort）
```

> **Hook**: `chat.params` (llm.ts:115) 拦截/修改参数

### SDK/服务器用的（模型看不见）

#### 4. model — 模型实例

```ts
// llm.ts:235-248
model: wrapLanguageModel({
  model: language,        // Vercel AI SDK 的模型实例
  middleware: [{           // 中间件：ProviderTransform 消息格式适配
    transformParams(args) { ... }
  }],
})
```

不经过任何 hook。

#### 5. headers — HTTP 请求头

```ts
// llm.ts:209-224
headers: {
  // Provider 硬编码（不经过 hook）
  ...(opencode provider → x-opencode-project/session/request/client)
  ...(其他 provider → User-Agent)
  // Model 配置的 headers
  ...input.model.headers,
  // Plugin hook 可修改的层
  ...headers,  // ← chat.headers hook 控制的就是这一层
}
```

> **Hook**: `chat.headers` (llm.ts:134) — 只控制 `...headers` 这一层，provider 硬编码的不经过

#### 6. 控制参数

```ts
maxOutputTokens,              // 最大输出 token 数
maxRetries: input.retries ?? 0,  // 重试次数
abortSignal: input.abort,     // 取消信号
toolChoice: "auto" | "required" | "none",
experimental_telemetry: {...},
experimental_repairToolCall(failed) { ... },  // 工具调用修复
onError(error) { ... },
```

不经过任何 hook。

---

## 四、LLM 响应处理

`streamText()` 返回流式事件，由 `processor.ts` 逐个处理：

| 事件 | 处理 | 源码 |
|------|------|------|
| `start` | 设置 session 状态为 busy | processor.ts:59 |
| `reasoning-start/delta/end` | 写入 AI 思考过程 | processor.ts:63-109 |
| `text-start/delta` | 逐字写入 AI 回复 | processor.ts:287-317 |
| `text-end` | 触发 **Hook**: `experimental.text.complete` | processor.ts:320-339 |
| `tool-call-start/delta` | 建立工具调用 part | processor.ts:112-178 |
| `tool-result` | 记录工具执行结果 | processor.ts:181-202 |
| `tool-error` | 记录工具执行失败 | processor.ts:205-229 |
| `start-step` | 创建快照 (Snapshot.track) | processor.ts:234-243 |
| `finish-step` | 记录 usage/cost/tokens | processor.ts:245-264 |
| `finish` | (空操作) | processor.ts:343 |

---

## 五、Agent Loop 循环

prompt.ts:297 的 `while(true)` 循环：

```
Step 1 (首轮):
  ├── ensureTitle() — 并行生成标题（小模型，不阻塞）
  ├── resolveTools() — 解析可用工具
  ├── Hook ① 拦截消息历史
  ├── 构造 system prompt
  ├── processor.process() → LLM.stream() → streamText()
  │     └── 流式接收响应
  └── 检查 finish reason

如果 finish = "tool-calls":
  Step 2 (工具调用轮):
  ├── 消息历史现在多了 AI 的 tool_call + 工具结果
  ├── Hook ① 拦截更新后的消息历史
  ├── 重新构造请求 → 调 LLM
  └── 检查 finish reason

如果 finish = "stop" 或 "length":
  退出循环
```

### 标题生成 vs 主回答

| | 标题生成 | 主回答 |
|--|---------|--------|
| 触发条件 | step===1 且第一条消息 | 每轮都触发 |
| 模型 | 小模型 (gpt-5-nano) | 配置的主模型 (claude-opus-4-6) |
| 阻塞主流程 | ❌ 并行 | - |
| 经过 messages.transform hook | ❌ | ✅ |
| 经过 system.transform hook | ✅ | ✅ |
| 经过 chat.params hook | ✅ | ✅ |
| tools | 空 {} | ~30 个工具 |
| system prompt | 2KB 标题指令 | 37KB agent prompt |

---

## 六、完整 Hook 清单

按调用时序排列，标注源码位置和所属层：

### 请求阶段（发给 LLM 前）

| # | Hook | 层 | 源码位置 | 拦截内容 | 可修改 |
|---|------|---|---------|---------|--------|
| ① | `experimental.chat.messages.transform` | Prompt | prompt.ts:652 | 消息历史数组 | ✅ output.messages |
| ② | `experimental.chat.system.transform` | LLM | llm.ts:84 | system prompt 数组 | ✅ output.system |
| ③ | `chat.params` | LLM | llm.ts:115 | temperature/topP/topK/options | ✅ output.* |
| ④ | `chat.headers` | LLM | llm.ts:134 | 插件层 HTTP headers | ✅ output.headers |
| - | `tool.definition` | Tool | registry.ts:163 | 单个工具的定义 | ✅ output.description/params |

### 响应阶段（LLM 回复后）

| # | Hook | 层 | 源码位置 | 拦截内容 | 可修改 |
|---|------|---|---------|---------|--------|
| ⑤ | `tool.execute.before` | Prompt | prompt.ts:803 | 工具调用参数 | ✅ output.args |
| ⑥ | `tool.execute.after` | Prompt | prompt.ts:824 | 工具执行结果 | ✅ output.output/title |
| ⑦ | `experimental.text.complete` | Processor | processor.ts:323 | AI 最终回复文本 | ✅ output.text |

### 其他 Hook（不在主流程中）

| Hook | 源码位置 | 用途 |
|------|---------|------|
| `experimental.compaction` | compaction.ts:169 | 上下文压缩时拦截 |
| `shell.env` | prompt.ts:1632, bash.ts:162, pty/index.ts:129 | Shell 环境变量注入 |
| `experimental.event` | prompt.ts:1306, 1871 | 会话事件广播 |

---

## 七、调试方法速查

| 方法 | 看到什么 | 适合场景 |
|------|---------|---------|
| `--print-logs` | 元数据（model/provider/agent） | 快速确认调用链 |
| Plugin Hook (dump-llm.js) | system prompt/messages/params 完整内容 | 分析 prompt 构造 |
| VSCode 断点 (llm.ts:173) | streamText() 所有参数 | 深度调试 |
| hook-dump JSON 文件 | 持久化的拦截数据 | 离线分析 |

### 启动命令

```bash
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/path/to/your-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

| 参数 | 归属 | 含义 |
|------|------|------|
| `--inspect` | Bun | 启动 WebSocket 调试器（端口 6499），允许 IDE attach |
| `--conditions=browser` | Bun | 解析 package.json exports 的 browser 条件分支 |
| `src/index.ts` | 入口 | Bun 直接执行 TypeScript |
| `serve` | OpenCode | headless HTTP server 模式（不启 TUI） |
| `--port 5555` | OpenCode | 监听端口 |
| `--print-logs` | OpenCode | 日志输出到 stderr（终端可见） |
| `OPENCODE_CONFIG_DIR` | OpenCode | 额外的 config 目录，自动扫描 plugins/agents/commands |

---

## 附录：原始调试笔记

> 以下是首次探索 OpenCode hook 机制时的原始记录，保留作为过程参考。

Created demo.log

好问题，让我查一下现有的插件/hook 机制和调试手段：

Searched for "Plugin.trigger"
Searched for "Plugin.trigger"
Searched for "chat\.(params|messages|system|headers)"
Searched for "LOG_LEVEL|--print-logs|--log-level|OPENCODE_LOG"
Viewed llm.ts:47-100
Viewed log.ts:1-183

Now let me check 

Searched for "--inspect|--conditions"
Searched for "conditions.*browser|browser.*conditions"

Now let me look at what the `--conditions=browser` does and check the plugin system:

Viewed llm.ts:47-60
Searched for "chat.params"
Listed directory plugin
Searched for "chat.params"
Viewed index.ts:1-235

信息全齐了，我来一次性给你回答三个问题：

---

### 问题 1：怎么看发给 LLM 的完整内容？

OpenCode 有 **4 种现有手段**，从易到难：

#### ① `--print-logs` 日志（你已经在用）

你的 demo.log 里已经有关键信令了：

```
service=llm providerID=alibaba-coding-plan-cn modelID=kimi-k2.5 ... stream
```

但它**只打了 metadata**（model/provider/agent 名），**没有打 system prompt 和 messages 内容**——源码里只有 `l.info("stream", { modelID, providerID })` 这一行日志（llm.ts:56-59）。

#### ② Plugin Hook（最正规的方式）

OpenCode 提供了多个 plugin hook 可以拦截 LLM 请求：

| Hook 名称 | 时机 | 你能看到什么 |
|---|---|---|
| `chat.params` | 调 LLM 前 | temperature, topP, topK, model options |
| `chat.headers` | 调 LLM 前 | HTTP headers |
| `experimental.chat.system.transform` | system prompt 拼装后 | **完整 system prompt 数组** |
| `experimental.chat.messages.transform` | messages 发送前 | **完整对话历史 messages** |

你可以写一个插件来 dump 这些内容。比如在你的 `opencode.json` 里配一个 plugin：

```js
// dump-llm-plugin.mjs
export default async function(input) {
  return {
    "experimental.chat.system.transform": async (ctx, output) => {
      console.log("=== SYSTEM PROMPT ===")
      console.log(JSON.stringify(output.system, null, 2))
    },
    "experimental.chat.messages.transform": async (ctx, output) => {
      console.log("=== MESSAGES ===")
      for (const msg of output.messages) {
        console.log(`[${msg.info.role}]`, JSON.stringify(msg.parts).slice(0, 500))
      }
    },
    "chat.params": async (ctx, output) => {
      console.log("=== PARAMS ===", JSON.stringify(output))
    }
  }
}
```

#### ③ 断点调试（你现在的方式）

在 `llm.ts:173` 的 `streamText()` 调用处打断点，可以在 Variables 面板检查：
- `system` — 完整 system prompt
- `input.messages` — 完整消息历史
- `tools` — 注册的工具列表

#### ④ Vercel AI SDK 内置的 telemetry

llm.ts:249 有 `experimental_telemetry`，但需要配置 OpenTelemetry collector，比较重。

---

### 问题 2：你的 demo.log 日志解读

你的日志记录了完整的一次请求链路：

```
1. POST /session              → 创建 session (ses_2b8af5d23ff...)
2. POST prompt_async          → 发消息，立即返回 204
3. loop step=0                → Agent Loop 开始
4. llm stream (small=true)    → 第一次 LLM 调用是生成标题（小模型）
5. tool.registry             → 注册了约30个工具（bash/read/edit/write/task...）
6. llm stream (small=false)  → 第二次 LLM 调用是真正回答用户问题
7. message.part.delta        → 流式返回 AI 回复
8. exiting loop              → Loop 结束（模型没调工具，直接回答了）
```

注意有 **两次 LLM 调用**：
- `small=true` → **生成标题**用的小模型调用（并行的，不影响回答）
- `small=false` → **真正给用户回答**的 LLM 调用

---

### 问题 3：启动参数解释

```bash
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

| 参数 | 归属 | 含义 |
|------|------|------|
| `--inspect` | **Bun 运行时** | 启动 WebSocket 调试器（端口 6499），允许 IDE attach 打断点 |
| `--conditions=browser` | **Bun 运行时** | Node.js 的 [条件导出](https://nodejs.org/api/packages.html#conditional-exports)。OpenCode 的某些依赖（如 `@opentui/solid`）在 `package.json` 的 `exports` 里有 `browser` 条件分支，加这个标志让 Bun 解析到 browser 版本的代码。tsconfig.json 里也有对应的 `"customConditions": ["browser"]` |
| `src/index.ts` | **入口文件** | OpenCode 的 TypeScript 入口，Bun 直接执行不需要编译 |
| `serve` | **OpenCode 命令** | yargs 子命令，启动 headless HTTP server 模式（不启动 TUI） |
| `--port 5555` | **OpenCode 参数** | 监听端口 5555 |
| `--print-logs` | **OpenCode 参数** | 把日志输出到 stderr（你的终端），而不是写到日志文件。不加这个参数的话日志会写到 `~/.local/share/opencode/log/dev.log` |