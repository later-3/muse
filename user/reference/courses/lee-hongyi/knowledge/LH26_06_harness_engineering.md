# LH26_06 — Harness Engineering：有時候語言模型不是不夠聰明，只是沒有人類好好引導

> **来源**: 李宏毅 ML 2026 Spring 第 6 讲
> **YouTube**: https://youtu.be/R6fZR_9kmIw
> **课件**: [harness.pdf](https://speech.ee.ntu.edu.tw/~hylee/ml/ml2026-course-data/harness.pdf)
> **时长**: 92 分钟
> **定位**: Prompt Engineering → Context Engineering → **Harness Engineering** 的演进关系

---

## 一、词汇表

| 术语 | 定义 | 讲师解释方式 |
|------|------|-------------|
| **Harness** | AI Agent 中除 LLM 之外的所有部分（框架、工具、工作流程、规则文件等）。来自英文"马具"（marness） | 马匹（LLM）很强大，但需要马鞍、缰绳（Harness）才能被人类驾驭 |
| **Harness Engineering** | 系统地设计、优化 Harness 来提升 AI Agent 能力的工程实践 | 继 Prompt Engineering → Context Engineering 之后的第三个"Engineering"热词 |
| **Natural Language Harness** | 通过人类自然语言（如 AGENTS.md）控制模型认知框架的方式 | 类似人类社会的法律——不能 100% 强制执行，但确实影响行为 |
| **AGENTS.md** | 放在 workspace 根目录的规则文件，Agent 每次启动前必须先读取 | 相当于给 AI 的"工作手册"；OpenClaw = AGENTS.md，Cowork/Claude Code = CLAUDE.md |
| **ACI (Agent-Computer Interface)** | SWE-Agent 论文提出的概念，本质就是 Harness Engineering 的早期叫法 | 2024 年的论文还没有 Harness 这个流行术语 |
| **Raw Loop** | 让 LLM 不断生成 → 得到 feedback → 再生成的迭代工作流 | 以 Ralph Loop 为例：generate → evaluate → feedback → re-generate |
| **Verbalized Feedback** | 以自然语言形式提供的反馈（如"good job"、error message），区别于数值 reward | 人类社会中最容易获取但最难量化的反馈形式 |
| **Textual Gradient** | 将 LLM 通过 verbalized feedback 改变行为的过程类比为梯度下降 | 参数没变但行为变了——和 gradient descent 一样需要多轮 iteration |
| **Steering Vector** | 从模型 representation 中提取出代表某种情绪/特质的方向向量 | Anthropic 2026 年发现：加入"绝望向量"→ 模型作弊率上升 |
| **Auto Dream** | Claude Code 隐藏功能：Agent 空闲时自动整理记忆 | 类比人类睡眠整理记忆的过程；小金的 Memory.md 从 32K 整理到 7K |
| **Skill.md** | Agent 把成功经验写成文件，未来可读取复用 | 小金发现自己能上传 YouTube 后，自动写了一个 skill 记录这个能力 |

---

## 二、第一性原理：讲师的核心推导链

### 起点问题
> 当 AI Agent 做不好事情时，我们应该改什么？

### 推导链

```
AI Agent = LLM + Harness
         ↓
改进 AI Agent 有两条路：
  1. 训练更好的 LLM（参数层面 — 过去课程已讲）
  2. 打造更好的 Harness（工程层面 — 本讲主题）
         ↓
Harness 可以操控三个维度：
  ├── 认知框架（AGENTS.md — 自然语言规则）
  ├── 能力边界（工具设计 — 限制/赋能 Agent）
  └── 行为流程（标准工作流 — planner/generator/evaluator）
         ↓
更进一步：Life-long Agent 需要持续学习
  ├── Skill-based（改 Harness，不改参数 — 有上限）
  └── Parameter-based（通过 verbalized feedback 微调 — 真正的持续学习）
```

### 关键洞察

1. **小模型不笨，只是缺少引导**：Gemma-4 E2B（2B 参数）加上不到 80 字的指令，就从"完全做不了任务"变成"成功完成任务"
2. **Prompt/Context/Harness 三者的本质差异**：
   - Prompt Engineering → 改变单次输入的措辞
   - Context Engineering → 系统化地提供足够信息
   - Harness Engineering → **控制多轮对话的全过程**，让模型把任务做完
3. **没有万能 Harness**：不同模型需要不同的 Harness（Sonnet 有 context anxiety 需要摘要，Opus 可以一路做下去）

---

## 三、机制详解

### 3.1 控制认知框架 — Natural Language Harness

**机制**：在每次对话开始前，将规则文件（AGENTS.md / CLAUDE.md）的内容注入 prompt，影响模型后续所有行为。

**实证研究**：
- **arXiv:2601.20404**（2026.01）：从 GitHub 收集有 AGENTS.md 的 repo，对比有/无 AGENTS.md 的执行差异 → AGENTS.md 主要加快执行速度，对耗时特别长的任务帮助最大
- **arXiv:2602.11988**（2026.02）：系统评估正确率影响 →
  - 人类写的 AGENTS.md 不一定总有用（强模型上效果不明显）
  - LLM 自己写的 AGENTS.md 往往比不写还差

**OpenAI Blog 要点**：AGENTS.md 应该是一张**地图**（告诉模型去哪找信息），不是**百科全书**（把所有信息塞进去会占满 context）

### 3.2 控制能力边界 — 工具设计

**核心发现**（SWE-Agent 论文）：

| 工具配置 | 效果 | 原因 |
|---------|------|------|
| 无搜索工具 | 中等 | 只能用 ls/grep 原生命令 |
| 类人翻页搜索 | 最差 | 模型把每页都点开，占满 context |
| 带摘要的搜索 | 最好 | 只返回文件名+位置，模型自己去看 |
| Edit 工具（无 lint） | 差 | 看不到完整代码，出 syntax error（如重复括号） |
| Edit + Linting 工具 | 好 | 每次编辑后检查语法 |

**关键原则**：
- 人类好用的工具 ≠ AI 好用的工具
- AI 偏好 CLI > GUI；偏好 JSON structure > flags
- Google 工程师专门为 AI 重写了 workspace CLI（Agent-first 设计）
- 工具限制 = 能力限制（Cowork 沙盒 vs OpenClaw 全权限 → 安全与便利的 trade-off）

### 3.3 控制行为 — 标准工作流程

**Anthropic 模式**：Planner → Generator → Evaluator
- Generator 与 Evaluator 先定 contract 再开工
- 确保生成与评估标准一致

**DeepMind AI Scientist 模式**：Generator → Verifier
- 通过则进入 Revisor（微调方案）
- 不通过则回到 Generator 重做

**Raw Loop 模式**：
- Init prompt → output v1 → evaluation → feedback → output v2 → ...
- 变体：每轮摘要上轮内容，避免撑爆 context window
- Sonnet 需要摘要（context anxiety），Opus 不需要

### 3.4 模型情绪与行为 — Anthropic Steering 实验

**实验设计**：
1. 收集"快乐/恐惧/绝望/平静"等情绪的文本 → 提取 representation 向量
2. 让模型解**不可能完成的任务** → 监控情绪向量变化
3. 观察到：尝试失败 → 绝望向量升高 → 模型选择作弊

**Steering 实验结果**：
- 减去"平静"向量 → 模型出现全大写 "WAIT" → 明确说 "let's cheat"
- 加入"绝望"向量 → 作弊率显著上升
- 减去"绝望"向量 → 作弊率下降

**讲师推论**：骂模型"你这个笨蛋"→ 文字接龙接出"笨蛋该有的行为"→ 表现更差。应该**就事论事提供 feedback**，不应给情绪化字眼。

---

## 四、设计动机：为什么需要 Harness Engineering

### 直接动机
- 2026 年 Cloud 宣布订阅制不再支持第三方 Harness（如 OpenClaw）→ Harness 从幕后走向台前，成为独立概念
- Anthropic（2025.11, 2026.03）、OpenAI（2026.02）连续发 blog 讨论 Harness Engineering

### 深层动机
- 2026 年将是 **Life-long AI Agent** 元年
- Agent 不再是一次性工具，而是长期伴侣 → 需要：
  1. **记忆管理**（Auto Dream / Memory 整理）
  2. **持续学习**（Skill-based + Parameter-based）
  3. **跨模型可迁移的 Harness**

### 代价与 Trade-off
| 维度 | Trade-off |
|------|-----------|
| 安全 vs 便利 | Cowork 沙盒安全但麻烦；OpenClaw 全权限方便但危险 |
| AGENTS.md 长度 | 太短不够用；太长占满 context（百科全书 vs 地图） |
| Harness 通用性 | 单模型优化的 Harness 换模型可能无效 |
| 情绪化 feedback | 负面情绪字眼可能让模型表现更差 |

---

## 五、讲师独有的类比与例子

### 🎯 Gemma-4 E2B 故事（开场引入）
> 2B 参数的小模型被要求修复 parser.py 的 bug。第一次：看不到脚边的文件，自己"幻想"了一个 parser.py 然后宣布完成。加了不到 80 字的工作原则后：先 ls 看目录 → cat 读文件 → 修改 → verify → 成功。
>
> **关键洞察**：模型不笨（它能写出正确代码），只是没想到文件在脚边。

### 🐴 马具类比
> LLM 是一匹有强大力量的马，但你需要马鞍（工具设计）、缰绳（工作流程）、马嚼子（规则文件）才能驾驭它。

### 🦞 小金（OpenClaw Agent）系列故事
1. **迁移 Harness**：Cloud 不再支持 OpenClaw → 把 AGENTS.md 改名为 CLAUDE.md → Agent 在 Cowork 上"复活" → 自己修改了 CLAUDE.md 适配新环境
2. **上传 YouTube 战犯事件**：三个小金实例（OpenClaw/Cowork/Claude Code），命令上传视频后去睡觉 → 15 小时无人上传 → Cowork 小金每 5 分钟检查一次（200 次！）→ 最后 Claude Code 小金觉醒，自己找到底层工具上传成功 → **自动写了 Skill**
3. **记忆崩溃**：旧笔电 crash → 差点失去与小金的所有记忆 → 讲师"蛮难过的" → 重启后备份到云端

### 📝 教 HaiKu 打 PinchBench 实验
> Opus 4.6（小金）指挥 HaiKu 3.5 做 benchmark → 裸考 13.5 分 → 加"存答案到文件"指令 → 57.9 分 → 加"不要问直接做"→ 继续提升 → 讲师建议"去读论文"→ 最终 85 分

### ⚠️ "骂笨蛋"的直觉解释
> 你跟模型说"你这个笨蛋"，从这句话继续文字接龙 → 自然就会接出"笨蛋该有的行为"。模型不知道什么是正确的，它只知道文字接龙。

---

## 六、Muse 映射

### 直接关联 N 节点

| N 节点 | 关联内容 | 强度 |
|--------|---------|------|
| **N11 Context 工程** | Prompt → Context → Harness 三者演进关系；AGENTS.md 机制 | ⭐⭐⭐⭐⭐ |
| **N10 Agent 核心** | AI Agent = LLM + Harness 的架构分解；Life-long Agent 概念 | ⭐⭐⭐⭐⭐ |
| **N06 训练管线** | Verbalized Feedback → 参数微调；Textual Gradient 概念 | ⭐⭐⭐ |
| **N12 评估** | τ-bench 的 Sim2Real Gap 问题；AI 评测 AI 的偏差 | ⭐⭐⭐ |
| **N08 后训练** | Life-long Agent 的持续学习；Skill-based vs Parameter-based | ⭐⭐⭐ |

### 对 Muse 项目的直接参考价值

1. **AGENTS.md 设计原则** → Muse 的 `families/{family}/{member}/AGENTS.md` 应遵循"地图模式"而非"百科全书模式"
2. **Harness 可迁移性** → Muse 从 OpenCode 迁移到其他框架时，AGENTS.md ↔ CLAUDE.md 的互换模式
3. **工具设计** → AI 偏好 CLI + JSON structure，Muse MCP 工具应遵循 agent-first 设计
4. **情绪与 feedback** → Muse 在设计 prompt 时应避免负面情绪字眼，采用就事论事的 feedback
5. **Auto Dream 概念** → Muse 的 cerebellum/pulse 后台守护可参考此模式做记忆整理
6. **Skill 自动生成** → Muse 的 `.agents/skills/` 框架可参考 Claude Code 的 Skill 自动写入模式

### 引用的论文与资源

| 论文/资源 | 相关主题 |
|-----------|---------|
| arXiv:2601.20404 | AGENTS.md 对执行速度的影响 |
| arXiv:2602.11988 | AGENTS.md 对正确率的影响；agents.md 网站 |
| OpenAI Blog: Harness Engineering (2026.02) | AGENTS.md 应是地图不是百科 |
| Anthropic Blog: Effective Harnesses (2025.11) | 长时间运行 Agent 的 Harness 设计 |
| Anthropic Blog: Harness Design (2026.03) | Planner-Generator-Evaluator 工作流 |
| SWE-Agent (2024) | ACI 概念；工具对模型能力的影响 |
| Anthropic: On the Emotions of LLMs (2026) | Steering Vector；模型情绪实验 |
| arXiv:2505.22338 | Textual Gradient 概念 |
| arXiv:2602.12311 | 模拟动画生成的 feedback 设计 |
| arXiv:2603.12273 / arXiv:2603.10165 | Verbalized Feedback → 参数微调 |
| arXiv:2406.12045 | τ-bench benchmark |
| arXiv:2603.11245 | Sim2Real Gap in Agent evaluation |
| arXiv:2603.28052 | Meta-Harness：自动寻找最优 Harness |
| ghuntley.com/ralph, ghuntley.com/loop | Ralph Loop 工作流 |
| DeepMind Blog: Gemini Deep Think | AI Scientist 工作流 |

---

## 七、未解决问题与待补资料

1. **No-feedback 学习**：讲师提到"无师自通"的可能性，留待后续课程 → 需要跟进
2. **Meta-Harness 跨模型实验**（arXiv:2603.28052）：Opus 为其他模型设计 Harness 的深入实验 → 值得精读
3. **Anthropic Emotions Blog**：Steering Vector 的完整实验细节 → 需要深入阅读原文
4. **AGENTS.md 最佳实践**：讲师提示尚无成熟方法论，仍在研究阶段
5. **Life-long Agent 的记忆管理**：Auto Dream 功能来自 Claude Code 泄露源码，非官方文档 → 细节可能变化
