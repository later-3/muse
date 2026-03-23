---
name: opencode-config
description: OpenCode 使用与配置 — 指导 Muse 理解和修改 OpenCode 的模型、认证、插件配置，避免常见踩坑
---

# OpenCode 配置指南

> 当你需要修改 Muse 大脑使用的模型、认证、插件时，先读这个 Skill。
> 教训来源：切换模型踩坑多次后总结。

## 核心架构

```
OpenCode = Muse 的大脑引擎
  ├── opencode serve     ← Muse 启动的 headless 模式 (无 TUI)
  ├── opencode (TUI)     ← 人工交互模式 (终端界面)
  └── opencode auth      ← 认证管理
```

## Muse 配置文件体系

> **Muse 始终使用项目级 opencode.json**，不依赖全局配置。
> 原因：后续会有多个 Muse 实例，每个实例有自己的工作区，各自独立配置模型和 MCP。

### 文件位置（当前项目）

| 文件 | 路径 | 用途 |
|------|------|------|
| **项目配置（主）** | `opencode.json`（项目根目录） | model / mcp / plugin / username |
| **Muse 进程配置** | `.env` | Muse 进程变量，**不传给 opencode serve** |
| **Muse 内部配置** | `muse/config.mjs` | Muse 读取 .env，加载业务配置 |

### 多 Muse 实例场景

```
Muse-主 (assistant-agent/)          ← opencode serve port 4096
  └── opencode.json                  ← model: qwen3-coder-plus

Muse-家族 (family-home/)            ← opencode serve port 4098（未来）
  └── opencode.json                  ← model: 独立配置

Dev Worktree (dev-worktrees/xxx/)   ← 共用 主serve 或独立 serve
  └── opencode.json                  ← 如存在，优先级高于项目根
```

> **关键**：serve 的 cwd 决定读哪个 opencode.json。
> 用 `lsof -p {serve_pid} | grep cwd` 确认实际 cwd。

---

## Muse Skills 加载机制

> Muse start.sh 启动时为每个 member 动态生成 `.opencode/opencode.json`（Layer 5），
> 通过 `skills.paths` 控制该 member 能看到哪些 Skills。

### Skills 三层设计（Agent-First 原则）

```
muse/.agents/skills/          ← 引擎级（所有 member 共用）
├── opencode-config/          opencode 配置与切换
├── muse-trace/               全链路诊断
└── ...

muse/.agents/admin-skills/    ← 管理员级（config.json adminSkills:true 才加载）
└── add-family-member/        新建 Muse 成员（仅 nvwa 可见）

families/{family}/{member}/
└── .agents/skills/           ← member 专属（gitignored）
    └── ...
```

**能力边界由基础设施决定，不依赖 AI 自律**：
- coder 的 `opencode.json` 里根本没有 `admin-skills` 路径
- 所以 coder **看不见、不知道** `add-family-member` skill 存在

### 如何标记管理员 member

```json
// families/{family}/{member}/config.json
{
  "adminSkills": true,   ← 加这一行，该 member 即为 admin
  "telegram": { ... }
}
```

重启 start.sh 后生效（每次启动都重新生成 opencode.json）。

### 工作目录与文件访问

- start.sh 执行 `cd "$MEMBER_DIR"` 后启动 OpenCode
- OpenCode 的 **workspace cwd = member 目录**，工具的相对路径基于此
- OpenCode 无硬性文件系统沙箱限制，绝对路径仍可访问任意位置
- Plugin 和 MCP 路径均使用**绝对路径**（start.sh 注入），避免 cwd 依赖问题

---


共 6 层，**后者覆盖前者**，越靠后优先级越高：

| 层 | 来源 | 路径 | 说明 |
|----|------|------|------|
| 1（最低） | Remote | `.well-known/opencode` | 企业/组织远端默认，一般不用 |
| 2 | 全局用户 | `~/.config/opencode/config.json` | 全局 plugin |
| 2 | 全局用户 | `~/.config/opencode/opencode.json{c}` | 全局 model，oh-my-opencode 生效层 |
| 3 | 环境变量 | `$OPENCODE_CONFIG` 指向的文件 | 按需指定，少用 |
| 4 | **项目** | `{workspace}/opencode.json{c}` | **Muse 主要配置层** |
| 5 | `.opencode/` 目录 | `{workspace}/.opencode/opencode.json` + agents/ | 更细粒度覆盖 |
| 6（最高） | 内联 | `$OPENCODE_CONFIG_CONTENT` 环境变量 | 临时覆盖，少用 |

> [!CAUTION]
> **plugin 字段是数组拼接（union），不是覆盖！**
> 源码 `opencode/packages/opencode/src/config/config.ts` 的 `mergeConfigConcatArrays()` 函数：
> ```javascript
> merged.plugin = Array.from(new Set([...target.plugin, ...source.plugin]))
> ```
> 这意味着：
> - `model` 等普通字段：高优先级覆盖低优先级 ✅
> - `plugin` 数组：所有层级的 plugin **拼接去重** ❌ 无法用 `[]` 覆盖
> - `instructions` 数组：同样是拼接去重
>
> **后果**：全局 `~/.config/opencode/opencode.json` 里的 `"plugin": ["oh-my-opencode@latest"]`
> 会污染所有 opencode 实例（包括 muse），即使 muse 本地设 `"plugin": []` 也无法去掉。
> **临时解法**：移走 `~/.config/opencode/opencode.json`。
> **正式解法**：P2 — 通过 `OPENCODE_CONFIG` 环境变量或 `OPENCODE_DISABLE_PROJECT_CONFIG` 实现配置隔离。

---

## 查询可用模型

### 方法一：命令行（推荐）

```bash
# 查看所有可用模型（排除 openrouter，Muse 不用 openrouter）
opencode models 2>&1 | grep -v "openrouter"
```

### 当前可用模型列表（2026-03-17 更新）

> [!IMPORTANT]
> **不使用 openrouter 下的任何模型。** openrouter 只是代理，我们直连各 provider。

**OpenCode 官方 Zen 服务**（按 token 计费，需 opencode auth）：
```
opencode/big-pickle         opencode/claude-sonnet-4-5
opencode/claude-3-5-haiku   opencode/claude-sonnet-4-6
opencode/claude-haiku-4-5   opencode/gemini-3-flash
opencode/claude-opus-4-1    opencode/gemini-3.1-pro
opencode/claude-opus-4-5    opencode/gpt-5.4
opencode/gpt-5.1-codex      opencode/minimax-m2.5
```

**阿里百炼 Coding Plan**（alibaba-coding-plan-cn，需中国区 key）：
```
alibaba-coding-plan-cn/qwen3-coder-plus      ← 当前 Muse 使用
alibaba-coding-plan-cn/qwen3-coder-next
alibaba-coding-plan-cn/qwen3-max-2026-01-23
alibaba-coding-plan-cn/qwen3.5-plus
alibaba-coding-plan-cn/glm-4.7
alibaba-coding-plan-cn/glm-5
alibaba-coding-plan-cn/kimi-k2.5
alibaba-coding-plan-cn/MiniMax-M2.5
```

**MiniMax 直连**（minimax-cn，需 MiniMax key）：
```
minimax-cn/MiniMax-M2
minimax-cn/MiniMax-M2.1
minimax-cn/MiniMax-M2.5
minimax-cn/MiniMax-M2.5-highspeed
```

**OpenAI 直连**（openai，需 OpenAI key）：
```
openai/gpt-5.4              openai/gpt-5.1-codex
openai/gpt-5.2              openai/gpt-5.1-codex-max
openai/gpt-5.3-codex        openai/gpt-5.1-codex-mini
openai/codex-mini-latest
```

### 方法二：确认实际 model 来源

```bash
# 查看 serve 日志确认加载了哪个配置
lsof -p $(pgrep -f 'opencode serve' | head -1) -F n | grep 'opencode/log' | sed 's/^n//'
# 然后: grep 'service=config\|model' {log_file}
```

---

## 切换模型 — Muse 标准步骤

> 只需改 **项目 opencode.json**，不改全局配置。

```bash
# 1. 编辑项目配置
vim opencode.json
# 修改 model 和 small_model 字段，必须是 opencode models 输出中的 ID

# 2. 验证模型 ID 存在
opencode models 2>&1 | grep -v "openrouter" | grep "你的model"

# 3. 重启 Muse（配置不重启不生效）
# 在 muse/ 目录执行 start.sh 或重启 Telegram Bot 进程

# 4. 验证生效（看 Muse 日志）
grep "期望模型" muse/logs/muse_*.log | tail -1
# 应输出: 期望模型: {你的model} (由 opencode.json 配置)
```

> [!CAUTION]
> `.env` 里的 `DEFAULT_MODEL` 对 opencode serve **无效**！
> serve 读配置文件，不读 Muse 进程的环境变量。
> 修改 model 必须改 opencode.json，然后重启。

---

## opencode.json 项目配置完整结构

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "alibaba-coding-plan-cn/qwen3-coder-plus",
  "small_model": "alibaba-coding-plan-cn/qwen3-coder-plus",
  "username": "Later",
  "plugin": ["file://muse/plugin/index.mjs"],
  "mcp": {
    "memory-server": {
      "type": "local",
      "command": ["node", "muse/mcp/memory.mjs"],
      "environment": {
        "MEMORY_DB_PATH": "./muse/data/memory.db"
      }
    }
  }
}
```

> **plugin 路径说明**：`file://muse/plugin/index.mjs` 是相对于 serve 启动时的 cwd 的。
> 如果 serve 从 `assistant-agent/muse/` 启动，应改为 `file://plugin/index.mjs`。
> 这是插件加载失败的常见原因：
> ```
> ERROR service=plugin path=file://muse/plugin/index.mjs
>       error=ResolveMessage: Cannot find module '/plugin/index.mjs'
> ```

---

## 认证管理

```bash
opencode auth list      # 查看已认证的 provider
opencode auth login     # 添加新 provider
opencode auth logout    # 登出
```

认证存储：`~/.local/share/opencode/auth.json`

### 认证诊断

```bash
# 查看 provider 类型
cat ~/.local/share/opencode/auth.json | python3 -c "
import json, sys
for k, v in json.load(sys.stdin).items():
    print(f'{k}: type={v.get(\"type\", \"?\")}')
"

# 检查 OAuth token 是否过期 (OpenAI 等用 OAuth)
cat ~/.local/share/opencode/auth.json | python3 -c "
import json, sys, base64, time
d = json.load(sys.stdin)
for provider, info in d.items():
    token = info.get('access', '')
    if '.' in token:
        parts = token.split('.')
        payload = parts[1] + '=' * (4 - len(parts[1]) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        exp = decoded.get('exp', 0)
        left = (exp - int(time.time())) // 60
        print(f'{provider}: {\"有效\" if left > 0 else \"已过期\"} ({left}分钟)')
    else:
        print(f'{provider}: API key (不过期)')
"
```

### Provider ID 映射（认证时用）

| 显示名 | auth.json 中的 ID | model 格式示例 |
|--------|-------------------|---------------|
| OpenCode Zen | `opencode` | `opencode/gpt-5.4` |
| 阿里百炼 Coding Plan | `alibaba-coding-plan-cn` | `alibaba-coding-plan-cn/qwen3-coder-plus` |
| MiniMax (minimaxi.com) | `minimax-cn` | `minimax-cn/MiniMax-M2.5` |
| OpenAI 直连 | `openai` | `openai/gpt-5.4` |

> [!IMPORTANT]
> Provider ID **不一定**等于显示名！
> 用 `opencode auth list` 看实际 ID，再对应到 `opencode models` 输出中的前缀。

---

## 踩坑记录

| 坑 | 原因 | 解法 |
|----|------|------|
| 改了 opencode.json 但模型没变 | 没重启 serve | 重启 Muse 的 start.sh |
| provider/model 格式被拒 | model ID 不在列表里 | `opencode models` 确认 ID |
| plugin 加载失败 `/plugin/index.mjs` | serve 的 cwd 和 plugin 相对路径不匹配 | 确认 serve cwd，调整 plugin 路径 |
| .env 改了 DEFAULT_MODEL 没用 | .env 是 Muse 进程用的，不传给 serve | 改 opencode.json |
| poll 一直 busy 超时 | 模型请求时间长，120s 不够 | 调大 timeoutMs，或换更快模型 |
| seenBusy=false 超时 | 模型 ID 错误，serve 内部报错 | 检查 serve 日志 + 确认模型 ID |
| Dev task 用 worktree 里的 opencode.json | worktree 有自己的 opencode.json (层 5) | `cat {worktree}/opencode.json` 确认 |
| muse 返回空响应 / pua 自称 Sisyphus | 全局 `~/.config/opencode/opencode.json` 的 `plugin: ["oh-my-opencode@latest"]` 被拼接到 muse 的配置中，Sisyphus agent 接管任务，主 session 无 text parts | 移走全局 opencode.json；P2 做配置隔离 |
