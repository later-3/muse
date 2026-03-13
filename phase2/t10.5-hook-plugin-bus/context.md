# T10.5: Hook / Plugin / Bus — 技术方案

> 本文档是 T10.5 的详细技术方案，按 `/dev-doc` 11 维度编写，供评审和开发参考。

---

## 一、需求背景

### 1.1 现状问题

Phase 1 的 Muse 所有生命周期行为硬编码在 Orchestrator:

```javascript
// orchestrator.mjs — Phase 1 硬编码逻辑
class Orchestrator {
  async handleMessage(text, context) {
    const intent = classifyIntent(text)           // 手动意图分类
    const enriched = this.#buildPrompt(text)       // 手动注入记忆/身份
    const result = await engine.sendAndWait(...)   // 无法拦截工具调用
    const processed = this.#postProcess(result)    // 手动提取偏好/关键词
    return processed
  }
}
```

**问题**:
- 无法在工具调用前/后做审计
- 无法动态修改 system prompt
- 无法感知 Session 错误/空闲事件
- 想加新的自动化行为必须改 Orchestrator 代码

### 1.2 解决方案

OpenCode 原生提供 Plugin/Hook/Bus 三层机制:
- **Plugin**: 外部 JS 模块，注册到 `opencode.json`
- **Hook**: Plugin 暴露的回调函数，在 OpenCode 关键节点被调用
- **Bus**: 内部事件总线，Plugin 通过 `event` hook 订阅全部事件

Muse 编写一个 Plugin，注册需要的 Hook → OpenCode 在运行时回调 → Muse 得到生命周期拦截能力。

---

## 二、目标

| # | 子任务 | 交付物 | 优先级 |
|---|--------|--------|--------|
| H1 | Plugin 壳子 | `muse/plugin/index.mjs` + opencode.json 注册 | P0 |
| H2 | event hook | 接收全部 Bus 事件，写日志文件 | P0 |
| H3 | chat.message hook | 消息到达时记录元信息 | P1 |
| H4 | tool.execute.after | 工具调用审计日志 | P1 |
| H5 | chat.system.transform | 动态 system prompt 注入 | P1 |
| H6 | Session.Error 监听 | 预留 Gap Journal 接口 | P2 (注册不实现) |
| H7 | Session.Idle 监听 | 预留 Pulse 接口 | P2 (注册不实现) |
| H8 | permission.ask | 预留审批链 | P2 (注册不实现) |
| H9 | 测试 | unit + integration + E2E | P0 |

---

## 三、与 Muse 整体的对齐

### 3.1 ARCHITECTURE.md 映射

```
ARCHITECTURE.md 的四感官:
  大脑 (OpenCode) → Plugin 直接拦截大脑内部生命周期
  小脑 (Cerebellum) → 小脑管外部健康，Plugin 管内部生命周期
  触达层 (Telegram) → 不变
  记忆层 (Memory) → tool.execute.after 可审计 MCP 工具调用
```

### 3.2 PHILOSOPHY.md 原则

> **原则四**: 在 OpenCode 架构上扩展 — Plugin/Hook/Skill/MCP

T10.5 正是「Plugin + Hook」这一层:

```
PHILOSOPHY.md 四层扩展:
  1. Skill          → T10 ✅ (最轻)
  2. MCP Server     → T11 ✅
  3. Custom Tool    → T10 ✅
  4. Plugin + Hook  → T10.5 ← 本任务 (最重)
```

### 3.3 长期路线衔接

| Phase | T10.5 提供 |
|-------|-----------|
| P2 | event 日志 + 工具审计 + system prompt 注入 |
| P3 | Session.Idle → Pulse 主动触发 |
| P3 | Session.Error → Gap Journal 能力缺口 |
| P4 | permission.ask → 审批链 |
| P4 | 家族成员各自的 Plugin |

---

## 四、与前后任务的关系

### 上游

| 任务 | 提供 | T10.5 消费 |
|------|------|-----------|
| T10 Skill ✅ | `memory-companion`, `daily-chat` | Hook 中可参考 Skill 策略做决策 |
| T11 MCP ✅ | `memory-server` MCP 5 工具 | `tool.execute.after` 审计 MCP 调用 |

### 下游

| 任务 | 消费 T10.5 的 |
|------|-------------|
| T12 Identity | `chat.system.transform` hook 注入身份 |
| T13 Orchestrator | Hook 接手 buildPrompt/postProcess → Orchestrator 瘦身 |
| T16 Gap Journal | `Session.Error` event → 触发缺口记录 |
| P3 Pulse | `Session.Idle` event → 主动消息 |

### 并行协调

- T10.5 和 T12 都涉及 system prompt → T10.5 用 `chat.system.transform`，T12 用 `AGENTS.md` 静态注入，两者互补不冲突
- T10.5 的 `tool.execute.after` 和 T11 的 MCP audit 表 → Hook 做运行时审计，MCP 做持久化审计

---

## 五、OpenCode 源码分析

### 5.1 Plugin 注册与加载

**文件**: `opencode/packages/opencode/src/plugin/index.ts`

```typescript
// Line 57-98: 加载外部 Plugin
for (let plugin of plugins) {
  if (!plugin.startsWith("file://")) {
    // npm 包: bun install → import
  }
  // file:// 前缀: 直接 import
  await import(plugin).then(async (mod) => {
    const seen = new Set()
    for (const [_name, fn] of Object.entries(mod)) {
      if (seen.has(fn)) continue
      seen.add(fn)
      hooks.push(await fn(input))  // 调用 Plugin 函数，返回 Hooks 对象
    }
  })
}
```

**关键**: Plugin 是一个导出函数的 ESM 模块，函数接收 `PluginInput`，返回 `Hooks` 对象。

### 5.2 Hook 触发机制

**文件**: `opencode/packages/opencode/src/plugin/index.ts:107-122`

```typescript
export async function trigger(name, input, output) {
  for (const hook of await state().then(x => x.hooks)) {
    const fn = hook[name]
    if (!fn) continue
    await fn(input, output)  // 顺序执行，input/output 可被修改
  }
  return output
}
```

**关键**: Hook 是 **顺序** 执行的，每个 Hook 可以修改 output 对象。

### 5.3 Hooks 接口定义

**文件**: `opencode/packages/plugin/src/index.ts:148-234`

14 个 Hook 类型:

| Hook | 触发点 | 用途 |
|------|--------|------|
| `event` | 所有 Bus 事件 | 全局事件监听 |
| `config` | 配置加载后 | 配置修改 |
| `tool` | 工具注册 | 自定义工具 |
| `auth` | 认证流程 | Provider 认证 |
| `chat.message` | 用户消息到达 | 消息拦截/修改 |
| `chat.params` | LLM 调用前 | 修改 temperature 等 |
| `chat.headers` | LLM HTTP 调用前 | 注入 HTTP header |
| `permission.ask` | 权限请求 | 审批链 |
| `command.execute.before` | 命令执行前 | 命令拦截 |
| `tool.execute.before` | 工具执行前 | 参数修改 |
| `tool.execute.after` | 工具执行后 | 审计/日志 |
| `shell.env` | Shell 启动 | 环境变量注入 |
| `experimental.chat.system.transform` | system prompt 组装 | prompt 修改 |
| `experimental.chat.messages.transform` | 消息列表组装 | 上下文修改 |
| `experimental.session.compacting` | compaction 前 | 压缩策略 |
| `experimental.text.complete` | 文本完成后 | 后处理 |
| `tool.definition` | 工具定义发送给 LLM | 工具描述修改 |

### 5.4 Bus 事件体系

**文件**: 各模块定义 `BusEvent.define()`, `Bus.publish()`, `Bus.subscribe()`

| 模块 | 主要事件 | 文件 |
|------|---------|------|
| Session | Created, Updated, Deleted, Diff, Error | `session/index.ts:182-207` |
| Status | Status, Idle | `session/status.ts:28-36` |
| MessageV2 | Updated, Removed, PartUpdated, PartDelta, PartRemoved | `session/message-v2.ts:451-480` |
| Compaction | Compacted | `session/compaction.ts:22` |
| Todo | Updated | `session/todo.ts:18` |
| File | Edited | `tool/apply_patch.ts:223` |
| FileWatcher | Updated | `tool/apply_patch.ts:231` |

**关键**: `Bus.subscribeAll()` (plugin/index.ts:135) 将所有事件转发给 `hook.event()`

### 5.5 PluginInput

**文件**: `opencode/packages/plugin/src/index.ts:26-33`

```typescript
export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>  // SDK client
  project: Project                                    // 项目信息
  directory: string                                   // 工作目录
  worktree: string                                    // git worktree
  serverUrl: URL                                      // ⚠️ 已废弃
  $: BunShell                                         // shell 工具
}
```

---

## 六、技术方案

### 6.1 目录结构

```
muse/plugin/
├── index.mjs              ← Plugin 入口 (ESM, export default function)
├── hooks/
│   ├── event-logger.mjs   ← event hook: 全局事件日志
│   ├── message-hook.mjs   ← chat.message hook: 消息到达处理
│   ├── tool-audit.mjs     ← tool.execute.after hook: 工具审计
│   └── system-prompt.mjs  ← chat.system.transform hook: 动态 prompt
├── bus-bridge.mjs          ← 事件桥接: Bus → Muse 内部 (预留)
└── plugin.test.mjs         ← 测试
```

### 6.2 核心接口

```javascript
// muse/plugin/index.mjs
export default async function musePlugin(input) {
  // input: { client, project, directory, worktree, $ }
  return {
    event: eventLogger(input),        // 全局事件日志
    'chat.message': messageHook(input),
    'tool.execute.after': toolAudit(input),
    'experimental.chat.system.transform': systemPrompt(input),
    // P2 预留 (空实现):
    // 'permission.ask': permissionHook(input),
  }
}
```

### 6.3 关键流程

```
用户发消息 (Telegram)
    ↓
Engine.sendAndWait() → OpenCode prompt
    ↓
[chat.message hook]  ← Muse Plugin: 记录消息元信息
    ↓
[chat.system.transform hook]  ← Muse Plugin: 动态注入上下文
    ↓
LLM 推理 → 可能调用工具
    ↓
[tool.execute.after hook]  ← Muse Plugin: 工具调用审计
    ↓
所有过程产生 Bus 事件
    ↓
[event hook]  ← Muse Plugin: 全局事件日志
    ↓
回复返回 → Telegram
```

---

## 七、详细设计

### H1: Plugin 壳子

```javascript
// muse/plugin/index.mjs
import { createEventLogger } from './hooks/event-logger.mjs'
import { createToolAudit } from './hooks/tool-audit.mjs'
import { createSystemPrompt } from './hooks/system-prompt.mjs'
import { createMessageHook } from './hooks/message-hook.mjs'

export default async function musePlugin(input) {
  const { directory } = input
  const logDir = `${directory}/muse/data/hook-logs`
  // 确保日志目录存在
  const { mkdirSync } = await import('node:fs')
  mkdirSync(logDir, { recursive: true })

  return {
    event: createEventLogger({ logDir }),
    'chat.message': createMessageHook(),
    'tool.execute.after': createToolAudit({ logDir }),
    'experimental.chat.system.transform': createSystemPrompt({ directory }),
  }
}
```

**安全边界**:
- Plugin 内的错误用 try/catch 包裹，不能影响 OpenCode 主流程
- 日志写入用异步非阻塞 (`appendFile`)，不影响响应速度

### H2: event hook (全局事件日志)

```javascript
// hooks/event-logger.mjs
export function createEventLogger({ logDir }) {
  return async ({ event }) => {
    try {
      const { type, properties } = event
      const line = JSON.stringify({
        ts: Date.now(),
        type,
        ...(properties?.sessionID && { sessionID: properties.sessionID }),
      })
      // 异步写日志，不阻塞
      appendFile(`${logDir}/events.jsonl`, line + '\n').catch(() => {})
    } catch { /* 降级: 不影响主流程 */ }
  }
}
```

**输入**: 所有 Bus 事件 (Session.Created, Status.Idle, MessageV2.PartDelta, ...)
**输出**: `muse/data/hook-logs/events.jsonl` (JSONL 格式)
**安全**: try/catch 全包，appendFile 异步不阻塞

### H3: chat.message hook

```javascript
// hooks/message-hook.mjs
export function createMessageHook() {
  return async (input, output) => {
    // input: { sessionID, agent?, model?, messageID? }
    // output: { message (UserMessage), parts (Part[]) }
    try {
      const textParts = output.parts.filter(p => p.type === 'text')
      console.log(`[muse-hook] chat.message: session=${input.sessionID} parts=${textParts.length}`)
    } catch { /* 降级 */ }
  }
}
```

**用途**: 消息到达时记录元信息，未来可在此注入上下文

### H4: tool.execute.after (工具审计)

```javascript
// hooks/tool-audit.mjs
export function createToolAudit({ logDir }) {
  return async (input, output) => {
    // input: { tool, sessionID, callID, args }
    // output: { title, output, metadata }
    try {
      const audit = {
        ts: Date.now(),
        tool: input.tool,
        sessionID: input.sessionID,
        callID: input.callID,
        title: output.title,
        outputLen: output.output?.length || 0,
      }
      appendFile(`${logDir}/tool-calls.jsonl`, JSON.stringify(audit) + '\n').catch(() => {})
    } catch { /* 降级 */ }
  }
}
```

**安全**: 不记录完整的 args 和 output (可能含敏感数据)，只记录元信息

### H5: chat.system.transform (动态 system prompt)

```javascript
// hooks/system-prompt.mjs
export function createSystemPrompt({ directory }) {
  return async (input, output) => {
    // input: { sessionID?, model }
    // output: { system: string[] }
    try {
      // 注入 Muse 上下文信息 (不重复 AGENTS.md 已有的内容)
      output.system.push(
        `\n[Muse Context]\n当前时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`
      )
    } catch { /* 降级 */ }
  }
}
```

**安全边界**:
- 只 append 到 `output.system`，不覆盖
- 不重复 AGENTS.md 的人格定义 (那是 T12 的职责)
- 注入的是运行时动态信息 (时间、最近会话概要等)

### H6-H8: 预留点位

```javascript
// 不在代码中实现，只在 event hook 中通过事件类型判断记录
// Session.Error → console.warn + events.jsonl (T16 接手时改为写 Gap 表)
// Session.Idle → events.jsonl (P3 接手时改为触发 Pulse)
// permission.ask → 暂不注册 (P4 接手时添加)
```

---

## 八、优先级排序

| 优先级 | 任务 | 依据 |
|--------|------|------|
| **P0** | H1 Plugin 壳子 + H2 event + H9 测试 | 基础设施，其它都依赖 |
| **P1** | H4 tool.execute.after | 工具审计是 T11 联动的直接证据 |
| **P1** | H5 chat.system.transform | T12 前的动态 prompt 能力 |
| **P1** | H3 chat.message | 消息链路可观测性 |
| **P2** | H6-H8 预留点位 | 注册事件监听，不实现业务逻辑 |

---

## 九、风险与降级

| # | 风险 | 等级 | 对策 |
|---|------|------|------|
| 1 | Hook 抛错导致 OpenCode 崩溃 | **高** | 每个 hook 函数全包 try/catch，绝不 throw |
| 2 | Plugin 加载失败 | 中 | OpenCode 已有 catch (plugin/index.ts:90)，会继续运行 |
| 3 | 日志写入磁盘慢导致阻塞 | 中 | 用 `appendFile(...).catch()` 异步，不 await |
| 4 | `experimental.*` Hook 未来被移除 | **低→高** | 这些 API 标记 experimental。当前先用，升级时检查 |
| 5 | Hook 和 AGENTS.md 内容冲突 | 中 | `chat.system.transform` 只注入动态信息，不定义人格 |
| 6 | Bus 事件太多导致日志爆盘 | 低 | 事件日志只记录元信息 (无 content)，定期轮转 |

---

## 十、测试方案

### 单元测试 (`plugin.test.mjs`)

| 测试 | 验证 |
|------|------|
| Plugin 导出格式 | `typeof musePlugin === 'function'`，返回 Hooks 对象 |
| event hook 降级 | 传入 undefined event → 不 throw |
| tool-audit 记录 | 传入 mock 数据 → jsonl 文件有内容 |
| system-prompt 注入 | 传入 `{ system: [] }` → system 数组新增元素 |
| 所有 hook 异常降级 | 每个 hook 内部 throw → 不影响返回值 |

### 集成测试

| 测试 | 验证 |
|------|------|
| Plugin 在 opencode.json 注册 | `opencode mcp list` / 配置验证 |
| event hook 收到 Bus 事件 | 启动 OpenCode → 检查 events.jsonl |
| tool.execute.after 审计 | AI 调用工具 → tool-calls.jsonl 有记录 |

### E2E 测试 (`plugin.e2e.mjs`)

| 测试 | 验证 | 避坑 |
|------|------|------|
| Plugin 被 OpenCode 加载 | `opencode run` → `--print-logs` 含 "loading plugin" | R1: 网络不可达 graceful skip |
| event hook 工作 | 运行后 events.jsonl 非空 | 断言文件内容，不靠模型文本 |
| tool-audit 工作 | AI 调用任意工具 → tool-calls.jsonl 有记录 | R2: 检查日志文件，不匹配模型输出 |
| Hook 异常不崩 | Plugin 中故意注入 throw → 主流程正常 | 独立测试场景 |

**E2E 要求** (吸取 T10 教训):
- 不依赖外部网络
- 断言检查日志文件/工具调用记录，不靠模型文本匹配
- 每条 E2E 幂等可重复
- 明确区分本任务闭环 vs 待后续联动

---

## 十一、验收标准

### 三层验证

| 层 | 标准 | 证据 |
|----|------|------|
| **文件层** | `muse/plugin/` 目录存在，`opencode.json` 有注册 | unit test |
| **注册层** | OpenCode 启动日志含 "loading plugin muse" | E2E `--print-logs` |
| **行为层** | Hook 被实际调用 → 日志文件有记录 | events.jsonl / tool-calls.jsonl |

### T10.5 闭环 vs 待联动

| ✅ 自身闭环 | ⏳ 待后续联动 |
|-------------|-------------|
| Plugin 加载成功 | T12: chat.system.transform + AGENTS.md |
| event hook 收事件 | T13: Hook 接手 Orchestrator 逻辑 |
| tool.execute.after 审计 | T16: Session.Error → Gap 记录 |
| 异常降级不崩 | P3: Session.Idle → Pulse |

---

## 评审报告（结合 Muse 整体规划）

### 一、总体判断

`T10.5 Hook / Plugin / Bus` 这份方案 **方向正确，而且确实应该前移到第一批基座任务**。  
它不是“后面再加也行”的锦上添花，而是 `Phase 2` 从 wrapper 走向 OpenCode 原生运行时扩展的关键连接层。

如果没有这层，后面会出现两个问题：

1. `T11/T12/T13` 虽然都在做 Native 化，但运行时观察、生命周期拦截、内部事件承接还是会绕回 wrapper
2. `Muse` 长期要的主动性、缺口记录、审批链、状态桥、家族协作，就都没有统一挂点

所以我认同它的总体定位：

- `T10` 是策略层
- `T10.5` 是生命周期拦截层
- `T11` 是有状态能力层
- `T12` 是身份/人格层

这套分层和 Muse 的长期路线是顺的。

### 二、和 Muse 整体目标的对齐程度

放到 `Muse` 的大目标里看，`T10.5` 的价值主要有 `5` 个：

1. **把 OpenCode 内部生命周期开放给 Muse 使用**
   - Muse 不只是“会聊天”，而是开始能“观察自己在做什么”
2. **给 T11 的记忆落盘提供运行时触发点**
   - 没有 `prompt.after / compaction.before / event`，记忆很难自然沉淀
3. **给 T16 Gap Journal 提供真实错误入口**
   - 没有 `Session.Error`，缺口记录就只能靠外层猜
4. **给 P3 Pulse 留主动触发入口**
   - `Session.Idle` 这类事件是主动性的自然挂点
5. **给 P4 审批链和自我开发留控制点**
   - `permission.ask` 未来非常关键

所以从整体路线看，`T10.5` 是对的，而且是必须有的。

### 三、当前方案里最稳的部分

#### 1. 定位边界比以前清楚

这次文档已经明确写了：

- 不是行为策略层
- 不是能力载体
- 不是人格载体

这很重要。  
只要守住这个边界，`T10.5` 就不会长成新的“大 orchestrator”。

#### 2. 和前后任务的联动关系写得比较准确

尤其这几条是对的：

1. `T10` 提供策略，`T10.5` 提供运行时触发
2. `T11` 提供 MCP 能力，`T10.5` 负责审计与事件承接
3. `T12` 用 `AGENTS.md` 做静态人格，`chat.system.transform` 只做补充
4. `T16` 消费 `Session.Error`

这说明方案不是孤立写的，而是在系统链路里想过位置。

#### 3. “闭环 vs 待联动” 这层划分是成熟的

这一点比很多前面的任务文档更稳。  
它明确区分了：

- `T10.5` 自己必须完成的
- 以及要等 `T12/T13/T16/P3` 才能闭合的

这能减少后续“明明不是本任务范围，却被误判没做完”的混乱。

#### 4. 吸取了 T10 的 E2E 教训

文档现在明确强调：

- 不靠模型文本匹配
- 尽量看日志文件和工具调用痕迹
- E2E 要幂等

这是对的，也说明方案开始更重视“证据强度”，不是只看形式。

### 四、我认为仍需补强的关键问题

#### 1. `chat.system.transform` 的使用边界仍然有风险，必须继续收紧

这是当前方案最大的架构风险。

文档说得对：

- `AGENTS.md` 是身份主载体
- `chat.system.transform` 只是补充

但当前方案里又把它列成第一阶段核心 Hook 之一，这会让实现时很容易越界。  
尤其在 `T12` 还没完全落地前，最容易发生的情况是：

- 本来应该在 AGENTS.md 定义的人格/行为基调
- 又被 `system transform hook` 动态拼进去一次

这样会带来 `2` 个坑：

1. 人格再次膨胀回动态 prompt
2. T12/T10.5 边界重新混乱

建议在文档里更硬地写清楚：

- `chat.system.transform` **只允许注入动态上下文**
  - 当前能力清单
  - 当前运行模式
  - 临时环境信息
  - 非持久状态提醒
- **禁止**在这里重新定义：
  - 人格设定
  - 长期说话风格
  - 伴侣关系基调

一句话：**T10.5 能改 system，但不能重新承载 identity。**

#### 2. 当前方案仍有“把 Phase 1 的自动化逻辑整体搬进 Hook”的风险

文档里写了：

- “Hook 接手 Orchestrator 的自动化逻辑”

这句话方向没错，但很危险。  
如果实现时把：

- 记忆注入
- 偏好提取
- 意图分类
- prompt 拼接

一股脑搬进 Hook，那只是把“胖 orchestrator”换成“胖 plugin”。

建议更明确拆开：

1. **认知决策** → 交给 AI / T11 / T13
2. **生命周期触发** → 交给 Hook
3. **运行时审计和转发** → 交给 Plugin/Bus

Hook 只负责“什么时候触发”，不要负责“替 AI 做复杂判断”。

#### 3. `event hook` 记录“全部 Bus 事件”这个说法偏满，后面很容易爆量

文档后面虽然提到“只记录元信息，定期轮转”，这是对的；  
但在方案层我还是建议再收紧一句：

- Phase 2 默认并不是“永久记录全部事件”
- 而是“先支持接收全部事件，再只落关键事件”

否则实现时如果真的全量落盘：

- `MessageV2.PartDelta`
- `Session.Updated`
- 高频 tool 事件

很容易造成：

1. 日志爆量
2. 重要事件被淹没
3. Web/调试侧看不懂

建议文档里从一开始就定义：

- `P0` 只关注关键事件白名单
  - `Session.Error`
  - `Session.Idle`
  - `Session.Compacted`
  - `Command.Executed`
  - `Todo.Updated`
- 其余事件只做调试开关，不默认落盘

#### 4. `tool.execute.after` 和 T11 审计之间的边界还可以再明确

文档里已经说：

- Hook 做运行时审计
- T11 MCP 做持久化审计

这很好，但建议再加一句避免后面重复建设：

- `T10.5` 的 tool audit 是 **运行时观测日志**
- `T11` 的 audit 是 **领域数据审计**

例如：

- Hook 记“哪个工具何时被调用”
- T11 记“哪条记忆为什么被写、谁写的、是否被拦”

否则后面会出现两套“审计”同时想当主表的问题。

#### 5. 缺少对“Bus Bridge”产物边界的说明

方案里提到：

- `bus-bridge.mjs`

这很好，但还没回答一个关键问题：

- `Bus Bridge` 输出给谁？

从 Muse 整体看，它未来至少会服务 `4` 个方向：

1. Web 驾驶舱状态
2. 小脑 / 守护链路
3. Gap Journal
4. Family 协作或自省日志

建议文档里至少写一句：

> T10.5 的 Bus Bridge 在 Phase 2 先只做本地事件归档和内部桥接，不直接承担 Web API 或跨进程协议职责。

否则它后面很容易越长越厚。

### 五、和前后任务的联动建议

#### 与 T11 Memory MCP

这是当前最强联动点。  
建议明确：

1. `prompt.after` 不直接“决定存什么”
2. 它只负责在合适生命周期点触发“摘要/落盘机会”
3. 真正的记忆语义还是由 `T11` 工具和 AI 决策完成

否则 Hook 会重新侵入记忆决策层。

#### 与 T12 Identity → AGENTS.md

建议把边界写得更强：

1. `AGENTS.md` 是静态主载体
2. `chat.system.transform` 只补动态上下文
3. 任何“人格定义”都不能反向写回 Hook

#### 与 T13 Orchestrator 瘦身

这里建议文档里直接写：

- `T13` 删除的是硬编码自动化逻辑
- 不是把这些逻辑原封不动平移到 Hook

这样能减少实现时的误解。

#### 与 T16 Gap Journal

现在写“Session.Error → Gap”是对的，但建议补一个保守原则：

- P2 先做错误事件桥接和日志落点
- 真正的 Gap 语义由 T16 定义

避免 T10.5 提前把 GapEntry 结构定死。

### 六、测试与证据层面的判断

当前文档的测试思路总体比前面任务成熟，尤其这几点是对的：

1. 分文件层 / 注册层 / 行为层
2. E2E 看日志文件，不只看模型输出
3. 明确“异常降级不崩”要单测

但我建议再补 `2` 条：

1. **Hook 顺序影响测试**
   - 既然文档已写 Hook 是顺序执行，那就应该有测试证明顺序稳定
2. **实验性 Hook 的退化策略**
   - `experimental.chat.system.transform` 如果未来版本移除，系统应如何退回

这两条都是真正的工程风险。

### 七、最终结论

`T10.5` 这份方案 **整体通过评审，可以进入开发**。  
它在 Muse 架构里的定位是对的，而且是 `Phase 2` 里非常关键的一层：

1. 它是生命周期拦截层
2. 它是运行时观察层
3. 它是未来 Pulse / Gap / 审批链 / 状态桥的挂点层
4. 但它不是新的认知中心，也不是新的身份中心

我建议开发时守住这 `4` 条原则：

1. Hook 负责触发和观察，不替 AI 做重决策
2. `chat.system.transform` 只补动态信息，不承载人格
3. `event` 默认白名单落盘，避免“记录一切”
4. 审计要区分运行时审计（T10.5）和领域审计（T11）

一句话总结：

> **T10.5 的方向是对的，它不是“又一个功能模块”，而是 Muse 真正接管 OpenCode 内部生命周期的第一层基座；但这层最怕长成新的胖中心，所以边界一定要在方案阶段就收紧。**
