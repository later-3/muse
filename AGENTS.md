# Muse — AI 灵魂伴侣框架

> 基于 OpenCode 的 AI 伴侣，不是助手。她叫小缪，有性格、有记忆、会成长。

## 项目定位

详见 [ARCHITECTURE.md](./ARCHITECTURE.md) 和 [PHILOSOPHY.md](./PHILOSOPHY.md)。

## 技术栈

- **Runtime**: Node.js ESM (>=22)
- **数据库**: better-sqlite3 (SQLite WAL)
- **Telegram**: Telegraf
- **AI 引擎**: OpenCode serve (REST API, 端口 4096)
- **Web 驾驶舱**: 单页 HTML (端口 4097)
- **测试**: `node:test` 内置测试框架
- **无框架**: 不用 React/Vue/Express，保持轻量

## Phase 1 进度

| 任务 | 状态 | 说明 |
|------|------|------|
| T01 项目脚手架 | ✅ 完成 | config.mjs, index.mjs, logger.mjs |
| T02 身份系统 | ✅ 完成 | identity.json + system prompt 生成 |
| T03 引擎层 | ✅ 完成 | OpenCode REST API 封装 + 状态机处理 |
| T04 记忆层 | ✅ 完成 | 语义(KV) + 情景(对话日志) SQLite |
| T05 编排层 | ✅ 完成 | 意图路由 + 记忆注入 + 后处理 |
| T06 Telegram | ✅ 完成 | Bot 交互 + 长消息分割 + 白名单 |
| T07 Web 驾驶舱 | ✅ 完成 | SPA 5页 + 17 API 测试 + E2E 验证 |
| T08 小脑 | ✅ 完成 | 守护进程 + 健康监控 + 自动重启 + session GC |
| T09 集成联调 | ✅ 完成 | 8 项集成测试 + 手动验证清单 |

**Phase 1 主体完成** — 守护链路/真实环境验证持续补证据中，详见 `phase1/t09-integration/manual-checklist.md`

## 快速上手

```bash
cp .env.example .env          # 填 TELEGRAM_BOT_TOKEN
npm install
./start.sh                    # 启动 OpenCode serve + Muse
# 或: node muse/index.mjs    # 单独启动 Muse（需 OpenCode 已运行）
```

验证：
```bash
node --test muse/             # 运行全部测试
curl http://127.0.0.1:4097/   # Web 驾驶舱
```

## 开发规范

- **ESM only** — 所有文件 `.mjs` 后缀，`import/export`
- **测试必须** — 每个模块 `xxx.test.mjs`，用 `node:test` + `assert/strict`
- **日志标签** — `createLogger('模块名')` 统一格式
- **错误降级** — 不能 crash 的地方用 try/catch 降级，不静默吞错
- **commit 格式** — `feat(t0X): 简述` / `fix(t0X): 简述`
- **审核流程** — 写 `review-prompt.md`，交另一个 agent 审核

## 关键文档索引

| 文档 | 位置 | 内容 |
|------|------|------|
| **用户文档** | `docs/` | 快速上手 + 架构 + 故障场景 + FAQ |
| 架构设计 | `ARCHITECTURE.md` | 大脑/小脑/触达层/Pulse/自我成长 完整设计 |
| 设计哲学 | `PHILOSOPHY.md` | 伴侣 vs 助手，设计原则 |
| Phase 1 | `phase1/README.md` | T01-T09 任务详情 (主体完成) |
| Phase 2 | `phase2/README.md` | Agent 化 + 工具/Native Agent 基座/技能基础 |
| Phase 3 | `phase3/README.md` | 主动性 + Pulse + 自我成长基础 |
| Phase 4 | `phase4/README.md` | 受控自我开发 + 家族 + 进化 |
| Phase 5 | `phase5/README.md` | 实体化: 3D 形象 + Body MCP + IoT |
| 模块说明 | `muse/README.md` | 启动流程、消息链路、排障 |
| 踩坑记录 | `phase1/EXPERIENCE.md` | BUG-001 到 BUG-015 |

## 踩坑提醒

- `prompt_async` 返回 204 空 body — 不要直接 `res.json()`
- OpenCode status map 删除 idle session — `unknown` = 已完成
- Telegraf 内置 90s handler 超时 — 配 `handlerTimeout: 150_000`
- Identity 数据是嵌套结构 `identity.name` 不是 `name`
- Mock 测试会掩盖真实数据分布不平衡

完整踩坑记录见 `phase1/EXPERIENCE.md`
