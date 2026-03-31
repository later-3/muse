# s02: Tool Use — Dispatch Map 扩展工具

> **一句话:** 添加新工具 = 写一个 handler + 注册到 dispatch map，Loop 不改一行
> **源码:** `reference/repos/learn-claude-code/agents/s02_tool_use.py` (151 行)
> **Muse 对应:** `src/mcp/` MCP 工具注册

---

## 核心代码 (35 行)

```python
# 工具定义: 4 个工具 (s01 只有 bash)
TOOLS = [
    {"name": "bash",       "description": "Run a shell command.", ...},
    {"name": "read_file",  "description": "Read file contents.", ...},
    {"name": "write_file", "description": "Write content to file.", ...},
    {"name": "edit_file",  "description": "Replace exact text in file.", ...},
]

# Dispatch Map: 核心设计模式
TOOL_HANDLERS = {
    "bash":       lambda **kw: run_bash(kw["command"]),
    "read_file":  lambda **kw: run_read(kw["path"], kw.get("limit")),
    "write_file": lambda **kw: run_write(kw["path"], kw["content"]),
    "edit_file":  lambda **kw: run_edit(kw["path"], kw["old_text"], kw["new_text"]),
}

# agent_loop: 和 s01 完全一样！只改了下面两行
for block in response.content:
    if block.type == "tool_use":
        handler = TOOL_HANDLERS.get(block.name)           # ← 查 map
        output = handler(**block.input) if handler else "Unknown"  # ← 调 handler

# 安全: 路径沙箱
def safe_path(p: str) -> Path:
    path = (WORKDIR / p).resolve()
    if not path.is_relative_to(WORKDIR):   # ← 逃逸检测
        raise ValueError(f"Path escapes workspace: {p}")
    return path
```

## 架构图

```
s01 (1 tool):        s02 (4 tools):
┌──────┐             ┌──────────────┐
│ bash │             │ TOOL_HANDLERS│
└──────┘             │ {            │
                     │  bash → fn   │
Loop 不变 ──→        │  read → fn   │ ← 新增只改这里
                     │  write → fn  │
                     │  edit → fn   │
                     │ }            │
                     └──────────────┘
```

## 关键洞察

| 概念 | 说明 |
|------|------|
| **Loop 不变** | s01 → s02 → ... → s12，核心 while 循环一模一样 |
| **Dispatch Map** | `{name: handler}` 字典，LLM 返回 tool name → 查 map → 调函数 |
| **路径沙箱** | `safe_path()` 防止 LLM 读写工作目录外的文件 |
| **ACI 原则** | 工具名直观 (`read_file` 不是 `rf`)，参数最少，描述清晰 |

## Muse 映射

| learn-claude-code | Muse/OpenCode |
|-------------------|---------------|
| `TOOL_HANDLERS = {...}` | MCP server 的 tool 注册 (`src/mcp/`) |
| `TOOLS = [...]` | OpenCode 内置工具 (bash/read/write/edit/glob/grep) |
| `safe_path()` | OpenCode 的工作目录限制 |
| 从 1→4 工具 | Muse 通过 MCP 可以加无限工具 |

> **关键差异:** 他们直接在代码里注册工具，Muse 通过 MCP 协议动态发现工具

## 面试能讲

> **Q: 如何给 AI Agent 添加新能力？**
> 
> A: 最简单的设计是 Dispatch Map 模式：定义一个 `{tool_name: handler}` 字典。添加新能力时，写一个 handler 函数，注册到字典里，再给 LLM 的 tools 数组加一个描述。Agent Loop 本身不需要改。这和 MCP (Model Context Protocol) 的思想一致 — MCP 就是把这个 dispatch map 变成了网络协议，让工具可以跨进程注册。
