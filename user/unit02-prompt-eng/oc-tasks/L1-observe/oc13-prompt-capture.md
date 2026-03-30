# oc31: 观察 Prompt 注入链

> **USOLB:** `[O]`观察hook | **Bloom:** 1 — 观察 | **理论:** 04a §7层

---

## 操作步骤

### Step 1: 用 message-hook 截获完整 system prompt

在 `src/plugin/hooks/message-hook.mjs` 里加:
```javascript
hooks.on('chat.message.before', (event) => {
  const systemMsg = event.messages?.find(m => m.role === 'system')
  if (systemMsg) {
    console.log('\n══ SYSTEM PROMPT 截获 ══')
    console.log(systemMsg.content)
    console.log('══ 长度:', systemMsg.content.length, '字符 ══\n')
  }
})
```

### Step 2: 启动 Muse 发消息，看截获的 prompt

---

## 观察记录

### 截获的完整 system prompt

```
（贴在这里）
```

### 结构分析

| 段落 | 内容摘要 | 对应 7 层的哪层？ |
|------|---------|----------------|
| 第 1 段 | （填写） | （填写） |
| 第 2 段 | （填写） | （填写） |
| ... | | |

### 7 层 Prompt 架构对照

| 层 | 名称 | Muse 有吗？ | 在 prompt 的哪部分？ |
|----|------|-----------|-------------------|
| 1 | 角色定义 | （填写） | （填写） |
| 2 | 任务指令 | （填写） | （填写） |
| 3 | 上下文 | （填写） | （填写） |
| 4 | 输出格式 | （填写） | （填写） |
| 5 | 规则约束 | （填写） | （填写） |
| 6 | 示例 | （填写） | （填写） |
| 7 | Guardrails | （填写） | （填写） |
