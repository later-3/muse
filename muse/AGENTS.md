# muse/ — Muse 核心模块

> 详细架构和消息链路见 [README.md](./README.md)

## 模块结构

```
muse/
├── index.mjs          # 入口: startAll() / stopAll()
├── config.mjs         # 环境变量 + .env 加载
├── logger.mjs         # createLogger()
├── core/
│   ├── identity.mjs   # 人设 (identity.json → system prompt)
│   ├── memory.mjs     # SQLite 记忆 (语义KV + 情景对话)
│   ├── engine.mjs     # OpenCode REST API 客户端
│   └── orchestrator.mjs # 意图 → Session → Prompt → 后处理
├── adapters/
│   └── telegram.mjs   # Telegram Bot (Telegraf)
├── web/
│   ├── api.mjs        # HTTP API + 静态文件服务
│   ├── api.test.mjs   # 17 个 API 测试
│   └── index.html     # SPA 前端 (5 tab)
└── data/
    ├── identity.json   # 小缪人设定义
    └── memory.db       # SQLite (自动创建)
```

## 启动顺序

Web → Identity → Memory → Engine → Telegram（Web 最先启动作为诊断入口）

## 测试

```bash
node --test muse/web/api.test.mjs    # Web API (17 tests)
node --test muse/index.test.mjs      # 集成测试
node --test muse/config.test.mjs     # 配置测试
node --test muse/                    # 全部
```

## 注意事项

- Identity 数据是嵌套的: `data.identity.name`, `data.psychology.traits.humor` (0-1 float)
- Memory 语义记忆靠正则提取（稀疏），情景记忆每轮自动存（密集）
- Engine `sendAndWait()` 的状态机逻辑较复杂，见 EXPERIENCE.md BUG-009/010/011
- Web 驾驶舱是纯 HTML+JS，不依赖任何前端框架
