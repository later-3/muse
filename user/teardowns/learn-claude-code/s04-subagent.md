# s04: Subagent — 上下文隔离的子任务

> **一句话:** 大任务拆成子任务时，子 Agent 用全新的 `messages=[]`，不污染父对话
> **源码:** `reference/repos/learn-claude-code/agents/s04_subagent.py` (185 行)
> **Muse 对应:** Harness `harnessSend()` 多 Agent 编排

---

## 核心代码 (25 行)

```python
def run_subagent(prompt: str) -> str:
    # 核心: 全新的 messages，和父 Agent 的对话历史完全隔离
    sub_messages = [{"role": "user", "content": prompt}]  # ← fresh!
    
    for _ in range(30):  # 安全上限
        response = client.messages.create(
            model=MODEL, system=SUBAGENT_SYSTEM,
            messages=sub_messages,  # ← 子 Agent 自己的历史
            tools=CHILD_TOOLS, max_tokens=8000,
        )
        sub_messages.append({"role": "assistant", "content": response.content})
        
        if response.stop_reason != "tool_use":
            break
        
        # 执行工具... (和 s02 一样)
        results = [...]
        sub_messages.append({"role": "user", "content": results})
    
    # 只返回最终文本总结 — 中间过程全丢弃
    return "".join(b.text for b in response.content 
                   if hasattr(b, "text")) or "(no summary)"

# 父 Agent 的工具里多了一个 "task"
PARENT_TOOLS = CHILD_TOOLS + [
    {"name": "task", 
     "description": "Spawn a subagent with fresh context.",
     ...}
]
```

## 架构图

```
Parent Agent                      Subagent
┌─────────────────┐               ┌─────────────────┐
│ messages = [     │               │ messages = []    │ ← 全新!
│   user: "重构X", │  task tool    │   user: "分析Y"  │
│   asst: "好的",  │ ──────────→  │   asst: 调工具   │
│   user: "继续",  │              │   user: 工具结果  │
│   asst: "派子任务│              │   asst: "Y分析..."│
│ ]                │  ← summary   │ ]                │
│   tool_result:   │ ──────────── │                  │
│   "Y分析结论..." │              │  ← 整个丢弃!     │
└─────────────────┘               └─────────────────┘

共享:  文件系统 (WORKDIR)
隔离:  对话历史 (messages)
禁止:  子 Agent 不能再 spawn 子 Agent (无 task 工具)
```

## 关键洞察

| 概念 | 说明 |
|------|------|
| **上下文有限** | LLM 的上下文窗口有限，子任务的中间过程会浪费 token |
| **隔离 = 新 list** | `sub_messages = []` 一行代码就实现了隔离 |
| **只返总结** | 父 Agent 只看子任务的结论，不看过程 |
| **共享文件系统** | 子 Agent 可以读写同一个 WORKDIR，通过文件传递大量信息 |
| **禁止递归** | CHILD_TOOLS 没有 `task` 工具，防止无限 spawn |

## Muse 映射

| learn-claude-code | Muse/OpenCode |
|-------------------|---------------|
| `run_subagent(prompt)` | `orchestrator.harnessSend(participant, task)` |
| `sub_messages = []` | Harness 为每个参与者创建新 session |
| `CHILD_TOOLS` 没有 task | Participant 没有 harness 权限 |
| 只返回 summary | `notify_planner` 回调结果 |
| 共享 WORKDIR | 共享 Muse 工作目录 |

> **关键洞察:** learn-claude-code 的 subagent 就是 Muse Harness 的简化版！
> 区别是 Muse 用的是 OpenCode session (异步)，他们用的是 Python 函数 (同步)

## 面试能讲

> **Q: 多 Agent 协作中如何避免上下文污染？**
> 
> A: 核心方法是"上下文隔离"：每个子 Agent 用独立的 `messages=[]`。我在 learn-claude-code 的 s04 里看到，实现只需要一行代码 — `sub_messages = [{"role": "user", "content": prompt}]`。关键是子 Agent 和父 Agent 共享文件系统但不共享对话历史，子 Agent 完成后只返回文本总结，中间的工具调用细节全丢弃。这既节省了父 Agent 的上下文窗口，又避免了交叉污染。Muse 的 Harness 编排也是同样原理，用 OpenCode session 实现。
