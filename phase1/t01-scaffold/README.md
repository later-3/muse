# T01 项目脚手架 — 技术方案

> 建立 Muse 助手的项目基础：ESM 模块系统 + 依赖管理 + 配置系统 + 入口文件 + 项目规范

---

## 1. 目标

为 Phase 1 所有后续任务提供：
- 可运行的 Node.js ESM 项目骨架
- 统一的配置管理（环境变量 + 默认值）
- 清晰的目录结构和模块边界
- 开发/调试工具链

---

## 2. 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js >= 20 | LTS + 原生 ESM + fetch + test runner |
| 模块 | ESM (type: "module") | 现代标准, Later 偏好 ESM |
| 数据库 | better-sqlite3 | 零配置 + 同步 API + 单文件 + 性能好 |
| Telegram | telegraf ^4 | 最流行 Node.js TG 框架, 维护活跃 |
| 配置 | dotenv + 手动合并 | 简单, 不引入复杂框架 |
| 测试 | node:test + node:assert | 零依赖, Node 20 原生 |
| 日志 | 自定义 (console 封装) | Phase 1 不引入 pino/winston |

---

## 3. 目录结构

```
assistant-agent/
├── muse/                      ← Muse 助手源码根目录
│   ├── index.mjs              ← 主入口: 启动所有服务
│   ├── config.mjs             ← 配置加载 (env + defaults)
│   ├── logger.mjs             ← 日志工具
│   ├── core/
│   │   ├── engine.mjs         ← T03: OpenCode REST 封装
│   │   ├── memory.mjs         ← T04: 分层记忆
│   │   ├── orchestrator.mjs   ← T05: 编排层
│   │   └── identity.mjs       ← T02: 身份系统
│   ├── adapters/
│   │   └── telegram.mjs       ← T06: Telegram Bot
│   ├── web/
│   │   ├── server.mjs         ← T07: HTTP 服务
│   │   └── index.html         ← T07: 前端页面
│   ├── daemon/
│   │   ├── health.mjs         ← T08: 心跳检查
│   │   └── com.later.muse.plist ← T08: launchd 配置
│   └── data/
│       ├── identity.json      ← 身份配置 (T02 创建)
│       └── .gitkeep           ← memory.db 运行时生成
├── phase1/                    ← Phase 1 任务文档
├── assistant-prep/            ← 背景研究文档
├── .env.example               ← 环境变量模板
├── .env                       ← 实际环境变量 (gitignore)
├── .gitignore                 ← 更新: 排除 .env, data/*.db
└── package.json               ← 项目描述 + 依赖 + scripts
```

**设计决策**：
- 源码放在 `muse/` 子目录而非根目录，因为根目录已有 `phase1/`, `assistant-prep/`, 参考仓库等
- `data/` 目录存放运行时数据 (SQLite DB)，gitignore 掉 `*.db`
- 配置通过 `.env` 环境变量，不用 YAML/TOML

---

## 4. 核心文件实现

### 4.1 package.json

```json
{
  "name": "muse-assistant",
  "version": "0.1.0",
  "description": "Muse - 终身 AI 助手",
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "start": "node muse/index.mjs",
    "dev": "node --watch muse/index.mjs",
    "test": "node --test muse/**/*.test.mjs"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "dotenv": "^16.4.0",
    "telegraf": "^4.16.0"
  }
}
```

### 4.2 config.mjs (含启动校验 — 评审改进)

```javascript
import 'dotenv/config'

export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || '')
      .split(',').filter(Boolean).map(id => id.trim()),
  },

  // OpenCode Engine
  engine: {
    host: process.env.OPENCODE_HOST || 'http://127.0.0.1',
    port: parseInt(process.env.OPENCODE_PORT || '4096', 10),
    workspace: process.env.OPENCODE_WORKSPACE || process.cwd(),
    defaultModel: {
      providerID: process.env.DEFAULT_PROVIDER || 'google',
      modelID: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
    },
    heavyModel: {
      providerID: process.env.HEAVY_PROVIDER || 'anthropic',
      modelID: process.env.HEAVY_MODEL || 'claude-sonnet-4-20250514',
    },
  },

  // Memory
  memory: {
    dbPath: process.env.MEMORY_DB_PATH || './muse/data/memory.db',
    maxEpisodicDays: parseInt(process.env.MAX_EPISODIC_DAYS || '90', 10),
  },

  // Web Cockpit
  web: {
    port: parseInt(process.env.WEB_PORT || '4097', 10),
    host: process.env.WEB_HOST || '127.0.0.1',
  },

  // Identity
  identity: {
    path: process.env.IDENTITY_PATH || './muse/data/identity.json',
  },

  // Daemon
  daemon: {
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    maxFailures: parseInt(process.env.MAX_HEARTBEAT_FAILURES || '3', 10),
  },
}

export function getEngineUrl() {
  return `${config.engine.host}:${config.engine.port}`
}

/** 启动时校验必填配置，fail-fast（评审 Action #1） */
export function validateConfig() {
  const errors = []
  if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required')
  if (config.telegram.allowedUsers.length === 0) errors.push('TELEGRAM_ALLOWED_USERS is required (comma-separated user IDs)')
  if (config.engine.port < 1 || config.engine.port > 65535) errors.push(`OPENCODE_PORT invalid: ${config.engine.port}`)
  if (config.web.port < 1 || config.web.port > 65535) errors.push(`WEB_PORT invalid: ${config.web.port}`)
  if (config.daemon.heartbeatIntervalMs < 5000) errors.push('HEARTBEAT_INTERVAL must be >= 5000ms')
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:\n' + errors.map(e => `  - ${e}`).join('\n') + '\n')
    process.exit(1)
  }
}
```

### 4.3 logger.mjs (含结构化字段 — 评审改进)

```javascript
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info

function formatTime() {
  return new Date().toISOString().slice(11, 23)
}

/** 结构化日志，包含 time/level/module 字段，便于 T09 联调排查 */
export function createLogger(module = 'muse') {
  const fmt = (level) => `[${formatTime()}] [${level}] [${module}]`
  return {
    debug: (...args) => currentLevel <= LEVELS.debug && console.debug(fmt('DEBUG'), ...args),
    info:  (...args) => currentLevel <= LEVELS.info  && console.log(fmt('INFO'), ...args),
    warn:  (...args) => currentLevel <= LEVELS.warn  && console.warn(fmt('WARN'), ...args),
    error: (...args) => currentLevel <= LEVELS.error && console.error(fmt('ERROR'), ...args),
  }
}

export const log = createLogger('muse')
```

### 4.4 index.mjs (入口, 含 fail-fast 校验)

```javascript
import { config, validateConfig } from './config.mjs'
import { log } from './logger.mjs'

async function main() {
  // 评审 Action #1: fail-fast 配置校验
  validateConfig()

  log.info('🎭 Muse 助手启动中...')
  log.info(`   引擎: ${config.engine.host}:${config.engine.port}`)
  log.info(`   Web:  http://${config.web.host}:${config.web.port}`)

  // T03: 引擎层
  // const engine = new Engine(config)
  // await engine.ensureRunning()

  // T04: 记忆层
  // const memory = new Memory(config)

  // T05: 编排层
  // const orchestrator = new Orchestrator(engine, memory, config)

  // T06: Telegram
  // const telegram = new TelegramAdapter(orchestrator, config)
  // await telegram.start()

  // T07: Web 驾驶舱
  // const web = new WebServer(orchestrator, config)
  // await web.start()

  // T08: 心跳
  // const health = new HealthCheck(engine, config)
  // health.start()

  log.info('🎭 Muse 助手已就绪!')
}

main().catch(err => {
  log.error('启动失败:', err)
  process.exit(1)
})
```

### 4.5 .env.example

```bash
# === Telegram ===
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_ALLOWED_USERS=your-telegram-user-id

# === OpenCode Engine ===
OPENCODE_HOST=http://127.0.0.1
OPENCODE_PORT=4096
OPENCODE_WORKSPACE=/home/user/Code/assistant-agent

# === Models ===
DEFAULT_PROVIDER=google
DEFAULT_MODEL=gemini-2.5-flash
HEAVY_PROVIDER=anthropic
HEAVY_MODEL=claude-sonnet-4-20250514

# === Memory ===
MEMORY_DB_PATH=./muse/data/memory.db

# === Web Cockpit ===
WEB_PORT=4097

# === Daemon ===
HEARTBEAT_INTERVAL=30000
LOG_LEVEL=info
```

---

## 5. 上下文参考

| 来源 | 路径 | 参考点 |
|------|------|--------|
| OpenClaw | `openclaw/package.json` | 依赖选型, scripts 定义 |
| ZeroClaw | `zeroclaw/Cargo.toml` | 模块划分思路 |
| OpenCode 文档 | `assistant-prep/opencode/02-persistent-server.md` | REST API 端口/路径 |
| Telegram 文档 | `assistant-prep/opencode/05-telegram-integration.md` | Bot Token 获取 |
| Phase 1 地图 | `phase1/README.md` | 任务依赖关系 |
| 愿景文档 | `assistant-prep/muse-vision.md` | 整体架构 |

---

## 6. 测试方案

### 6.1 单元测试

```bash
# 配置加载测试
node --test muse/config.test.mjs
```

测试项：
- [x] 默认配置值正确
- [x] 环境变量覆盖生效
- [x] `getEngineUrl()` 返回正确 URL
- [x] `allowedUsers` 正确解析逗号分隔列表

### 6.2 集成验证

```bash
# 启动验证 (应打印启动日志后退出)
node muse/index.mjs

# 期望输出:
# [HH:MM:SS.sss] [INFO] 🎭 Muse 助手启动中...
# [HH:MM:SS.sss] [INFO]    引擎: http://127.0.0.1:4096
# [HH:MM:SS.sss] [INFO]    Web:  http://127.0.0.1:4097
# [HH:MM:SS.sss] [INFO] 🎭 Muse 助手已就绪!
```

### 6.3 验收标准

1. ✅ `npm install` 成功，无报错
2. ✅ `node muse/index.mjs` 打印启动日志
3. ✅ `node --test` 配置测试通过
4. ✅ 目录结构与文档一致
5. ✅ `.env.example` 包含所有必需变量

---

## 7. 风险与决策记录

| 风险 | 应对 |
|------|------|
| better-sqlite3 需要编译 | Node 20 + macOS 通常没问题, 失败时用 sql.js 兜底 |
| telegraf v4 有 breaking change | 锁定大版本 ^4 |
| 源码放 muse/ 子目录是否合理 | 避免和已有文件/目录冲突, 保持根目录干净 |
| **.env 泄露** (评审补充) | .gitignore 排除 + .env.example 只含模板值 |
| **OpenCode 不可达/慢响应** (评审补充) | engine 层设 timeout + 重试 + 降级提示 (T03 实现) |
| **SQLite 损坏/锁竞争** (评审补充) | 初始化时开启 WAL 模式 (T04 实现) |
| **launchd 重启风暴** (评审补充) | ThrottleInterval=10s 限制重启频率 (T08 实现) |

---

## 8. 架构约束 (评审补充)

### 模块依赖方向
```
adapters / web / daemon
         ↓
    orchestrator
         ↓
  engine / memory / identity
```
**规则**: 上层可依赖下层，禁止反向依赖。

### 统一生命周期接口
所有服务模块应实现:
```javascript
// 每个模块导出的类应遵循此接口
class Module {
  async start()    {}  // 启动
  async stop()     {}  // 优雅关闭
  async health()   {}  // 健康检查, 返回 { ok, detail }
}
```

---

## 9. 完成定义 (DoD)

- [ ] `package.json` 创建, `npm install` 成功
- [ ] `muse/config.mjs` + `validateConfig()` + `.env.example` 就绪
- [ ] `muse/logger.mjs` (含 `createLogger(module)`) 就绪
- [ ] `muse/index.mjs` 可启动 (含 fail-fast 校验)
- [ ] `muse/config.test.mjs` 全部通过 (含校验测试)
- [ ] 目录结构创建完毕 (core/, adapters/, web/, daemon/, data/)
- [ ] `.gitignore` 更新 (.env, *.db)
- [ ] 启动验证通过 + 配置测试通过
- [ ] git commit
