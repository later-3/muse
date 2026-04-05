# Agent 核心定义

> **一句话定义**: Agent 是一个以 LLM 为决策核心的系统，通过 while 循环将模型与工具连接，使其能够感知环境、规划行动并自主执行任务。

## 核心原理

### 最简 Agent = 一个循环

Agent 的本质不是框架，不是复杂的编排系统，而是一个 **while 循环**。learn-claude-code 用不到 30 行 Python 给出了最精确的定义：

```python
def agent_loop(query):
    messages = [{"role": "user", "content": query}]
    while True:
        response = client.messages.create(
            model=MODEL, system=SYSTEM, messages=messages,
            tools=TOOLS, max_tokens=8000,
        )
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            return  # 模型决定停止 → 退出循环

        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = run_bash(block.input["command"])
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                })
        messages.append({"role": "user", "content": results})
```

**关键设计决策：**
- **退出条件由模型控制**：`stop_reason != "tool_use"` — 模型决定何时停止，不是人类
- **消息列表是唯一的状态**：`messages` 累积所有交互历史
- **循环体永远不变**：后续所有增强（多工具、子 Agent、压缩）都是在循环外部叠加，循环本身从 s01 到 s12 完全不变

### Agent 的四个组成部分

Microsoft 的 ai-agents-for-beginners 将 Agent 定义为一个 **系统**，包含：

| 组件 | 定义 | 类比 |
|------|------|------|
| **环境 (Environment)** | Agent 运作的空间 | 代码仓库 / 文件系统 / API |
| **感知器 (Sensors)** | 获取环境状态的能力 | `read_file` / `bash` / API 返回值 |
| **执行器 (Actuators)** | 改变环境状态的能力 | `write_file` / `edit_file` / `bash` |
| **LLM (大脑)** | 决策核心 | Claude / GPT / Gemini |

### Agent 类型谱系

从简单到复杂，Agent 存在一个类型谱系：

| 类型 | 行为模式 | 示例 |
|------|---------|------|
| **Simple Reflex** | 基于预定义规则直接响应 | if/else 路由 |
| **Model-Based Reflex** | 基于世界模型做出反应 | 有历史数据的决策 |
| **Goal-Based** | 创建计划来达成目标 | ReAct / Plan-and-Solve |
| **Utility-Based** | 权衡偏好，数值化比较方案 | 多因素优化 |
| **Learning** | 从反馈中持续改进 | 带 Memory 的 Agent |
| **Hierarchical** | 上级分解任务，下级执行 | Manager-Worker 模式 |
| **Multi-Agent** | 多 Agent 独立或协作完成任务 | Swarm / Team 模式 |

### "Agent 就是模型"

hello-agents (Datawhale) 提出了一个激进但深刻的观点：

> "The agent is never the surrounding code. The agent is always the model."
> — 第一章

围绕 Agent 的代码（循环、工具调度、消息管理）都是 **harness（线束）**，不是 Agent 本身。模型才是做决策的那个实体。这个区分非常重要：
- **Harness** 可以是 30 行 Python，也可以是 OpenCode 的数万行代码
- **Agent** 永远是那个被训练出来的、能理解意图和规划行动的模型

### Swarm 的极简抽象

OpenAI 的 Swarm 将 Agent 进一步简化为两个原语：

```python
agent = Agent(
    name="Helper",
    instructions="You are a helpful agent.",   # system prompt
    functions=[do_something],                   # 可调用的工具
)
```

- **Agent = instructions + functions**：instructions 变成 system prompt，functions 变成 tools
- **执行循环**和 learn-claude-code 完全一致：get completion → execute tools → check if done → repeat
- **Handoff**：Agent 返回另一个 Agent 即完成交接，无需复杂的编排层

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [learn-claude-code](../repos/learn-claude-code/docs/en/s01-the-agent-loop.md) | s01: The Agent Loop | ⭐⭐⭐ 定义级 | 30 行最简实现 + 循环不变性原则 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/01-intro-to-ai-agents/README.md) | L01: Intro to AI Agents | ⭐⭐⭐ 定义级 | 四组件模型 + 类型谱系 |
| [hello-agents](../repos/hello-agents/docs/chapter1/) | 第一章: 初识智能体 | ⭐⭐⭐ 定义级 | "Agent is the model" 观点 + 历史演进 |
| [swarm](../repos/swarm/README.md) | README + examples/basic | ⭐⭐ 实现级 | agents + handoffs 双原语 |
| [anthropic-cookbook](../repos/anthropic-cookbook/patterns/) | patterns/ | ⭐⭐ 实现级 | 生产级 Agent 模式 |

## 关键代码片段

### 最简 Agent（learn-claude-code s01）
```
User prompt → LLM → Tool execute → tool_result → LLM → ... → stop
         └────────────── while True ──────────────┘
```

### Swarm 的执行循环
```python
# client.run() 内部循环：
1. Get completion from current Agent
2. Execute tool calls, append results
3. Switch Agent if necessary (handoff)
4. Update context_variables
5. If no new function calls → return
```

## 概念间关系

- **后续概念**: [[tool-use-mcp]] (扩展 Agent 的能力) → [[prompt-engineering]] (优化 Agent 的指令) → [[context-engineering]] (管理 Agent 的信息)
- **相关概念**: [[multi-agent]] (多 Agent 协作) / [[memory]] (Agent 的记忆)
- **实现参考**: OpenCode (harness 层) / Muse (集成层)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| `src/core/engine/` | Agent Loop (while 循环) | ✅ 已实现 |
| `src/mcp/` | Tool 注册与调度 | ✅ 已实现 |
| `src/core/identity/` | Agent instructions (system prompt) | ✅ 已实现 |
| OpenCode 集成 | Harness 层 | ✅ 已实现 |
| `src/daemon/pulse/` | 主动行为（超越被动响应） | ✅ 已实现 |

## 开放问题

1. **Agent 自主性边界**：Agent 应该被允许做多少决策？learn-claude-code 的 `stop_reason` 完全交给模型，但生产环境需要 guardrails
2. **循环 vs 状态机**：简单 while 循环够用吗？复杂场景是否需要显式状态机（如 OpenCode 的 Sisyphus）？
3. **评估标准**：如何量化一个 Agent 的"好坏"？目前缺乏统一 benchmark
