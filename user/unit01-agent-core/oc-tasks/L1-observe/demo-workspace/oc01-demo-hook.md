# oc01-demo-hook: OpenCode Plugin Hook 拦截 LLM 通信

> 通过 OpenCode 插件机制，拦截并展示发给大模型的所有数据。

## 1. 概述

OpenCode 内部使用 **Vercel AI SDK** 的 `streamText()` 调用大模型。在调用前后，提供了 **7 个 Plugin Hook** 让插件介入。本 demo 利用这些 hook 把发给 LLM 的完整内容 dump 到 JSON 文件中。

---

## 2. 插件加载机制（关键！踩坑总结）

### 2.1 OpenCode 扫描插件的逻辑

源码位置: `config/config.ts` → `loadPlugin(dir)` (L497-509)

```ts
async function loadPlugin(dir: string) {
  for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", { cwd: dir })) {
    plugins.push(pathToFileURL(item).href)
  }
}
```

OpenCode 对 **每一个 config directory** 执行 `loadPlugin(dir)`，在 `dir` 下扫描 `plugin/` 或 `plugins/` 子目录中的 `.ts` / `.js` 文件。

### 2.2 Config directories 的来源

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

### 2.3 踩坑：源码启动时 CWD ≠ 项目目录

**核心矛盾**: 从源码启动时，CWD 必须在 opencode 源码目录（否则 Bun 找不到 `node_modules`），但 OpenCode 用 CWD 来查找 `.opencode/` 目录。

```
CWD = make-muse/reference/opencode/packages/opencode
       ↑ Bun 需要这里来解析 react 等依赖
       ↑ 但 .opencode/ 目录在 demo-workspace 下
```

**错误尝试**:

| 方法 | 结果 | 原因 |
|------|------|------|
| `--cwd /path/to/demo-workspace` | ❌ 无此参数 | serve 命令不支持 --cwd |
| cd 到 demo-workspace + 绝对路径跑 bun | ❌ `Cannot find module 'react'` | Bun monorepo 依赖解析失败 |
| `OPENCODE_CONFIG=opencode.json` | ❌ 插件没加载 | OPENCODE_CONFIG 只加载配置文件，不加载 plugins 目录 |

**正确方案**: 使用 `OPENCODE_CONFIG_DIR` 环境变量

### 2.4 正确的启动命令 ✅

```bash
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/Users/xulater/Code/assistant-agent/muse/user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

**为什么这样可以**:
1. **CWD 在 opencode 源码目录** → Bun 能找到 `node_modules/{react,Vercel AI SDK,...}`
2. **`OPENCODE_CONFIG_DIR` 指向 `demo-workspace/.opencode`** → 被加入 directories 列表
3. **`loadPlugin()` 扫描该目录** → 找到 `plugins/dump-llm.js` → 插件加载成功

### 2.5 `OPENCODE_CONFIG_DIR` 的关键细节

- 必须指向一个**目录**，不是文件
- 该目录下的 `plugins/*.js` 或 `plugin/*.js` 会被自动发现
- 该目录下的 `opencode.json` / `opencode.jsonc` 也会被自动加载
- 该目录下的 `agents/*.md` 和 `commands/*.md` 也会被加载

### 2.6 另一种方式: opencode.json 的 plugin 数组

在 `opencode.json` 中显式指定插件路径：

```json
{
  "plugin": [
    "file:///absolute/path/to/dump-llm.js"
  ]
}
```

但这种方式需要配合 `OPENCODE_CONFIG` 加载该配置文件，且 `OPENCODE_CONFIG` 只加载 JSON 内容，**不会扫描同目录下的 plugins/ 子目录**。所以推荐用 `OPENCODE_CONFIG_DIR`。

### 2.7 通用模板（所有 oc-tasks 通用）

```bash
# 模板：在 opencode 源码目录启动，加载任意 .opencode 目录
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/path/to/your-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

插件放在 `/path/to/your-workspace/.opencode/plugins/your-plugin.js`。

---

## 3. Hook 触发链路

```
用户消息 → POST /session/{id}/prompt_async
              │
              ▼
     ┌─ SessionPrompt.loop() ─────────────────────────┐
     │                                                 │
     │  ① experimental.chat.messages.transform         │
     │     ↓ 拦截完整对话历史 (messages 数组)             │
     │                                                 │
     │  ② experimental.chat.system.transform           │
     │     ↓ 拦截 system prompt                        │
     │                                                 │
     │  ③ chat.params                                  │
     │     ↓ 拦截 LLM 参数 (temperature/topP/topK)     │
     │                                                 │
     │  ④ chat.headers                                 │
     │     ↓ 拦截 HTTP headers                         │
     │                                                 │
     │  ⑤ streamText() ─→ LLM API ─→ 流式响应          │
     │                                                 │
     │  ⑥ tool.execute.before / tool.execute.after     │
     │     ↓ 拦截工具调用（如果 LLM 调了工具的话）         │
     │                                                 │
     │  ⑦ experimental.text.complete                   │
     │     ↓ 拦截 AI 最终回复文本                        │
     └─────────────────────────────────────────────────┘
```

**实际观察到的触发顺序**（从 hook-dump/ 文件编号）:

| 编号 | 文件 | 说明 |
|------|------|------|
| 001 | system-prompt.json (3KB) | **标题生成**的 system prompt (small=true) |
| 002 | chat-params.json (5KB) | 标题生成的 LLM 参数 |
| 003 | chat-headers.json | 标题生成的 HTTP headers |
| 004 | messages.json (1KB) | **主回答**的消息历史 |
| 005 | system-prompt.json (39KB) | **主回答**的 system prompt (巨大!) |
| 006 | chat-params.json (33KB) | 主回答的 LLM 参数（含完整工具定义） |
| 007 | chat-headers.json | 主回答的 HTTP headers |

> **关键发现**: 每次 prompt 会触发 **两轮** LLM 调用：
> 1. `small=true` — 生成会话标题（gpt-5-nano，3KB system prompt）
> 2. `small=false` — 真正回答用户（claude-opus-4-6，39KB system prompt）

---

## 4. 各 Hook 详解

### ① `experimental.chat.system.transform`

**拦截数据（真实示例）**:

**标题生成 (001-system-prompt.json)**: 2KB，简单的标题生成指令
```
You are a title generator. You output ONLY a thread title...
```

**主回答 (005-system-prompt.json)**: 37KB，包含完整的 agent prompt
```
<Role>
You are "Sisyphus" - Powerful AI Agent with orchestration capabilities...
</Role>
<Behavior_Instructions>
## Phase 0 - Intent Gate (EVERY message)
...
</Behavior_Instructions>
...
<env>
  Working directory: /Users/xulater/.../opencode/packages/opencode
  Platform: darwin
</env>
Instructions from: .../AGENTS.md
...
```

### ② `experimental.chat.messages.transform`

**拦截数据**: 当前只有一条 user 消息
```json
{
  "messages": [{
    "info": { "role": "user", "id": "msg_xxx" },
    "parts": [{ "type": "text", "text": "你好！请用一句话介绍你自己。" }]
  }]
}
```

### ③ `chat.params`

**拦截数据**: LLM 调用参数 + 完整工具列表
```json
{
  "temperature": 0.7,
  "topP": 0.9,
  "topK": 40,
  "options": { ... }
}
```

### ④ `chat.headers`

**拦截数据**: HTTP headers（本次为空 `{}`）

### ⑤ `tool.execute.before` / `tool.execute.after`

本次未触发（模型直接回答，没调工具）。

### ⑥ `experimental.text.complete`

本次未在 dump 中出现（可能该 hook 的触发时机在 processor 层）。

---

## 5. 发给 LLM 的完整请求结构

最终发给 `streamText()` 的参数（源码 `llm.ts:173-256`）:

```js
streamText({
  model: wrappedLanguageModel,
  messages: [
    { role: "system", content: "system prompt (37KB agent prompt + env info)" },
    { role: "user", content: [{ type: "text", text: "你好！" }] },
    // ... 完整对话历史
  ],
  tools: {
    read: { description: "...", parameters: {...} },
    edit: { description: "...", parameters: {...} },
    bash: { description: "...", parameters: {...} },
    // ... 约 30 个工具
  },
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 16384,
  headers: { "User-Agent": "opencode/..." },
  providerOptions: { ... }
})
```

---

## 6. 插件编写规范

### 6.1 插件文件格式

```js
// .opencode/plugins/my-plugin.js
export default async function(input) {
  // input.client    — OpenCode SDK client
  // input.project   — 当前项目信息
  // input.directory — 项目目录 (= CWD)
  // input.worktree  — Git worktree 根
  // input.serverUrl — Server URL
  // input.$         — BunShell

  return {
    "hook.name": async (ctx, output) => {
      // ctx    = 输入上下文（只读，如 sessionID, model）
      // output = 可修改的输出对象
    }
  }
}
```

### 6.2 dump-llm.js 的关键设计

```js
// 用 import.meta.url 而不是 input.directory 来定位 dump 目录
// 因为 input.directory = CWD = opencode 源码目录，不是 demo-workspace
const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const dumpDir = path.join(pluginDir, "..", "..", "hook-dump")
```

---

## 7. 操作步骤

### Step 1: 启动 Server

```bash
cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode

OPENCODE_CONFIG_DIR=/Users/xulater/Code/assistant-agent/muse/user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

成功标志: 终端输出 `[dump-llm] 🚀 插件已加载! dump 目录: ...`

### Step 2: 运行 Demo 脚本

```bash
node user/unit01-agent-core/oc-tasks/L1-observe/oc01-demo-hook.mjs
```

### Step 3: 查看 Dump 数据

```bash
ls demo-workspace/hook-dump/

# System Prompt 完整内容
cat demo-workspace/hook-dump/005-system-prompt.json | jq '.prompts[0].full' | head -50

# LLM 参数 + 工具列表
cat demo-workspace/hook-dump/006-chat-params.json | jq .
```

---

## 8. 文件清单

| 文件 | 用途 |
|------|------|
| `.opencode/plugins/dump-llm.js` | 插件实现（7 个 hook 拦截 + 写 JSON） |
| `oc01-demo-hook.mjs` | 调用脚本（发消息 + 读取 dump + 格式化展示） |
| `hook-dump/*.json` | 插件输出的拦截数据（运行后生成） |
| `opencode.json` | 项目配置（model/permissions） |

---

## 9. 速查卡

### 加载自定义 Plugin 的正确方式

```bash
# 1. 把插件放到 your-workspace/.opencode/plugins/xxx.js
# 2. 用 OPENCODE_CONFIG_DIR 指向 .opencode 目录
# 3. cd 到 opencode 源码目录，启动 server

cd /path/to/opencode/packages/opencode
OPENCODE_CONFIG_DIR=/path/to/your-workspace/.opencode \
bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
```

### 环境变量速查

| 环境变量 | 用途 | 指向 |
|---------|------|------|
| `OPENCODE_CONFIG_DIR` | 额外的 config 目录（含 plugins/agents/commands） | 目录路径 |
| `OPENCODE_CONFIG` | 额外的 opencode.json 配置文件 | 文件路径 |
| `OPENCODE_CONFIG_CONTENT` | 内联 JSON 配置内容 | JSON 字符串 |

### 关键区别

| 环境变量 | 加载 opencode.json | 扫描 plugins/ | 扫描 agents/ |
|---------|-------------------|--------------|-------------|
| `OPENCODE_CONFIG_DIR` | ✅ | ✅ | ✅ |
| `OPENCODE_CONFIG` | ✅ | ❌ | ❌ |
