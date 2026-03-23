---
description: Muse 项目开发规范 (代码/测试/日志/commit/审核)
---

# 开发规范

> 从 AGENTS.md 拆出的必须遵守的开发规范。

## 代码规范

- **ESM only** — 所有文件 `.mjs` 后缀，`import/export`
- **Node.js >= 22** — 使用 `node:test` 内置测试框架
- **无框架** — 不用 React/Vue/Express，保持轻量

## 测试规范

- **测试必须** — 每个模块 `xxx.test.mjs`，用 `node:test` + `assert/strict`
- **写完即测** — 不要写完所有代码再补测试
- **CWD = muse/** — 从 `muse/` 目录运行 `npm test`

## 日志规范

- **统一标签** — `createLogger('模块名')` 统一格式
- **错误降级** — 不能 crash 的地方用 try/catch 降级
- **不静默吞错** — catch 里必须有 `log.error` 或 `console.error`

## Git 规范

- **commit 格式** — `feat(tXX): 简述` / `fix(tXX): 简述`
- **每完成一个 P0 子任务就提交**，不攒到最后

## 审核规范

- **开发文档** — 遵循 `/dev-doc` (13 维度)
- **开发实现** — 遵循 `/dev-impl` (含上下游联动 + Agent 设计检查)
- **真实验证** — 遵循 `/dev-verify` (防止认知覆盖率缺失)
- **审核流程** — 写 `review-prompt.md`，交另一个 agent 审核

## 技术栈

| 组件 | 技术 |
|------|------|
| Runtime | Node.js ESM (>=22) |
| 数据库 | better-sqlite3 (SQLite WAL) |
| Telegram | Telegraf |
| AI 引擎 | OpenCode serve (REST API, 端口 4096) |
| Web 驾驶舱 | 单页 HTML (端口 4097) |
| 测试 | `node:test` 内置测试框架 |
