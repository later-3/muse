# T12: Identity → AGENTS.md — 人格原生注入

> **主链第二步** — 可与 T11 并行

## 目标

人格从代码 `buildSystemPrompt()` → AGENTS.md 文件 + OpenCode 原生 chat.system.transform 注入。

## 子任务

1. identity.json → AGENTS.md 生成器
2. Web 驾驶舱改身份 → 自动重新生成 AGENTS.md
3. 验证: 人格不在 session 里重复膨胀

## 验收

- 改身份 → AGENTS.md 自动更新 → 对话风格变化
- 连续 20 轮对话后 session token 稳定
- 删除 Orchestrator 中的 buildSystemPrompt 调用后功能不退化
