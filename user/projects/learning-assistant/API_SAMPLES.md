# Learning Assistant V0 — API Sample Responses

> **交付方:** AI 2 (后端检索 / Notes / TTS)  
> **接收方:** 前端开发 / OpenCode 适配层 / 集成方  
> **日期:** 2026-03-28

---

## 一、启动方式

```bash
cd muse
node user/projects/learning-assistant/server/server.mjs
```

服务启动在：`http://127.0.0.1:4300`

### 环境变量

```bash
LEARNING_ASSISTANT_PORT=4300   # 端口
LEARNING_ASSISTANT_HOST=127.0.0.1  # 监听地址
```

---

## 二、接口清单

### 1. GET /api/context/search?q=

**用途:** 搜索本地学习资料

**请求:**
```http
GET /api/context/search?q=attention HTTP/1.1
Host: 127.0.0.1:4300
```

**成功响应 (200):**
```json
{
  "ok": true,
  "items": [
    {
      "id": "F2-build-gpt",
      "title": "F2: Let's build GPT from scratch — Karpathy",
      "path": "user/foundations/F2-build-gpt.md",
      "snippet": "...Self-Attention 的核心是让每个 token 都能直接看到序列中的其他所有 token..."
    },
    {
      "id": "F13-inference-optimization",
      "title": "F13: 推理优化 — Flash Attention / KV-Cache / 投机解码",
      "path": "user/foundations/F13-inference-optimization.md",
      "snippet": "...让模型跑得更快更省的工程技术..."
    }
  ]
}
```

**空查询响应 (200):**
```json
{
  "ok": true,
  "items": []
}
```

**字段说明:**
- `id`: 文档唯一标识（文件名不含 .md）
- `title`: 文档标题（从第一个 # 标题提取）
- `path`: 相对路径（从 muse/ 根目录）
- `snippet`: 命中片段预览（150 字左右）

---

### 2. POST /api/notes

**用途:** 保存对话笔记为 Markdown 文件

**请求:**
```http
POST /api/notes HTTP/1.1
Host: 127.0.0.1:4300
Content-Type: application/json

{
  "title": "2026-03-28 学习讨论",
  "content": "## 今天讨论的要点\n\n- Self-Attention 的核心是 QKV 矩阵计算\n- Transformer 的位置编码让模型理解顺序\n"
}
```

**成功响应 (200):**
```json
{
  "ok": true,
  "path": "user/projects/learning-assistant/notes/2026-03-28-学习讨论.md",
  "filename": "2026-03-28-学习讨论.md"
}
```

**错误响应 (400):**
```json
{
  "ok": false,
  "error": "Missing or empty content"
}
```

**保存位置:**
```
muse/user/projects/learning-assistant/notes/YYYY-MM-DD-标题.md
```

**文件内容格式:**
```markdown
# 标题

内容正文...
```

---

### 3. POST /api/tts

**用途:** 文字转语音（edge-tts + macOS say 兜底）

**请求:**
```http
POST /api/tts HTTP/1.1
Host: 127.0.0.1:4300
Content-Type: application/json

{
  "text": "Self-Attention 的核心是让每个 token 都能直接看到序列中的其他所有 token",
  "voice": "zh-CN-XiaoyiNeural"
}
```

**成功响应 (200):**
```
HTTP/1.1 200 OK
Content-Type: audio/mpeg
Content-Length: 11737

<二进制 MP3 数据>
```

**错误响应 (400):**
```json
{
  "ok": false,
  "error": "Missing or empty text"
}
```

**降级响应 (503):**
```json
{
  "ok": false,
  "error": "TTS 全部失败：edge=超时，say=命令不存在"
}
```

**声音配置:**
- 默认：`zh-CN-XiaoyiNeural` (edge-tts, 活泼女声)
- 兜底：`Tingting` (macOS say, 系统自带)
- 可通过 `voice` 参数覆盖

---

### 4. GET /health

**用途:** 健康检查

**请求:**
```http
GET /health HTTP/1.1
Host: 127.0.0.1:4300
```

**响应 (200):**
```json
{
  "ok": true,
  "service": "learning-assistant",
  "indexSize": 34
}
```

---

## 三、扫描的文档目录

服务启动时自动扫描以下目录的 `.md` 文件：

```
muse/
├── user/foundations/           # 15 个 F 文件 (F1-F15)
├── user/unit01-agent-core/     # Agent 核心
├── user/unit02-multi-agent/    # 多 Agent 编排
├── user/unit03-state-memory/   # 状态与记忆
└── user/unit04-prompt-eng/     # Prompt 工程
```

**索引内容:**
- 文件名/ID
- 标题（第一个 # 标题）
- 所有 # 和 ## 级标题
- 关键词（预定义 KEYWORDS_MAP）
- 预览片段（前 200 字符）
- 估算 tokens 数

---

## 四、检索策略

V0 使用简单匹配，不做向量搜索：

1. **文件名/ID 匹配** (100 分)
2. **标题匹配** (50 分，完全匹配 +25 分)
3. **标题匹配** (20 分)
4. **关键词匹配** (15 分)
5. **预览匹配** (5 分)

按分数降序返回结果。

---

## 五、错误处理

所有错误响应统一格式：

```json
{
  "ok": false,
  "error": "错误描述"
}
```

**常见错误:**
- `400` - 请求参数错误
- `404` - 路由不存在
- `500` - 服务器内部错误
- `503` - TTS 服务不可用

---

## 六、CORS

所有响应包含 CORS 头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 七、测试命令

### 健康检查
```bash
curl -s http://127.0.0.1:4300/health | jq .
```

### 搜索测试
```bash
curl -s "http://127.0.0.1:4300/api/context/search?q=Transformer" | jq .
```

### 笔记保存测试
```bash
curl -s -X POST http://127.0.0.1:4300/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"测试笔记","content":"这是测试内容"}' | jq .
```

### TTS 测试
```bash
curl -s -X POST http://127.0.0.1:4300/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好 Later"}' \
  --output /tmp/test.mp3 && open /tmp/test.mp3
```

### 运行自动化测试
```bash
cd muse
node --test user/projects/learning-assistant/test/server.test.mjs
```

---

## 八、已知限制 (V0)

1. **不做向量搜索** - 只使用关键词匹配
2. **不做复杂 RAG** - 只返回片段，不注入完整文档
3. **TTS 依赖 edge-tts** - 需要 `pip install edge-tts`，降级到 macOS say
4. **无认证** - 本地服务，无权限控制
5. **无持久化会话** - 每次搜索独立

---

## 九、为 OpenCode 适配层准备的数据结构

检索结果可直接用于组装 prompt：

```javascript
// 示例：从搜索到 prompt 组装
const searchResults = await fetch('/api/context/search?q=attention').then(r => r.json())

const contextForPrompt = searchResults.items.map(item => ({
  id: item.id,
  title: item.title,
  snippet: item.snippet,
  // 可扩展：加载完整文档
}))

// 组装 system prompt
const systemPrompt = `你是小缪，Later 的 AI 学习伴侣。
当前讨论的上下文:
${contextForPrompt.map(c => `- [${c.id}] ${c.title}: ${c.snippet}`).join('\n')}

请基于以上资料回答问题。`
```

---

## 十、验收标准完成情况

- [x] 能扫描本地文档并建立索引 (34 个文档)
- [x] GET /api/context/search 可返回命中结果
- [x] POST /api/notes 可成功保存 Markdown
- [x] POST /api/tts 可返回音频或清晰错误
- [x] 测试可证明上述能力成立 (18 个测试全部通过)

---

## 十一、接口契约冻结

以下字段名在开发过程中**不得修改**：

### Search Response
- `ok` (boolean)
- `items` (array)
- `items[].id` (string)
- `items[].title` (string)
- `items[].path` (string)
- `items[].snippet` (string)

### Notes Request
- `title` (string, optional)
- `content` (string, required)

### Notes Response
- `ok` (boolean)
- `path` (string)
- `filename` (string)

### TTS Request
- `text` (string, required)
- `voice` (string, optional)

### Error Response
- `ok` (false)
- `error` (string)

如需修改，必须通知前端和集成方。
