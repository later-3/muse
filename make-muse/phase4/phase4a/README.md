# Phase 4a — Web 驾驶舱：家族管理中心

> **前置**: Phase 3d (T42 Planner Orchestrator) 完成
> **一句话**: 把 Web 驾驶舱从 member 生命周期解耦，建成独立的家族全景管理平台。

---

## 背景

当前 Web 驾驶舱 (`src/web/`) 有一个根本性架构缺陷：

| 问题 | 说明 |
|------|------|
| **耦合** | WebServer 嵌入 `index.mjs`，依赖单个 member 的 `identity`/`memory`/`engine` 实例注入 |
| **单视角** | 只能看到启动它的那个 member 的数据 |
| **启停绑定** | member 不启动 → 驾驶舱就没有 |
| **重复** | 每个 member 都有自己的 web 端口 (nvwa:4097, coder:4099, arch:4103)，但 UI 完全一样 |

### 目标架构

Web 驾驶舱应该是**独立进程**，通过 Family Registry + Member Engine API 管理所有成员：

```
┌──────────────────────────────┐
│  Web 驾驶舱 (standalone)      │  ← 独立 node 进程，不依赖任何 member
│  http://127.0.0.1:4200       │
├──────────────────────────────┤
│  Family Registry (JSON)      │  ← 发现所有在线 member
│  ├─ nvwa   → 127.0.0.1:4096 │
│  ├─ coder  → 127.0.0.1:4098 │
│  ├─ arch   → 127.0.0.1:4102 │
│  └─ planner→ 127.0.0.1:4104 │
├──────────────────────────────┤
│  Member Engine API (HTTP)    │  ← 对每个 member 发 prompt / 读 session
└──────────────────────────────┘
```

---

## 任务分解

### T50 — 独立 Web 服务 (Standalone)

把 Web 驾驶舱从 `index.mjs` 拆出来，做成可独立启动的服务。

| 子任务 | 说明 |
|--------|------|
| T50-1 | **服务入口**: `src/web/standalone.mjs` — 独立 node 进程，读 `MUSE_HOME` 发现 families |
| T50-2 | **Registry API**: `/api/family/members` — 列出所有在线 member（基于 `registry.mjs`） |
| T50-3 | **Member 控制面板**: `/api/member/:name/restart` — family-level 启停控制（调 start.sh / kill PID） |
| T50-4 | **启动脚本**: `start-cockpit.sh` 或 `./start.sh cockpit` — 一键启动 |
| T50-5 | **旧 WebServer 降级**: `index.mjs` 中的 WebServer 改为可选，默认关闭 |

### T51 — 家族全景仪表盘

新前端：一眼看到所有成员的状态。

| 子任务 | 说明 |
|--------|------|
| T51-1 | **家族概览页**: 成员卡片网格 — 名字、角色、状态(🟢在线/🔴离线)、最近活动 |
| T51-2 | **成员详情弹窗**: 点击成员 → 看身份、性格、健康报告、session 列表 |
| T51-3 | **成员管理操作**: 启动/停止/重启 member（调 `start.sh`） |
| T51-4 | **实时状态**: 轮询 Registry + Engine health，自动刷新成员状态 |

### T52 — 跨成员对话

在驾驶舱里直接和任意 member 对话。

> **API 策略**: 不复用 MemberClient（它只封装了 createSession/prompt/poll/fetchLastReply），
> standalone cockpit 直接**透传 OpenCode HTTP API**（`/session`, `/session/:id/message` 等），
> 后端做纯代理 + CORS，不再包装一层。

| 子任务 | 说明 |
|--------|------|
| T52-0 | **OpenCode 代理层**: `/api/member/:name/oc/*` → 透传到 member 的 OpenCode API（session/message/status） |
| T52-1 | **对话面板**: 选择 member → 输入消息 → 通过代理层发到 OpenCode |
| T52-2 | **Session 管理**: 创建/切换/删除 session（直接调 OpenCode REST） |
| T52-3 | **会话历史**: 读取 member 的所有 session + messages，按时间线展示 |
| T52-4 | **多窗口对话**: 同时打开多个 member 的对话窗口 |

### T53 — 配置管理

在 Web 上配置 member 的模型、身份、性格。

> **身份真相源**: `data/identity.json` 是运行时身份主数据（名字、简介、性格维度等）。
> AGENTS.md 是由 `identity.mergePersonaToAgentsMd()` 生成的人格展示层，不是真相源。
> `config.json` 只处理端口/telegram/role 等运行配置，不承担身份主数据。

> **模型生效合同**: 修改 `opencode.json` 的 model 字段本身不会让在线实例切模型。
> OpenCode serve 在启动时解析模型，改文件后**必须显式 restart member** 才生效。
> Cockpit 需要提供 family-level restart API（T50-3 的 control plane）。

| 子任务 | 说明 |
|--------|------|
| T53-1 | **模型配置**: 查看/切换 member 的 AI 模型（读写 opencode.json `model`），改后触发 restart member |
| T53-2 | **身份编辑**: 编辑 `data/identity.json` 对应字段（名字、角色、简介），需要时同步生成 AGENTS.md |
| T53-3 | **性格调参**: 性格维度滑块，写入 identity.json，同步 AGENTS.md 人格区块 |
| T53-4 | **创建新成员**: 表单化创建 member（调 `create-member.sh`） |

### T54 — 工作流可视化

Planner 工作流的可视化管理界面。

| 子任务 | 说明 |
|--------|------|
| T54-1 | **工作流列表**: 所有活跃 workflow instances，显示状态/进度 |
| T54-2 | **状态机可视化**: 节点图 — 当前节点高亮，历史路径回放 |
| T54-3 | **Artifact 查看**: 读取工作流产出物内容 |

---

## 技术选型

| 项 | 方案 | 理由 |
|----|------|------|
| 后端 | `node:http` (vanilla) | 延续现有无依赖风格，与引擎一致 |
| 前端 | HTML + Vanilla CSS + JS | 延续 T07 风格，零构建，Claude-friendly |
| 进程间通信 | HTTP (MemberClient) | 复用 `src/family/member-client.mjs` |
| 成员发现 | Family Registry JSON | 复用 `src/family/registry.mjs` |
| 配置管理 | 直读/写 member 目录下的 JSON 文件 | 简单直接 |

---

## 执行优先级

```
T50 (独立服务) → T51 (家族仪表盘) → T52 (对话) → T53 (配置) → T54 (工作流)
```

T50 是基础设施，必须先做；T51-T54 可以逐步迭代。

---

## 与其他 Phase 的关系

| Phase | 关系 |
|-------|------|
| Phase 1 T07 | Part I 的前端/API 可部分复用，Part II 愿景在此落地 |
| Phase 3d T42 | Planner 工作流的可视化 (T54) |
| Phase 4 Family | 多成员管理是 Family 架构的用户界面 |
