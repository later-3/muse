# T08 小脑 (Cerebellum) — 技术方案

> 独立守护进程：健康监控 + 大脑进程管理 + 僵尸会话清理
>
> 大脑 = OpenCode serve | 小脑 = 本模块 | launchd = 系统级守护

---

## 1. 目标

- 实现独立的小脑进程，与大脑 (opencode serve) 分离运行
- 两级守护：launchd 拉起小脑，小脑拉起并管理大脑
- 定时健康检查，大脑无响应时自动重启
- 清理僵尸 session，防止资源泄漏
- **诊断可观测性** — 小脑对外暴露丰富的运行状态，让 Web 驾驶舱成为真正的故障诊断入口
- 遵循 T01 生命周期接口（start/stop/health）

> 📎 自我成长引擎 (T08-2) 的预研方案见 [self-growth-spec.md](self-growth-spec.md)，属于 Phase 1.5/2 演进方向，不在本阶段交付范围内。

---

## 2. 架构

```
┌─────────────────────────────────────────────┐
│              系统级 (macOS)                   │
│  launchd ──KeepAlive──> 小脑 cerebellum.mjs  │
└─────────────────────┬───────────────────────┘
                      │ spawn + monitor
┌─────────────────────▼───────────────────────┐
│              小脑 (Cerebellum)                │
│  cerebellum.mjs — 独立 Node.js 进程          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐            │
│  │ Heartbeat   │  │ SessionGC   │            │
│  │ 30s 心跳    │  │ 定时清理    │            │
│  │ 3次失败重启 │  │ >24h session│            │
│  └──────┬──────┘  └──────┬──────┘            │
│         │                │                   │
│         ▼                ▼                   │
│  ┌─────────────────────────────┐             │
│  │  Engine healthCheck (REST)  │             │
│  │  GET /provider              │             │
│  │  GET /session (清理用)       │             │
│  └──────────────┬──────────────┘             │
└─────────────────┼────────────────────────────┘
                  │ HTTP
┌─────────────────▼────────────────────────────┐
│              大脑 (Cortex)                     │
│  opencode serve :4096                         │
│  推理 · 对话 · 工具调用 · 代码编写             │
└──────────────────────────────────────────────┘
```

**关键设计决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 小脑是独立进程 | ✅ | 大脑 crash 不影响小脑，反过来也是 |
| launchd 只管小脑 | ✅ | 不直接管大脑，避免 launchd 和小脑抢管 |
| 通过 REST 检测大脑 | 优先 `GET /global/health`，降级 `/provider` | 和 T03 Engine.healthCheck 保持一致 (BUG-004) |
| 小脑自己不用 Engine 类 | 轻量 fetch | 避免循环依赖，小脑应尽量简单 |

---

## 3. 核心实现

### 3.1 daemon/cerebellum.mjs

```javascript
import { spawn } from 'node:child_process'
import { createLogger } from '../logger.mjs'

const log = createLogger('cerebellum')

export class Cerebellum {
  #config
  #cortexProcess = null
  #heartbeatTimer = null
  #sessionGCTimer = null
  #consecutiveFailures = 0
  #running = false

  constructor(config) {
    this.#config = config
  }

  // --- 生命周期 ---

  async start() {
    log.info('🧠 小脑启动中...')
    this.#running = true

    // 1. 尝试连接已有的大脑
    if (await this.#cortexHealthCheck()) {
      log.info('检测到已运行的大脑 (opencode serve)，进入监控模式')
    } else {
      // 2. 没有运行中的大脑，拉起一个
      await this.#spawnCortex()
    }

    // 3. 启动心跳监控
    this.#startHeartbeat()

    // 4. 启动会话清理（每小时一次）
    this.#startSessionGC()

    log.info('🧠 小脑已就绪，守护大脑中')
  }

  async stop() {
    log.info('小脑关闭中...')
    this.#running = false

    // 停止定时器
    clearInterval(this.#heartbeatTimer)
    clearInterval(this.#sessionGCTimer)

    // 优雅关闭大脑 (只关闭我们自己启动的)
    if (this.#cortexProcess) {
      log.info('终止大脑进程...')
      this.#cortexProcess.kill('SIGTERM')
      this.#cortexProcess = null
    }

    log.info('小脑已关闭')
  }

  async health() {
    const cortexOk = await this.#cortexHealthCheck()
    return {
      ok: this.#running,
      detail: {
        cerebellum: this.#running ? 'running' : 'stopped',
        cortex: cortexOk ? 'healthy' : 'unreachable',
        consecutiveFailures: this.#consecutiveFailures,
        ownsCortex: this.#cortexProcess !== null,
        lastRestartTime: this.#lastRestartTime,       // 最近重启时间
        lastFailureReason: this.#lastFailureReason,   // 最近失败原因
        heartbeatHistory: this.#heartbeatHistory,      // 最近 10 次心跳结果
        lastGCResult: this.#lastGCResult,              // 最近一次 session GC 结果
      }
    }
  }

  // --- 心跳监控 ---

  #startHeartbeat() {
    const intervalMs = this.#config.daemon.heartbeatIntervalMs
    const maxFailures = this.#config.daemon.maxFailures

    this.#heartbeatTimer = setInterval(async () => {
      const ok = await this.#cortexHealthCheck()

      if (ok) {
        if (this.#consecutiveFailures > 0) {
          log.info(`大脑恢复健康 (之前连续失败 ${this.#consecutiveFailures} 次)`)
        }
        this.#consecutiveFailures = 0
        return
      }

      this.#consecutiveFailures++
      log.warn(`大脑健康检查失败 (${this.#consecutiveFailures}/${maxFailures})`)

      if (this.#consecutiveFailures >= maxFailures) {
        log.error(`大脑连续 ${maxFailures} 次无响应，执行重启`)
        this.#consecutiveFailures = 0
        await this.#restartCortex()
      }
    }, intervalMs)
  }

  // --- 进程管理 ---

  async #spawnCortex() {
    const port = this.#config.engine.port
    const workspace = this.#config.engine.workspace

    log.info(`拉起大脑: opencode serve --port ${port}`)

    this.#cortexProcess = spawn('opencode', ['serve', '--port', String(port)], {
      cwd: workspace,
      stdio: ['ignore', 'ignore', 'pipe'],
      detached: false,  // 小脑死了大脑也停（双保险）
    })

    // 收集 stderr 用于诊断
    let stderrBuffer = ''
    this.#cortexProcess.stderr.on('data', chunk => {
      if (stderrBuffer.length < 2048) stderrBuffer += chunk.toString()
    })

    this.#cortexProcess.on('exit', (code, signal) => {
      log.warn(`大脑进程退出: code=${code} signal=${signal}`)
      this.#cortexProcess = null
      // 不在这里重启，等心跳检测触发
    })

    this.#cortexProcess.on('error', err => {
      log.error(`大脑进程错误: ${err.message}`)
    })

    // 等待大脑就绪 (最多 15s)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500))
      if (await this.#cortexHealthCheck()) {
        log.info('大脑已就绪')
        return
      }
    }

    throw new Error(`大脑启动超时 (15s)\nstderr: ${stderrBuffer.slice(0, 500)}`)
  }

  async #restartCortex() {
    // 1. 杀掉旧进程
    if (this.#cortexProcess) {
      this.#cortexProcess.kill('SIGTERM')
      this.#cortexProcess = null
      await new Promise(r => setTimeout(r, 2000))  // 等待清理
    }

    // 2. 拉起新进程
    try {
      await this.#spawnCortex()
      log.info('✅ 大脑重启成功')
    } catch (err) {
      log.error(`大脑重启失败: ${err.message}`)
      // 下次心跳会继续尝试
    }
  }

  // --- 会话清理 ---

  #startSessionGC() {
    // 每小时执行一次
    this.#sessionGCTimer = setInterval(() => {
      this.#cleanupSessions().catch(err => {
        log.warn(`会话清理失败: ${err.message}`)
      })
    }, 3600_000)
  }

  async #cleanupSessions() {
    try {
      const baseUrl = `${this.#config.engine.host}:${this.#config.engine.port}`
      const headers = {
        'Content-Type': 'application/json',
        'x-opencode-directory': this.#config.engine.workspace,
      }

      const res = await fetch(`${baseUrl}/session`, {
        headers,
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return

      const sessions = await res.json()
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000  // 24 小时
      let cleaned = 0

      for (const session of sessions) {
        const updatedAt = new Date(session.updatedAt || session.createdAt).getTime()
        if (now - updatedAt > maxAge) {
          await fetch(`${baseUrl}/session/${session.id}`, {
            method: 'DELETE',
            headers,
            signal: AbortSignal.timeout(5000),
          })
          cleaned++
        }
      }

      if (cleaned > 0) {
        log.info(`清理了 ${cleaned} 个僵尸 session`)
      }
    } catch (err) {
      log.debug(`会话清理跳过: ${err.message}`)
    }
  }

  // --- 内部工具 ---

  async #cortexHealthCheck() {
    try {
      const baseUrl = `${this.#config.engine.host}:${this.#config.engine.port}`
      // 优先 /global/health (无需 workspace header) — 和 Engine.healthCheck 保持一致 (BUG-004)
      const res = await fetch(`${baseUrl}/global/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return true
      // 降级: 尝试 /provider (旧版兼容)
      const res2 = await fetch(`${baseUrl}/provider`, {
        headers: { 'x-opencode-directory': this.#config.engine.workspace },
        signal: AbortSignal.timeout(3000),
      })
      return res2.ok
    } catch {
      return false
    }
  }
}
```

### 3.2 daemon/com.later.muse.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.later.muse</string>

    <key>ProgramArguments</key>
    <array>
        <string>/Users/xulater/.nvm/versions/node/v22.0.0/bin/node</string>
        <string>/Users/xulater/Code/assistant-agent/muse/daemon/cerebellum.mjs</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/xulater/Code/assistant-agent</string>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>/tmp/muse-cerebellum.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/muse-cerebellum.err</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

> **注意**: Node.js 路径和项目路径需要根据实际环境调整。

---

## 4. 上下文参考

| 来源 | 路径 | 参考点 |
|------|------|--------|
| T03 引擎层 | `muse/core/engine.mjs` | healthCheck / spawn 逻辑复用 |
| T01 脚手架 | `muse/config.mjs` | daemon 配置项 |
| OpenCode KI | `engineering_principles.md` | Plugins > Forks 原则 |
| ZeroClaw | 心跳参考 | heartbeat 模式 |
| launchd 文档 | Apple Developer | KeepAlive + ThrottleInterval |

---

## 5. 测试方案

```bash
node --test muse/daemon/cerebellum.test.mjs
```

| # | 测试项 | 描述 |
|---|--------|------|
| 1 | 健康检查成功 | mock server → cortexHealthCheck true |
| 2 | 健康检查失败 | 无 server → cortexHealthCheck false |
| 3 | 心跳成功 → 计数归零 | 连续成功 → consecutiveFailures = 0 |
| 4 | 心跳连续失败触发重启 | 3 次失败 → restartCortex 被调用 |
| 5 | 心跳恢复后打印日志 | 失败后恢复 → 打印恢复信息 |
| 6 | 会话清理 — 过期 | >24h session → 被 DELETE |
| 7 | 会话清理 — 未过期 | <24h session → 保留 |
| 8 | start — attach 模式 | 已有大脑 → 不 spawn，进入监控 |
| 9 | start — spawn 模式 | 无大脑 → spawn opencode serve |
| 10 | stop — 优雅关闭 | 停止心跳 + 终止大脑进程 |
| 11 | health() 返回完整状态 | 包含 cerebellum/cortex/failures/ownsCortex |

---

## 6. 与 T03 Engine 的关系

T03 Engine 也有 `spawn` 和 `healthCheck` 逻辑，但**职责不同**：

| | T03 Engine | T08 Cerebellum |
|---|-----------|----------------|
| **角色** | 大脑内部的 OpenCode 客户端 | 大脑外部的守护者 |
| **spawn** | 首次启动时拉起 opencode serve | 大脑挂了时重新拉起 |
| **healthCheck** | 请求前检查连通性 | 定时巡检，触发重启 |
| **生命周期** | 和主进程同生共死 | 独立进程，大脑挂了它不挂 |

> Phase 1 MVP 中，如果走小脑架构，Engine 的 `#spawn()` 可以简化 —— 因为 spawn 职责转移给了小脑。Engine 只需 attach 模式（已有 server → 直接用）。

---

## 7. 完成定义 (DoD)

- [ ] `muse/daemon/cerebellum.mjs` Cerebellum 类完整实现
- [ ] 两级守护逻辑：launchd → 小脑 → 大脑
- [ ] 30s 心跳 + 3 次失败自动重启大脑
- [ ] 僵尸 session 清理 (>24h)
- [ ] `daemon/com.later.muse.plist` 配置
- [ ] `start()/stop()/health()` 生命周期完整
- [ ] 11 项单元测试通过 (mock server)
- [ ] 集成验证：kill 大脑 → 小脑自动重启
- [ ] 集成验证：kill 小脑 → launchd 拉起 → 小脑拉起大脑
- [ ] git commit
