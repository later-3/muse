/**
 * exp04 — JS 版迷你 Swarm (Agent Handoff)
 *
 * 巩固 Day 04: Swarm 源码核心概念
 * - Agent = { name, instructions, functions, handoffs }
 * - run() 循环：LLM 调用 → 检查函数/handoff → 执行 → 下一轮
 * - Handoff = 把控制权交给另一个 Agent
 */

function createAgent(name, { instructions = '', handler, handoffs = [] } = {}) {
  return { name, instructions, handler, handoffs }
}

async function run(agent, message, { maxTurns = 10, context = {} } = {}) {
  const history = []
  let current = agent
  let input = message
  let turn = 0

  while (turn < maxTurns) {
    turn++
    const result = await current.handler(input, context)
    history.push({ turn, agent: current.name, input, result })

    if (result.handoff) {
      const target = current.handoffs.find(h => h.name === result.handoff)
      if (!target) {
        history.push({ turn, error: `handoff target "${result.handoff}" not found` })
        break
      }
      current = target
      input = result.message || input
      continue
    }

    if (result.done !== false) break
    input = result.message || input
  }

  return { agent: current.name, turns: turn, history, lastResult: history[history.length - 1]?.result }
}

export { createAgent, run }
