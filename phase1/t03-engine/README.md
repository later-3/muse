# T03 引擎层 — 技术方案

> 封装 OpenCode REST API：auto-spawn + 健康检查 + 异步消息收发 + 超时重试
>
> 已整合评审反馈（4 个高优先级修正 + 3 项增强）

---

## 1. 目标

- 封装 OpenCode serve 的完整 REST API 为可复用的 Engine 类
- 自动检测和启动 `opencode serve` 进程（含进程所有权语义）
- 支持异步消息 (`prompt_async`) + 高层 `sendAndWait()` helper
- 标准 SSE 分帧解析（空行分帧 + 多行 data 拼接）
- 超时 + 分类重试（只重试可恢复错误）+ 降级提示
- spawn 失败可观测（捕获 error/exit/stderr）
- 遵循 T01 生命周期接口（start/stop/health）

---

## 2. OpenCode REST API 参考

> 来源：`opencode-trace/02-technical-plan.md` 源码验证的完整 API

### 2.1 核心 Endpoints

| Method | Path | 说明 |
|--------|------|------|
| GET | `/provider` | 模型列表 + 健康检查 |
| GET | `/session` | 列出所有 session |
| GET | `/session/:id` | session 详情 |
| GET | `/session/:id/message` | 消息列表 |
| POST | `/session` | 创建 session |
| POST | `/session/:id/message` | 同步发送（仅调试/短任务用） |
| POST | `/session/:id/prompt_async` | **异步发送**（主路径，推荐） |
| POST | `/session/:id/abort` | 中止生成 |
| DELETE | `/session/:id` | 删除 session |
| GET | `/event` | **SSE 事件流**（46 种 Bus 事件） |

### 2.2 关键约束

1. 每个请求必须带 `x-opencode-directory` header
2. `prompt_async` 立即返回，结果通过 SSE 或轮询 messages 获取
3. `GET /event` 推送所有 Bus 事件，10s 心跳

---

## 3. 核心实现

### 3.1 core/engine.mjs

```javascript
import { spawn } from 'node:child_process'
import { createLogger } from '../logger.mjs'

const log = createLogger('engine')

// 可重试的 HTTP 状态码
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

export class Engine {
  #config
  #process = null
  #ownsProcess = false   // 评审 #1.1: 进程所有权
  #baseUrl = ''
  #headers = {}
  #ready = false

  constructor(config) {
    this.#config = config
    this.#baseUrl = `${config.engine.host}:${config.engine.port}`
    this.#headers = {
      'Content-Type': 'application/json',
      'x-opencode-directory': config.engine.workspace,
    }
  }

  async start() {
    if (await this.#healthCheck()) {
      log.info('已检测到运行中的 OpenCode serve (attach 模式)')
      this.#ownsProcess = false   // 不是我们启动的
      this.#ready = true
      return
    }
    await this.#spawn()
    this.#ownsProcess = true      // 我们自己启动的
    this.#ready = true
    log.info(`OpenCode serve 已就绪: ${this.#baseUrl}`)
  }

  async stop() {
    // 评审 #1.1: 只回收自己启动的进程
    if (this.#ownsProcess && this.#process) {
      log.info('终止 Muse 启动的 OpenCode serve 进程')
      this.#process.kill('SIGTERM')
      this.#process = null
    } else {
      log.info('OpenCode serve 为外部实例，不终止')
    }
    this.#ownsProcess = false
    this.#ready = false
  }

  async health() {
    const ok = await this.#healthCheck()
    return {
      ok,
      detail: ok ? `running at ${this.#baseUrl}` : 'unreachable',
      ownsProcess: this.#ownsProcess,
    }
  }

  // --- Session Management ---

  async createSession() {
    return this.#request('POST', '/session', {})
  }

  async listSessions() {
    return this.#request('GET', '/session')
  }

  async getSession(sessionId) {
    return this.#request('GET', `/session/${sessionId}`)
  }

  async deleteSession(sessionId) {
    return this.#request('DELETE', `/session/${sessionId}`)
  }

  // --- Messaging ---

  /** 异步发送（主路径，推荐） */
  async sendMessageAsync(sessionId, text, model = null) {
    const payload = { parts: [{ type: 'text', text }] }
    if (model) payload.model = model
    return this.#request('POST', `/session/${sessionId}/prompt_async`, payload)
  }

  /** 同步发送（仅调试/短任务用） */
  async sendMessage(sessionId, text, model = null) {
    const payload = { parts: [{ type: 'text', text }] }
    if (model) payload.model = model
    return this.#request('POST', `/session/${sessionId}/message`, payload, { timeoutMs: 120_000 })
  }

  /**
   * 评审 #2.1: 高层 helper — 发送消息并等待助手回复
   * 内部: prompt_async → 轮询 messages → 检测 session.idle → 返回结果
   */
  async sendAndWait(sessionId, text, opts = {}) {
    const { model = null, timeoutMs = 120_000, pollIntervalMs = 1000 } = opts

    // 1. 异步发送
    await this.sendMessageAsync(sessionId, text, model)

    // 2. 轮询等待完成
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs))
      const session = await this.getSession(sessionId)
      const messages = session.messages || []

      // 找最后一条 assistant 消息
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        // 检查 session 是否 idle（不再生成）
        const status = session.status || session.state
        if (status === 'idle' || status === 'completed') {
          return {
            message: lastAssistant,
            text: this.#extractText(lastAssistant),
            sessionId,
          }
        }
      }
    }
    throw new Error(`sendAndWait 超时: session ${sessionId} 在 ${timeoutMs}ms 内未返回结果`)
  }

  async getMessages(sessionId) {
    return this.#request('GET', `/session/${sessionId}/message`)
  }

  async abort(sessionId) {
    return this.#request('POST', `/session/${sessionId}/abort`)
  }

  // --- SSE Event Stream ---

  /**
   * 评审 #1.2: 标准 SSE 分帧解析
   * 按空行分帧 + 多行 data 拼接
   */
  subscribeEvents(onEvent) {
    const controller = new AbortController()
    const url = `${this.#baseUrl}/event`

    const run = async () => {
      const res = await fetch(url, {
        headers: this.#headers,
        signal: controller.signal,
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let dataLines = []   // 当前帧的 data 行

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按行处理
        const lines = buffer.split('\n')
        buffer = lines.pop() // 保留不完整行

        for (const line of lines) {
          if (line === '') {
            // 空行 = 帧结束，处理收集的 data
            if (dataLines.length > 0) {
              const payload = dataLines.join('\n')
              dataLines = []
              try {
                onEvent(JSON.parse(payload))
              } catch { /* 非 JSON data，跳过 */ }
            }
          } else if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6))
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5))
          }
          // 忽略 event:, id:, 注释行(:开头)
        }
      }
    }

    run().catch(err => {
      if (err.name !== 'AbortError') log.error('SSE 连接断开:', err.message)
    })

    return { cancel: () => controller.abort() }
  }

  // --- Internal ---

  /**
   * 评审 #1.3: spawn 增加错误可观测性
   * 捕获 error/exit + 保留 stderr 诊断信息
   */
  async #spawn() {
    log.info('启动 opencode serve ...')

    let stderrBuffer = ''

    this.#process = spawn('opencode', ['serve', '--port', String(this.#config.engine.port)], {
      cwd: this.#config.engine.workspace,
      stdio: ['ignore', 'ignore', 'pipe'],  // 保留 stderr
      detached: true,
    })

    // 收集 stderr（最多 2KB 用于诊断）
    this.#process.stderr.on('data', chunk => {
      if (stderrBuffer.length < 2048) stderrBuffer += chunk.toString()
    })

    // 监听启动失败
    const earlyExit = new Promise((_, reject) => {
      this.#process.on('error', err => {
        reject(new Error(`opencode 启动失败: ${err.message} (${err.code || 'unknown'})`))
      })
      this.#process.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          reject(new Error(
            `opencode 异常退出: code=${code} signal=${signal}\nstderr: ${stderrBuffer.slice(0, 500)}`
          ))
        }
      })
    })

    this.#process.unref()

    // 等待就绪（最多 15s），同时监听早退
    for (let i = 0; i < 30; i++) {
      const result = await Promise.race([
        new Promise(r => setTimeout(r, 500)),
        earlyExit.catch(err => err),
      ])
      if (result instanceof Error) throw result
      if (await this.#healthCheck()) return
    }
    throw new Error(`opencode serve 启动超时 (15s)\nstderr: ${stderrBuffer.slice(0, 500)}`)
  }

  async #healthCheck() {
    try {
      const res = await fetch(`${this.#baseUrl}/provider`, {
        headers: this.#headers,
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * 评审 #1.4: 分类重试 — 只重试可恢复错误
   * 可重试: 网络错误 / 超时 / 408 / 429 / 5xx
   * 不可重试: 400 / 401 / 403 / 404 等
   */
  async #request(method, path, body = undefined, opts = {}) {
    const { timeoutMs = 30_000, retries = 2 } = opts
    const url = `${this.#baseUrl}${path}`

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const fetchOpts = {
          method,
          headers: this.#headers,
          signal: AbortSignal.timeout(timeoutMs),
        }
        if (body !== undefined) fetchOpts.body = JSON.stringify(body)

        const res = await fetch(url, fetchOpts)

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
          err.status = res.status
          err.method = method
          err.path = path

          // 确定性错误 → 不重试
          if (!RETRYABLE_STATUS.has(res.status)) throw err
          // 可恢复错误 → 可以重试
          if (attempt < retries) {
            log.warn(`可恢复错误 (${attempt + 1}/${retries + 1}): ${method} ${path} → ${res.status}`)
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
            continue
          }
          throw err
        }

        const contentType = res.headers.get('content-type') || ''
        return contentType.includes('application/json') ? await res.json() : await res.text()

      } catch (err) {
        // 网络级错误（ECONNREFUSED, DNS, 超时等）→ 可重试
        if (!err.status && attempt < retries && err.name !== 'AbortError') {
          log.warn(`网络错误 (${attempt + 1}/${retries + 1}): ${method} ${path} - ${err.message}`)
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw err
      }
    }
  }

  /** 从 assistant 消息中提取文本 */
  #extractText(message) {
    return (message.parts || [])
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('')
  }
}
```

### 3.2 设计决策（含评审修正）

| 决策 | 选择 | 理由 |
|------|------|------|
| 进程所有权 | `#ownsProcess` 标记 | 评审 #1.1: 防止 stop() 误杀外部实例 |
| SSE 解析 | 标准空行分帧 + 多行 data | 评审 #1.2: 可靠处理真实 SSE 流 |
| spawn 可观测 | stderr pipe + error/exit 监听 | 评审 #1.3: 启动失败可诊断 |
| 重试分类 | 408/429/5xx + 网络可重试 | 评审 #1.4: 400/404 不重试 |
| 高层 helper | `sendAndWait()` | 评审 #2.1: 封装 async+轮询，减轻 orchestrator |
| 同步消息 | 保留但标注仅调试用 | 评审 #2.2: 主路径统一走 async |

---

## 4. 上下文参考

| 来源 | 路径 | 参考点 |
|------|------|--------|
| OpenCode Trace | `opencode-trace/02-technical-plan.md` | REST API 完整 endpoints |
| OpenCode Trace | 同上 2.4 | SSE `GET /event` 发现 |
| T01 脚手架 | `muse/config.mjs` | engine 配置项 |
| T01 评审 | 生命周期接口 | `start()/stop()/health()` |

---

## 5. 测试方案

```bash
node --test muse/core/engine.test.mjs
```

| # | 测试项 | 描述 |
|---|--------|------|
| 1 | 健康检查成功 | mock server → healthCheck true |
| 2 | 健康检查失败 | 无 server → healthCheck false |
| 3 | 创建 session | POST /session → 返回 session |
| 4 | 异步发消息 | prompt_async → 返回成功 |
| 5 | sendAndWait | 异步发送 → 轮询超时/成功 |
| 6 | headers 正确 | x-opencode-directory 存在 |
| 7 | 可恢复错误重试 | 503 → 重试 → 最终成功 |
| 8 | 不可恢复错误直接失败 | 404 → 不重试，立即抛错 |
| 9 | 全部重试失败 | 3 次 503 → 最终抛错 |
| 10 | HTTP 错误含上下文 | err.status/method/path 存在 |
| 11 | start attach 模式 | 已有 server → ownsProcess=false |
| 12 | stop 不误杀外部实例 | attach 模式 → stop 不 kill |
| 13 | SSE 标准分帧 | 空行分帧 + 多行 data |
| 14 | SSE 跨 chunk 拼接 | data 被 chunk 切割 → 正确解析 |
| 15 | start/stop 生命周期 | 完整流程不抛错 |

> 测试使用 `node:http` 创建轻量 mock server，不依赖真实 OpenCode。

---

## 6. 完成定义 (DoD)

- [ ] `muse/core/engine.mjs` Engine 类完整实现
- [ ] `#ownsProcess` 进程所有权 + stop 安全语义
- [ ] `#spawn()` 含 error/exit/stderr 可观测
- [ ] `sendAndWait()` 高层 helper
- [ ] SSE 标准分帧解析（空行分帧 + 多行 data）
- [ ] `#request()` 分类重试（只重试可恢复错误）
- [ ] `start()/stop()/health()` 生命周期完整
- [ ] 15 项单元测试通过（mock server）
- [ ] git commit
