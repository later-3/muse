# workflow/ — 工作流引擎

核心模块：
- `state-machine.mjs` — 状态机（节点流转、transition、history）
- `definition.mjs` — 工作流 JSON 解析和校验
- `bridge.mjs` — 实例持久化（state.json、artifact、归档）
- `loader.mjs` — 工作流加载（从文件 / 从 member workflows/）
- `notify.mjs` — Telegram 通知（handoff 接管、完成、异常）

测试：`*.test.mjs`、`e2e.test.mjs`、`e2e-real.test.mjs`
