# 架构说明

> 面向对 Muse 内部设计感兴趣的用户。完整技术设计见 [ARCHITECTURE.md](../ARCHITECTURE.md)。

## 整体架构

```
┌─────────────────────────────────────────────────┐
│              launchd (系统级)                     │
│     职责: 守护小脑, KeepAlive=true               │
└─────────────────┬───────────────────────────────┘
                  │ 拉起 / 重启
┌─────────────────▼───────────────────────────────┐
│         小脑 Cerebellum (独立进程)                │
│   node muse/daemon/cerebellum.mjs               │
│   职责: 心跳监控 + 重启大脑 + session GC          │
│   只管大脑 (opencode serve), 不管 Muse 主进程     │
└─────────────────┬───────────────────────────────┘
                  │ 监控 / 重启
┌─────────────────▼───────────────────────────────┐
│        大脑 OpenCode serve (端口 4096)            │
│   职责: LLM 推理 / 工具调用 / 代码生成            │
│   数据: session (内存, 重启后丢失)                │
└─────────────────▲───────────────────────────────┘
                  │ REST API 调用
┌─────────────────┴───────────────────────────────┐
│        Muse 主进程 (node muse/index.mjs)          │
│   ├── Web 驾驶舱 (端口 4097) ← 最先启动           │
│   ├── Identity (读 identity.json)                │
│   ├── Memory (SQLite, 持久化到磁盘)               │
│   ├── Engine (封装对大脑的 REST 调用)              │
│   ├── Orchestrator (编排: 身份+记忆+引擎)          │
│   └── Telegram Bot (对外交互)                     │
└─────────────────────────────────────────────────┘
```

## 启动顺序

Muse 主进程按 5 阶段启动 (Web 优先，确保诊断入口可用):

1. **Web 驾驶舱** — 先起来，即便后续模块失败也能看到状态
2. **Identity** — 加载 `identity.json`，获取人格数据
3. **Memory** — 初始化 SQLite，打开记忆库
4. **Engine** — 连接 OpenCode serve (如不在跑则启动)
5. **Telegram** — 注册 Bot 命令和消息处理

## 进程关系

| 进程 | 启动方式 | 守护者 | 数据持久性 |
|------|---------|--------|-----------|
| OpenCode serve | 由 Muse Engine 或 Cerebellum 拉起 | Cerebellum | session 在内存 (重启丢失) |
| Cerebellum | `node muse/daemon/cerebellum.mjs` 或 launchd | launchd | 无状态 |
| Muse 主进程 | `./start.sh` | ⚠️ 暂无 | Memory/Identity 在磁盘 |

## 数据持久化

- **SQLite 记忆** (`muse/data/memory.db`) — 语义记忆 + 情景对话，任何进程挂掉都不丢
- **身份配置** (`muse/data/identity.json`) — 磁盘文件，Web 编辑立即写入
- **OpenCode session** — 内存态，大脑重启后丢失（Orchestrator 会从 SQLite 重新注入记忆）
