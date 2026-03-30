# oc32: 观察 Muse Memory 读写

> **USOLB:** `[U]`使用 `[L]`日志 | **Bloom:** 1 — 观察 | **理论:** 03a §记忆

---

## 操作步骤

### Step 1: 和 Muse 对话，提到"记住"

```
用户: "帮我记住：我最近在学 Agent 核心循环，已经完成了 unit01"
```

### Step 2: 再次对话，问它还记得吗

```
用户: "我之前让你记住了什么？"
```

### Step 3: 看 memory 工具调用日志

```bash
node src/plugin/trace-reader.mjs  # 看有没有 search_memory / store_memory 调用
```

---

## 观察记录

| 问题 | 记录 |
|------|------|
| memory 工具被调用了吗？ | （填写） |
| 调的是 search 还是 store？ | （填写） |
| 存储的数据长什么样？ | （填写） |
| 检索结果准确吗？ | （填写） |
| 对应 Weng 的哪种记忆类型？(工作/短期/长期) | （填写） |
