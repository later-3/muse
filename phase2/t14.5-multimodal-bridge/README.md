# T14.5: Multimodal Tool Bridge — 多模态工具桥

> **第三批** — 与 T14/T15 并行

## 目标

外界输入进入认知前的工具化桥接层。当某个器官接收到东西后，需要经过具体的"理解工具"才能真正被 AI 认知。

这层既不是感知 (T14 管感知入口)，也不是能力注册 (T15 管自知)，而是**"外界输入 → 可被 AI 理解的文本/语义" 的转换工具集**。

## 为什么需要这层

没有它，语音/图片/文档能力会分散在 Skill、MCP、Router、Gap 各处。统一到这层后:
- 新增一种多模态理解 = 新增一个 bridge tool
- Perception 收到 audio → 查 Registry → 找到 bridge tool → 转换 → AI 处理

## 子任务

1. Bridge Tool 标准定义 (输入: artifact → 输出: text/structured data)
2. `describe_image` — 图片描述 (多模态 LLM 直接支持)
3. `transcribe_audio` — 语音转文字 (MCP: whisper 或外部 API)
4. `parse_document` — 文档提取 (PDF/Office → 文本)
5. `extract_metadata` — 文件元数据提取
6. 预留: `summarize_media` — 视频/长音频摘要

## Phase 2 范围

- `describe_image`: 如果 LLM 支持多模态则直接用，否则 Gap
- 其余标注为 Gap，记录到 Gap Journal
- 重点是**建立标准**，不是全部实现

## 验收

- Bridge Tool 标准格式文档化
- `describe_image` 可用 (或明确标记为 Gap)
- 所有不可用的 bridge 在 Capability Registry 标记为 missing
