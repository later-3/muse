# oc01: 启动 Muse + 发消息 + 看日志

> **USOLB:** `[U]`使用 `[L]`日志
> **Bloom Level:** 1 — 观察
> **对应理论:** 01a §一 核心循环 (ReAct: Reason → Action → Observe)
> **目标:** 亲眼看到 Agent Loop 在跑，知道一条消息从发出到回复经历了什么

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
# 查看 Muse Node.js 日志
tail -f families/later-muse-family/pua/data/logs/muse_*.log

# 查看 trace (OpenCode Plugin 写的)
node src/plugin/trace-reader.mjs
```

### Step 4: 记录观察

回答以下问题（填在下面）:

---

## 观察记录

### Q1: 消息到达 Muse 后，日志里第一行输出是什么？
```
（填写）
```

### Q2: 你看到了几次 LLM 调用？（对应 Agent Loop 的几轮）
```
（填写）
```

### Q3: 有没有看到工具调用？如果有，是什么工具？
```
（填写）
```

### Q4: 从发消息到收到回复，日志里大概经历了哪些阶段？
```
（填写，尝试对应: Reason → Action → Observe）
```

### Q5: 和 01a 学的 ReAct 循环对比，你观察到的和理论一致吗？
```
（填写）
```

---

## 理论回顾

完成观察后，回顾这些知识点：
- 01a §一: Agent 核心循环 = `while(true) { LLM想 → 有工具调？执行！→ 没有？完成！}`
- 01e §1.2: ReAct = Thought → Action → Observation 交替
- Muse 映射: Telegram → engine.mjs → OpenCode session → MCP tools → LLM
