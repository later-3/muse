# OpenCode 配置方案 — Muse 视角

> Muse 基于 OpenCode 的配置加载机制，实现多 member 实例的配置隔离与灵活定制。

---

## 1. OpenCode 配置加载优先级

```
低 ──────────────────────────────────────────────────────────────── 高

1. Remote .well-known/opencode     ← 组织级默认（企业部署）
2. Global config (~/.config/opencode/) ← ⚠️ 始终加载
3. OPENCODE_CONFIG                 ← 自定义配置文件路径
4. Project config (findUp opencode.json)
5. .opencode directories           ← member 配置放这里 ⭐
6. OPENCODE_CONFIG_CONTENT         ← 内联 JSON 配置
7. Account config (opencode.ai cloud)
8. Managed config (Enterprise)     ← 系统级最高优先级

高 ──────────────────────────────────────────────────────────────── 低
```

**关键发现**：全局配置（`~/.config/opencode/`）始终会被加载，无法通过环境变量禁用。但可以利用优先级机制让 member 配置覆盖全局配置。

---

## 2. 配置类型与合并规则

| 配置类型 | 字段 | 合并策略 | 全局污染风险 | Muse 方案 |
|---------|------|---------|------------|---------|
| **plugin** | `plugin: string[]` | 数组去重合并，后加载的同名覆盖 | ⚠️ 高 | member 指定同名 plugin 覆盖全局 |
| **skills** | `skills.paths: string[]` | 数组去重合并 | ⚠️ 高 | member 指定相同路径会被去重 |
| **mcp** | `mcp: Record<string, McpConfig>` | 深度合并 | ✅ 低 | member 设置 `enabled: false` 禁用全局 |
| **model** | `model: string` | 后者覆盖 | ✅ 无 | member 直接指定 |
| **provider** | `provider: Record<string, Provider>` | 深度合并 | ✅ 无 | 共享 API Key 是预期行为 |
| **permission** | `permission: Permission` | 深度合并 | ⚠️ 中 | member 可覆盖具体权限 |
| **agent/command** | `.opencode/agent/*.md` | 深度合并，同名覆盖 | ⚠️ 中 | member 同名定义覆盖全局 |

---

## 3. Muse 配置方案

### 3.1 目录结构

```
muse/
├── start.sh                        ← 启动脚本
└── families/{family}/{member}/
    ├── config.json                 ← member 业务配置
    ├── AGENTS.md                   ← member 人格 + 项目规则
    └── .opencode/
        └── opencode.json           ← member OpenCode 配置
```

### 3.2 启动流程

```bash
# start.sh 核心逻辑
MEMBER_DIR="$MUSE_ROOT/families/$FAMILY/$MEMBER"

# 1. 生成 opencode.json 到 member 目录
node -e "
  const config = {
    plugin: ['file://...muse/src/plugin/index.mjs'],
    skills: { paths: [...] },
    mcp: { 'memory-server': {...} }
  };
  fs.writeFileSync('$MEMBER_DIR/.opencode/opencode.json', JSON.stringify(config));
"

# 2. 从 member 目录启动（关键！）
cd "$MEMBER_DIR"
node "$SRC_DIR/index.mjs"
```

**关键点**：
- `cd "$MEMBER_DIR"` 确保 `Instance.directory = memberDir`
- OpenCode 的 `findUp` 只会找 member 目录及以上的配置
- member 的 `.opencode/` 配置优先级高于全局

### 3.3 配置隔离效果

| 场景 | 行为 |
|------|------|
| 全局 plugin `oh-my-opencode@2.4.3` | 加载 |
| member plugin `oh-my-opencode` (file://) | **覆盖**全局，使用 file:// 版本 |
| 全局 MCP `jira` (enabled: true) | 加载 |
| member MCP `jira: { enabled: false }` | **禁用** |
| 全局 skill `/shared/skills` | 加载 |
| member skill `/member/skills` | 合并（两者都有） |
| 全局 model `anthropic/claude-3` | 作为默认 |
| member model `google/gemini-2.5` | **覆盖** |

---

## 4. 环境变量参考

| 变量 | 作用 | Muse 使用 |
|------|------|---------|
| `MUSE_MEMBER_DIR` | member 目录路径 | ✅ 核心变量 |
| `MUSE_TRACE_DIR` | trace 日志目录 | ✅ 传递给 plugin |
| `OPENCODE_CONFIG` | 指定单个配置文件 | ❌ 不使用 |
| `OPENCODE_CONFIG_DIR` | 指定 .opencode 目录 | ❌ 不使用 |
| `OPENCODE_CONFIG_CONTENT` | 内联 JSON 配置 | ❌ 不使用 |
| `OPENCODE_DISABLE_PROJECT_CONFIG` | 禁用项目级配置 | ❌ 不使用 |

**Muse 选择**：不使用 OpenCode 的环境变量来控制配置，而是通过目录结构和启动位置来实现隔离。

---

## 5. 配置文件来源

### 5.1 opencode.json

**位置**：`{MEMBER_DIR}/.opencode/opencode.json`

**生成时机**：每次 `start.sh` 启动时动态生成

**内容**：
```json
{
  "plugin": ["file:///path/to/muse/src/plugin/index.mjs"],
  "skills": {
    "paths": [
      "/path/to/muse/.agents/skills",
      "/path/to/member/.agents/skills"
    ]
  },
  "mcp": {
    "memory-server": {
      "type": "local",
      "command": ["node", "/path/to/muse/src/mcp/memory.mjs"],
      "environment": {
        "MEMORY_DB_PATH": "/path/to/member/data/memory.db",
        "TELEGRAM_BOT_TOKEN": "..."
      }
    }
  }
}
```

### 5.2 config.json

**位置**：`{MEMBER_DIR}/config.json`

**加载**：Muse 的 `config.mjs` 在启动时读取

**内容**：
```json
{
  "telegram": {
    "botToken": "...",
    "chatId": "..."
  },
  "engine": {
    "port": 4096,
    "defaultModel": { "providerID": "google", "modelID": "gemini-2.5-flash" }
  },
  "pulse": { "enabled": true }
}
```

### 5.3 AGENTS.md

**位置**：`{MEMBER_DIR}/AGENTS.md`

**生成**：`identity.mergePersonaToAgentsMd(workspace)` 在 Web API 调用时写入

**内容**：
```markdown
<!-- PERSONA_START -->
# 人格

- 名字：小缪
- 主人：Later
...

<!-- PERSONA_END -->

# 项目规则

- ESM only
- 测试必须
...
```

---

## 6. 验证测试

### 6.1 配置路径验证

```javascript
// src/config.test.mjs
it('should load config from member directory', async () => {
  process.env.MUSE_MEMBER_DIR = memberDir
  const module = await import('./config.mjs')
  
  assert.equal(module.config.engine.workspace, memberDir)
  assert.ok(module.config.memory.dbPath.includes('member'))
})
```

### 6.2 AGENTS.md 路径验证

```javascript
// src/core/identity.test.mjs
it('should write AGENTS.md to projectRoot parameter', async () => {
  const result = await identity.mergePersonaToAgentsMd(tmpDir)
  assert.equal(result.path, join(tmpDir, 'AGENTS.md'))
})
```

### 6.3 OpenCode 配置合并验证

在 OpenCode 源码中已有完整测试：

```typescript
// opencode/packages/opencode/test/config/config.test.ts

test("merges plugin arrays from global and local configs", ...)
test("deduplicates duplicate plugins from global and local configs", ...)
test("project config can override MCP server enabled status", ...)
```

---

## 7. 常见问题

### Q1: 全局 plugin 会污染 member 吗？

**会，但可以覆盖。** OpenCode 的 plugin 是数组去重合并，全局的会加载。如果 member 指定了同名 plugin，会覆盖全局版本。

### Q2: 如何完全禁用全局配置？

设置 `OPENCODE_DISABLE_PROJECT_CONFIG=true` 会禁用项目级配置，但全局配置仍会加载。要完全隔离，需要清空全局配置目录。

### Q3: 多 member 能并行运行吗？

**能。** 每个 member 有独立的 `.opencode/opencode.json` 和 `config.json`，从各自目录启动。

### Q4: start-pua.sh 为什么有问题？

1. 从项目根启动（`cd $PROJECT_ROOT`），会加载项目根的配置
2. 用软链接覆盖项目根的 opencode.json
3. 用复制覆盖项目根的 AGENTS.md

正确做法：用 `muse/start.sh test-pua` 启动。

---

## 8. 参考资料

- [OpenCode Config Precedence](https://opencode.ai/docs/config#precedence-order)
- OpenCode 源码：`opencode/packages/opencode/src/config/config.ts`
- OpenCode 测试：`opencode/packages/opencode/test/config/config.test.ts`