# family/ — Family 通信层

核心模块：
- `registry.mjs` — Family Registry（成员注册、端口发现、角色映射）
- `handoff.mjs` — 跨 Muse Handoff（3-step ACK、session 创建、ensureNodeCompletion）
- `member-client.mjs` — MemberClient（OpenCode REST API 封装）

进程模型：每个 Muse 成员是独立 OpenCode 进程，通过 REST API 通信。
