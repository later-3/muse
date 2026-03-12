# FAQ — 开发中积累的问题和经验

> 开发 Muse 过程中的踩坑和决策记录。完整 Bug 记录见 [phase1/EXPERIENCE.md](../phase1/EXPERIENCE.md)。

---

## 启动相关

### Q: `node muse/daemon/cerebellum.mjs` 没反应？
A: 早期版本 cerebellum.mjs 只导出类，没有 main 入口。已修复 (commit `ce59e60`)。确保代码是最新的。

### Q: `launchctl load` 报错 "Input/output error"？
A: macOS 新版用 `launchctl bootstrap/bootout`，不用 `load/unload`，也不要 `sudo`:
```bash
cp muse/daemon/com.later.muse.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.later.muse.plist
```

### Q: start.sh 启动后小脑也在跑吗？
A: 不在。`start.sh` 只启动 Muse 主进程 (Web + Telegram + Engine)。小脑是独立进程，需单独启动。

---

## 架构相关

### Q: 小脑管 Muse 主进程吗？
A: 不管。小脑只守护 OpenCode serve (大脑)。Muse 主进程目前没有守护——这是 Phase 2 要解决的问题。

### Q: 大脑重启后记忆会丢吗？
A: **永久记忆不丢** — 语义记忆和情景对话在 SQLite 文件里。**当前对话上下文会丢** — OpenCode session 在内存中，重启后 Orchestrator 会重新注入记忆。

### Q: Identity 数据结构为什么是嵌套的？
A: `identity.json` 的顶层 key 是 `identity`/`psychology`/`linguistics` 等分类，不是扁平的。代码里访问名字要用 `identity.data.identity.name`，不是 `identity.data.name`。踩坑记录: BUG-009。

---

## 测试相关

### Q: 为什么有些测试用 mock server？
A: 集成测试不依赖真实的 OpenCode serve，用 `createServer()` 模拟 HTTP 响应。这样测试在没有 OpenCode 的机器上也能跑。

### Q: `prompt_async` 为什么不能直接 `res.json()`？
A: OpenCode 的 `prompt_async` 成功时返回 204 (无 body)。直接 `.json()` 会报错。踩坑记录: BUG-001。

---

## 开发规范

### Q: 为什么用 `.mjs` 不用 `.js`？
A: Muse 全用 ESM (`import/export`)。`.mjs` 强制 Node.js 以 ESM 模式解析，不需要 `"type": "module"` 配置。

### Q: 测试框架是什么？
A: `node:test` — Node.js 内置测试框架，不引入 Jest/Mocha 等外部依赖。搭配 `assert/strict` 使用。
