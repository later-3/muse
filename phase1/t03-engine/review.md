# T03 引擎层 — 评审请求

你好，你是一个资深软件架构师。请评审 T03 引擎层技术方案。

---

## 项目背景

我们在开发 **Muse**，一个终身 AI 助手。技术栈：Node.js ESM (Node 20) + OpenCode REST API + SQLite + telegraf。

### 架构约束（T01 评审确立）

- 模块依赖方向：`adapters/web/daemon → orchestrator → engine/memory/identity`
- 所有模块实现生命周期接口：`start()/stop()/health()`
- `validateConfig()` 使用 throw（不耦合 process.exit）
- 结构化日志：`createLogger(module)` → `[time][level][module]`

### 已完成模块

**T01 项目脚手架** ✅
- `muse/config.mjs`: 配置 + fail-fast 校验 + NaN 拦截
- `muse/logger.mjs`: 结构化日志 `createLogger(module)`
- `muse/index.mjs`: 入口 + catch 校验错误后 process.exit
- 8/8 测试通过

**T02 身份系统** ✅
- `muse/core/identity.mjs`: Identity 类
- identity.json → 4 层 system prompt（role/style/rules/safety）
- 两步 traits 映射（traits→labels→prompt）
- 深合并 + 原子写入 + schema 校验 + last-known-good 回退
- data getter 返回 structuredClone（防绕过 validate）
- 17/17 测试通过

### 当前任务

**T03 引擎层** — 封装 OpenCode REST API

### OpenCode REST API 关键信息（源码验证）

以下 API 信息来自 `opencode-trace/02-technical-plan.md`，经过源码逐行验证：

1. **`GET /provider`** — 模型列表，可用于健康检查
2. **`POST /session/:id/message`** — 同步发消息（阻塞等结果，长任务会 HTTP 超时）
3. **`POST /session/:id/prompt_async`** — **异步发消息**（立即返回，推荐）
4. **`GET /event`** — **内置 SSE 事件流**，推送所有 46 种 Bus 事件（无需 Plugin）
5. 每个请求必须带 `x-opencode-directory` header
6. OpenCode serve 默认端口 4096 (`opencode serve --port 4096`)

---

## 评审材料

请阅读以下文件：

- `phase1/t03-engine/README.md` — T03 技术方案（完整代码 + 测试计划）

---

## 评审角度

1. **API 封装完整性**: 是否覆盖了必要的 OpenCode endpoints？有遗漏吗？
2. **异步消息策略**: `prompt_async` + SSE/轮询的方案是否合理？有没有更好的方式？
3. **进程管理**: auto-spawn + detached + unref 的方式是否稳妥？有什么坑？
4. **错误处理**: timeout + 重试 + 降级的策略是否够用？边界情况考虑全了吗？
5. **SSE 实现**: 原生 fetch stream 解析 SSE 的方式是否可靠？
6. **与 T01/T02 的衔接**: 是否正确遵循了架构约束和生命周期接口？
7. **可测试性**: 用 mock HTTP server 测试的方案是否可行？
8. **可行性**: 可以直接开始开发了吗？有没有疑问？

请用中文给出专业评审意见。

---

## 评审结论

结论：`T03` 的总体方向是正确的，`prompt_async + SSE` 也明显优于同步阻塞调用；但按当前文档，**还不建议直接开始开发**。目前至少有 `4` 个高优先级问题需要先补清，否则实现后很容易在进程管理、SSE 解析和错误处理上出现不稳定行为。

### 1. 高优先级问题

#### 1.1 缺少“进程所有权”语义，`stop()` 存在误杀风险

当前设计里：

- `start()` 会先尝试连接已运行的 OpenCode
- 连不上时再 `spawn('opencode', ['serve', ...])`
- `stop()` 里如果有 `#process` 就直接 `kill('SIGTERM')`

这个思路在最简单场景能跑，但没有清楚表达“这个进程是不是 Muse 自己拉起来的”。  
建议显式记录 `#ownsProcess`：

- 如果是 auto-spawn，`#ownsProcess = true`
- 如果是 attach 到已有实例，`#ownsProcess = false`
- `stop()` 只允许回收自己启动的进程

否则后续一旦出现：

- 重复 `start()/stop()`
- 共享 OpenCode 实例
- 多个进程同时使用同一 OpenCode

就会有误杀风险。

#### 1.2 SSE 解析实现过于简化，不足以可靠处理标准 SSE

当前 `subscribeEvents()` 的解析逻辑本质上是：

1. 按 `\n` 分行
2. 找 `data: `
3. 直接 `JSON.parse`

这只能处理“单行 JSON 的最简单 SSE”，但标准 SSE 实际允许：

- 一个事件由多行 `data:` 组成
- 用空行作为事件结束标记
- 存在 `event:`、`id:` 字段
- 存在注释行
- chunk 边界可能切在任意位置

因此，当前方案对小 demo 可能够用，但对真实长连接并不稳。  
建议改成标准处理方式：

1. 先按空行分割完整 event frame
2. 收集同一 frame 的多行 `data:`
3. 拼接后再解析 JSON
4. 保留 `event` / `id` 以便后续扩展

#### 1.3 auto-spawn 失败不可观测，排障会很困难

当前 `spawn()` 使用：

```js
stdio: 'ignore',
detached: true,
this.#process.unref()
```

并且没有监听：

- `error`
- `exit`
- `close`

这会导致 `opencode` 启动失败时，用户只能在 `15s` 后看到一个“启动超时”，但不知道到底是：

- `opencode` 不在 PATH
- 端口被占用
- 工作目录无效
- OpenCode 自己崩掉

建议至少补：

1. 监听 `error` 事件，立即报出 `ENOENT` 等启动错误
2. 监听早退 `exit`，收集退出码
3. 不要完全 `ignore` 标准错误，至少保留一小段 stderr 到日志或缓冲区

#### 1.4 重试策略没有区分“可恢复错误”和“确定性错误”

当前 `#request()` 中，所有失败最终都会进入通用 catch，然后只要不是 `AbortError` 就可能重试。  
这会导致：

- `400` 重试
- `401/403` 重试
- `404` 重试

这些错误本质上是请求本身有问题，重试没有意义，只会放大延迟和日志噪音。

建议改成：

- `网络错误 / 连接重置 / DNS / ECONNREFUSED / 超时 / 408 / 429 / 5xx` → 可重试
- `400/401/403/404` 等确定性错误 → 立即失败

### 2. 分项评审

#### 2.1 API 封装完整性

基础 endpoint 覆盖已经比较够用了：

- session CRUD
- sync/async message
- abort
- event stream

但从上层调用体验看，还缺一个高层 helper。  
建议在 Engine 内增加一个类似：

- `waitForAssistantReply(sessionId, opts)`
- 或 `sendAndWait(sessionId, text, opts)`

否则 orchestrator 后面需要自己拼：

1. `prompt_async`
2. 订阅 SSE
3. 过滤 session 事件
4. 超时控制
5. 最终结果提取

这部分复杂度不应该完全泄漏给上层。

#### 2.2 异步消息策略

`prompt_async + SSE` 是正确方向。  
相比同步 `POST /message`：

- 更不容易遇到 HTTP 超时
- 更适合后续长任务
- 与流式事件模型更一致

建议把同步 `sendMessage()` 明确降级为“仅调试/短任务用”，主路径统一走异步。

#### 2.3 进程管理

`detached + unref` 的出发点可以理解：让 OpenCode 作为独立服务存在。  
但这会带来 `3` 个额外义务：

1. 明确所有权
2. 明确失败可观测性
3. 明确 stop 的行为边界

否则它不是“稳妥”，只是“启动了就不管了”。

#### 2.4 错误处理

当前方案已经有：

- timeout
- retries
- 退避等待

这是好的基础。  
但还缺这 `3` 个边界：

- 区分可重试与不可重试错误
- 在错误对象里附带 method/path/status，便于上层判断
- 为 `abort`、SSE 断线、OpenCode 未启动这些常见场景定义清晰错误语义

#### 2.5 SSE 实现

使用 Node 20 原生 `fetch` 读 stream 是可行的，不需要额外依赖。  
问题不在“原生 fetch 能不能做”，而在“当前解析器太简化”。  
如果解析逻辑按标准 SSE 分帧重写，这条技术路线本身是成立的。

#### 2.6 与 T01/T02 的衔接

方向上是符合约束的：

- `Engine` 是 core 层模块
- 暴露 `start()/stop()/health()`
- 不反向依赖 orchestrator/adapters

这一点没有明显问题。  
后续只要确保它不直接耦合 Telegram/Web，就符合之前确立的依赖方向。

#### 2.7 可测试性

使用 `node:http` 做 mock server 是可行的，尤其适合：

- 普通 REST 请求
- headers 校验
- timeout/retry 测试

但目前测试计划还缺 `4` 类关键场景：

1. 多 chunk SSE
2. 多行 `data:` SSE
3. spawn 失败/早退
4. stop 不误杀外部实例

这些恰好是当前方案的高风险点，建议补进测试矩阵。

#### 2.8 可行性

结论是：**可以做，但不建议按当前文档原样开工。**  
先补完下面 `5` 项，再进入实现会稳很多：

1. 增加 `#ownsProcess`
2. 重写 SSE 分帧解析
3. 补 spawn/error/exit 可观测性
4. 区分可重试与不可重试错误
5. 增加高层 `sendAndWait` / `waitForAssistantReply` helper

### 3. 建议的最小修正集

为了不拖慢 T03 节奏，建议只做最小必要增强：

1. `Engine` 增加 `#ownsProcess` 和清晰的 stop 语义
2. `subscribeEvents()` 改成标准 SSE parser
3. `#spawn()` 捕获 `error/exit`，保留最小诊断信息
4. `#request()` 只重试超时、网络错误、`408/429/5xx`
5. 新增一个高层 helper，避免 orchestrator 自己拼异步流程
6. 测试补齐 SSE 边界和 spawn 失败场景

### 4. 最终结论

最终判断：**T03 技术路线可行，但当前版本还不能算“可直接开发”**。  
把上面 `4` 个高优先级问题补掉后，这个引擎层方案就会从“能跑”提升到“可稳定集成”。
