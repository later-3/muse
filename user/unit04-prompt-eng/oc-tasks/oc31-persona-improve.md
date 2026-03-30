# oc31: 优化 Muse Persona Prompt

> **USOLB:** `[B]`编译修改 `[U]`使用 | **Bloom:** 4 — 创造
> **前置:** oc28(截获) + oc29(走读) + oc30(对比)
> **目标:** 基于分析改进 AGENTS.md 模板 + system-prompt hook 拼接逻辑

---

## 从 oc30 带过来的改进点

| # | 借鉴来源 | 改什么 |
|---|---------|--------|
| 1 | （从 oc30 复制） | （填写） |
| 2 | （从 oc30 复制） | （填写） |

---

## 修改记录

### 改进 1: AGENTS.md 模板

**文件:** `families/later-muse-family/pua/AGENTS.md`

**修改前:**
```
（贴原来的关键部分）
```

**修改后:**
```
（贴改后的）
```

### 改进 2: system-prompt hook

**文件:** `src/plugin/hooks/system-prompt.mjs`

**修改前:**
```javascript
// 贴原代码
```

**修改后:**
```javascript
// 贴改后代码
```

---

## 验证

- [ ] 启动 Muse，用 oc28 的方法截获新的 system prompt
- [ ] 对比改进前后的 prompt，确认改进生效
- [ ] 和 Muse 对话，主观感受有没有改善
- [ ] 用 oc17 的评估指标（如有）做量化对比
