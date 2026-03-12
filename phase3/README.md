# Phase 3 — 主动性 + 自我成长基础

> **前置**: Phase 2 (Agent 化 + 工具基座) 完成
> **一句话**: 小缪有自己的节奏，会主动找你，还能开始学习新技能。

---

## 背景

Phase 2 让 Muse 拥有了工具使用和技能系统的 Agent 基础能力。Phase 3 在此基础上赋予她**主动性**——定时触发、事件驱动的消息推送，以及长期目标管理能力。

## 主要内容

### Pulse 引擎 (主动消息)

- **定时触发** — 早安、午休提醒、晚安、周报
- **事件触发** — git push 代码审计、记忆变更关联发现
- **随机触发** — 分享想法/心情、纪念日
- **Anti-Spam** — 每小时最多 2 次、深夜静音、连续未回复降频

### Goal 系统 (长期目标)

- 结构化目标对象: `active → achieved / abandoned`
- 目标驱动的主动行为 (Goal-driven Proactivity)
- 举例: "2026 学会 Rust" → 自动安排学习 → 跟进进度

### Life Threads (生活主题线)

- 把碎片记忆串成持续脉络 (健康/工作/学习/情绪)
- 跨时间的关联发现

## 技术架构

```
Cerebellum (小脑)
  ├── Cron Triggers → 定时检查 → 创建 session → 生成消息 → 推送
  ├── Event Listeners → 监听 git/文件系统事件
  └── Memory Scheduler → 定时记忆维护
```

依赖 Phase 2 的 MCP 工具和技能系统。

## 与其他 Phase 的关系

| Phase | 关系 |
|-------|------|
| Phase 1 | 使用 Telegram/Web 通道推送消息 |
| Phase 2 | 依赖 MCP 工具 + 技能系统 + Agent 化基础 |
| Phase 4 | 主动性是自我进化的前提 |

## 详细设计

完整的 Pulse 引擎和主动消息场景见 [ARCHITECTURE.md](../ARCHITECTURE.md) 第四~五章。
