# Harness 层架构

> **一句话定义**: Harness（框架/线束）是围绕 LLM 核心循环的工程层 — 它不改变模型本身，但决定了 Agent 的规划、隔离、并发、持久化和恢复能力。learn-claude-code 的 s01-s12 是最佳教学递进。

## 核心原理

### Harness 等级体系

learn-claude-code 定义了一个渐进式的 Harness 等级系统，从最简 30 行 Agent 到生产级多 Agent 团队：

```
     单体                          扩展                          团队
s01 → s02 → s03 → s04 → s05 → s06 │ s07 → s08 → s09 → s10 → s11 → s12
循环   工具   规划   子代理  技能加载 压缩 │ 任务图  后台   团队   协议   自主   工作树
```

每一层解决一个新问题，但**核心循环不变** — 所有复杂性都加在循环的"外面"。

### 第一层: 规划 (s03: TodoWrite)

**问题**：多步任务中模型"忘记"后续步骤。

```python
class TodoManager:
    # 核心约束: 同一时间只能有一个 in_progress 任务
    def update(self, items):
        in_progress_count = sum(1 for i in items if i["status"] == "in_progress")
        if in_progress_count > 1:
            raise ValueError("Only one task can be in_progress")

# Nag 提醒: 3 轮没更新 todo 就注入提醒
if rounds_since_todo >= 3:
    last["content"].insert(0, {
        "type": "text",
        "text": "<reminder>Update your todos.</reminder>",
    })
```

**设计洞察**：
- "一次只做一件事"迫使模型保持专注
- Nag 提醒是"非侵入式 guardrail" — 不阻断循环，只注入提示

### 第二层: 隔离 (s04: Subagent)

**问题**：上下文被工具输出污染。读 5 个文件只为得到"pytest"一个答案，但 5 个文件的内容永久留在上下文中。

```python
def run_subagent(prompt):
    # 子代理从空 messages 开始
    sub_messages = [{"role": "user", "content": prompt}]
    for _ in range(30):
        response = client.messages.create(
            model=MODEL, system=SUBAGENT_SYSTEM,
            messages=sub_messages, tools=CHILD_TOOLS
        )
        # ... 子代理自己的循环 ...
    # 只返回最终文本摘要, 子代理的所有中间过程被丢弃
    return "".join(b.text for b in response.content if hasattr(b, "text"))
```

**关键原则**：
- 父 Agent 得到 `task` 工具，子 Agent 得到所有工具但**没有 `task`**（禁止递归生成）
- 子代理的整个 messages 历史被丢弃 — 父代理只看到一段摘要

### 第三层: 持久化 (s07: Task System)

**问题**：内存中的 TodoList 无法处理依赖关系，且上下文压缩后丢失。

```python
# 文件化的任务图 (DAG)
.tasks/
  task_1.json  {"id": 1, "status": "completed"}
  task_2.json  {"id": 2, "blockedBy": [1], "status": "pending"}
  task_3.json  {"id": 3, "blockedBy": [1], "status": "pending"}
  task_4.json  {"id": 4, "blockedBy": [2, 3], "status": "pending"}

# 依赖清除: 完成任务自动解锁下游
def _clear_dependency(self, completed_id):
    for task in all_tasks:
        if completed_id in task["blockedBy"]:
            task["blockedBy"].remove(completed_id)
```

**核心三问**：
- **可做什么?** — pending 且 blockedBy 为空的任务
- **什么被阻塞?** — blockedBy 非空的任务
- **什么已完成?** — completed 的任务

### 第四层: 并发 (s08: Background Tasks)

**问题**：阻塞式执行浪费模型思考时间。`npm install` 需要 3 分钟，模型干等。

```python
class BackgroundManager:
    def run(self, command):
        task_id = str(uuid.uuid4())[:8]
        thread = threading.Thread(
            target=self._execute, args=(task_id, command), daemon=True)
        thread.start()  # 立即返回
        return f"Background task {task_id} started"

# 后台完成后注入通知
def agent_loop(messages):
    while True:
        notifs = BG.drain_notifications()
        if notifs:
            messages.append({"role": "user",
                "content": f"<background-results>\n{notif_text}\n</background-results>"})
        response = client.messages.create(...)
```

**设计原则**：循环保持单线程，只有 I/O 子进程并行化。通知通过队列在下次 LLM 调用前注入。

### 第五层: 环境隔离 (s12: Worktree)

**问题**：多个 Agent 在同一个目录里同时工作会冲突。

```
Control plane (.tasks/)           Execution plane (.worktrees/)
+------------------+              +------------------------+
| task_1.json      |  <------->   | auth-refactor/         |
|   worktree: "auth"|             |   branch: wt/auth      |
+------------------+              +------------------------+
| task_2.json      |  <------->   | ui-login/              |
|   worktree: "ui"  |             |   branch: wt/ui        |
+------------------+              +------------------------+

State machines:
  Task:     pending → in_progress → completed
  Worktree: absent  → active      → removed | kept
```

**核心**：任务管目标 (what)，工作树管环境 (where)，通过 task_id 绑定。

### Harness 层的完整视图

| 层次 | 组件 | 解决的问题 | 机制 |
|------|------|-----------|------|
| s01 | Agent Loop | 怎么和模型对话 | while + tool dispatch |
| s02 | Tool Use | 怎么扩展能力 | dispatch map |
| s03 | TodoManager | 怎么保持计划 | 状态约束 + nag 提醒 |
| s04 | Subagent | 怎么控制上下文 | messages 隔离 |
| s05 | Skill Loading | 怎么按需加载知识 | 两层 prompt |
| s06 | Context Compact | 怎么处理长对话 | 三层压缩 |
| s07 | Task Graph | 怎么记住目标 | 文件持久化 + DAG |
| s08 | Background | 怎么并行执行 | daemon thread + 通知队列 |
| s09 | Agent Teams | 多人怎么协作 | MessageBus + JSONL |
| s10 | Team Protocols | 怎么避免冲突 | FSM + request_id |
| s12 | Worktree | 怎么隔离环境 | git worktree + 任务绑定 |

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [learn-claude-code](../repos/learn-claude-code/) | s01-s12 全部 | ⭐⭐⭐ | 渐进式教学 + 完整代码 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/) | L07: Planning | ⭐⭐ | 规划设计模式 |

## 概念间关系

- **基础概念**: [[agent-definition]] (s01 循环) / [[tool-use-mcp]] (s02 工具)
- **上层概念**: [[multi-agent]] (s09-s10) / [[context-engineering]] (s06)
- **应用参考**: [[observability]] (每个 Harness 层都是 instrumentation 点)

## 开放问题

1. **规划深度**：s03 的 TodoManager 是平面清单，s07 是 DAG。什么时候需要更复杂的规划（如 HTN）？
2. **子代理复杂度**：s04 禁止递归生成。但实际场景中是否需要多层子代理？
3. **Worktree 成本**：每个任务一个 git 分支，对于大型仓库是否太重？
