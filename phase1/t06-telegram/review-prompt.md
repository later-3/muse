# T06 Telegram 适配器 — 评审指南

> 本文档用于指导评审 agent 对 T06 技术方案进行评审

---

## 评审输入

请阅读以下文档后再进行评审：

1. **T06 技术方案** — `phase1/t06-telegram/README.md`
2. **T06 评审上下文** — `phase1/t06-telegram/context.md`
3. **Phase 1 总体规划** — `phase1/README.md`（可选）

---

## 评审维度

请从以下 5 个维度逐项评审：

### 1. 职责边界

- Adapter 是否只做消息收发 + 命令路由，不越权做意图分类/记忆检索？
- 与 T05 Orchestrator 的接口调用是否正确？
- session 映射策略是否合理？

### 2. 用户体验

- typing 动画是否在正确的时机触发？
- 长消息分割策略是否保持语义完整？
- 错误提示是否友好、不暴露内部信息？
- 命令系统是否完整覆盖 Phase 1 需求？

### 3. 安全性

- 白名单实现是否正确（中间件层一处拦截）？
- 未授权用户的处理是否合理（静默忽略 vs 提示拒绝）？
- Bot token 是否安全管理？

### 4. 健壮性

- Orchestrator 调用失败时的错误处理是否完备？
- session 失效后映射是否正确更新？
- 进程重启后 session Map 丢失是否可接受？

### 5. 测试覆盖度

- 18 项测试是否覆盖了主路径、命令、安全、分割、错误处理？
- mock 策略是否合理？
- 是否有遗漏的边界场景？

---

## 评审输出格式

```markdown
# T06 Telegram 适配器 — 评审报告

## 总体评价
（1-2 句话概括）

## 逐项评审
### 1. 职责边界 [✅ | ⚠️ | ❌]
...
### 2. 用户体验 [✅ | ⚠️ | ❌]
...
### 3. 安全性 [✅ | ⚠️ | ❌]
...
### 4. 健壮性 [✅ | ⚠️ | ❌]
...
### 5. 测试覆盖度 [✅ | ⚠️ | ❌]
...

## 必须修正 (Blockers)
1. ...

## 建议改进 (Suggestions)
1. ...

## 确认通过的部分
1. ...
```

评分标准：
- ✅ = 可直接通过
- ⚠️ = 有问题需讨论/修正
- ❌ = 有 blocker，必须修正后才能开始开发

---

# T06 Telegram 适配器 — 评审报告

## 总体评价

方案整体方向正确，Telegram Adapter 的职责边界也基本守住了，作为 T05 的“嘴巴”是成立的。  
但结合当前 `assistant-agent` 项目的真实代码和设计，我认为当前版本**还不能直接开工**，至少有 `2` 个 blocker：`session` 映射策略与 T05 的真实行为没有完全对齐，以及 `userSessions` 被设计成模块级全局 Map，会给测试隔离和未来多实例运行埋坑。

## 逐项评审

### 1. 职责边界 [⚠️]

优点：

- 方案明确限定 T06 只做消息收发、命令路由、session 映射、权限检查，没有越权做记忆检索和模型选择。
- 对 T05 的主要调用只走 `orchestrator.handleMessage()` 和 `orchestrator.health()`，边界是对的。
- `/reset` 只清本地 session 映射、不直接管 OpenCode session 清理，也符合 T08 的职责划分。

问题：

1. 文档中的 session 恢复叙述和 T05 的真实实现需要更精确对齐。  
在当前项目真实代码里，T05 的 session 恢复不是 `#resolveSession()` 处理的，而是在 `handleMessage()` 中捕获疑似 session 错误后：
   - 调 `engine.createSession()`
   - 重试一次 `sendAndWait()`
   - 返回新的 `sessionId`

所以 T06 文档里这句：
```text
T05 #isSessionError 会自动重建 session
```
方向上是对的，但建议写得更贴近真实接口语义：
“`handleMessage()` 可能返回一个和传入不同的 `sessionId`，T06 必须始终用返回值覆盖本地映射。”

2. `userSessions` 被设计成模块级全局 `Map`，不利于未来多实例和测试隔离。  
当前方案写的是：
```js
const userSessions = new Map()
```
这在单实例 Phase 1 能跑，但它不是实例私有状态。如果未来：
   - 同进程里创建多个 TelegramAdapter
   - 单测并行跑多个实例
   - 后续扩成多 bot / 多 agent

这个全局 Map 会变成隐式共享状态。建议放进类私有字段，比如 `#userSessions`。

### 2. 用户体验 [⚠️]

优点：

- typing 动画在发给 Orchestrator 之前触发，这个时机是对的。
- 长消息分割按 `段落 → 换行 → 空格 → 硬截断` 的优先级，也比直接硬切好很多。
- 错误提示默认是友好中文，不直接把内部堆栈返回给用户，这个决策正确。
- `/start /help /status /reset` 这些 Phase 1 关键命令都覆盖到了。

问题：

1. `/status` 的错误处理会把内部异常信息直接回给用户。  
当前文档里是：
```js
await ctx.reply('⚠️ 获取状态失败: ' + e.message)
```
这和主消息处理里“不给用户暴露内部错误”不一致。  
如果上游抛的是具体内部错误，例如配置、网络、路径、数据库状态，这些不应该直接透出。建议统一成用户友好的固定文案，详细错误只打日志。

2. 长消息分割没有考虑代码块/列表结构破坏。  
Phase 1 发纯文本问题不大，但 Muse 未来高频会返回代码、日志、列表说明。当前纯按字符和换行切，容易把代码块和列表结构切坏。这个不一定是 blocker，但建议至少记录为后续优化点。

### 3. 安全性 [⚠️]

优点：

- 白名单放在 middleware 层统一拦截，这个设计是对的。
- 未授权用户静默忽略，也符合“不要暴露 Bot 存在”的思路。
- Bot token 通过 `config.telegram.botToken` 读取，符合当前配置体系。

问题：

1. 白名单中间件没有处理 `ctx.from` 缺失的边界。  
虽然普通私聊文本几乎都会有 `ctx.from.id`，但中间件里直接：
```js
const userId = String(ctx.from?.id)
```
如果 `ctx.from` 为空，就会得到 `'undefined'`，逻辑上虽然最终会被拒绝，但建议明确判断并记录低优先级日志，避免奇怪更新类型混入时不易排查。

2. 文档没有强调“只支持私聊，不支持群聊”在代码层要如何落实。  
现在非目标里写了“不支持群聊”，但中间件和消息处理示例里没有显式检查 `chat.type === 'private'`。  
如果不做这个检查，Bot 进到群里后，白名单用户在群里发消息可能仍会触发处理，这和 Phase 1 范围不一致。

### 4. 健壮性 [❌]

这是当前最需要补的部分。

#### 4.1 session 映射策略依赖 T05 返回新 sessionId，但文档没有把“覆盖更新”写成强约束

当前 T05 的真实行为是：

- 如果传入的 `sessionId` 已失效，`handleMessage()` 可能返回一个**新的** `sessionId`
- T06 必须用返回值覆盖旧映射

文档在消息处理示例里确实有：
```js
userSessions.set(userId, result.sessionId)
```
但这个动作实际上是 T06 正确性的核心，不只是普通保存逻辑。  
建议在设计说明里把它写成明确约束：

1. 每次调用 `handleMessage()` 后都必须写回 `result.sessionId`
2. 不能只在“首次创建”时写 session

否则实现者很容易把它当成普通缓存，不意识到它承担了 session 失效恢复的闭环。

#### 4.2 模块级全局 `userSessions` 会让 start/stop 之间残留状态

由于 `userSessions` 不属于实例私有字段，也没有在 `stop()` 中清理，当前行为会变成：

- adapter stop 了
- bot 停了
- 但 `userSessions` 还留在进程内

这对“进程不停、实例重建”的场景会产生隐式状态残留。即便 Phase 1 可能暂时只有一个实例，这也是明显的设计味道。  
这也是我认为当前文档还不能直接通过的主要原因之一。

#### 4.3 `health()` 只返回 `ok: true`，没有真正反映 bot 状态

当前方案：
```js
async health() {
  return {
    ok: true,
    detail: { activeSessions, uptime }
  }
}
```

这更像“本地统计”，不是健康检查。  
如果：

- `start()` 还没调用
- `launch()` 失败
- bot 已 stop

按这个设计 `health()` 仍然可能返回 `ok: true`。  
建议至少维护一个 `#started` / `#running` 状态位，让 `health()` 与实际生命周期一致。

### 5. 测试覆盖度 [⚠️]

测试矩阵覆盖面还不错，主路径、命令、白名单、长消息、异常处理都列到了。

但还缺 `3` 类关键场景：

1. **私聊限制测试**  
如果 Phase 1 只支持 private chat，就应该有明确测试验证群聊消息被忽略。

2. **stop()/重建实例后的 session 状态测试**  
当前文档没有暴露这个问题，但如果继续用模块级 Map，这一项测试很容易暴露状态残留。

3. **`/status` 错误信息不泄露内部细节的测试**  
现在只写了“友好错误提示”，但示例代码实际会把 `e.message` 回给用户，测试需要把这个风险钉住。

mock 策略本身是合理的，T06 不应该在单元测试里真的去连 Telegram。

## 必须修正 (Blockers)

1. 把 `userSessions` 从模块级全局 `Map` 改成实例私有状态，例如 `#userSessions`，并在 `stop()` 或实例销毁语义上明确其生命周期。
2. 明确并强调 session 映射更新规则：每次 `handleMessage()` 返回后，都必须用 `result.sessionId` 覆盖本地映射，因为 T05 可能在内部重建 session。
3. 给 `health()` 增加真实的运行态判断，不能固定返回 `ok: true`。

## 建议改进 (Suggestions)

1. `/status` 错误提示改为固定友好文案，详细错误只记录日志。
2. 增加 `chat.type === 'private'` 检查，和“Phase 1 不支持群聊”的目标对齐。
3. 中间件里对 `ctx.from` 缺失做显式处理和日志记录。
4. 长消息分割后续可以增加“代码块优先保持完整”的策略，但这可以留到下一阶段。
5. 测试补充：私聊限制、实例重建后的 session 状态、`/status` 信息不泄露。

## 确认通过的部分

1. T06 作为“嘴巴”只调用 T05，不直接依赖 Identity/Memory/Engine，这个边界是对的。
2. 命令系统基本覆盖了 Phase 1 需要的最小交互面。
3. typing 动画、长消息分割、白名单中间件这些方向都是正确的。
4. 进程重启后 session Map 丢失在 Phase 1 是可以接受的，文档对此的判断是务实的。
5. 使用 telegraf + long polling 作为 Phase 1 方案是合理选型，没有过度设计。

---

# T06 Telegram 适配器 — 开发结果审核

## 总体评价

`T06` 这次实现方向整体是对的，文档评审里要求修的几个关键点也基本都落地了：

- `userSessions` 改成了实例私有 `#userSessions`
- 增加了 `private chat` 限制
- `/status` 不再把内部错误直接回给用户
- `health()` 不再固定返回 `ok: true`

但从代码评审角度看，当前还有 `2` 个比较实质的问题，以及 `1` 个项目级验证上的不确定项。  
其中最重要的问题不是“功能没写”，而是“核心行为没有被真正测试证明”。

## 主要发现

### 1. 测试没有真正覆盖 TelegramAdapter 的核心行为

当前 `muse/adapters/telegram.test.mjs` 单独跑是 `27/27` 通过，我本地复跑结果也是通过。  
但测试内容本身存在一个明显问题：

- 很多测试是在验证 `Map`、字符串常量、mock orchestrator 的直接行为
- 而不是在真正实例化 `TelegramAdapter` 后，驱动它的 `start()` / `stop()` / middleware / command / on('text') handler

例如：

- 白名单逻辑测试只是检查某个 ID 在不在数组里
- 私聊限制测试只是断言 `chat.type !== 'private'`
- Session 映射测试只是操作一个局部 `Map`
- health 状态测试只是检查局部布尔值

这些测试能说明“思路是对的”，但**不能证明适配器类本身真的按预期工作**。  
对于一个主要职责是“接线和路由”的 adapter 来说，这是当前最大的测试盲区。

换句话说，现在测到的更多是：

- 设计意图
- 局部辅助逻辑

而不是：

- `TelegramAdapter.start()` 是否真的正确注册了 middleware / commands / handlers
- `TelegramAdapter.stop()` 是否真的清空 session 并停 bot
- 收到文本消息时是否真的先 typing、再调 orchestrator、再覆盖 sessionId、再分割回复

这是一个高优先级测试问题。

### 2. `start()` 不是幂等的，重复调用会重复注册 handler

当前实现：

```js
async start() {
  this.#registerMiddleware()
  this.#registerCommands()
  this.#registerMessageHandler()

  await this.#bot.launch()
  this.#running = true
}
```

这里没有任何“已启动”保护。  
如果上层因为热重载、异常恢复、重复初始化等原因误调用两次 `start()`，就会出现：

- middleware 重复注册
- command handler 重复注册
- `on('text')` 重复注册

最终表现可能是：

- 一条消息被处理多次
- 一次消息触发多个回复
- `orchestrator.handleMessage()` 被重复调用

考虑到 Muse 后面还有 T08 小脑守护和可能的异常恢复逻辑，这不是纯理论问题，建议在合并前补掉。

### 3. 项目级测试全绿结论我这里无法完整确认

我本地执行了：

```bash
node --test muse/adapters/telegram.test.mjs
```

结果是：

- `27/27` 通过

但执行：

```bash
npm test
```

时，我没有在可见时间窗口内拿到完整结束结果，因此我不能独立确认提交说明里写的：

```text
126/126 project-wide tests pass
```

这不代表 T06 有明确回归，只是说明我这边**无法完整背书项目级全绿**这个结论。

## 已确认做对的部分

1. `#userSessions` 作为实例私有状态，解决了文档评审里模块级全局 `Map` 的问题。
2. 每次都用 `result.sessionId` 覆盖映射，这一点和当前 T05 的 session 重建策略已经对齐。
3. `private chat only` 和白名单中间件都已经进入实现，不再只是文档承诺。
4. `/status` 已改成固定友好文案，不再向用户泄露内部错误。
5. `splitMessage()` 单独抽成纯函数并导出，这对后续持续改进消息分割策略是好的结构。
6. `stop()` 会清掉 session 映射，这比文档版更稳。

## 结论

`T06` 当前可以判断为：**基本可合并，但建议先补一轮测试和生命周期小修**。

优先级建议：

1. 先补“真正驱动 TelegramAdapter 实例”的测试，而不是只测辅助逻辑
2. 给 `start()` 增加幂等保护，避免重复注册 handler
3. 再确认一次项目级 `npm test` 全绿
