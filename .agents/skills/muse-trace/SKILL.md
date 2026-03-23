---
name: muse-trace
description: 使用 muse-trace 诊断 Muse 各模块的问题。当 Muse 出现异常（工具失败、响应超时、AI 行为异常、开发任务失败），按本 Skill 确定问题在哪个模块，再针对性排查。
---

# muse-trace Skill — Muse 全链路自诊断

## muse-trace 模块划分

```
muse-trace/
├── opencode/     AI 大脑内部（Plugin hook → trace-reader 查看）
├── telegram/     感知入口（createLogger [telegram]）
├── orchestrator/ 编排层（createLogger [engine]/[orchestrator]）
└── dev/          开发任务（createLogger [dev]）
```

## Trace 日志目录结构

```
{MEMBER_DIR}/data/trace/
├── 2026-03-18/                  ← 按日归档
│   ├── events.jsonl             ← OpenCode session 事件
│   ├── messages.jsonl           ← AI 消息元信息
│   ├── tool-calls.jsonl         ← 工具调用结束记录（含 outputSummary）
│   └── tool-starts.jsonl        ← 工具调用开始记录（用于卡死诊断）
├── 2026-03-19/
│   └── ...
└── traces/                      ← session 粒度聚合（trace-reader 默认视图）
    └── ses_xxx.json
```

## 第一步：定位问题在哪个模块

| 现象 | 怀疑模块 | 下一步 |
|------|---------|--------|
| Telegram 收不到消息 | telegram | 看 `[telegram]` 日志 |
| 收到消息但没回复 | orchestrator | 看 `[engine] sendAndWait` 日志 |
| 回复了但内容异常 | opencode | 用 `trace-reader` 看工具链 |
| 工具调用报错 | opencode | `trace-reader --errors` |
| **工具卡死（seenBusy 持续）** | opencode | **对比今日 `tool-starts` 和 `tool-calls`** |
| 超时且无工具记录 | opencode | OpenCode 内部未到工具层即卡住 |
| DevTask 失败 | dev | 看 `[dev]` step 和 exitCode |
| MCP 连接失败 | opencode | error 含 ECONNREFUSED |

## 各模块诊断方法

### opencode 模块（AI 大脑）

> **重要**：必须带 `MUSE_TRACE_DIR` 参数。启动横幅已打印完整命令，**直接复制使用**。

```bash
# TRACE_DIR = 启动横幅 "Trace:" 后的路径
MUSE_TRACE_DIR={TRACE_DIR} node {MUSE_ROOT}/src/plugin/trace-reader.mjs           # 最近 session
MUSE_TRACE_DIR={TRACE_DIR} node {MUSE_ROOT}/src/plugin/trace-reader.mjs --errors  # 只看失败
MUSE_TRACE_DIR={TRACE_DIR} node {MUSE_ROOT}/src/plugin/trace-reader.mjs --tools   # 全部日期工具调用
MUSE_TRACE_DIR={TRACE_DIR} node {MUSE_ROOT}/src/plugin/trace-reader.mjs --tools --date 2026-03-18  # 指定日期
MUSE_TRACE_DIR={TRACE_DIR} node {MUSE_ROOT}/src/plugin/trace-reader.mjs --tail    # 实时监听今日
```

#### 诊断工具卡死（`seenBusy` 持续到超时）

```bash
# 有 start 没有对应 end (callID 匹配) = 卡死的工具
cat {TRACE_DIR}/$(date +%Y-%m-%d)/tool-starts.jsonl | tail -20
cat {TRACE_DIR}/$(date +%Y-%m-%d)/tool-calls.jsonl  | tail -20
```

**关键字段**：
- `status: "error"` + `error: "ECONNREFUSED"` → MCP server 挂了
- `durationMs > 10000` → 工具调用超时
- `outputSummary` → 工具实际返回内容前 200 字，判断数据是否正确
- `tool-starts` 有记录但 `tool-calls` 无对应 `callID` → 该工具执行中卡死

### telegram / orchestrator / dev 模块

```bash
LOG=$(ls -t families/{FAMILY}/{MEMBER}/data/logs/muse_*.log | head -1)
grep "\[telegram\]" "$LOG" | tail -20
grep "\[engine\]" "$LOG" | tail -20
grep "\[dev\]" "$LOG" | tail -20
tail -f "$LOG"   # 实时监听
```

## 诊断后的修复路径

```
opencode 层工具失败（ECONNREFUSED）
  → 用 debug-mcp-service Skill 排查 MCP server

opencode 层工具卡死（tool-starts 有但 tool-calls 无对应记录）
  → 检查该工具的网络请求是否超时
  → 考虑在对应 MCP tool 里加请求超时

opencode 层行为异常（工具链不对）
  → 检查 AGENTS.md 或 system prompt 内容

Telegram 层异常
  → 检查 TELEGRAM_BOT_TOKEN 环境变量

Dev 层失败（开发任务）
  → 用 debug-muse-issue Skill 诊断具体步骤
```
