# oc02: trace-reader 全链路追踪

> **USOLB:** `[U]`使用 `[L]`日志
> **Bloom Level:** 1 — 观察
> **对应理论:** 01a §一 核心循环 + 01e §1 ReAct
> **前置:** oc01 完成（Muse 已启动并有过一次交互）
> **目标:** 用 trace-reader 看 OpenCode 内部的 events / tool-calls / traces 三种视图

---

## 操作步骤

### Step 1: 确保有 trace 数据

先完成 oc01（和 Muse 有过至少一次对话），trace 数据会自动写到：
```
families/later-muse-family/members/{member}/data/trace/
```

### Step 2: 运行 trace-reader

```bash
# 最近一次 session 的完整链路
node src/plugin/trace-reader.mjs

# 只看失败的事件
node src/plugin/trace-reader.mjs --errors

# 实时监听（开着它，然后给 Muse 发消息）
node src/plugin/trace-reader.mjs --tail
```

### Step 3: 理解三种视图

trace-reader 输出三类数据，分别对应 Agent Loop 的不同层面：

| 视图 | 看什么 | 对应理论 |
|------|--------|---------|
| **events** | session 生命周期（创建/消息/完成） | Agent Loop 的启动和停止 |
| **tool-calls** | 调了什么工具、参数、返回值 | ReAct 的 Action + Observation |
| **traces** | 完整执行链路（含时间戳） | Agent Loop 的每一轮 |

### Step 4: 记录观察

---

## 观察记录

### Q1: trace-reader 输出了几个 event？分别是什么类型？
```
（填写）
```

### Q2: 有几次 tool-call？每次调的是什么工具？
```
（填写）
```

### Q3: 从 trace 能看出 Agent 循环了几轮吗？
```
（填写）
```

### Q4: event 和 tool-call 的时间戳对比，能还原出 Reason→Action→Observe 的顺序吗？
```
（填写）
```

---

## 理论回顾

- trace 里的 events = Agent Loop 的"骨架"（什么时候开始、什么时候结束）
- trace 里的 tool-calls = ReAct 的 Action+Observation 部分
- 两者合起来 = 完整的 Agent Loop 可视化
- 这就是 Muse 的 `src/plugin/index.mjs` 用 OpenCode Plugin Hook 记录的
