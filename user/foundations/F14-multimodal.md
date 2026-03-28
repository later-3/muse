# F14: 多模态 — Vision-Language 模型

> **来源：** 综合（LLaVA / GPT-4V / Qwen-VL 论文）
> **状态：** ⏳ 占位 · 待填充 · 优先级低（Sprint 2+）
> **一句话：** 理解图片怎么变成 token，LLM 怎么"看"图。

---

## ⚡ 3 分钟速读版

```
一句话: [待填充]
3 个关键概念: Vision Encoder / 图像Token化 / 跨模态对齐
对 Muse 最重要的: 未来 Muse 可能需要处理截图/图片
面试必记: [待填充]
```

---

## 核心章节框架

### 1. 图片怎么变成 Token
> 图片 → Vision Encoder (ViT) → Patch Embeddings → 投影到 LLM 的 embedding 空间

### 2. 训练方式
> Stage 1: 图文对齐预训练（大量图文对）
> Stage 2: 指令微调（对话格式的图文 QA）

### 3. 主流架构
> LLaVA / GPT-4V / Gemini / Qwen-VL 对比

### 4. Muse 应用场景
> 截图理解 / OCR / 可视化 debug

---

## 🔗 被引用于

- 暂无（Sprint 2+ 启用）
