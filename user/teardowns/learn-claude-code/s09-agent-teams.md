# s09: Agent Teams — JSONL 信箱多 Agent 协作

> **一句话:** 多个 Agent 跑在各自线程里，通过 JSONL 文件信箱互发消息
> **源码:** `reference/repos/learn-claude-code/agents/s09_agent_teams.py` (404 行)
> **Muse 对应:** `src/core/orchestrator.mjs` Harness 多 Agent 编排

---

## 核心代码 (40 行)

```python
# ═══ JSONL 信箱: 最简单的 Agent 间通信 ═══
class MessageBus:
    def send(self, sender, to, content, msg_type="message"):
        msg = {"type": msg_type, "from": sender, 
               "content": content, "timestamp": time.time()}
        # 追加写入对方的 JSONL 文件
        with open(f"{to}.jsonl", "a") as f:
            f.write(json.dumps(msg) + "\n")
    
    def read_inbox(self, name):
        # 读取并清空自己的信箱
        messages = [json.loads(l) for l in open(f"{name}.jsonl")]
        open(f"{name}.jsonl", "w").close()  # 清空
        return messages  # drain 模式

# ═══ Teammate: 持久化的命名 Agent ═══
class TeammateManager:
    def spawn(self, name, role, prompt):
        # 每个 teammate 一个线程
        thread = threading.Thread(
            target=self._teammate_loop,
            args=(name, role, prompt), daemon=True)
        thread.start()
    
    def _teammate_loop(self, name, role, prompt):
        messages = [{"role": "user", "content": prompt}]
        for _ in range(50):
            # 检查信箱
            inbox = BUS.read_inbox(name)
            for msg in inbox:
                messages.append({"role": "user", "content": json.dumps(msg)})
            
            # 正常 agent loop (和 s01 一样!)
            response = client.messages.create(...)
            if response.stop_reason != "tool_use":
                break
            # 执行工具...
        
        member["status"] = "idle"  # 完成后变空闲

# ═══ 区别: Subagent vs Teammate ═══
# s04 Subagent:  spawn → execute → return summary → destroyed
# s09 Teammate:  spawn → work → idle → work → ... → shutdown
```

## 架构图

```
Lead Agent                 .team/inbox/
┌──────────┐               ┌──────────┐
│ 主线程    │               │ alice.jsonl │ ◄── append-only
│ spawn →  │               │ bob.jsonl   │
│ send_msg │               │ lead.jsonl  │
│ broadcast│               └──────────┘
└──────────┘

Thread: alice               Thread: bob
┌──────────────┐            ┌──────────────┐
│ while True:  │            │ while True:  │
│  check inbox │◄─── read ──│  check inbox │
│  call LLM    │            │  call LLM    │
│  run tools   │── send ──→ │  run tools   │
│  status:idle │            │  status:work │
└──────────────┘            └──────────────┘

5 种消息类型:
  message           → 普通对话
  broadcast         → 发给所有人
  shutdown_request  → 请求关停 (s10)
  shutdown_response → 关停审批 (s10)
  plan_approval     → 计划审批 (s10)
```

## 关键洞察

| 概念 | 说明 |
|------|------|
| **JSONL 信箱** | 每人一个 `.jsonl` 文件，append 写入，drain 读取 — 最简单的消息队列 |
| **线程隔离** | 每个 teammate 独立线程，独立 messages，独立 agent_loop |
| **持久 vs 临时** | Subagent(s04) 用完即弃 vs Teammate(s09) 长期存活 |
| **Lead 模式** | Lead Agent = 用户交互 + 管理 teammates，不直接干活 |
| **状态机** | `working → idle → working → ... → shutdown` |

## Muse 映射

| learn-claude-code | Muse/OpenCode |
|-------------------|---------------|
| `MessageBus` (JSONL) | Muse 的 `notify_planner` 回调 |
| `TeammateManager.spawn()` | `orchestrator.harnessSend()` |
| `config.json` (团队配置) | Muse `config.json` member 配置 |
| 线程 (threading) | Muse 用 OpenCode session (进程级隔离) |
| Lead + Teammates | Planner + Executor (Harness 模式) |

> **关键对比:**
> - learn-claude-code: JSONL 文件信箱 (进程内，简单)
> - Muse: notify_planner 回调 (跨进程，复杂但健壮)
> - 两者都是 Lead-Worker 模式

## 面试能讲

> **Q: 多个 AI Agent 之间如何通信？**
> 
> A: 最简单的方案是 JSONL 文件信箱，这是 Claude Code 的做法：每个 Agent 有一个 `.jsonl` 文件作为信箱，发消息就 append 一行 JSON，读消息就 drain（读完清空）。比消息队列轻量得多。关键设计是"5 种消息类型" — 普通消息、广播、关停请求/响应、计划审批，覆盖了大部分协作场景。我在 Muse 的 Harness 里实现了类似功能，但用的是回调函数而不是文件，因为 Muse 的 Agent 是跨进程的。
