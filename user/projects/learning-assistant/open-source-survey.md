# 学习助手 V0 开源调研

> **目标：** 判断这个学习助手是直接复用现成开源项目更快，还是在当前仓库里做一个轻量定制版更快。

---

## 一、结论先说

1. **最适合你的 V0 方案：** 在当前 `muse` 仓库里做一个轻量定制版，复用已有 `web` 和 `voice` 模块。
2. **最快能直接用的通用成品：** `Open WebUI`。
3. **最强的实时语音/多模态工程底座：** `Pipecat` 或 `LiveKit Agents`。
4. **后续做“看屏幕/截图问答”最值得参考：** `screenpipe` 这类屏幕采集/OCR 项目。

> 判断标准不是“谁最强”，而是“谁最适合你当前 1-2 天内跑出可用 V0”。

---

## 二、当前仓库已有可复用资产

1. 现有 Web 服务已经有聊天 API：[`api.mjs`](/Users/xulater/Code/assistant-agent/muse/src/web/api.mjs#L121)
2. 现有独立 web/cockpit 服务已经能提供路由和静态资源壳：[`standalone.mjs`](/Users/xulater/Code/assistant-agent/muse/src/web/standalone.mjs#L607)
3. 现有 TTS 模块已可复用：[`tts.mjs`](/Users/xulater/Code/assistant-agent/muse/src/voice/tts.mjs#L1)
4. 现有 STT 模块已存在，但 Web 端 V0 更适合直接用浏览器原生识别：[`stt.mjs`](/Users/xulater/Code/assistant-agent/muse/src/voice/stt.mjs#L1)

**结论：** 你不是从 0 开始。仓库里已经有一半壳了。

---

## 三、外部方案调研

### 1. Open WebUI

- 仓库：<https://github.com/open-webui/open-webui>
- 定位：通用自托管 AI Web UI，支持多模型和 RAG。
- 优点：
  1. 开箱即用，最快跑起来。
  2. 已有成熟网页聊天界面。
  3. 后续做图像输入也更自然。
- 缺点：
  1. 太通用，不是为你的 `foundations/ + unit01-04/` 学习语料和 Muse persona 定制。
  2. 和当前 `muse/src` 资产复用度低。
  3. 你会花不少时间做“适配”和“裁剪”，不一定比轻量自建更快。
- 适合度：
  **适合作为备用即用工具，不适合作为仓库内长期演进版本。**

### 2. Pipecat

- 仓库：<https://github.com/pipecat-ai/pipecat>
- UI Kit：<https://github.com/pipecat-ai/voice-ui-kit>
- 定位：实时语音和多模态 AI Agent 框架。
- 优点：
  1. 对语音、多模态、实时交互支持强。
  2. Voice UI Kit 已提供组件和模板。
  3. 后续演进到视觉/视频更顺。
- 缺点：
  1. Python/WebRTC 体系，技术栈明显更重。
  2. 对你当前“先做学习助手 V0”来说过度。
  3. 与现有 `muse` Node.js 资产衔接一般。
- 适合度：
  **适合未来要做生产级实时多模态时参考，不适合现在直接上。**

### 3. LiveKit Agents

- 仓库：<https://github.com/livekit/agents>
- 官网：<https://livekit.com/>
- 定位：面向语音、视频、物理世界 AI 的实时 Agent 平台。
- 优点：
  1. 适合高质量实时语音/视频交互。
  2. 浏览器接入成熟。
  3. 长期上限很高。
- 缺点：
  1. 更偏基础设施和实时媒体平台。
  2. 对当前“学习助手 V0”过重。
  3. 需要额外学习和搭建成本。
- 适合度：
  **适合作为远期升级参考，不适合当前快速版。**

### 4. screenpipe

- 仓库：<https://github.com/mediar-ai/screenpipe>
- 定位：屏幕采集、OCR、桌面感知。
- 优点：
  1. 很贴近你后面的“看屏幕/框选/识别回答”方向。
  2. 对屏幕理解链路有直接启发。
- 缺点：
  1. 不是当前 V0 所需。
  2. 现在直接接入会把项目复杂度拉高。
- 适合度：
  **适合作为 V2/V3 设计参考，不适合现在直接接入。**

---

## 四、推荐选型

### 方案 A：直接用 Open WebUI

适合：
1. 你今天就想有个“差不多能聊”的通用工具。

不适合：
1. 想复用当前仓库。
2. 想让它成为你之后自己持续迭代的项目。

### 方案 B：基于当前仓库做轻量定制版 V0

适合：
1. 想 1-2 天内出一个可用版本。
2. 想复用 `muse/src/web` 和 `muse/src/voice`。
3. 想把它作为长期支线项目继续做下去。

**推荐：选 B。**

---

## 五、V0 具体建议

1. **前端：** 单页网页，浏览器 Web Speech API 做语音输入。
2. **后端：** 新开一个轻量 server，复用现有 web/voice 模块思路。
3. **知识库：** 只读本地 `user/foundations/` 和 `user/unit01-04/`。
4. **检索：** V0 不上复杂 RAG，只做简单索引 + 文件片段加载。
5. **TTS：** 优先复用现有 [`tts.mjs`](/Users/xulater/Code/assistant-agent/muse/src/voice/tts.mjs#L1)；MiniMax 作为可选升级，不强绑。

---

## 六、对后续演进的启发

1. `V1`：截图上传问答
2. `V2`：浏览器框选截图问答
3. `V3`：屏幕共享 + 单帧抓取 + OCR / Vision 理解

> 也就是说：**现在先做一个轻量自定义版，后面参考 Pipecat / screenpipe 的模式继续演进。**

---

## 七、参考来源

1. Pipecat repo: <https://github.com/pipecat-ai/pipecat>
2. Pipecat Voice UI Kit: <https://github.com/pipecat-ai/voice-ui-kit>
3. Open WebUI repo: <https://github.com/open-webui/open-webui>
4. LiveKit Agents repo: <https://github.com/livekit/agents>
5. screenpipe repo: <https://github.com/mediar-ai/screenpipe>
