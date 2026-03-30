# oc09: 落地 ACI 修复 — 把 oc06 审计的问题真正修好

> **USOLB:** `[B]`编译修改
> **Bloom Level:** 4 — 创造
> **对应理论:** 01a §2.6 ACI (闭环: 审计→修复)
> **前置:** oc06 ACI 审计完成
> **目标:** 把 oc06 审计出的 P0 问题在真实代码里修复

---

## 从 oc06 带过来的 P0 问题

（从 oc06-aci-audit.md 的"优先级 P0"部分复制过来）

| # | 工具 | 问题 | 计划修复方式 |
|---|------|------|------------|
| 1 | （填写） | （填写） | （填写） |
| 2 | （填写） | （填写） | （填写） |

---

## 修复记录

### 修复 1

**文件:** `src/mcp/planner-tools.mjs`
**修改前:**
```javascript
// （贴原来的代码）
```

**修改后:**
```javascript
// （贴改后的代码）
```

**ACI 原则改进:** （说明改了哪条原则）

### 修复 2

（同上格式）

---

## 验证

修复后的验证步骤：
1. [ ] `node --test src/mcp/planner-tools.test.mjs` 通过
2. [ ] 启动 Muse，让 pua 调用被修改的工具，行为正常
3. [ ] 用 trace-reader 看工具调用记录，没有异常

---

## 提交

```bash
git add src/mcp/planner-tools.mjs
git commit -m "fix: ACI审计修复 — 改进MCP工具描述和错误处理 (oc09)"
```
