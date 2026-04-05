# Tool Use 与 MCP

> **一句话定义**: Tool Use 是 Agent 通过函数调用（Function Calling）扩展能力的机制，MCP (Model Context Protocol) 则是标准化工具注册与发现的协议层。

## 核心原理

### 工具的本质：dispatch map

learn-claude-code s02 揭示了 Tool Use 的核心设计：**添加工具不需要改变循环**。工具只是注册到一个分发字典中：

```python
TOOL_HANDLERS = {
    "bash":       lambda **kw: run_bash(kw["command"]),
    "read_file":  lambda **kw: run_read(kw["path"], kw.get("limit")),
    "write_file": lambda **kw: run_write(kw["path"], kw["content"]),
    "edit_file":  lambda **kw: run_edit(kw["path"], kw["old_text"], kw["new_text"]),
}
```

循环中只需一行查找：

```python
for block in response.content:
    if block.type == "tool_use":
        handler = TOOL_HANDLERS.get(block.name)
        output = handler(**block.input) if handler \
            else f"Unknown tool: {block.name}"
```

**加一个工具 = 加一个 handler + 加一个 schema entry。循环永远不变。**

### Function Calling 三要素

ai-agents-for-beginners L04 定义了 Function Calling 的三个必要条件：

1. **支持 Function Calling 的 LLM** — 不是所有模型都支持
2. **Function Schema (JSON)** — 告诉 LLM 有什么工具可用：
```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_current_time",
        "description": "Get the current time in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "The city name"}
            },
            "required": ["location"],
        },
    }
}]
```
3. **函数实现代码** — LLM 选择工具后的实际执行逻辑

> **关键洞察**：LLM 返回的是 **tool_call**（函数名 + 参数），不是最终答案。Harness 负责执行并把结果喂回模型。

### Swarm 的自动 Schema 推导

Swarm 创新性地从 Python 函数签名自动生成 Schema：

```python
def greet(name, age: int, location: str = "New York"):
    """Greets the user. Make sure to get their name and age before calling.
    Args:
       name: Name of the user.
       age: Age of the user.
       location: Best place on earth.
    """
```

自动转换为：
- docstring → `description`
- 无默认值的参数 → `required`
- type hints → 参数 `type`

**Muse 启发**：MCP server 的工具注册可以借鉴这种"声明即注册"的模式。

### 路径安全：safe_path 模式

learn-claude-code s02 强调的安全模式 — 所有文件操作都经过沙箱检查：

```python
def safe_path(p: str) -> Path:
    path = (WORKDIR / p).resolve()
    if not path.is_relative_to(WORKDIR):
        raise ValueError(f"Path escapes workspace: {p}")
    return path
```

**原则**：Agent 能触及的文件系统范围，必须由 harness 强制限制，不能依赖模型自律。

### Tool Use 的六个构件

| 构件 | 作用 | 对应实现 |
|------|------|---------|
| **Function Schema** | 告诉 LLM 有什么工具 | JSON 定义 / 自动推导 |
| **Function Execution** | 调用时机和方式 | dispatch map / planner |
| **Message Handling** | 管理 user/assistant/tool 消息流 | messages 列表 |
| **Tool Integration** | 连接外部服务 | API adapter / MCP server |
| **Error Handling** | 工具执行失败的恢复 | 错误消息回传给 LLM |
| **State Management** | 跨轮次保持一致性 | context_variables / working memory |

### MCP: 工具的标准化协议

MCP (Model Context Protocol) 将工具从"硬编码在 harness 里"提升为"通过协议动态注册和发现"：

```
传统方式:
  Agent ←→ [hardcoded tools in agent code]

MCP 方式:
  Agent ←→ MCP Client ←→ MCP Server A (文件系统)
                       ←→ MCP Server B (数据库)
                       ←→ MCP Server C (API)
```

**MCP 的价值**：
- **解耦**：工具实现与 Agent 代码分离
- **复用**：多个 Agent 共享同一个 MCP Server
- **标准化**：统一的工具发现、调用协议
- **安全**：权限控制在 Server 端实现

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [learn-claude-code](../repos/learn-claude-code/docs/en/s02-tool-use.md) | s02: Tool Use | ⭐⭐⭐ | dispatch map 模式 + safe_path 安全 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/04-tool-use/README.md) | L04: Tool Use Design Pattern | ⭐⭐⭐ | Function Calling 三要素 + 六构件模型 |
| [swarm](../repos/swarm/README.md) | README: Functions | ⭐⭐ | 自动 Schema 推导 + handoff-as-function |
| [anthropic-cookbook](../repos/anthropic-cookbook/tool_use/) | tool_use/ | ⭐⭐ | 高级 tool use 模式 |
| [hello-agents](../repos/hello-agents/docs/chapter10/) | 第十章: 智能体通信协议 | ⭐⭐ | MCP / A2A / ANP 协议对比 |

## 关键代码片段

### 最简 Tool Dispatch（从 1 工具到 N 工具）
```
s01: bash only → hardcoded call
s02: 4 tools   → TOOL_HANDLERS dict
    添加工具 = dict 加一项 + TOOLS 列表加一项
    循环：不变
```

### Handoff 作为 Tool (Swarm)
```python
def transfer_to_sales():
    return sales_agent  # 返回 Agent 对象 = 控制权转移

agent_a = Agent(functions=[transfer_to_sales])
# 模型调用 transfer_to_sales() → 切换到 sales_agent
```

## 概念间关系

- **前置概念**: [[agent-definition]] (理解什么是 Agent)
- **后续概念**: [[prompt-engineering]] (优化工具描述) → [[context-engineering]] (Tool 结果的管理)
- **相关概念**: [[multi-agent]] (跨 Agent 的工具共享) / [[memory]] (工具执行历史的记忆)
- **高阶实践**: [[runtime-comparison]] (不同框架的 Tool 实现对比)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| `src/mcp/` | MCP Client + Tool 注册 | ✅ 已实现 |
| MCP Server 定义 | Tool Schema | ✅ 已实现 |
| `start.sh` 动态写入 | Tool 发现 | ✅ 已实现 |
| OpenCode 的 tool hook | Tool 执行拦截 | ✅ 已实现 |
| safe_path 模式 | 工具安全沙箱 | ❌ 待实现 |

## 开放问题

1. **工具过多的困惑**：当 Agent 有 30+ 工具时，模型容易选错（context confusion）。如何实现动态工具加载（RAG over tools）？
2. **MCP 的性能开销**：每个 MCP Server 是独立进程，大量工具调用时延迟如何控制？
3. **工具组合推理**：模型能否规划"先调 A 工具，拿到结果后调 B 工具"的多步工具链？当前模型在这方面的表现如何？
