/**
 * oc03 — event hook 观察 Agent Loop 轮次
 *
 * 📖 对应 Unit 01: Agent 核心循环
 * 🎯 USOLB: [O] 观察 hook  [L] 日志
 * 🎯 Bloom Level: 1 — 观察
 * 🎯 目标: 增强 event-logger，每轮打印 Turn N → LLM 想了什么 → 调了什么工具 → 结果
 *
 * 📌 对应理论:
 * - 01e §1.2 ReAct 循环: Thought → Action → Observation
 * - 01a §一 核心循环: while(true) { LLM想 → 有工具？执行 → 没有？完成 }
 *
 * 📚 涉及源码:
 * - src/plugin/hooks/event-logger.mjs — 当前的事件日志 hook
 * - src/plugin/index.mjs — hook 注册入口
 *
 * 🔧 使用方式:
 *   1. 把这个文件复制到 src/plugin/hooks/ 目录
 *   2. 在 src/plugin/index.mjs 里注册这个 hook
 *   3. 启动 Muse，发消息，观察终端输出
 *
 * 💡 Later 走读指南:
 *   1. 先看现有的 event-logger.mjs 怎么写的
 *   2. 看这个增强版加了什么
 *   3. 理解每个 hook 事件对应 ReAct 的哪个阶段
 *   4. 部署上去，发消息，看输出
 */

// ─── 这是一个增强版 event-logger ───────────────────
// 目标: 把 OpenCode 的事件翻译成 ReAct 的语言
//
// OpenCode 事件              →  ReAct 阶段
// ─────────────────────────────────────────
// session.created           →  Agent Loop 启动
// chat.message.before       →  Reason (LLM 开始思考)
// chat.message.after        →  Reason 完成
// tool.execute.before       →  Action (开始执行工具)
// tool.execute.after        →  Observation (工具返回结果)
// session.completed         →  Agent Loop 结束

/**
 * 增强版 Agent Loop 观察器
 *
 * @param {Object} hooks - OpenCode plugin hook 注册器
 */
export function registerLoopObserver(hooks) {
  let turnCount = 0
  let sessionId = null

  // ── Agent Loop 启动 ──
  hooks.on('session.created', (event) => {
    sessionId = event.sessionId
    turnCount = 0
    console.log('\n╔═══════════════════════════════════════════╗')
    console.log('║  🔄 Agent Loop 启动                        ║')
    console.log(`║  Session: ${sessionId?.slice(0, 8) || 'unknown'}...  ║`)
    console.log('╚═══════════════════════════════════════════╝')
  })

  // ── Reason: LLM 开始思考 ──
  hooks.on('chat.message.before', (event) => {
    turnCount++
    console.log(`\n── Turn ${turnCount} ─────────────────────`)
    console.log(`  🧠 Reason: LLM 开始思考...`)
    // Later: 这里可以打印 messages 数量看上下文长度
    // console.log(`     消息数: ${event.messages?.length}`)
  })

  // ── Reason 完成: 看 LLM 返回了什么 ──
  hooks.on('chat.message.after', (event) => {
    const msg = event.message
    if (msg?.tool_calls?.length > 0) {
      console.log(`  🧠 Reason 结果: 要调 ${msg.tool_calls.length} 个工具`)
      for (const tc of msg.tool_calls) {
        console.log(`     → ${tc.function?.name}(${tc.function?.arguments?.slice(0, 50)}...)`)
      }
    } else {
      console.log(`  🧠 Reason 结果: 直接回答 (不调工具)`)
      console.log(`     → "${msg?.content?.slice(0, 80)}..."`)
    }
  })

  // ── Action: 工具执行 ──
  hooks.on('tool.execute.before', (event) => {
    console.log(`  ⚡ Action: 执行工具 ${event.toolName}`)
  })

  // ── Observation: 工具返回 ──
  hooks.on('tool.execute.after', (event) => {
    const resultPreview = String(event.result || '').slice(0, 100)
    console.log(`  👁️ Observe: ${event.toolName} 返回`)
    console.log(`     → "${resultPreview}..."`)
    console.log(`     耗时: ${event.duration || '?'}ms`)
  })

  // ── Agent Loop 结束 ──
  hooks.on('session.completed', (event) => {
    console.log(`\n╔═══════════════════════════════════════════╗`)
    console.log(`║  ✅ Agent Loop 结束                         ║`)
    console.log(`║  总轮次: ${turnCount}                              ║`)
    console.log(`╚═══════════════════════════════════════════╝`)
  })
}

// ─── 注册说明 ──────────────────────────────────
// 在 src/plugin/index.mjs 里加:
//
//   import { registerLoopObserver } from './hooks/oc03-loop-observer.mjs'
//   registerLoopObserver(hooks)
//
// 然后启动 Muse，发消息，终端就会打印 Agent Loop 的每一轮。
// ────────────────────────────────────────────────
