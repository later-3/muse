# oc05: 走读 Muse 完整调用链

> **USOLB:** `[S]`源码
> **Bloom Level:** 2 — 理解
> **对应理论:** 01a + 01e 全部
> **前置:** oc04 完成（已理解 OC Session）
> **目标:** 画出 Muse 从 Telegram 消息到达 → LLM 回复 → Telegram 返回的完整时序图

---

## 调用链追踪

从一条 Telegram 消息开始，追踪它经过的每一个文件和函数：

### 阶段 1: 消息到达

| 步骤 | 文件 | 函数/方法 | 做了什么 |
|------|------|---------|---------|
| 1 | `src/adapters/telegram/` | （填写） | 接收 Telegram 消息 |
| 2 | `src/core/engine.mjs` | （填写） | 路由到对应 member |
| 3 | （填写） | （填写） | 创建/复用 OC session |

### 阶段 2: Agent 处理

| 步骤 | 文件 | 做了什么 | 对应 ReAct |
|------|------|---------|-----------|
| 4 | （填写） | system-prompt hook 注入身份 | — |
| 5 | （填写） | 发给 LLM | Reason |
| 6 | （填写） | MCP 工具调用 | Action |
| 7 | （填写） | 工具结果返回 | Observation |

### 阶段 3: 回复返回

| 步骤 | 文件 | 做了什么 |
|------|------|---------|
| 8 | （填写） | LLM 最终回复 |
| 9 | （填写） | 回复发回 Telegram |

---

## 时序图 (完成后画)

```
用户 → Telegram → Muse engine → OC session → LLM
                                     ↕
                                 MCP tools
                                     ↓
用户 ← Telegram ← Muse engine ← OC session ← LLM
```

（走读后替换成详细的 Mermaid 时序图）

---

## 关键发现

```
1. （填写：最意外的发现）
2. （填写：和预期不同的地方）
3. （填写：对应 Muse 里程碑 M1 的结论）
```
