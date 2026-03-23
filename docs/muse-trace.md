# muse-trace — Muse 全链路追踪体系

> Muse 各层模块的可观测性统一框架。

## 架构概览

```
muse-trace/
├── opencode/     AI 大脑内部（Plugin hook）
├── telegram/     感知入口（Telegram 收发）
├── orchestrator/ 编排层（session 决策、sendAndWait）
└── dev/          开发任务（DevTask 执行过程）
```

每一层都有独立的日志输出。Muse Node.js 层（telegram/orchestrator/dev）使用 `createLogger` 写到 stdout/文件；OpenCode 层使用 Plugin hook 写 JSONL。

---

## 各模块日志

### opencode 模块（Plugin hook）

**感知范围**：session 生命周期、工具调用链、AI 大脑内部事件

**日志位置**（family 模式，`MEMBER_DIR = muse/families/{FAMILY}/{MEMBER}/`）：
```
MEMBER_DIR/data/trace/
├── events.jsonl        # session 创建/完成/出错
├── tool-calls.jsonl    # 工具调用（含 durationMs, error）
├── messages.jsonl      # 消息元信息（agent, model）
└── traces/
    └── {sessionId}.json  # 单次对话完整链路快照
```

**Legacy 模式**（无 family）：`{workspace}/muse/data/hook-logs/`

Muse 自身日志（telegram/orchestrator/dev）写到：`MEMBER_DIR/data/logs/muse_{timestamp}.log`

#### events.jsonl 格式
```jsonc
{"ts":1742342400000,"type":"session.created","sid":"ses_abc"}
{"ts":1742342406000,"type":"session.idle","sid":"ses_abc"}
{"ts":1742342410000,"type":"session.error","sid":"ses_def","error":"ECONNREFUSED..."}
```

#### tool-calls.jsonl 格式
```jsonc
{"ts":1742342405000,"tool":"get_time","sid":"ses_abc","durationMs":12,"outputLen":15}
{"ts":1742342420000,"tool":"set_memory","durationMs":3001,"error":"ECONNREFUSED"}
```

#### traces/{sessionId}.json 格式
```jsonc
{
  "sessionId": "ses_abc", "startedAt": 1742342400000,
  "totalMs": 6000, "agent": "build", "model": "gemini-2.5-pro",
  "status": "completed",
  "tools": [{"tool": "get_time", "durationMs": 12}]
}
```

---

### telegram 模块（createLogger）

Muse 启动日志中即可看到，tag 为 `[telegram]`：
```
[telegram] received text from user_123
[telegram] sent reply, msgId=456
```

### orchestrator 模块（createLogger）

tag 为 `[engine]` 和 `[orchestrator]`，追踪 session 决策和 sendAndWait 轮询：
```
[engine] sendAndWait start sessionId=ses_abc
[engine] poll #3 status=busy
[engine] completed, totalMs=6000
```

### dev 模块（createLogger）

tag 为 `[dev]`，追踪 DevTask 10 步执行：
```
[dev] step=plan, status=ok
[dev] step=build, status=ok
[dev] step=test, exitCode=0
```

---

## trace-reader CLI（opencode 模块专用）

```bash
# 在 muse/ 目录下运行
node src/plugin/trace-reader.mjs                    # 最近 10 条 session
node src/plugin/trace-reader.mjs --errors           # 只看失败 session
node src/plugin/trace-reader.mjs --tools            # 工具调用列表
node src/plugin/trace-reader.mjs --session ses_xxx  # 指定 session
node src/plugin/trace-reader.mjs --tail             # 实时事件流
```

---

## 调试场景速查

| 问题 | 先看哪里 |
|------|---------|
| 完全没响应 | orchestrator 日志（`[engine] sendAndWait`）是否在轮询 |
| Telegram 收不到消息 | telegram 日志（`[telegram] received`） |
| AI 行为异常 | `trace-reader --session {sid}` 看工具调用链 |
| 工具调用失败 | `trace-reader --tools` 找 error 字段 |
| MCP server 挂了 | `trace-reader --errors` → error 含 ECONNREFUSED |
| DevTask 失败 | dev 日志（`[dev]`）| 的 step 和 exitCode |
