# 故障场景与恢复行为

> Muse 系统在各种故障下的表现和自动恢复能力。

---

## 故障矩阵

| 场景 | 现象 | 自动恢复 | 数据影响 | 操作 |
|------|------|---------|---------|------|
| 大脑 (OpenCode) 挂了 | 对话停止 | ✅ 小脑 30s 内重启 | 当前 session 上下文丢失，SQLite 记忆不丢 | 无需干预 |
| 小脑 (Cerebellum) 挂了 | 大脑无人守护 | ✅ launchd 自动拉起 (需已注册) | 无影响 | 无需干预 |
| Muse 主进程挂了 | Telegram 停 + Web 停 | ❌ 暂无守护 | SQLite + identity.json 不丢 | 手动 `cd muse && ./start.sh` |
| opencode 返回 500 | 单次对话失败 | ✅ Orchestrator 有重试 | 无 | 自动重试 |
| SQLite 锁定 | 写入失败 | ⚠️ WAL 模式下罕见 | 读取正常 | 等待锁释放 |
| Telegram 网络断开 | 消息收不到 | ✅ Telegraf 自动重连 | 可能丢失断网期间消息 | 等网络恢复 |

---

## 场景详解

### 大脑挂了 → 重启后的恢复链路

```
大脑 crash
  → 小脑心跳检测失败 (连续 3 次, ~90s)
  → 小脑执行重启: spawn opencode serve --port 4096
  → 大脑就绪 → 小脑继续心跳监控
  → 用户下次发消息 → Muse 创建新 session
  → Orchestrator 重新注入: 身份 + 语义记忆 + 情景摘要
  → 对话恢复 (但之前的多轮上下文丢失)
```

### 为什么当前 session 上下文会丢？

OpenCode 的 session 存在内存中。大脑重启后，之前的对话多轮上下文不在了。但 Muse 的编排层会：
1. 从 `identity.json` 注入人格 prompt
2. 从 SQLite 查询语义记忆 (你的偏好、姓名等永久信息)
3. 从 SQLite 查询近期情景摘要

所以她"记得你是谁"，但"忘了刚才聊到哪"。

### 全部挂了 → 如何完全恢复

```bash
# 确认 launchd 会自动拉起小脑 (如已注册)
launchctl list | grep com.later.muse

# 如果小脑没启动
node muse/daemon/cerebellum.mjs &

# 启动 Muse 主进程
cd muse && ./start.sh
```

数据完全不丢 — SQLite 文件 + identity.json 都在磁盘。

---

## 已知限制

| 限制 | 影响 | 计划解决时间 |
|------|------|------------|
| Muse 主进程无守护 | 挂了需手动重启 | Phase 2 |
| 大脑重启丢 session | 多轮上下文中断 | Phase 2 (session 恢复策略) |
| 只有 Telegram + Web 通道 | 无 CLI 交互 | Phase 3+ |
