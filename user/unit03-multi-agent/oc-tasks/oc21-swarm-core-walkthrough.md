# oc27: 走读 Swarm core.py

> **USOLB:** `[S]`源码 | **Bloom:** 2 — 理解 | **理论:** 02b §Swarm Handoff

---

## 核心文件: `repos/swarm/swarm/core.py`

### run() 方法 — Agent Loop

| 行号 | 代码 | 做了什么 | 对应 ReAct |
|------|------|---------|-----------|
| （填写） | （填写） | 主循环入口 | — |
| （填写） | （填写） | 调 LLM | Reason |
| （填写） | （填写） | 处理 tool_calls | Action |
| （填写） | （填写） | 检测 Handoff | — |

### Handoff 机制

| 问题 | 答案 (附行号) |
|------|-------------|
| Handoff 的触发条件是什么？ | （填写） |
| context 怎么传递给新 agent？ | （填写） |
| Handoff 后旧 agent 的状态？ | （填写） |

---

## Swarm vs Muse 对比

| 维度 | Swarm | Muse |
|------|-------|------|
| Handoff 触发 | （填写） | `src/family/handoff.mjs` |
| Context 传递 | （填写） | session-context.mjs |
| 多 Agent 管理 | （填写） | registry.mjs |
