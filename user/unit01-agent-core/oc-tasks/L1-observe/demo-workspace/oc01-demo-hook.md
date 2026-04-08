# oc01-demo-hook: OpenCode Plugin Hook 拦截 LLM 请求上下文

> 通过 OpenCode 插件机制，拦截发给大模型的主要请求上下文（system prompt、消息历史、调用参数等）。
>
> **注意**: Hook 拦截的是 Plugin 可修改的数据切面，不是最终发给 LLM API 的完整请求。最终请求还包含 OpenCode 在 hook 之后合入的 headers、tools 等字段。

---

## 1. 插件加载机制（关键！踩坑总结）

### 1.1 OpenCode 扫描插件的逻辑

源码位置: `config/config.ts` → `loadPlugin(dir)` (L497-509)

```ts
async function loadPlugin(dir: string) {
  for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", { cwd: dir })) {
    plugins.push(pathToFileURL(item).href)
  }
}
```

OpenCode 对 **每一个 config directory** 执行 `loadPlugin(dir)`，在 `dir` 下扫描 `plugin/` 或 `plugins/` 子目录中的 `.ts` / `.js` 文件。

### 1.2 Config directories 的来源

源码位置: `config/paths.ts` → `directories()` (L22-43)

```ts
export async function directories(directory, worktree) {
  return [
    Global.Path.config,                    // ~/.config/opencode/
    ...findUp(".opencode", directory),      // 从 CWD 向上找 .opencode/
    ...findUp(".opencode", home),           // ~/
    ...(OPENCODE_CONFIG_DIR ? [OPENCODE_CONFIG_DIR] : []),  // 环境变量
  ]
}
```

| 来源 | 说明 |
|------|------|
| `~/.config/opencode/` | 全局配置目录 |
| `{CWD}/.opencode/` | 项目级，从 CWD 向上查找 |
| `~/.opencode/` | Home 目录级 |
| `OPENCODE_CONFIG_DIR` | **环境变量手动指定** |

### 1.3 踩坑：源码启动时 CWD ≠ 项目目录

**核心矛盾**: 从源码启动时，CWD 必须在 opencode 源码目录（否则 Bun 找不到 `node_modules`），但 OpenCode 用 CWD 来查找 `.opencode/` 目录。

```
CWD = make-muse/reference/opencode/packages/opencode
       ↑ Bun 需要这里的 node_modules（monorepo 依赖解析）
       ↑ 但 .opencode/ 目录在 demo-workspace 下
```

**错误尝试**:

| 方法 | 结果 | 原因 |
|------|------|------|
| `--cwd /path/to/demo-workspace` | ❌ 无此参数 | serve 命令不支持 --cwd |
| cd 到 demo-workspace + 绝对路径跑 bun | ❌ `Cannot find module 'react'` | Bun monorepo 依赖解析失败 |
| `OPENCODE_CONFIG=opencode.json` | ❌ 插件没加载 | **OPENCODE_CONFIG 只加载 JSON 配置文件，不扫描 plugins/ 目录** |

**正确方案**: 使用 `OPENCODE_CONFIG_DIR` 环境变量

### 1.4 正确的启动命令 ✅

```bash
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/Users/xulater/Code/assistant-agent/muse/user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

**为什么这样可以**:
1. **CWD 在 opencode 源码目录** → Bun 能找到 `node_modules/{react,Vercel AI SDK,...}`
2. **`OPENCODE_CONFIG_DIR` 指向 `demo-workspace/.opencode`** → 被加入 directories 列表
3. **`loadPlugin()` 扫描该目录** → 找到 `plugins/dump-llm.js` → 插件加载成功

### 1.5 `OPENCODE_CONFIG_DIR` 的关键细节

- 必须指向一个**目录**，不是文件
- 该目录下的 `plugins/*.js` 或 `plugin/*.js` 会被自动发现
- 该目录下的 `opencode.json` / `opencode.jsonc` 也会被自动加载
- 该目录下的 `agents/*.md` 和 `commands/*.md` 也会被加载

### 1.6 环境变量速查

| 环境变量 | 加载 opencode.json | 扫描 plugins/ | 扫描 agents/ |
|---------|-------------------|--------------|-------------|
| `OPENCODE_CONFIG_DIR` | ✅ | ✅ | ✅ |
| `OPENCODE_CONFIG` | ✅ | ❌ | ❌ |
| `OPENCODE_CONFIG_CONTENT` | ✅ (内联 JSON) | ❌ | ❌ |

### 1.7 通用模板（所有 oc-tasks 通用）

```bash
# 模板：在 opencode 源码目录启动，加载任意 .opencode 目录
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/path/to/your-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

插件放在 `/path/to/your-workspace/.opencode/plugins/your-plugin.js`。

---

## 2. Hook 触发链路

### 2.1 源码级调用顺序

每次 `prompt_async` 会触发 **两条独立的 LLM 调用路径**，它们经过的 hook 不同：

#### 路径 A: 标题生成 (small=true)

源码: `prompt.ts:1938` → 直接调 `LLM.stream({ small: true, ... })`

```
LLM.stream()
  ├── experimental.chat.system.transform  ← 标题生成的 system prompt
  ├── chat.params                          ← 标题生成的参数
  ├── chat.headers                         ← headers
  └── streamText()                         ← 发给 LLM
```

**不经过** `experimental.chat.messages.transform`，因为标题生成路径直接构造 messages 传入 `LLM.stream()`，不走 `prompt.ts:652` 的主消息拼装逻辑。

#### 路径 B: 主回答 (small=false)

源码: `prompt.ts:652` → `processor.process()` → `LLM.stream()`

```
prompt.ts:652  experimental.chat.messages.transform  ← 拦截完整对话历史
    ↓
LLM.stream()
  ├── experimental.chat.system.transform  ← 主回答的 system prompt
  ├── chat.params                          ← 主回答的参数
  ├── chat.headers                         ← headers（插件可修改的部分）
  ├── resolveTools()                       ← 解析工具定义 (在 chat.params 之后!)
  └── streamText() → LLM API
          ↓ 流式响应
  ├── tool.execute.before / after          ← 如果 LLM 调了工具
  └── experimental.text.complete           ← AI 回复文本完成 (processor.ts:323)
```

### 2.2 实际 dump 文件与路径对应

| 编号 | 文件 | 路径 | 说明 |
|------|------|------|------|
| 001 | system-prompt.json (3KB) | A: 标题 | 标题生成的 system prompt |
| 002 | chat-params.json (5KB) | A: 标题 | 标题生成的 LLM 参数（含 agent 信息） |
| 003 | chat-headers.json | A: 标题 | 插件可修改的 headers（`{}`，因为初始为空） |
| 004 | messages.json (1KB) | B: 主回答 | 对话历史（仅 1 条 user 消息） |
| 005 | system-prompt.json (39KB) | B: 主回答 | 主回答的 system prompt（含完整 agent prompt） |
| 006 | chat-params.json (33KB) | B: 主回答 | 主回答的 LLM 参数（含 agent 信息，**不含工具定义**） |
| 007 | chat-headers.json | B: 主回答 | 同上，`{}` |

> **关键纠正**: 006 文件 33KB 大是因为它包含了完整的 `agent` 对象（含 agent prompt 文本和 permission 列表），**不是**因为它包含工具定义。工具定义在 `resolveTools()` 中解析，发生在 `chat.params` hook 之后（llm.ts:151 vs llm.ts:115）。

---

## 3. 各 Hook 详解

### ① `experimental.chat.messages.transform`

**源码位置**: `prompt.ts:652`（在 `LLM.stream()` 之前，prompt 层）

**重要**: 此 hook **仅在主回答路径触发**，标题生成路径不经过此 hook。

**拦截数据**:
```js
{
  messages: [{
    info: { role: "user", id: "msg_xxx", agent: "Sisyphus" },
    parts: [{ type: "text", text: "你好！请用一句话介绍你自己。" }]
  }]
}
```

### ② `experimental.chat.system.transform`

**源码位置**: `llm.ts:84`（在 `LLM.stream()` 内部）

**两条路径都触发**，但内容截然不同：

| 路径 | 大小 | 内容 |
|------|------|------|
| 标题生成 | ~2KB | "You are a title generator. You output ONLY a thread title..." |
| 主回答 | ~37KB | 完整 agent prompt + env info + AGENTS.md instructions |

**system prompt 的拼装逻辑** (llm.ts:68-81 + prompt.ts:654-660):

llm.ts 内部拼装:
1. **Agent Prompt** — 如果 agent 配置了 `prompt` 字段
2. **Provider Prompt** — 否则用 provider 默认 prompt
3. **`input.system` 数组** — 来自 prompt.ts 传入的环境/技能/指令

prompt.ts 构造 `system` 数组 (仅主回答路径):
1. **环境 Prompt** — `SystemPrompt.environment()`
2. **技能 Prompt** — `SystemPrompt.skills()`
3. **指令 Prompt** — `InstructionPrompt.system()`（AGENTS.md 等）

### ③ `chat.params`

**源码位置**: `llm.ts:115-132`

**触发时机**: 在 `resolveTools()` **之前**（llm.ts:151）

**拦截数据**: temperature, topP, topK, 以及 provider 特定的 options 对象。
```json
{
  "temperature": null,
  "topP": null,
  "topK": null,
  "options": { "thinking": { "type": "adaptive" }, "effort": "high" }
}
```

> **注意**: `chat.params` 的 output 对象**不包含工具定义**。006 文件之所以大（33KB），是因为 `ctx.agent` 包含了完整的 agent prompt 文本和 permission 列表，不是工具。

### ④ `chat.headers`

**源码位置**: `llm.ts:134-146`

**拦截的是插件可修改的 headers 部分**（初始为 `{}`）。最终发给 LLM API 的 headers 是在 `streamText()` 调用时合成的（llm.ts:209-224）：

```ts
// llm.ts:209-224 — streamText() 内部的 headers 合成
headers: {
  // 1. Provider 特定 headers（代码硬编码，不经过 hook）
  ...(providerID.startsWith("opencode")
    ? { "x-opencode-project": ..., "x-opencode-session": ... }  // opencode 路由用
    : providerID !== "anthropic"
      ? { "User-Agent": `opencode/${version}` }
      : undefined),
  // 2. Model 配置的 headers
  ...input.model.headers,
  // 3. Plugin hook 可修改的 headers（chat.headers 产出的就是这部分）
  ...headers,  // ← 插件在这里注入
}
```

所以 dump 里 `headers: {}` 是正常的 — 它只是插件可控的那一层，provider 层的 headers 不经过此 hook。

### ⑤ `tool.execute.before` / `tool.execute.after`

**仅在 LLM 决定调用工具时触发**。本次 demo 模型直接回答没调工具，所以未触发。

### ⑥ `experimental.text.complete`

**源码位置**: `processor.ts:323`（在 `text-end` 事件处理中）

```ts
case "text-end":
  if (currentText) {
    currentText.text = currentText.text.trimEnd()
    const textOutput = await Plugin.trigger(
      "experimental.text.complete",
      { sessionID, messageID, partID },
      { text: currentText.text },
    )
    currentText.text = textOutput.text
  }
```

**确定会触发**，在 stream 的 `text-end` 事件时。本次 dump 中未出现，可能是因为运行时 dump-llm 插件版本和最终版不一致导致。

---

## 4. 发给 LLM 的完整请求结构

最终发给 `streamText()` 的参数（源码 `llm.ts:173-256`）:

```js
streamText({
  model: wrappedLanguageModel,

  // ─── 消息 ───
  messages: [
    { role: "system", content: "system prompt (经过 hook ②)" },
    ...input.messages,  // 经过 hook ①
  ],

  // ─── 工具 (在 chat.params hook 之后才解析) ───
  tools: { read: {...}, edit: {...}, bash: {...}, /* ~30 个 */ },
  activeTools: ["read", "edit", "bash", ...],

  // ─── 参数 (经过 hook ③) ───
  temperature, topP, topK,
  maxOutputTokens,
  providerOptions: { ... },

  // ─── Headers (hook ④ 只控制 ...headers 这一层) ───
  headers: {
    ...providerSpecificHeaders,  // 代码硬编码，不经过 hook
    ...input.model.headers,      // 模型配置
    ...headers,                   // hook ④ 可修改
  },
})
```

### Hook 能拦截 vs 不能拦截

| 数据 | Hook 能拦截？ | 说明 |
|------|-------------|------|
| System Prompt | ✅ | `experimental.chat.system.transform` |
| Messages 历史 | ✅ (仅主回答) | `experimental.chat.messages.transform` |
| temperature/topP/topK | ✅ | `chat.params` |
| Provider options | ✅ | `chat.params` 的 output.options |
| 自定义 HTTP headers | ✅ | `chat.headers` |
| **工具定义** | ❌ | 在 hook 之后由 `resolveTools()` 生成 |
| **Provider 硬编码 headers** | ❌ | `x-opencode-*` / `User-Agent` |
| **maxOutputTokens** | ❌ | 代码计算，无 hook |

> 注: `tool.definition` hook 可以修改单个工具的 description 和 parameters，但不在 `chat.params` 中。

---

## 5. 插件编写规范

### 5.1 插件文件格式

```js
// .opencode/plugins/my-plugin.js
export default async function(input) {
  // input.client    — OpenCode SDK client
  // input.project   — 当前项目信息
  // input.directory — 项目目录 (= CWD，源码启动时是 opencode 源码目录!)
  // input.worktree  — Git worktree 根
  // input.serverUrl — Server URL
  // input.$         — BunShell

  return {
    "hook.name": async (ctx, output) => {
      // ctx    = 输入上下文（只读）
      // output = 可修改的输出对象（插件可以改这里影响后续流程）
    }
  }
}
```

### 5.2 dump-llm.js 的关键设计

```js
// ⚠️ 用 import.meta.url 而不是 input.directory 来定位 dump 目录!
// 因为 input.directory = CWD = opencode 源码目录，不是 demo-workspace
const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const dumpDir = path.join(pluginDir, "..", "..", "hook-dump")
```

---

## 6. 操作步骤

### Step 1: 启动 Server

```bash
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/Users/xulater/Code/assistant-agent/muse/user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

成功标志: 终端输出 `[dump-llm] 🚀 插件已加载! dump 目录: ...`

### Step 2: 运行 Demo 脚本

在**另一个终端**，从 muse 项目根目录运行：

```bash
cd /Users/xulater/Code/assistant-agent/muse
node user/unit01-agent-core/oc-tasks/L1-observe/oc01-demo-hook.mjs
```

### Step 3: 查看 Dump 数据

```bash
# 在 muse 项目根目录下
ls user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/hook-dump/

# System Prompt 完整内容（主回答的）
cat user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/hook-dump/005-system-prompt.json | jq '.prompts[0].length'

# LLM 参数
cat user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/hook-dump/006-chat-params.json | jq '.params'
```

---

## 7. 文件清单

| 文件 | 用途 |
|------|------|
| `.opencode/plugins/dump-llm.js` | 插件实现（7 个 hook 拦截 + 写 JSON） |
| `oc01-demo-hook.mjs` | 调用脚本（发消息 + 读取 dump + 格式化展示） |
| `hook-dump/*.json` | 插件输出的拦截数据（运行后生成，不提交 git） |
| `opencode.json` | 项目配置（model/permissions） |
