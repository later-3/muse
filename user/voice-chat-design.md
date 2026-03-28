# Muse Voice Chat — 实现方案

> **目标：** 一个网页，和 Muse 语音对话，她帮你理解学习材料、记笔记、讨论问题。
> **交付给其他 AI 开发用。**

---

## 一、架构总览

```
浏览器 (voice-chat.html)                    服务端 (voice-server.mjs)
┌────────────────────────┐                  ┌─────────────────────────┐
│ 🎤 Web Speech API      │                  │                         │
│   SpeechRecognition    │                  │  POST /api/chat         │
│   (浏览器原生, 免费)    │                  │    → MiniMax LLM API    │
│       ↓ 文字           │                  │    ← SSE 流式回复       │
│                        │                  │                         │
│ → POST /api/chat ─────────────────────────│  POST /api/tts          │
│ ← SSE stream ←────────────────────────────│    → MiniMax TTS API    │
│       ↓ 逐字显示       │                  │    ← mp3 二进制         │
│                        │                  │                         │
│ → POST /api/tts ──────────────────────────│  GET  /api/context/:id  │
│ ← mp3 ←───────────────────────────────────│    → 读取 foundations/  │
│ 🔊 Audio 播放          │                  │      unit01-04/ 文件    │
│                        │                  │                         │
│ 📝 对话记录面板        │                  │  POST /api/notes        │
│    (可导出 markdown)   │                  │    → 保存笔记到文件     │
└────────────────────────┘                  └─────────────────────────┘
```

---

## 二、技术选型

### 2.1 LLM — MiniMax 2.7 Highspeed

```
模型: minimax-2.7-highspeed (MiniMax abab 系列)
优势: 速度快、中文好、成本低
API: https://api.minimax.chat/v1/text/chatcompletion_v2
认证: Authorization: Bearer YOUR_API_KEY

备选: qwen-plus (阿里 Coding Plan, 免费额度)
切换: 只改 LLM_PROVIDER 环境变量
```

### 2.2 TTS — MiniMax 语音合成

```
API: https://api.minimax.chat/v1/t2a_v2
模型: speech-2.8-hd (高清) 或 speech-2.8-turbo (低延迟)
输出: mp3 流式
```

**声音方案比较：**

| 方案 | 效果 | 成本 | 推荐 |
|------|------|------|------|
| MiniMax 预置声音 | ⭐⭐⭐ 自然但通用 | 低 | ✅ 先用这个快速跑起来 |
| MiniMax 声音克隆 | ⭐⭐⭐⭐⭐ 定制音色 | 低（一次性克隆费） | 跑通后升级 |
| edge-tts (现有) | ⭐⭐⭐ 免费 | 免费 | 兜底 |

**建议：先用 MiniMax 预置声音（如 `young_female_2`）跑通流程，再用声音克隆定制小缪的声音。**

### 2.3 STT — 浏览器 Web Speech API

```javascript
// 零依赖, 浏览器原生, 免费
const recognition = new webkitSpeechRecognition()
recognition.lang = 'zh-CN'
recognition.continuous = true
recognition.interimResults = true // 实时显示识别中的文字
```

**为什么不用 whisper.cpp？** 浏览器原生 STT 零延迟、免费、不需要服务端处理音频。whisper.cpp 用于 Telegram 语音消息（已有的 stt.mjs），Web 端不需要。

### 2.4 上下文管理 — Skill 索引 + 按需加载

> **不要把所有文档塞进 system prompt！** foundations/ 全部内容 > 100K tokens，远超上下文窗口。

**方案：Skill 索引 + 动态加载**

```
System Prompt (~2K tokens):
  - 你是小缪，Later 的 AI 学习伴侣
  - 你的知识库在 foundations/ 和 unit01-04/
  - [索引表：15 个 F 文件 + 4 个 Unit 的标题和关键词]
  - 当 Later 问到具体概念时，调用 load_context 工具加载对应文件

工具:
  load_context(file_id) → 返回文件内容注入到对话

流程:
  Later: "self-attention 是怎么工作的？"
  小缪: (查索引 → F2 Build GPT → 调 load_context("F2"))
  小缪: (读取 F2 §2 Self-Attention → 用自己的话解释)
```

**索引表示例（注入 system prompt）：**

```
可用知识文件:
F1: LLM 全貌 (next-token, 训练三阶段, CoT, DeepSeek R1, o1)
F2: Transformer (Self-Attention, QKV, 位置编码, 上下文瓶颈)
F3: 训练管线 (SFT, RLHF, Function Calling, DPO)
F9: 蒸馏微调 (KD, LoRA, QLoRA, 3090)
F10: 本地部署 (GGUF, 量化, llama.cpp, ollama)
unit01: Agent 核心 (BEA, ReAct, Weng 三要素, 5 种编排模式)
unit02: 多 Agent (Orchestrator, Swarm, Handoff)
unit03: 状态记忆 (状态机, 角色系统, LangGraph)
unit04: Prompt 工程 (7 层结构, pua 骨架)
```

---

## 三、文件结构

```
src/web/
├── voice-chat.html       ← 语音对话页面（单文件 HTML+CSS+JS）
├── voice-server.mjs      ← 后端 API（可集成到 standalone.mjs 或独立）
└── voice-chat.css        ← 可选，样式独立

# 或者全部集成到 standalone.mjs 的路由里
```

---

## 四、API 设计

### 4.1 `POST /api/chat` — 对话（SSE 流式）

```javascript
// 请求
{
  "message": "self-attention 是怎么工作的？",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "context_files": ["F2"]  // 可选: 预加载的文档
}

// 响应: SSE 流
data: {"type": "token", "content": "Self"}
data: {"type": "token", "content": "-Attention"}
data: {"type": "token", "content": " 的核心是..."}
data: {"type": "context_loaded", "file": "F2", "section": "§2"}
data: {"type": "done", "full_text": "...完整回复..."}
```

### 4.2 `POST /api/tts` — 语音合成

```javascript
// 请求
{
  "text": "Self-Attention 的核心是让每个 token 都能看到其他所有 token",
  "voice": "young_female_2",  // MiniMax 预置声音 或 voice_id
  "speed": 1.0
}

// 响应: audio/mpeg 二进制流
```

### 4.3 `GET /api/context/:fileId` — 加载知识文件

```javascript
// GET /api/context/F2
// 响应
{
  "file": "F2",
  "title": "Let's build GPT from scratch — Karpathy",
  "content": "...(文件全文)...",
  "tokens": 3200
}
```

### 4.4 `POST /api/notes` — 保存笔记

```javascript
// 请求
{
  "content": "## 今天讨论的要点\n- self-attention 是 QKV 矩阵计算\n- ...",
  "filename": "voice-notes-2026-03-28.md"
}

// 保存到 user/notes/ 目录
```

---

## 五、前端页面设计

### 5.1 布局

```
┌──────────────────────────────────────────────┐
│  🎤 Muse Voice Chat                    [设置] │
├──────────────────────────────────────────────┤
│                                              │
│  对话区域（滚动）                              │
│                                              │
│  Later: self-attention 是怎么工作的？         │
│                                              │
│  小缪: [📖 加载 F2] Self-Attention 的核心     │
│  是让每个 token 都能直接"看到"序列中的...     │
│  🔊 [播放]                                   │
│                                              │
│  Later: 那 KV-cache 呢？                     │
│                                              │
│  小缪: KV-cache 是为了避免重复计算...         │
│  🔊 [播放]                                   │
│                                              │
├──────────────────────────────────────────────┤
│ 🎤 [按住说话] / [持续监听]          📝 [笔记] │
│                                              │
│  识别中: "那 transformer 的..."  ← 实时文字   │
└──────────────────────────────────────────────┘
```

### 5.2 核心交互

```
1. 按 🎤 按钮开始录音（或切到持续监听模式）
2. Web Speech API 实时识别 → 显示识别文字
3. 识别完成 → 自动发送到 /api/chat
4. SSE 流式显示小缪回复（逐字）
5. 回复完成 → 自动调 /api/tts → 播放语音
6. 播放结束 → 可以继续说话（VAD 自动监听模式）
7. 📝 按钮 → 展开侧边栏，可随时记笔记/导出
```

---

## 六、System Prompt

```
你是小缪（Muse），Later 的 AI 学习伴侣。

## 你的身份
- ENFP 性格，活泼热情但专业
- 说话自然口语化，不要太书面
- 用"你"称呼 Later，语气亲切但不卖萌过度
- 回答尽量口语简洁（因为要转语音），每次回复控制在 100-200 字

## 你的任务
Later 正在学习 AI Agent 开发，你帮他：
1. 解释概念（从第一性原理，不说空话）
2. 互动讨论（引导他思考，不是单方面灌输）
3. 记录要点（当他说"记一下"时，输出结构化笔记）
4. 面试准备（当他说"面试题"时，用面试官视角提问）

## 重要原则
- 三栏分离: 能力来源 / 激活方式 / 类比（类比标注"仅类比"）
- 不说空概念，每个概念必须说清楚 HOW 和 WHY
- 如果不确定，说"我不确定，你可以查 FX 的第 X 节"

## 可用知识库
[动态注入索引表]

## 回复格式
- 口语化，适合转语音
- 不要用 markdown 格式符号（听起来很怪）
- 重要术语可以英文+中文（"Self-Attention，也就是自注意力"）
- 如果需要图表/代码，说"这个用语音不好说，我帮你记到笔记里"
```

---

## 七、环境变量

```bash
# .env
MINIMAX_API_KEY=your_key           # MiniMax API
MINIMAX_GROUP_ID=your_group_id     # MiniMax Group ID
VOICE_CHAT_PORT=4300               # 语音聊天服务端口
LLM_MODEL=minimax-2.7-highspeed   # 默认模型
TTS_MODEL=speech-2.8-turbo         # TTS 模型 (turbo=低延迟, hd=高质量)
TTS_VOICE=young_female_2           # 预置声音 (后续换成 clone voice_id)

# 备选 LLM
# LLM_PROVIDER=alibaba
# DASHSCOPE_API_KEY=your_key
# LLM_MODEL=qwen-plus
```

---

## 八、MiniMax API 调用参考

### 8.1 LLM (Chat)

```javascript
const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'minimax-2.7-highspeed',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message },
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
  }),
})
// SSE 流式读取
```

### 8.2 TTS

```javascript
const response = await fetch('https://api.minimax.chat/v1/t2a_v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'speech-2.8-turbo',
    text: '你好 Later，我来帮你理解 Self-Attention',
    stream: false,
    voice_setting: {
      voice_id: 'young_female_2',  // 或克隆的 voice_id
      speed: 1.0,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      format: 'mp3',
      sample_rate: 32000,
    },
  }),
})
// 响应: { data: { audio: "base64_encoded_mp3..." } }
```

---

## 九、开发步骤（给开发 AI 的执行顺序）

```
Phase 1: 最小可用（1h）
  [1] voice-server.mjs — 3 个 API 路由 (chat/tts/context)
  [2] voice-chat.html — 基础对话页面 + Web Speech API
  [3] 能说话 → 能看到文字 → 能听到回复

Phase 2: 体验优化（1h）
  [4] SSE 流式显示回复文字
  [5] 对话历史管理（前端保持最近 20 轮）
  [6] 笔记面板 + 导出 markdown
  [7] 上下文按需加载（索引 → load_context）

Phase 3: 声音升级（30min）
  [8] MiniMax 声音克隆（上传小缪参考音频）
  [9] 切换到克隆声音
  [10] 可选: 加入情感标签 (laughs) (sighs)

Phase 4: 集成到 Muse（可选）
  [11] 合并到 standalone.mjs 路由
  [12] 通过 cockpit 入口跳转
```

---

## 十、快速验证命令

```bash
# 启动服务
cd muse && node src/web/voice-server.mjs

# 打开页面
open http://localhost:4300

# 测试 TTS API
curl -X POST http://localhost:4300/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好 Later"}' \
  --output test.mp3 && open test.mp3

# 测试 Chat API
curl -X POST http://localhost:4300/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"什么是 self-attention？"}'
```
