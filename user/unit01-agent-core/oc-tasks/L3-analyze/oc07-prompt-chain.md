# oc07: Muse Prompt 注入链走读

> **USOLB:** `[S]`源码 `[O]`观察hook
> **Bloom Level:** 3 — 分析
> **对应理论:** 01a §2.3 Augmented LLM + 01e §3
> **目标:** 完整追踪: AGENTS.md → identity.mjs → system-prompt hook → OpenCode → LLM

---

## Prompt 组装链路追踪

### Step 1: AGENTS.md (身份定义)

```
文件: families/{family}/{member}/AGENTS.md
内容结构: （走读后填写）
哪些字段? （填写）
```

### Step 2: identity.mjs (读取 + 解析)

| 函数 | 做了什么 | 源码位置 |
|------|---------|---------|
| （填写） | 读 AGENTS.md | `src/core/identity.mjs:L?` |
| （填写） | 解析身份字段 | `src/core/identity.mjs:L?` |

### Step 3: system-prompt hook (组装)

| 函数 | 做了什么 | 源码位置 |
|------|---------|---------|
| （填写） | 拦截 system prompt | `src/plugin/hooks/system-prompt.mjs:L?` |
| （填写） | 注入身份信息 | （填写） |

### Step 4: OpenCode → LLM

```
最终发给 LLM 的 system prompt 长什么样?
（用 message-hook.mjs 截获后贴在这里）
```

---

## 实操: 用 hook 截获真实 system prompt

```bash
# 在 message-hook.mjs 里加一行打印:
console.log('SYSTEM PROMPT:', messages[0]?.content?.slice(0, 200))
```

截获的内容:
```
（填写）
```

---

## 分析

| 问题 | 回答 |
|------|------|
| prompt 由几段拼成? | （填写） |
| 身份信息在哪个位置? | （填写） |
| 工具使用指导在哪里? | （填写） |
| 有没有 Guardrails? | （填写） |
| 和 01a §2.3 的 Augmented LLM 三要素 (检索+工具+记忆) 对的上吗? | （填写） |
