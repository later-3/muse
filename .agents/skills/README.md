# Muse 技能目录

> Muse 的行为策略通过 Skill 管理。AI 按需加载匹配的 Skill。

## 可用 Skill

| Skill | 层级 | 说明 | 状态 |
|-------|------|------|------|
| [memory-companion](./memory-companion/) | Layer 1 | 记忆存取策略 — 何时存储/检索/更新用户记忆 | ✅ |
| [daily-chat](./daily-chat/) | Layer 1 | 闲聊场景策略 — 对话节奏/轻重切换/情感表达 | ✅ |

## 规范

详见 [CONVENTION.md](./CONVENTION.md) — Skill 开发标准。

## 层级

- **Layer 1**: 基础行为 Skill (始终可用)
- **Layer 2**: 场景 Skill (按需加载, 预留)
- **Layer 3**: 高级 Skill (Phase 3+, 预留)
