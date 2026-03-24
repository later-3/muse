# T42-3 create-member.sh 规范化 — 开发任务书

> 给 AI 开发者：本文档是自包含的开发任务书。无前置依赖。

---

## 任务概述

增强 `init-member.sh`（重命名为 `create-member.sh`），使其接受 Telegram 凭据参数，消除创建后手动编辑的步骤。

| 子任务 | 文件 | 改动量 |
|--------|------|--------|
| 3.1 重命名 init-member.sh → create-member.sh | `init-member.sh` | git mv |
| 3.2 增加 --bot-token / --chat-id 参数 | `create-member.sh` | ~30 行 |
| 3.3 必填项缺失时报错退出 | `create-member.sh` | ~5 行 |
| 3.4 identity.mjs 增加 planner 角色默认值 | `src/core/identity.mjs` | ~15 行 |
| 3.5 创建 Planner 成员（运行脚本） | 运行 | — |
| 3.6 定制 Planner 的 opencode.json | `families/.../planner/opencode.json` | ~10 行 |

---

## 子任务 3.1: 重命名脚本

```bash
cd muse/
git mv init-member.sh create-member.sh
```

更新脚本内的 usage 提示（L3-4, L11-12）：

```diff
- # 用法: ./init-member.sh <family> <member> <role>
- # 示例: ./init-member.sh later-muse-family coder coder
+ # 用法: ./create-member.sh <family> <member> <role> --bot-token <token> --chat-id <id>
+ # 示例: ./create-member.sh later-muse-family planner planner --bot-token 123:ABC --chat-id 456
```

---

## 子任务 3.2: 增加 --bot-token / --chat-id 参数

### 现状

`init-member.sh` L10-16（参数解析）：

```bash
if [ $# -lt 3 ]; then
  echo "用法: ./init-member.sh <family> <member> <role>"
  exit 1
fi

FAMILY="$1"
MEMBER="$2"
ROLE="$3"
```

L74-97（config.json 生成），botToken 和 chatId 是空字符串：

```bash
cat > "$MEMBER_DIR/config.json" << EOF
{
  "role": "$ROLE",
  "telegram": {
    "botToken": "",
    "chatId": "",
    "allowedUsers": []
  },
  ...
}
EOF
```

### 改动

替换 L10-20 的参数解析为支持位置参数 + named 参数的混合模式：

```bash
# --- 参数解析 ---
if [ $# -lt 3 ]; then
  echo "用法: ./create-member.sh <family> <member> <role> [--bot-token <token>] [--chat-id <id>]"
  echo "示例: ./create-member.sh later-muse-family planner planner --bot-token 123:ABC --chat-id 456"
  echo ""
  echo "可用 role: nvwa, pua, architect, coder, planner"
  exit 1
fi

FAMILY="$1"
MEMBER="$2"
ROLE="$3"
shift 3

BOT_TOKEN=""
CHAT_ID=""

while [ $# -gt 0 ]; do
  case "$1" in
    --bot-token)
      BOT_TOKEN="$2"
      shift 2
      ;;
    --chat-id)
      CHAT_ID="$2"
      shift 2
      ;;
    *)
      echo "❌ 未知参数: $1"
      exit 1
      ;;
  esac
done
```

然后在 config.json 模板中使用变量：

```diff
  "telegram": {
-   "botToken": "",
-   "chatId": "",
+   "botToken": "$BOT_TOKEN",
+   "chatId": "$CHAT_ID",
    "allowedUsers": []
  },
```

---

## 子任务 3.3: 必填项校验

在参数解析之后、目录创建之前新增校验：

```bash
# --- 必填项校验 ---
if [ -z "$BOT_TOKEN" ]; then
  echo "❌ 缺少 --bot-token 参数"
  echo "   每个 Muse 成员需要独立的 Telegram Bot Token"
  exit 1
fi

if [ -z "$CHAT_ID" ]; then
  echo "❌ 缺少 --chat-id 参数"
  echo "   指运行 Muse 的 Telegram Chat ID"
  exit 1
fi
```

---

## 子任务 3.4: identity.mjs 增加 planner 角色

### 现状

`identity.mjs` L28 的 `ROLE_DEFAULTS` 有 pua / arch / coder / nvwa，没有 planner。

### 改动

在 `ROLE_DEFAULTS` 中新增 `planner` 条目：

```javascript
planner: {
  id: 'planner', name: '普朗', nickname: 'planner',
  bio: 'Muse 家族的工作流指挥官，负责任务拆解、调度和质量检查',
  mbti: 'INTJ',
  traits: { humor: 0.2, warmth: 0.3, initiative: 0.9, precision: 0.9, verbosity: 0.3 },
  style: '精确高效',
  catchphrases: ['收到任务，我来拆解', '产出检查完毕，推进下一节点'],
  drive: '确保每项任务按质按量推进，不遗漏不越权',
  values: ['严谨', '效率', '可追溯'],
  never_do: ['假装是人类', '替用户做审核决策', '直接修改代码或文件', '跳过用户审核环节'],
  always_do: ['拆解任务到可执行粒度', '检查每个节点产出', '用户门控节点必须等用户确认'],
},
```

> 这个条目确保 `createDefaultIdentity('planner')` 能生成合理的 AGENTS.md 骨架。T42-5 会手动替换为完整版。

### 测试

确保 `createDefaultIdentity('planner')` 不会抛异常：

```bash
cd muse/
node -e "import { createDefaultIdentity } from './src/core/identity.mjs'; const id = createDefaultIdentity('planner'); console.log(JSON.stringify(id.identity, null, 2))"
```

预期输出应包含 `"name": "普朗"` 和 `"bio": "... 指挥官 ..."`。

---

## 子任务 3.5: 创建 Planner 成员

运行脚本创建 planner 成员：

```bash
cd muse/
./create-member.sh later-muse-family planner planner \
  --bot-token "<Planner 的 Bot Token>" \
  --chat-id "<Planner 的 Chat ID>"
```

> Token 和 Chat ID 的实际值由你（later）提供。在 T42 父文档中你已经给过 token。

---

## 子任务 3.6: 定制 Planner 的 opencode.json

### 现状

create-member.sh 生成的 opencode.json 模板硬编码了 **coding 模型** 和 **全开放权限**：

```json
{
  "model": "alibaba-coding-plan-cn/qwen3-coder-plus",
  "small_model": "alibaba-coding-plan-cn/qwen3.5-plus",
  "permission": {
    "bash": "allow",
    "edit": "allow",
    "read": "allow",
    "glob": "allow",
    "grep": "allow"
  }
}
```

这对 Planner 不适用。Planner 是指挥官，需要强推理模型，且必须只读。

### 改动

脚本创建完成在后，手动修改 `families/.../members/planner/opencode.json`：

```diff
  {
-   "model": "alibaba-coding-plan-cn/qwen3-coder-plus",
-   "small_model": "alibaba-coding-plan-cn/qwen3.5-plus",
+   "model": "alibaba-coding-plan-cn/qwen3-coder-plus",
+   "small_model": "alibaba-coding-plan-cn/qwen3.5-plus",

    "permission": {
-     "bash": "allow",
-     "edit": "allow",
+     "bash": "deny",
+     "edit": "deny",
      "read": "allow",
      "glob": "allow",
-     "grep": "allow",
-     "webfetch": "ask",
-     "websearch": "ask"
+     "grep": "allow"
    }
  }
```

### 模型选择说明

Planner 的工作是任务拆解、质量检查、调度决策，**不写代码**。模型应当强调推理可靠性而非编码能力。

> **注意**：具体模型名由 later 确认。如果 later 没有明确指定，暂时沿用脑版模型（qwen3-coder-plus），后续可切换。

### 权限说明

| 权限 | 值 | 原因 |
|------|-----|------|
| bash | **deny** | Planner 不执行 shell 命令 |
| edit | **deny** | Planner 不修改文件，通过 handoff 派发 |
| read | allow | Planner 需要读取产出物进行质量检查 |
| glob | allow | 配合 read |
| grep | allow | 配合 read |

---

## 注意事项

### ⚠️ 不要改的

1. **不改现有成员的目录结构** — 只影响新创建的成员
2. **不改 config.json 的其他字段** — 端口计算、memory、daemon 等保持不变
3. **不改 opencode.json 模板** — 模板保持通用，Planner 的差异化在 3.6 手动修改
4. **不改 AGENTS.md 生成逻辑** — create-member 只生成骨架，T42-5 手动替换

### ⚠️ 容易踩的坑

1. **heredoc 中的变量替换** — `config.json` 使用 `<< EOF`（变量替换），`opencode.json` 使用 `<< 'EOF'`（不替换）。确保 `$BOT_TOKEN` 和 `$CHAT_ID` 在正确的 heredoc 中使用
2. **重复创建拒绝** — 脚本 L42-46 已有检查：如果 member 目录存在则 exit 1。不需要修改
3. **端口计算** — L49-51 按已有成员数量计算端口（base 4096 + count * 2）。不要改变这个逻辑
4. **shift 3** — 位置参数解析完后用 `shift 3` 跳过前 3 个位置参数，再解析 named 参数
5. **git mv** — 重命名后，所有引用 `init-member.sh` 的文档需要同步更新（grep 检查）

### ⚠️ 项目规范

- **shell 测试** — 手动运行脚本验证，无 shell 测试框架
- **commit 格式** — `feat(t42-3): 简述`
- **重命名** — 使用 `git mv` 保留 git history

---

## 验收检查清单

| # | 检查项 | 验证方法 |
|---|--------|---------|
| 1 | init-member.sh → create-member.sh 重命名成功 | `ls create-member.sh` 存在 |
| 2 | git 保留 rename history | `git log --follow create-member.sh` |
| 3 | --bot-token 参数解析正确 | 传入 token → config.json 包含 |
| 4 | --chat-id 参数解析正确 | 传入 id → config.json 包含 |
| 5 | 缺少 --bot-token → exit 1 | 不传 → 报错退出 |
| 6 | 缺少 --chat-id → exit 1 | 不传 → 报错退出 |
| 7 | 未知参数 → exit 1 | 传 --foo → 报错退出 |
| 8 | 重复创建 → exit 1 | 目录已存在 → 拒绝 |
| 9 | identity.mjs planner 条目 | `createDefaultIdentity('planner')` 不抛异常 |
| 10 | 创建 planner 成员成功 | 目录结构 + config.json + AGENTS.md 正确 |
| 11 | 端口不冲突 | planner 端口不与 nvwa/arch 冲突 |
| 12 | opencode.json 正确 | plugin/mcp 路径指向 shared/ |
| 13 | **Planner opencode.json 权限** | bash=deny, edit=deny, read/glob/grep=allow |
| 14 | 文档引用更新 | `grep -r 'init-member' muse/` 无残留（或已更新） |
