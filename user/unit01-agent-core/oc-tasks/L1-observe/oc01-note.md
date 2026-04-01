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

## 问题 1：怎么看发给 LLM 的完整内容？

OpenCode 有 **4 种现有手段**，从易到难：

### ① `--print-logs` 日志（你已经在用）

你的 demo.log 里已经有关键信令了：

```
service=llm providerID=alibaba-coding-plan-cn modelID=kimi-k2.5 ... stream
```

但它**只打了 metadata**（model/provider/agent 名），**没有打 system prompt 和 messages 内容**——源码里只有 `l.info("stream", { modelID, providerID })` 这一行日志（llm.ts:56-59）。

### ② Plugin Hook（最正规的方式）

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

### ③ 断点调试（你现在的方式）

在 `llm.ts:173` 的 `streamText()` 调用处打断点，可以在 Variables 面板检查：
- `system` — 完整 system prompt
- `input.messages` — 完整消息历史
- `tools` — 注册的工具列表

### ④ Vercel AI SDK 内置的 telemetry

llm.ts:249 有 `experimental_telemetry`，但需要配置 OpenTelemetry collector，比较重。

---

## 问题 2：你的 demo.log 日志解读

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

## 问题 3：启动参数解释

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