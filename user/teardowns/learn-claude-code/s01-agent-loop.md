# s01: Agent Loop — 一个 while 循环就是 Agent

> **一句话:** 整个 AI Agent 的秘密就是一个 while 循环 + 一个 bash 工具
> **源码:** `reference/repos/learn-claude-code/agents/s01_agent_loop.py` (119 行)
> **Muse 对应:** `src/core/engine.mjs` → `sendAndWait()`

---

## 核心代码 (30 行)

```python
# 工具定义: 只有一个 bash
TOOLS = [{
    "name": "bash",
    "description": "Run a shell command.",
    "input_schema": {
        "type": "object",
        "properties": {"command": {"type": "string"}},
        "required": ["command"],
    },
}]

# 核心循环: 就这么多
def agent_loop(messages: list):
    while True:
        # 1. 调 LLM
        response = client.messages.create(
            model=MODEL, system=SYSTEM, messages=messages,
            tools=TOOLS, max_tokens=8000,
        )
        messages.append({"role": "assistant", "content": response.content})
        
        # 2. 模型说停就停
        if response.stop_reason != "tool_use":
            return
        
        # 3. 执行工具调用
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = run_bash(block.input["command"])
                results.append({"type": "tool_result", 
                               "tool_use_id": block.id, "content": output})
        messages.append({"role": "user", "content": results})
        # → 回到 while True，LLM 继续决定下一步
```

## 架构图

```
User prompt
    │
    ▼
┌───────────┐
│ while True│ ◄─── 这就是 Agent Loop
│  ┌────────┤
│  │ LLM()  │──── stop_reason == "tool_use"? ──── no ──→ return
│  │        │         │
│  │        │        yes
│  │        │         │
│  │        │    ┌────▼────┐
│  │        │    │ run_bash│ 执行命令
│  │        │    └────┬────┘
│  │        │         │
│  └────────┤    append tool_result
│           │         │
│           │◄────────┘
└───────────┘
```

## 关键洞察

| 概念 | 说明 |
|------|------|
| **模型决定一切** | 何时调工具、调哪个、何时停止 — 全是 LLM 的 `stop_reason` 控制 |
| **Harness 只执行** | `run_bash()` 不做判断，模型说什么就跑什么 |
| **messages 是记忆** | 工具结果追加回 messages，LLM 下一轮能看到 |
| **一个工具够了** | bash 是万能的 — "Bash is all you need" |

## Muse 映射

| learn-claude-code | Muse/OpenCode |
|-------------------|---------------|
| `client.messages.create()` | OpenCode 内部调 LLM provider |
| `stop_reason != "tool_use"` | OpenCode 检查 `finish_reason` |
| `run_bash()` | OpenCode 内置 bash 工具 |
| `messages.append()` | OpenCode session 自动管理 |
| **整个 agent_loop** | **`engine.sendAndWait()` + OpenCode 内部 loop** |

> **关键差异:** 他们的 loop 在客户端 (Python 进程)，我们的 loop 在 OpenCode 服务端

## 面试能讲

> **Q: Agent 的核心原理是什么？**
> 
> A: 本质就是一个 while 循环：调 LLM → 检查 stop_reason → 如果要调工具就执行 → 把结果追加回对话 → 再调 LLM。这个循环在 Claude Code 里只有 30 行 Python。我从 learn-claude-code 源码看到的实现和 Anthropic BEA 论文描述一致：模型是大脑，循环是骨架，工具是四肢。真正的 Agent 智能来自模型训练，Harness 代码只负责连接。
