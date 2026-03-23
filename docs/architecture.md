# 架构说明

> 面向对 Muse 内部设计感兴趣的用户。设计哲学见 [philosophy.md](./philosophy.md)。

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

- **SQLite 记忆** (`data/memory.db`) — 语义记忆 + 情景对话，任何进程挂掉都不丢
- **身份配置** (`data/identity.json`) — 磁盘文件，Web 编辑立即写入
- **OpenCode session** — 内存态，大脑重启后丢失（Orchestrator 会从 SQLite 重新注入记忆）

## FAMILY_HOME 架构（T21）

设置 `MUSE_HOME` 后启用源码与数据分离：

```
~/.muse/                            # FAMILY_HOME
├── family.json                     # 家族元数据
├── config.json                     # 家族级配置 (engine/web/daemon)
└── members/nvwa/                   # 成员目录
    ├── config.json                 # 成员级配置 (telegram)
    ├── identity/identity.json      # 身份数据
    ├── memory/memory.db            # 记忆数据库
    └── memory/attachments/         # 图片附件
```

配置 4 层加载: 代码默认值 → 家族 JSON → 成员 JSON → process.env 覆盖。

> 详细配置参考 → [configuration.md](./configuration.md)

## 模块清单

| 层 | 模块 | 文件 | 职责 |
|----|------|------|------|
| 基础 | 配置 | `config.mjs` | 配置入口分发 |
| 基础 | 日志 | `logger.mjs` | 统一日志格式 |
| 核心 | 身份 | `core/identity.mjs` | 人格加载 + AGENTS.md 写入 |
| 核心 | 记忆 | `core/memory.mjs` | SQLite 语义 + 情景记忆 |
| 核心 | 引擎 | `core/engine.mjs` | OpenCode REST API 封装 |
| 核心 | 编排 | `core/orchestrator.mjs` | 身份+记忆 → prompt 编排 |
| 触达 | Telegram | `adapters/telegram.mjs` | Bot 命令 + 消息处理 |
| 触达 | 感知通道 | `perception/telegram-channel.mjs` | 图片/文件下载 |
| 服务 | Web | `web/api.mjs` | 驾驶舱 HTTP API |
| 服务 | MCP | `mcp/memory.mjs` | Memory MCP Server |
| 守护 | 小脑 | `daemon/cerebellum.mjs` | 心跳 + 重启 |
| 守护 | 自检 | `daemon/self-check.mjs` | 健康检查 |
| 能力 | 注册表 | `capability/registry.mjs` | 能力自知 |
| 家族 | CLI | `family/cli.mjs` | init / start / migrate |
| 家族 | 配置加载 | `family/config-loader.mjs` | 4 层合并 |
| 工作流 | 状态机 | `workflow/state-machine.mjs` | 节点流转 + transition + history |
| 工作流 | 定义解析 | `workflow/definition.mjs` | JSON 解析 + 校验 |
| 工作流 | Bridge | `workflow/bridge.mjs` | 实例持久化 + session-index + 归档 |
| 工作流 | 通知 | `workflow/notify.mjs` | Telegram 通知（handoff/完成/异常） |
| 通信 | Registry | `family/registry.mjs` | 成员注册 + 端口发现 + 角色映射 |
| 通信 | Handoff | `family/handoff.mjs` | 跨 Muse 3-step ACK + session 创建 |
| 通信 | Client | `family/member-client.mjs` | OpenCode REST API 封装 |
| Hook | Prompt | `plugin/hooks/workflow-prompt.mjs` | 节点 prompt 编译（七要素+自检） |
| Hook | Gate | `plugin/hooks/workflow-gate.mjs` | 工具权限门控 |
| MCP 工具 | 工作流 | `mcp/workflow-tools.mjs` | init/status/transition/emit_artifact |

## Family 多实例架构

每个 Muse 成员是独立的 OpenCode 进程，通过 REST API 通信：

```
families/later-muse-family/
  ├── registry.json                 # 成员注册表（端口/角色）
  ├── workflow/
  │   ├── definitions/              # 工作流模板库（family 共享）
  │   ├── instances/                # 进行中的工作流实例
  │   ├── archive/{YYYY-MM}/        # 已完成实例按月归档
  │   └── session-index.json        # sessionId → instanceId 映射
  ├── knowledge/
  │   └── INDEX.md                  # 知识导航索引
  └── {member}/                     # 成员目录
      ├── config.json               # 成员配置
      ├── AGENTS.md                 # 身份 + 原则（Layer 1）
      └── opencode.json             # OpenCode 配置
```

成员间通信链路：

```
pua (端口 4100)  ──handoff──▸  arch (端口 4101)
     │                              │
     ▼                              ▼
  MemberClient                  MemberClient
     │                              │
     ▼                              ▼
  OpenCode REST API             OpenCode REST API
```

## 工作流引擎

工作流引擎驱动跨 Muse 的协作任务：

```
workflow JSON 定义
       │
       ▼
  StateMachine（节点流转）
       │
  ┌────┼────┐
  ▼    ▼    ▼
Gate  Prompt Bridge
 │     │      │
 ▼     ▼      ▼
工具   AI    持久化
权限  指令   state.json
```

### 核心机制

- **状态机**: 节点 + transition + history，支持 action/handoff/terminal/decision 类型
- **Bridge**: per-instance 持久化 + session-index + 完成后自动归档
- **Handoff**: 跨 Muse 3-step ACK（deliver → bind → execute），支持重试/取消
- **Prompt Hook**: 编译节点七要素（目标/步骤/约束/工具/退出条件/流转/执行规则）
- **Gate Hook**: 按 capabilities + bash_policy + file_scope 门控工具权限
- **自检机制**: pre-check 验证输入 artifact 存在，post-check 验证输出 artifact 才允许流转
- **read_first**: 节点声明前置阅读文件，AI 执行前先读取上下文

## 知识包体系

四层架构，详见 [knowledge-pack.md](./knowledge-pack.md)：

| 层 | 存放 | 加载方式 |
|----|------|---------|
| Layer 1: AGENTS.md | 成员目录 | 常驻 system prompt |
| Layer 2: 局部 AGENTS.md | 代码关键目录 | read 时自动带出 |
| Layer 3: INDEX.md | family/knowledge/ | AI 按需 read |
| Layer 4: 现有文档 | muse/docs/ 等 | AI 按需 read |

