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
