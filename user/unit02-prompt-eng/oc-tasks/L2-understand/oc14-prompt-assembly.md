# oc32: 走读 Muse Prompt 组装链

> **USOLB:** `[S]`源码 | **Bloom:** 2 — 理解 | **理论:** 04a §7层 + unit01 oc07

---

## 组装链追踪

### Step 1: AGENTS.md → identity.mjs

| 源码位置 | 做了什么 |
|---------|---------|
| `src/core/identity.mjs:L?` | 读 AGENTS.md 文件 |
| `src/core/identity.mjs:L?` | 解析字段: （填写哪些字段） |
| `src/core/identity.mjs:L?` | 返回 identity 对象 |

### Step 2: identity → system-prompt hook

| 源码位置 | 做了什么 |
|---------|---------|
| `src/plugin/hooks/system-prompt.mjs:L?` | 接收 identity |
| `src/plugin/hooks/system-prompt.mjs:L?` | 拼接 system prompt |

### Step 3: hook → OpenCode → LLM

```
最终 prompt 的拼接顺序: （填写）
1. ___
2. ___
3. ___
```

---

## 7 层架构映射

（走读后标注每层在哪个文件的哪一行生成的）

| 层 | 内容 | 生成位置 (文件:行号) |
|----|------|---------------------|
| 1 角色 | （填写） | （填写） |
| 2 任务 | （填写） | （填写） |
| ... | | |
