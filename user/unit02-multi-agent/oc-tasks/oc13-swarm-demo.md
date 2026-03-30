# oc13: Swarm 跑通官方 demo

> **USOLB:** `[U]`使用
> **Bloom Level:** 1 — 观察
> **对应理论:** 02b §Swarm Handoff
> **目标:** 跑 Swarm 的 basic + triage 示例，观察 Handoff 行为

---

## 操作步骤

### Step 1: 确认 Swarm 已 clone

```bash
ls repos/swarm/examples/
# 应该看到 basic/, triage_agent/ 等目录
```

### Step 2: 跑 basic 示例

```bash
cd repos/swarm/examples/basic/
python3 run.py  # 或者 bare_minimum.py
```

### Step 3: 跑 triage 示例

```bash
cd repos/swarm/examples/triage_agent/
python3 run.py
```

---

## 观察记录

### basic 示例

| 问题 | 记录 |
|------|------|
| 有几个 Agent？分别叫什么？ | （填写） |
| 发生了 Handoff 吗？ | （填写） |
| Handoff 时 context 怎么传递的？ | （填写） |

### triage 示例

| 问题 | 记录 |
|------|------|
| triage agent 的作用是什么？ | （填写: 对应 BEA 的 Routing 模式） |
| 它怎么决定分给哪个 agent？ | （填写） |
| 和 Muse 的 planner 角色像吗？ | （填写） |

---

## 理论映射

| Swarm 概念 | BEA 对应模式 | Muse 对应 |
|-----------|-------------|----------|
| Agent 切换 | （填写） | handoff.mjs |
| triage | （填写） | planner 路由 |
| context 传递 | （填写） | session context |
