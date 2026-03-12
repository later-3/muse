# Phase 2 实施计划评审报告

> 评审对象：
> `/Users/xulater/.gemini/antigravity/brain/ec1c4cd6-bce3-48b3-b6c6-fd18101ff92a/implementation_plan.md.resolved`
>
> 评审目标：
> 不是一锤定音，而是从 Muse 整体方向出发，评估这份计划是否真正支撑：
> 1. Muse 作为长期陪伴型 Agent 的成长
> 2. 她对世界的感知、能力自知、缺口处理
> 3. 她基于 OpenCode / oh-my-opencode 的原生能力去适应世界、调用工具、调用子 agent、甚至自建执行体系

---

## 一、总体评价

这版 `implementation_plan.md.resolved` 比前一版明显进步，已经不再只是“列几个 Skill/MCP 任务”，而是开始把 OpenCode 的原生能力分层展开，尤其补进了：

1. `Plugin`
2. `Hook`
3. `Bus`
4. `AGENTS.md`
5. `Custom Tool`
6. `MCP`

这说明规划已经从“我怎么在 wrapper 上继续堆能力”，逐步转向“我怎么把 Muse 建在 OpenCode 的原生能力体系之上”。

但从 Muse 的真正目标来看，这份计划仍然**缺少一个比 Skill/MCP 更上层的架构抽象**：

> **Muse 不是只会用工具，她还要知道自己有什么感官、有什么能力、不会什么、如何尝试搞定、失败后怎么记录和求助。**

也就是说，这份文档现在更像：

- OpenCode 能做什么
- Muse 可以接哪些扩展机制

但还不完全像：

- Muse 如何感知世界
- Muse 如何知道自己会/不会
- Muse 如何面对未知输入
- Muse 如何调用工具、Hook、Plugin、子 agent、新 OpenCode 实例去适应世界

这是本轮评审最核心的结论。

---

## 二、这版计划做对了什么

### 1. Phase 2 主链顺序比之前合理

当前主链是：

1. `T11 Memory MCP`
2. `T12 Identity → AGENTS.md`
3. `T13 Orchestrator 瘦身`

补充层：

1. `T10 技能系统`

这个顺序比之前把 Skill 放在一切前面要稳得多。至少说明计划已经承认：

1. 记忆工具化是核心
2. 人格原生注入是核心
3. 去 wrapper 认知层是核心

这是对的。

### 2. 把 Hook / Plugin / Bus 纳入能力地图是重大改进

这点很重要，因为 Muse 后面很多能力不是靠单个 Skill 或 MCP 就能优雅完成的。

例如：

1. `prompt.before / after` 适合上下文整理、记忆落盘、审计
2. `tool.output.after` 适合工具审计、结果缓存
3. `permission.ask` 适合审批链
4. `Bus` 适合大脑、小脑、Web、家族成员之间的状态桥和触发器

如果没有这一层，很多系统能力会重新被塞回 wrapper 或 daemon。

### 3. 场景已经从“工具型”开始向“关系型”扩展

本版已经开始覆盖：

1. 日常关系场景
2. 长期关系与目标
3. 多模态与产物
4. 自我成长与开发
5. 家族协作

这说明规划开始往真正的 Muse 方向走，而不只是“一个更会用工具的开发代理”。

---

## 三、最关键的缺失：还没有“感官与能力自知架构”

这是这次评审里最重要的一点。

你明确提出的方向是：

1. Telegram 现在是她感知世界的一个器官
2. 以后摄像头可能是她的眼睛
3. 她必须知道自己有哪些“感官器官”
4. 当收到一个自己暂时不懂的外界输入时，她不能静默失败
5. 她应该知道自己不会
6. 她应该尝试用已有工具/技能/机制去搞定
7. 搞不定，再记录缺口、求助、成长

而这份计划目前还没有把这一层正式写成架构对象。

### 现在缺的不是某个功能，而是这 4 个系统层

#### 1. `Perception Ingress`

作用：

把 Telegram / 摄像头 / Web / 文件夹 / IoT / 其他输入统一变成标准化感知对象。

例如：

```js
{
  source: 'telegram',
  type: 'audio',
  userId: 'later',
  artifact: {
    kind: 'voice-note',
    mime: 'audio/ogg',
    localPath: '...'
  },
  textFallback: null,
  timestamp: '...'
}
```

没有这一层，系统就只能一直按：

1. `if text`
2. `if photo`
3. `if voice`
4. `if document`

这样打补丁。

#### 2. `Capability Registry`

作用：

Muse 必须知道自己：

1. 有哪些感官
2. 有哪些能力
3. 每个能力由什么机制提供
4. 当前是否可用
5. 正在学习什么
6. 最近失败了什么

例如：

```js
{
  senses: {
    telegram_text: { status: 'available' },
    telegram_audio: { status: 'available', tool: 'transcribe_audio' },
    camera_vision: { status: 'missing' }
  },
  capabilities: {
    understand_text: 'native',
    transcribe_audio: 'mcp',
    describe_image: 'plugin',
    route_subagent_task: 'builtin-task',
    create_skill: 'native-write',
    create_mcp_server: 'controlled-dev'
  }
}
```

没有这一层，她不会形成真正的“自知之明”。

#### 3. `Capability Gap Journal`

作用：

当她收到一个自己不会处理的输入时，不能只是失败或沉默，而要进入缺口管理。

例如：

1. 收到 Telegram 语音
2. 发现没有 `transcribe_audio`
3. 记录：
   - 输入类型
   - 缺失能力
   - 尝试过哪些补救路径
   - 是否需要审批 / 求助 / 学习

这层是未来成长、求助、自我开发的基础。

#### 4. `Execution Router`

作用：

她面对一个任务时，要知道优先走哪条执行路径：

1. 自己直接推理
2. 调内置工具
3. 加载 Skill
4. 调 Custom Tool
5. 调 MCP
6. 触发 Hook / Plugin 机制
7. 调子 agent
8. 起一个新的 OpenCode 实例

这不是细节，而是她以后能否真正“自己想办法搞定问题”的核心路由层。

---

## 四、用“语音消息”这个例子，说明当前计划哪里还不够

你举的例子非常好，因为它刚好暴露出目前计划还停留在哪一层。

### 用户场景

你现在通过 Telegram 发一条语音给 Muse。

你真正想要的不是：

1. 我们给 `telegram.mjs` 手写一个 `voice handler`
2. 然后加个 `transcribe_audio` 调用

而是：

1. 她收到一种来自外界的新输入
2. 她知道这是什么
3. 她知道自己会不会处理
4. 不会时知道该走什么补救路径
5. 最后仍不行，知道如何记录和求助

### 正确的架构链路应该是

1. `Telegram Adapter` 收到 `voice`
2. `Perception Ingress` 统一成 `type: audio`
3. Muse 查询 `Capability Registry`
4. 判断：
   - 有 `transcribe_audio` 吗？
   - 有负责语音理解的 Skill 吗？
   - 有对应 plugin / hook / MCP 吗？
   - 能否委派给一个会语音的子 agent？
   - 能否新起一个 OpenCode 实例处理？
5. 如果有 → 调工具链
6. 如果没有 → 写入 `Capability Gap Journal`
7. 然后：
   - 告知用户
   - 尝试启用已有机制
   - 或生成受控成长提议

### 这说明当前计划里还缺什么

1. 没有把 `Telegram` 定义为“器官”，还只是通道
2. 没有 “perception object” 这一层
3. 没有 “能力注册表”
4. 没有 “不会时如何尝试补救”的统一路由

所以当前这版计划虽然已经比之前好很多，**但仍然不够支撑你要的 Muse。**

---

## 五、Hook / Plugin 虽然出现了，但还没真正进入模块规划

你说“hook、plugin 没有”，这版确实比之前补上了能力地图，但**还没有真正变成 Phase 2 的明确模块或任务**。

现在的问题是：

1. 文档承认 Hook/Plugin 存在
2. 但后面 `T10-T13` 没有一个任务在真正落它们

这会带来一个风险：

1. 规划时知道它们重要
2. 实施时仍然只做 Skill + MCP
3. 最终 Muse 又长成“还是主要靠 wrapper 和少量 MCP 的系统”

### 我建议至少增加一个显式任务或子任务组

比如：

#### `T10.5 Event/Hook/Plugin 基座`

目标：

1. 明确哪些能力必须优先走 Hook/Plugin
2. 建立最小事件桥
3. 建立审批/审计/上下文注入的统一挂点

至少覆盖：

1. `prompt.before` / `prompt.after`
2. `tool.output.after`
3. `permission.ask`
4. `Session.Error`
5. `Session.Idle`

否则后面很多能力会继续回流到 wrapper。

---

## 六、子 agent / 自建 agent / 多 OpenCode 实例，没有被提升到足够高的位置

你特别强调了这一点，这里我完全同意，而且认为它应该进入 Phase 2 的架构规划，而不是 Phase 4 才突然出现。

Muse 将来不只是：

1. 会调用工具

她还应该：

1. 会调用子 agent
2. 会在需要时自建 agent
3. 会在需要时独立起一个 OpenCode 实例
4. 会把某些复杂任务外包给自己的“工人”或“器官”

### 这些能力的角色不一样

#### 1. 子 agent (`task`)

适合：

1. 短任务拆分
2. 临时并行处理
3. 研究 / 格式化 / 分类等局部任务

#### 2. 自建 agent

适合：

1. 长期角色
2. 特定领域专家
3. 家族成员扩展

#### 3. 新 OpenCode 实例

适合：

1. 隔离任务
2. 独立实验
3. 避免污染主大脑 session
4. 自主开发 / 自主学习的沙箱

这三者在计划里不应被模糊成同一种能力。

### 建议新增一节

`Agent Execution Topology`

明确：

1. 什么时候调 tool
2. 什么时候调 subagent
3. 什么时候创建新 agent
4. 什么时候起新 OpenCode 实例

这会比只在场景表里写一句“task 工具用于家族协作”强很多。

---

## 七、场景仍然不够全，尤其缺“器官型场景”和“连续生活型场景”

当前场景已经比之前丰富，但按 Muse 的方向，还应补至少 `5` 类：

### 1. 感官器官场景

例如：

1. Telegram 是她的嘴耳
2. 摄像头是她的眼睛
3. 文件夹/上传入口是她的收件箱
4. Home Assistant 事件是她的环境感知
5. Browser / page observation 是她的观察窗口

### 2. 未知输入场景

例如：

1. 收到语音但不会听
2. 收到图片但不会看
3. 收到 PDF 但不会提炼
4. 收到表格但不会分析

### 3. 连续目标场景

例如：

1. 学 Rust
2. 减重到 110 斤
3. 筹备旅行
4. 做一个长期项目

这些应该触发：

1. 目标识别
2. Goal 追踪
3. Thread 挂接
4. Artifact 产出

### 4. 主动性场景

例如：

1. 定期追踪目标
2. 主动回顾阶段进展
3. 发现多条记忆的关联
4. 在合适时间生成总结

### 5. 失败与求助场景

例如：

1. 她不会处理某种输入
2. 她尝试失败
3. 她记录失败原因
4. 她告诉你需要什么帮助
5. 她申请新能力或审批

Muse 的成长感，很大一部分其实来自这一类场景，而不只是“成功的时候”。

---

## 八、模块划分是否合理

结论：**比上一版合理很多，但还少了 `4` 个必须显式成模块的东西。**

### 目前合理的部分

1. `T11 Memory MCP`
2. `T12 Identity → AGENTS.md`
3. `T13 Orchestrator 瘦身`
4. `T10 Skill 系统`

### 我认为还必须加的模块

#### 1. `Perception Ingress`

负责统一输入入口。

#### 2. `Capability Registry`

负责她对自身能力与器官的认知。

#### 3. `Capability Gap Journal`

负责不会时的缺口记录与成长入口。

#### 4. `Execution Router`

负责决定：

1. tool
2. skill
3. custom tool
4. MCP
5. hook/plugin
6. subagent
7. new OpenCode instance

没有这 `4` 个模块，Phase 2 仍然会是“很多机制都接进来了，但没有一条完整的能力闭环”。

---

## 九、Phase 2 的建议重排

我建议把 Phase 2 进一步重排成下面这个结构。

### 主链

1. `T11 Memory MCP`
2. `T12 Identity → AGENTS.md`
3. `T13 Orchestrator 瘦身`

### 并行基座

4. `T10 Skill + Custom Tool 基础`
5. `T10.5 Event / Hook / Plugin 基座`

### 新增核心

6. `T14 Perception Ingress`
7. `T15 Capability Registry`
8. `T16 Capability Gap Journal`
9. `T17 Execution Router`

### 后置扩展

10. `T18 Multi-Agent / Subagent / Multi-OpenCode 拓扑`

这样更符合你要的方向：

1. 她先有原生记忆和人格
2. 再有感官与能力自知
3. 再有缺口与补救机制
4. 再把子 agent / 新 OpenCode 作为执行拓扑扩展起来

---

## 十、最终结论

这版 `implementation_plan.md.resolved`：

### 已经做对的

1. 终于把 `Hook / Plugin / Bus` 放进来了
2. 主链顺序比之前合理
3. 场景已经开始覆盖关系、目标、多模态、成长、家族

### 还不够的

1. 还没有“感官器官模型”
2. 还没有“能力自知”
3. 还没有“能力缺口处理”
4. 还没有“执行路由”
5. 子 agent / 新 OpenCode 实例没有被提升到足够重要的位置

一句话总结：

> **这版计划已经开始像“OpenCode 原生能力上的 Muse”，但还没有完全长成“一个知道自己有哪些器官、有什么能力、不会什么、并能自己尝试搞定问题的 Muse”。**

---

## 十一、建议的下一步

1. 在正式 Phase 2 计划中新增：
   - `Perception Ingress`
   - `Capability Registry`
   - `Capability Gap Journal`
   - `Execution Router`
2. 给 `Hook / Plugin / Bus` 单独补一个实施任务，不要只停留在能力地图
3. 把 `subagent / new agent / new OpenCode instance` 作为独立架构对象讨论
4. 补一份“感官器官与能力闭环场景矩阵”，至少覆盖：
   - 语音
   - 图片
   - 文件
   - 摄像头
   - 目标追踪
   - 主动提醒
   - 失败求助
