# T07 Muse 交互中心 — 审核提示

> 本文档供审核 Agent 使用。请根据以下维度对 T07 设计方案进行审核。

---

## 审核范围

请审核以下文档：
- `phase1/t07-web-cockpit/README.md` — 总体设计 + 分阶段规划
- `phase1/t07-web-cockpit/context.md` — 技术上下文

---

## 审核维度

### 1. 产品设计

- [ ] **需求完整性**: 5 大功能域（形象、对话、控制、数据、成长）是否覆盖了核心场景？有无遗漏？
- [ ] **用户体验**: 对话 + 形象联动的交互是否自然？有没有更好的方式？
- [ ] **阶段合理性**: Phase 1-4 的划分是否合理？是否存在依赖倒置或关键路径风险？
- [ ] **形象成长**: 从卡通到写实的进化路线是否可行？5 个阶段是否太多/太少？

### 2. 技术方案

- [ ] **架构可行性**: Body MCP 工具 → SSE → 前端渲染 这条链路是否现实？
- [ ] **性能**: 3D 渲染 (Three.js + VRM) 在浏览器中的性能是否可接受？
- [ ] **零依赖约束**: 单文件 HTML + CDN importmap 是否能支撑 Phase 3 的复杂度？是否需要引入构建工具？
- [ ] **与现有架构兼容**: API Server 和现有 `index.mjs` 的集成是否合理？

### 3. 创新性

- [ ] **Agent 控制身体**: 这个理念（AI 调用 MCP 工具来做表情/动作）是否有技术先例？有无更好的实现方式？
- [ ] **自主成长**: 成长维度设计是否有趣且有意义？是否会变成"打怪升级"的无聊循环？
- [ ] **物理世界延伸**: IoT 控制的判断链是否安全？需要什么样的授权机制？

### 4. 风险与遗漏

- [ ] **模型制作成本**: VRM 模型需要用 VRoid Studio 手动制作 5 个阶段的形象，这个工作量评估是否准确？
- [ ] **VRM 模型大小**: 加载 VRM 文件的时间和流量是否可接受？需要 LOD（Level of Detail）策略吗？
- [ ] **MCP 工具调用延迟**: AI 回复 + 身体动作的同步性如何保证？如果工具调用延迟大于 1s，表情会"跟不上"文字吗？
- [ ] **安全性**: IoT 控制缺少授权机制，误操作的回滚策略是什么？

### 5. 与项目整体的一致性

- [ ] **PHILOSOPHY.md 对齐**: "AI 管思考，代码管能力" 是否在 Body MCP 中被正确贯彻？
- [ ] **ARCHITECTURE.md 对齐**: Pulse 引擎和自主活动引擎是否与 T07 的交互中心设计协调？
- [ ] **Phase 2 路线图对齐**: T07 的阶段划分与 `phase2/README.md` 的规划是否冲突？

---

## 审核要求

1. 每个维度给出 ✅通过 / ⚠️有建议 / ❌需修改 的评价
2. 对每个 ⚠️ 和 ❌ 给出具体的改进建议
3. 如果有创意补充，欢迎提出
4. 最终给出总体评价: 可以开始实施 / 需要修改后再开始

---

## 上下文补充

审核时请参考：
- `ARCHITECTURE.md` — Muse 整体架构（大脑/小脑/Pulse/自主活动）
- `PHILOSOPHY.md` — 设计哲学（AI 决策边界、工程主权）
- `phase1/README.md` — Phase 1 任务地图
- `phase1/EXPERIENCE.md` — Phase 1 踩坑经验（特别是 BUG-009~011）
- `phase2/README.md` — Phase 2 架构规划
- `assistant-prep/muse-vision.md` — 产品愿景

---

> 审核结果请附在本文档末尾的 `## 审核结果` 章节中。

## 审核结果

### 1. 产品设计

⚠️ 有建议

这份方案的产品方向是对的，而且和 Muse 想做成“长期陪伴型数字存在”的目标高度一致。`形象 / 对话 / 控制 / 数据 / 成长` 这 5 大域不是乱堆功能，和 `assistant-prep/muse-vision.md`、`ARCHITECTURE.md`、`PHILOSOPHY.md` 的整体叙事是统一的。尤其“Web 不是后台，而是她的家 / 交互中心”这个定位，是成立的，也确实比普通控制台更符合 Muse 的长期路线。

但从 `Phase 1` 视角看，当前文档把 `MVP`、`中期能力`、`远期愿景` 写在了同一层，范围明显偏大。结合 `phase1/README.md`，T07 在当前阶段更适合被定义为：

1. 本地对话入口
2. 身份编辑器
3. 记忆浏览器
4. 系统状态与基础控制面板

而不是同时承担 `3D 身体壳层 / 成长系统 / Body MCP / IoT 家居中心` 的完整产品责任。

建议：
- 把 `README.md` 明确拆成两层：
  1. `Phase 1 可执行规格`
  2. `Phase 2-5 愿景与演进`
- 在 `Phase 1` 章节里收紧目标，只承诺当前真正要做的控制台能力。
- `3D / 成长 / IoT` 保留为方向，不在本轮文档审核里作为阻塞项。

### 2. 技术方案

⚠️ 有建议

`Phase 1` 里采用 `node:http + 单 HTML + 零构建` 的方案是合理的，和 `phase1/README.md` 的低复杂度原则一致，也符合当前本地控制台场景。`Three.js + VRM + importmap CDN` 作为后续阶段的暂定方案也可以接受，特别是在你已经明确“3D 技术路线先这样定，实际实施前再做技术调研”的前提下，这一块不应成为当前阻塞。

真正需要补强的是它和现有 Muse 主链的关系。结合当前 `T01-T06` 的实现，T07 不能自己发明新的主流程，它应该明确建立在已有模块之上：

1. 对话入口走 `Orchestrator.handleMessage()`
2. 身份编辑走 `Identity`
3. 记忆浏览走 `Memory`
4. 系统状态走各模块 `health()`

当前文档里这层约束还不够硬，容易让后面开发时绕过 `T02/T04/T05` 的边界，导致 Web 变成一套旁路逻辑。

建议：
- 在技术方案里明确写出 Phase 1 API 边界，强调 T07 只是适配器与控制台，不是新的核心编排层。
- 对“系统控制台”补充本地边界说明，例如：
  `Phase 1 默认仅绑定 localhost，不提供公网远程访问。`
- 对 `3D` 方案增加一句前置说明：
  `实施前需单独验证 VRM 资源体积、首屏性能、动画驱动链路与 SSE/事件同步方案。`

### 3. 创新性

✅ 通过

这份方案的创新点是真实成立的，不是“视觉花活”。`Agent 控制身体`、`她自己打扮自己`、`身体作为交互壳层` 这些设定，和 `PHILOSOPHY.md` 里的“AI 管思考，代码管能力”是对齐的。未来如果通过 `Body MCP` 把表情、动作、服装等能力暴露为工具，由 AI 做选择、由代码做边界控制，这条路线在产品层面是很有辨识度的。

成长系统也比常见的“经验值升级”更有意义。当前文档把成长更偏向关系、知识、审美、活力等长期维度，这和 Muse 的陪伴目标是相容的。

建议：
- 后续继续坚持“AI 决策，工程限权”原则，避免身体能力失控。
- 成长系统后面要避免沦为数值堆叠，最好始终和真实关系、内容积累、形象变化绑定。

### 4. 风险与遗漏

⚠️ 有建议

当前最大的风险不是单点技术，而是“文档叙事过满，执行边界不够锋利”。

关键风险有 4 个：

1. 范围膨胀风险
   - T07 现在很容易从“Web 控制台”滑向“整个 Muse 产品蓝图”，这会直接影响 `Phase 1` 落地节奏。
2. 系统控制能力的安全边界
   - 一旦 Web 提供重启、配置修改、日志查看、测试触发等能力，哪怕本地单机，也需要先写清楚边界。
3. `3D / VRM` 的工程成本
   - 方向可以先定，但模型制作、资源体积、动作驱动、前端性能都是真实成本，后面一定要单独评估。
4. 当前阶段成熟度表述
   - 结合现有 Muse 实现，当前主链仍然以 `T05 Orchestrator` 驱动的文本链路为主，离“身体成为主交互中心”还有距离。文档里最好避免让读者误以为这一层已经近在眼前。

建议：
- 增加 `非本阶段承诺` 小节，明确哪些只是愿景，不属于 T07 当前交付。
- 增加 `已知技术债 / 后续调研项` 小节，把 `3D 形象、VRM、Body MCP、IoT、成长数据库` 列进去。
- 对系统控制类能力增加本地访问、安全边界和未来鉴权说明。

### 5. 与项目整体的一致性

✅ 通过

整体看，T07 没有偏离 Muse 路线，反而是比较贴近 Muse 长期方向的一个模块。

和整体文档的对齐情况如下：

1. 与 `assistant-prep/muse-vision.md` 对齐
   - 都强调 Muse 不是普通 Bot，而是长期陪伴型助手。
2. 与 `ARCHITECTURE.md` 对齐
   - 身体、渠道、控制层属于壳层；核心仍然是 Muse 的记忆、编排、行为系统。
3. 与 `PHILOSOPHY.md` 对齐
   - 不能把能力定义权全部交给底层模型，身体和交互都应该由工程层保边界。
4. 与 `phase2/README.md` 基本对齐
   - T07 的后续方向和 Phase 2 的“AI-native / 工具化 / 自主性增强”是协同的。

这里唯一需要补强的是阶段定位：

1. `Phase 1`：本地控制台与可视化入口
2. `Phase 2+`：逐步演化为交互中心与身体壳层

只要文档里把这层写清楚，整体一致性就是成立的。

### 6. 总体评价

总体评价：**需要做文档收敛后再开始开发。**

不是方向错，而是当前规格层次还不够清楚。它已经抓到了 Muse 的长期目标，也没有偏离整体路线；但如果按现在这版直接开工，开发过程中很容易把 `Phase 1 MVP`、`中期架构探索`、`远期产品愿景` 混在一起做，最后买下范围失控和落地节奏变慢的坑。

我建议先修正这 4 个点：

1. 明确 `Phase 1` 最小交付范围
2. 明确 T07 和 `T02/T04/T05/T06` 的接口边界
3. 明确 `3D / Body MCP / IoT / 成长数据库` 属于后续阶段能力
4. 给“系统控制台”补上本地访问和安全边界说明

其中，`3D` 技术路线本轮可以先按当前方案保留，不作为阻塞；后续实施前再做专项技术调研即可。

---

## 开发结果审核（T07 Phase 1 MVP）

### 1. 总体判断

⚠️ **方向正确，也不是“只做了一个静态前端”，但当前实现还不能算真正达到 T07 Phase 1 的预期。**

这次交付里，`muse/web/api.mjs` 确实提供了 HTTP API，`muse/index.mjs` 也把 WebServer 接进了启动链，所以它不是“只做了页面没接后端”。但结合实际代码、现有 `T01-T06` 的真实接口，以及你反馈的“页面显示系统就绪但实际 `Failed to fetch`”，我认为当前 `T07` 还存在几类实质性问题：

1. 前端和核心模块的真实数据结构没有完全对齐
2. 文档里承诺的部分 API 没有真正实现
3. Web 被放在整个系统启动链的最后，和“驾驶舱/诊断入口”的目标冲突
4. 页面首屏状态文案会误导用户，以为系统已连接
5. 测试主要覆盖了 mock API 路由，没有真正证明“浏览器页面 + Muse 主链”已经跑通

### 2. 代码架构

⚠️ **整体边界方向是对的，但启动顺序和职责落位还不够符合 T07 的真实目标。**

好的部分：

1. `WebServer` 没有自己实现新的对话/记忆/身份逻辑，而是复用 `orchestrator / identity / memory / engine`
2. `muse/index.mjs` 已把 `web` 纳入 `createModules()`、`startAll()`、`stopAll()`，模块边界上没有明显越权

核心问题：

1. **Web 被放在启动链最后，不适合做系统驾驶舱**
   - [index.mjs](/home/user/Code/assistant-agent/muse/index.mjs#L49) 先 `engine.start()`，再 `telegram.start()`，最后才 `web.start()`
   - 这意味着只要 `Engine` 起不来、`Telegram` token 缺失、或 `Telegram` 启动失败，Web 就根本不会起来
   - 这和 T07 “系统状态 + 控制台 + 诊断入口”的目标是冲突的。真正的驾驶舱应该在子模块异常时也尽量能打开，至少能看到故障

2. **当前整体启动仍然被 Telegram 配置绑死**
   - [config.mjs](/home/user/Code/assistant-agent/muse/config.mjs#L50) 的 `validateConfig()` 仍然强制要求 `TELEGRAM_BOT_TOKEN`
   - 这会让“只想跑本地 Web 驾驶舱”这件事在系统层面不可行
   - 从整体路线看，Telegram 仍然是主渠道可以接受，但 T07 作为本地 cockpit，不应被 Telegram 的配置前置卡死

3. **README 承诺的 `web.enabled` 没实现**
   - [README.md](/home/user/Code/assistant-agent/phase1/t07-web-cockpit/README.md#L76) 写了 `muse/config.mjs` 会新增 `web.enabled`
   - 但 [config.mjs](/home/user/Code/assistant-agent/muse/config.mjs#L28) 只有 `web.port` 和 `web.host`
   - 这说明文档、实现、启动策略没有完全收口

建议：

1. 把 Web 的定位从“所有模块都成功后才附加启动的适配器”调整成“尽早启动的本地控制与诊断壳层”
2. 后续至少支持 `web-only` 或 `telegram-disabled` 的启动模式
3. 在 T08/T09 前，把系统启动策略重新梳理成：
   - 核心模块失败时，Web 仍尽可能可用
   - 页面显示降级状态，而不是整个系统直接没有入口

### 3. 功能实现

❌ **当前功能并没有完全符合文档和 Phase 1 预期，存在真实未接通和未实现项。**

最严重的问题有 3 个：

1. **身份页前端的数据结构和 `Identity` 模块真实结构不一致**
   - [identity.mjs](/home/user/Code/assistant-agent/muse/core/identity.mjs#L24) 到 [identity.mjs](/home/user/Code/assistant-agent/muse/core/identity.mjs#L52) 的真实数据结构是嵌套的：
     - `identity.name`
     - `identity.nickname`
     - `psychology.mbti`
     - `psychology.traits`
   - 但 [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L712) 到 [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L747) 读取的是：
     - `identityData.name`
     - `identityData.nickname`
     - `identityData.mbti`
     - `identityData.personality`
   - 这会导致页面加载到真实身份数据时字段为空或错位
   - 更严重的是保存时 [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L749) 到 [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L760) 构造出的 patch 也是错 shape，`identity.update()` 不会按预期更新真实字段，甚至可能把无效顶层键写进配置对象里

2. **README 承诺的 API 没有完全实现**
   - [README.md](/home/user/Code/assistant-agent/phase1/t07-web-cockpit/README.md#L89) 声明了 `GET /api/chat/history?n=`
   - [README.md](/home/user/Code/assistant-agent/phase1/t07-web-cockpit/README.md#L91) 声明了 `GET /api/system/logs?lines=`
   - 但 [api.mjs](/home/user/Code/assistant-agent/muse/web/api.mjs) 里并没有这两个路由
   - 这不只是“后续可增强”，因为它们已经写进了 T07 Phase 1 API 规格

3. **“系统就绪”首屏文案会误导用户**
   - [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L544) 默认日志文本就是 `系统就绪。`
   - 但页面初始化时只调用了 [index.html](/home/user/Code/assistant-agent/muse/web/index.html#L891) 的 `loadOverview()`，并没有先拿到后端健康检查成功的确认
   - 所以当页面是直接双击打开，或后端根本没起来，用户也会先看到“系统就绪”，然后在系统页才看到 `Failed to fetch`
   - 这和真实状态不一致，属于产品层面的误报

其他功能偏差：

1. README 写“概览页包含最近对话”，当前概览页只显示健康状态和统计，没有最近对话数据
2. 系统页文案里提到“大脑/小脑状态”，实际只渲染了 `engine` 和 `web`
3. `restart-brain` 通过 `engine.stop() + engine.start()` 实现，和文档里的 `engine.restart()` 描述不一致，不过这个问题比前几个轻

### 4. 测试质量

⚠️ **测试不是完全表面功夫，但对真正关键的联调问题覆盖不够。**

好的部分：

1. `api.test.mjs` 至少覆盖了主要路由的成功/失败分支
2. 路由层不是完全没测试，API handler 的基本行为有 mock 验证

主要缺口：

1. **测试没有覆盖真实 `Identity` 数据结构和前端表单之间的对接**
   - 这正是当前最严重的联调 bug，但在测试里完全没被发现

2. **测试没有覆盖 README 承诺的缺失接口**
   - 因为测试只验证了已经实现的端点，所以 `chat/history`、`system/logs` 缺失也没被发现

3. **测试没有证明浏览器页面真的能和后端跑通**
   - 现在没有任何测试验证：
     - 页面通过 HTTP 服务访问
     - 首屏加载 `/api/health` / `/api/status`
     - 身份页能正确渲染真实 `identity.json` shape
     - 发送消息后页面行为符合预期

4. **系统级集成测试没有更新到 T07**
   - [index.test.mjs](/home/user/Code/assistant-agent/muse/index.test.mjs#L13) 现在注释仍然写的是 `T01-T06`
   - 说明项目级集成测试尚未把 `Web` 纳入主链验证

5. **我无法在当前沙箱独立复跑 `api.test.mjs` 的监听测试**
   - 我尝试运行 `node --test muse/web/api.test.mjs`
   - 当前环境里本地端口监听被沙箱拦截，返回 `listen EPERM`
   - 所以我不能独立背书你说的 `13/13` 结果，但从代码静态审查已经能确认上面的联调缺口是真实存在的

建议：

1. 增加一个最小的前后端联调测试，至少验证 `GET /api/identity` 返回给页面后字段能正确渲染
2. 把 T07 加入系统级 `index.test.mjs`
3. 对 README 中承诺的每个 API 增加一一对应的测试用例，避免“文档写了但没实现”

### 5. 用户体验与产品符合度

⚠️ **视觉完成度不错，但“能打开页面”不等于“驾驶舱真的可用”。**

优点：

1. 单文件 HTML 的可交付性高
2. 界面结构清晰，5 个 tab 和 T07 文档的产品切面基本一致
3. 视觉上比普通后台更像“她的家”，方向是对的

但从产品真实性看，还有 3 个问题：

1. **访问方式没有被明确约束**
   - 如果用户直接打开 `muse/web/index.html`，相对路径 `fetch('/api/...')` 会失败
   - T07 既然是本地 HTTP cockpit，就应该明确“只能通过 `http://127.0.0.1:4097/` 访问”
   - 页面里也最好在 API 不通时给出明确提示，而不是只在日志里写 `Failed to fetch`

2. **系统页没有真实反映“启动链失败时的可诊断性”**
   - 当前 Web 只有在系统已经顺利启动后才会起来
   - 这会让“系统页”更像运行后的状态页，而不是驾驶舱

3. **当前整体更像 `Web 面板 v1`，还不是完整 `Web Cockpit`**
   - 这不是否定成果，而是要避免对完成度判断过高
   - 如果按 Phase 1 命名，这更接近：
     `本地 Web 面板 + 基础 API`
     而不是“已具备完整驾驶舱能力”

### 6. 与 T01-T07 及后续安排的拉通判断

⚠️ **整体路线没有偏，但需要从“模块完成”转向“集成与降级能力”优先。**

到 `T07` 为止，项目已经不是表面功夫：

1. `T01-T06` 的核心模块基本都是真实现，不是伪代码
2. `T07` 也不是纯静态页面，确实开始向完整产品壳层推进

但现在暴露出的阶段性问题也很明确：

1. **模块都在，但系统作为一个产品还不够稳定**
2. **接口 shape 对齐、启动降级、诊断入口可用性，正在成为比“再做新功能”更优先的工作**
3. **后续 T08/T09 的价值会明显上升**
   - T08 不能只做后台守护，更要考虑“部分模块失败时 Web 是否还能工作”
   - T09 不能只看单元测试，要重点做端到端联调和真实启动链验证

我的判断是：

1. 当前大方向仍然正确，没有明显偏离 Muse 路线
2. 但 `T07` 这一轮暴露出一个信号：
   - 后面的重点不应继续快速堆页面和新能力
   - 而应优先修“系统一体化”和“降级可用性”

### 7. 最终结论

总体评价：**需要修改后再算 T07 Phase 1 达标。**

不是说这次工作是假的，也不是说它只做了前端壳子。相反，API 和启动集成都已经开始了。但如果按 `Phase 1 T07 MVP 已完成` 来判断，我认为现在还差一截，原因主要是下面这 `5` 个点：

1. 前端身份页与 `Identity` 真实数据结构不兼容
2. README 承诺的 `chat/history`、`system/logs` API 未实现
3. 页面默认显示“系统就绪”，会误导用户
4. Web 启动被 `Engine + Telegram` 前置依赖绑死，不像真正驾驶舱
5. 测试没有覆盖最关键的真实联调场景

**必须优先修正：**

1. 修正前端身份页的数据 shape 和保存 patch
2. 补齐或下调 README 中对 API 的承诺
3. 修正页面首屏状态表达，明确未连接 / 加载中 / 已连接
4. 重新评估 `startAll()` 顺序和 Web 的启动策略
5. 增加至少一条真实的前后端联调测试

**可以后续阶段继续优化：**

1. 概览页最近对话
2. 日志查看能力
3. 更完整的系统诊断信息
4. Web 独立运行模式与更细的渠道开关
