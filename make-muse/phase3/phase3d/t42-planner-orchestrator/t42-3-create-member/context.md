# T42-3 上下文 — create-member.sh 规范化

## 背景

T42 需要创建一个 Planner 成员。当前 `init-member.sh` 有 2 个问题：

1. **不接受 --bot-token / --chat-id 参数** — 创建完后 config.json 里 botToken/chatId 是空字符串，需要手动编辑
2. **identity.mjs 没有 planner 角色** — `ROLE_DEFAULTS` 只有 pua/arch/coder/nvwa，没有 planner 的默认身份

同时，T42 父文档要求将脚本重命名为 `create-member.sh`，使命名更符合实际语义。

## 文件定位

| 文件 | 路径 | 当前行数 |
|------|------|---------|
| init-member.sh | `muse/init-member.sh` | 217 行 |
| identity.mjs | `muse/src/core/identity.mjs` | 548 行 |

## 现有成员

```
families/later-muse-family/members/
├── nvwa/      ← 活跃
├── arch/      ← 活跃
├── test-coder/ ← 测试用
├── test-dev/   ← 测试用
└── test-pua/   ← 测试用
```

## Planner 的特殊需求

Planner 和普通 Muse 成员有 2 个关键区别：

1. **OpenCode 权限** — Planner 是只读指挥官，`permission` 中 `bash`/`edit` 应该是 `deny` 而非 `allow`
2. **AGENTS.md** — 不能用通用 `createDefaultIdentity()` 模板，需要单独写（T42-5 负责，create-member 只生成骨架）

> 但 create-member.sh 本身不需要为 Planner 做特殊分支。Planner 的差异化在 T42-5 中手动配置。
