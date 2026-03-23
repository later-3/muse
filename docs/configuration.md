# Configuration Reference

> Muse 配置参考手册 — 拉起一个 Muse 需要什么？每个配置项的作用是什么？

---

## 运行前提

拉起一个 Muse 需要以下组件：

| 文件 | 必须 | 作用 |
|------|------|------|
| `start.sh` | ✅ | 启动脚本：启动 OpenCode serve + Muse 主进程 |
| `opencode.json` | ✅ | LLM 模型配置 + MCP 工具 + 插件注册 |
| `.env` 或 `config.json` | ✅ | 至少需要 `TELEGRAM_BOT_TOKEN` |
| `package.json` | ✅ | 依赖清单，`npm install` 安装 |
| `data/identity.json` | ⚠️ | 身份数据（首次运行自动创建默认值） |
| `data/memory.db` | ⚠️ | 记忆数据库（首次运行自动创建） |

### 依赖安装

```bash
cd muse
npm install
```

### 启动方式

**Legacy 模式**（当前默认）:
```bash
cd muse
cp .env.example .env   # 编辑: 填入 TELEGRAM_BOT_TOKEN
./start.sh
```

**FAMILY_HOME 模式**（T21）:
```bash
cd muse
node family/cli.mjs init ~/.muse --owner later
# 编辑 ~/.muse/members/nvwa/config.json 填入 botToken
MUSE_HOME=~/.muse node index.mjs
```

---

## 启动脚本 — start.sh

`start.sh` 做了什么：
1. 创建 `data/` 和 `logs/` 目录（如不存在）
2. 检查 OpenCode serve 是否在运行（`lsof -i :4096`）
3. 如未运行，启动 `opencode serve` 后台进程
4. 启动 Muse 主进程：`node index.mjs`

---

## 模型配置 — opencode.json

```json
{
  "provider": { ... },          // LLM 提供商 + API key
  "models": {
    "google:gemini-2.5-flash": { "id": "gemini-2.5-flash" }
  },
  "mcp": {
    "memory": {                 // Memory MCP 服务器
      "type": "stdio",
      "command": "node",
      "args": ["mcp/memory.mjs"],
      "env": { "MEMORY_DB_PATH": "./data/memory.db" }
    }
  },
  "plugin": {
    "url": "file://plugin/index.mjs"    // 观察者插件
  }
}
```

> ⚠️ API key 推荐用 `env:VAR_NAME` 引用环境变量，不要硬编码。

---

## 环境变量参考

### Telegram（必须）

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `TELEGRAM_BOT_TOKEN` | string | *(必填)* | Telegram Bot API Token |
| `TELEGRAM_ALLOWED_USERS` | string | `''` (空=允许所有) | 逗号分隔的 User ID 列表 |

### Engine

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENCODE_HOST` | string | `http://127.0.0.1` | OpenCode serve 地址 |
| `OPENCODE_PORT` | number | `4096` | OpenCode serve 端口 |
| `OPENCODE_WORKSPACE` | string | `process.cwd()` | 工作区路径 |
| `DEFAULT_PROVIDER` | string | `google` | 默认 LLM 提供商 |
| `DEFAULT_MODEL` | string | `gemini-2.5-flash` | 默认模型 |

### Memory

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MEMORY_DB_PATH` | string | `./data/memory.db` | SQLite 数据库路径 |
| `MAX_EPISODIC_DAYS` | number | `90` | 情景记忆保留天数 |

### Web 驾驶舱

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `WEB_PORT` | number | `4097` | 驾驶舱端口 |
| `WEB_HOST` | string | `127.0.0.1` | 监听地址（`0.0.0.0` = 远程访问） |

### Identity

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `IDENTITY_PATH` | string | `./data/identity.json` | 身份配置文件路径 |

### Daemon

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `HEARTBEAT_INTERVAL` | number | `30000` | 心跳间隔（ms，>= 5000） |
| `MAX_FAILURES` | number | `3` | 连续失败次数上限 |

### FAMILY_HOME（T21 新增）

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `MUSE_HOME` | string | *(不设置=旧模式)* | FAMILY_HOME 根路径 |
| `MUSE_MEMBER` | string | `nvwa` | 当前运行的成员名 |

---

## 配置加载优先级

### Legacy 模式（MUSE_HOME 未设置）

```
.env → process.env → config.mjs 读取
```

### FAMILY_HOME 模式（MUSE_HOME 已设置）

```
1. 代码默认值 (hardcoded)
2. FAMILY_HOME/config.json (家族级)
3. FAMILY_HOME/members/{name}/config.json (成员级)
4. process.env 覆盖 (.env + 环境变量)
```

后加载覆盖前加载。`process.env` 始终有最高优先级。

---

## 模块清单

| 模块 | 文件 | 一句话定位 |
|------|------|-----------|
| **配置** | `config.mjs` | 配置入口：FAMILY_HOME 或 Legacy 模式分发 |
| **日志** | `logger.mjs` | 统一日志：`createLogger('模块名')` |
| **入口** | `index.mjs` | 引导启动：5 阶段（Web→Identity→Memory→Engine→Telegram） |
| **身份** | `core/identity.mjs` | 人格配置加载 + AGENTS.md 写入 |
| **记忆** | `core/memory.mjs` | SQLite 语义记忆 + 情景记忆 |
| **引擎** | `core/engine.mjs` | OpenCode REST API 封装 |
| **编排** | `core/orchestrator.mjs` | 身份 + 记忆 → 引擎 prompt 编排 |
| **触达** | `perception/telegram-channel.mjs` | Telegram 图片/文件下载 |
| **适配** | `adapters/telegram.mjs` | Telegraf Bot 命令注册 |
| **Web** | `web/api.mjs` | 驾驶舱 HTTP API |
| **MCP** | `mcp/memory.mjs` | Memory MCP Server（OpenCode 调用） |
| **插件** | `plugin/index.mjs` | OpenCode 观察者插件 |
| **小脑** | `daemon/cerebellum.mjs` | 心跳监控 + 大脑重启 |
| **自检** | `daemon/self-check.mjs` | 系统健康检查 |
| **能力** | `capability/registry.mjs` | 能力注册表 |
| **CLI** | `family/cli.mjs` | 命令行：init / start / migrate |
| **配置加载** | `family/config-loader.mjs` | 4 层配置合并 |
| **初始化** | `family/init.mjs` | FAMILY_HOME 目录创建 |
| **迁移** | `family/migrate.mjs` | data/ → FAMILY_HOME 迁移 |

---

## OpenCode 配置方案

> 详见 [opencode-config.md](./opencode-config.md)

### 配置文件来源

| 文件 | 位置 | 作用 |
|------|------|------|
| `.opencode/opencode.json` | `{MEMBER_DIR}/.opencode/` | OpenCode 运行时配置（plugin/mcp/skills） |
| `config.json` | `{MEMBER_DIR}/` | Muse 业务配置（telegram/engine/memory） |
| `AGENTS.md` | `{MEMBER_DIR}/` | 人格 + 项目规则 |

### 配置隔离原则

1. **每个 member 从自己目录启动**：`cd $MEMBER_DIR`
2. **opencode.json 动态生成**：start.sh 每次启动时生成到 member 目录
3. **AGENTS.md 写入 workspace**：`identity.mergePersonaToAgentsMd(config.engine.workspace)`

### OpenCode 配置优先级

```
全局配置 → 项目配置 → .opencode/ → 内联配置
  (低)                              (高)
```

**关键**：member 的 `.opencode/opencode.json` 优先级最高，可以覆盖全局配置。

### 配置合并规则

| 配置类型 | 合并策略 | 隔离方案 |
|---------|---------|---------|
| plugin | 数组去重合并 | member 指定同名 plugin 覆盖全局 |
| mcp | 深度合并 | member 设置 `enabled: false` 禁用 |
| skills | 数组去重合并 | 全局 + member 都会加载 |
| model | 后者覆盖 | member 直接指定 |
