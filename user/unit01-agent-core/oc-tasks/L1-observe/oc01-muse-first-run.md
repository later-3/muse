# oc01: 启动 Muse + 发消息 + 看日志

> **USOLB:** `[U]`使用 `[L]`日志
> **Bloom Level:** 1 — 观察
> **对应理论:** 01a §一 核心循环 (ReAct: Reason → Action → Observe)
> **目标:** 亲眼看到 Agent Loop 在跑，知道一条消息从发出到回复经历了什么
> **状态:** ✅ 已完成 (2026-03-30)

---

## 操作步骤

### Step 1: 启动 Muse

```bash
# 在 muse 根目录
./start.sh later-muse-family pua
```

> 如果 start.sh 不存在或报错，检查 `muse.json` 配置的 family 和 member。

### Step 2: 发消息

通过 Telegram 给 pua 发一条消息:
```
你是谁？你有什么工具可以用？
```

### Step 3: 看日志

```bash
# 查看 Muse Node.js 日志 (路径: families/{family}/members/{member}/data/logs/)
tail -f families/later-muse-family/members/planner/data/logs/muse_*.log

# 查看 trace (要指定 member 的 trace 目录，不是引擎级的)
# 引擎级 data/trace/ 是空的！trace 数据在 member 目录下：
#   families/later-muse-family/members/{member}/data/trace/
# trace-reader 默认读引擎级目录，所以会报"暂无 trace 记录"
node src/plugin/trace-reader.mjs
```

> **注意:** 当前实际存在的 member 有 planner / reviewer / arch / nvwa 等，
> 按你启动的 member 替换路径。

---

## 观察记录

### Q1: 消息到达 Muse 后，日志里第一行输出是什么？

```
[04:14:04.154] [INFO] [telegram] 📩 收到消息: user=8651741012 (Xu Later) chat=8651741012
[04:14:04.154] [INFO] [telegram]   text="你是谁？你有什么工具可以用？"
[04:14:04.593] [INFO] [telegram]   session=(新建)
```

**为什么是"新建 session"？**
→ Muse 的 `engine.mjs` 每次收到 Telegram 消息，会调 OpenCode 的 `session.create` API 创建一个新 session。
一个 session = OpenCode 里的一次完整对话（从用户提问到 AI 回答完成）。
这和浏览器打开一个新的 ChatGPT 对话窗口是一样的概念。

> **架构洞察:** Muse 不直接调 LLM，而是把消息**委托给 OpenCode**。
> OpenCode 才是真正跑 Agent Loop 的引擎。Muse 只负责：
> Telegram 收消息 → 创建 OpenCode session → 等待完成 → 拿结果 → 发回 Telegram

**追问 1: 为什么每次都新建 session?**

看代码 `src/core/orchestrator.mjs` L109-112:
```javascript
async #resolveSession(context) {
  if (context.sessionId) return context.sessionId  // 有就复用
  const session = await this.#engine.createSession()  // 没有就新建
  return session.id
}
```
关键: **如果 context 里传了 sessionId 就复用, 没传就新建**.
当前 Telegram 适配器每次收消息都没传 sessionId, 所以每次都新建.
这意味着 **Muse 目前没有多轮对话记忆** (每次都是全新对话).
理论依据: 这是最简单的无状态设计. ChatGPT 也类似, 每个对话是独立 session.
其他项目: Claude Code / Aider 默认也是每次新建 session, 但会保存历史.

**追问 2: 新建 session + 发消息的代码在哪?**

- **新建 session:** `src/core/engine.mjs` L82: `this.#request('POST', '/session', {})`
- **发消息:** `src/core/engine.mjs` L117-119: `POST /session/{id}/prompt_async`
- **等待完成:** `src/core/engine.mjs` L132-190: `sendAndWait()` poll 状态直到 `unknown`
- 这些都是调 OpenCode 的 REST API (OpenCode 跑在本地 HTTP 服务)


### Q2: 你看到了几次 LLM 调用？（对应 Agent Loop 的几轮）

```
[04:14:15.224] [INFO] [orchestrator] ① session=ses_2c30cf14effe67... (新建)
[04:14:15.224] [INFO] [orchestrator] ② 调用 Engine.sendAndWait ...
[04:14:15.239] [INFO] [engine] ✓ prompt_async 已接受 (204)
[04:14:16.241] [INFO] [engine] ⏳ poll #1: status=busy
[04:14:17.245] [INFO] [engine] ⏳ poll #2: status=busy
...（省略中间 busy）
[04:14:29.309] [INFO] [engine] ⏳ poll #14: status=unknown → COMPLETE
[04:14:29.309] [INFO] [engine] ✓ 处理完成，获取消息...
```

**为什么看不到 LLM 调用次数？**
→ **Muse 的日志层级太高了！** Muse 只看到 "发了请求" → "在等" → "完成了"。
→ 真正的 Agent Loop（LLM 推理了几轮、调了什么工具）发生在 **OpenCode 内部**。
→ Muse 用 `poll` 轮询 OpenCode 的状态，只能看到 `busy` / `unknown`，看不到里面。

> **关键发现:** Muse 日志 ≠ Agent Loop 日志。
> 要看 Agent Loop 细节（LLM 几轮、用了什么工具），需要：
> 1. OpenCode 自己的日志
> 2. Plugin Hook 拦截（这就是 **oc03** 要做的事！）
> 3. trace-reader 读取 member 目录下的 trace 数据

**追问: trace-reader / OpenCode 日志 / 会话历史在哪?**

- **trace-reader** 是 oc02 的任务. 它读的是 Muse Plugin Hook 写的数据, 不是 OpenCode 原生日志.
- **OpenCode 自己没有传统日志文件.** 它的 session 数据在 `.opencode/agent/` 下, 但 session 完成后会被清理.
- **会话历史被 Muse Plugin Hook 拦截并写到 member 的 trace 目录:**
```
families/later-muse-family/members/planner/data/trace/2026-03-27/
  events.jsonl       <- session 生命周期
  messages.jsonl     <- LLM 消息内容
  tool-calls.jsonl   <- 工具调用记录 (Q3 要找的!)
  tool-starts.jsonl  <- 工具开始调用
```
- **真实数据示例:**
```json
{"tool":"memory-server_workflow_create","sid":"ses_2d349...","durationMs":8}
{"tool":"memory-server_handoff_to_member","sid":"ses_2d349...","durationMs":549}
```
- **这就是 Agent Loop 里的工具调用!** Muse 日志看不到, 但 trace 里全有.
- oc02 会专门教你怎么用 trace-reader 读这些数据.


### Q3: 有没有看到工具调用？如果有，是什么工具？

**没看到！** 原因同上——工具调用发生在 OpenCode 内部，Muse 日志只是外层封装。

> 要看工具调用，去 member 的 trace 目录：
> ```bash
> cat families/later-muse-family/members/{member}/data/trace/2026-03-30/tool-calls.jsonl
> ```

### Q4: 从发消息到收到回复，日志里大概经历了哪些阶段？

从日志能看出 **Muse 层面**的 3 个阶段：

```
阶段 1: 收消息 (telegram)
  [04:14:04] 📩 收到消息 → 新建 session

阶段 2: 委托给 OpenCode (engine)
  [04:14:15] ① 创建 session
  [04:14:15] ② sendAndWait
  [04:14:15] ✓ prompt_async 已接受 (204)

阶段 3: 等待 + 取结果
  [04:14:16~29] ⏳ poll busy × 14 次
  [04:14:29] ✓ COMPLETE → 获取消息
```

> **但这不是 Agent Loop 的 Reason→Action→Observe！**
> 这是 Muse 的 **外层编排循环**（收 → 委托 → 等 → 返）。
> 真正的 ReAct 循环藏在 OpenCode 内部的 14 秒 busy 期间。

### Q5: 和 01a 学的 ReAct 循环对比，你观察到的和理论一致吗？

**不一致！** 但这恰好是最重要的发现：

| 理论 (01a §一) | 实际观察 |
|----------------|---------|
| Agent = while(true) { LLM想 → 有工具？执行！→ 没有？完成！} | 看不到这个循环 |
| ReAct = Thought → Action → Observation 交替 | 只看到 busy → complete |
| Tool Use 是显式的 | 日志里没有 tool 信息 |

**为什么？** 因为 Muse 是 **两层架构**：

```
你看到的:   Telegram → Muse Engine → [黑盒 14秒] → 回复
实际发生的:  Telegram → Muse → OpenCode → { LLM推理 → 工具调用 → 观察 → ... } → 回复
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                          这部分在 OpenCode 内部，Muse 日志看不到
```

> **🎯 核心收获:** oc01 最大的价值不是"看到了 Agent Loop"，
> 而是发现了 **Muse 是 OpenCode 的上层封装**，Agent Loop 的细节需要用其他方法观察。
> 这就是 oc02 (trace) 和 oc03 (hook) 存在的原因！

---

## 理论回顾

- 01a §一: Agent 核心循环 = `while(true) { LLM想 → 有工具调？执行！→ 没有？完成！}`
  → ✅ 理论正确，但需要到 OpenCode 内部才能看到
- 01e §1.2: ReAct = Thought → Action → Observation 交替
  → ✅ 理论正确，Muse 日志层级不够，需要 plugin hook
- Muse 映射: Telegram → orchestrator → engine.sendAndWait → OpenCode session → 结果返回
  → ✅ 这才是 Muse 日志告诉我们的真实架构
