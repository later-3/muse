# Muse 引擎 — 开发者文档

> 这是 Muse 引擎的根 AGENTS.md。
> **Persona 信息**已迁移到各 member 的 AGENTS.md（如 `families/later-muse-family/nvwa/AGENTS.md`）。
> 开发 agent 在引擎根目录下工作时加载此文件。

## 引擎结构

```
muse/
├── muse.json             ← project 配置（默认 family/member）
├── .agents/
│   └── skills/           ← 引擎级 Skill（muse-trace 等）
├── docs/                 ← 开发者文档（muse-trace.md 等）
├── src/                  ← 所有引擎代码
│   ├── index.mjs         ← 启动入口
│   ├── config.mjs        ← 三模式配置加载
│   ├── core/             ← 大脑核心（identity/memory/engine/orchestrator）
│   ├── adapters/         ← 感知适配器（telegram）
│   ├── mcp/              ← MCP 工具服务器
│   ├── daemon/           ← 后台守护（cerebellum/pulse/health）
│   ├── family/           ← Family 配置加载器
│   ├── plugin/           ← OpenCode 插件（含 trace-reader CLI）
│   ├── skill/            ← Skill 相关
│   ├── web/              ← Web Cockpit
│   └── voice/            ← 语音 STT/TTS
├── families/             ← 运行时数据（gitignored）
│   └── {family}/{member}/
│       ├── .opencode/opencode.json  ← member 动态生成的 OpenCode 配置
│       ├── AGENTS.md     ← member 身份（persona）
│       ├── config.json   ← member 业务配置
│       └── data/
│           ├── logs/     ← Muse Node.js 日志（muse_{timestamp}.log）
│           └── trace/    ← OpenCode Plugin trace（events/tool-calls/traces）
└── data/                 ← 引擎级数据（STT 模型等，gitignored）
```

## 开发规范

> 详见 `.agents/workflows/dev-convention.md`

快速参考: ESM only / `node:test` / `createLogger()` / `feat(tXX): 简述`

## 可观测性（muse-trace）

Muse 全链路追踪分四个模块：
- **opencode**：Plugin hook，写 `data/trace/`（trace-reader CLI 查看）
- **telegram / orchestrator / dev**：`createLogger` 写 `data/logs/muse_*.log`

诊断工具：
```bash
cd muse/
node src/plugin/trace-reader.mjs           # 最近 session 链路
node src/plugin/trace-reader.mjs --errors  # 只看失败
node src/plugin/trace-reader.mjs --tail    # 实时监听
```

> 详见 `.agents/skills/muse-trace/SKILL.md` 和 `docs/muse-trace.md`

## 踩坑提醒

- `prompt_async` 返回 204 空 body — 不要直接 `res.json()`
- OpenCode status map 删除 idle session — `unknown` = 已完成
- Telegraf 内置 90s handler 超时 — 配 `handlerTimeout: 150_000`
- Identity 数据是嵌套结构 `identity.name` 不是 `name`
- Mock 测试会掩盖真实数据分布不平衡
- 切换模型不改 `oh-my-opencode.json` = 没切
- `trace.dir` 在 `loadMemberDirConfig` 和 `loadFamilyConfig` 两处都要设置

## 项目状态

> 详见 `PROJECT_STATE.json`

## MCP server 路径

启动时由 `start.sh` 动态写入 `families/{family}/{member}/.opencode/opencode.json`，不要在 member 目录里硬编码绝对路径。
