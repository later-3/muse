/**
 * exp05 — 最简状态机
 *
 * 巩固 Day 05: LangGraph 状态管理概念
 * - 状态 + 事件 → 新状态
 * - 支持 guard (条件转换)
 * - History 记录
 */

function createStateMachine(definition) {
  const { initial, states } = definition
  let current = initial
  const history = [{ state: initial, at: Date.now() }]

  return {
    get current() { return current },
    get history() { return [...history] },

    canTransition(event) {
      const transitions = states[current]?.on || {}
      return event in transitions
    },

    transition(event, context = {}) {
      const transitions = states[current]?.on || {}
      const target = transitions[event]
      if (!target) throw new Error(`No transition "${event}" from "${current}"`)

      // Guard check
      const def = typeof target === 'string' ? { target } : target
      if (def.guard && !def.guard(context)) {
        throw new Error(`Guard failed for "${event}" from "${current}"`)
      }

      const from = current
      current = def.target || target
      history.push({ from, event, to: current, context, at: Date.now() })

      // Run onEnter
      if (states[current]?.onEnter) states[current].onEnter(context)

      return { from, to: current, event }
    },

    getAvailableEvents() {
      return Object.keys(states[current]?.on || {})
    },

    toJSON() {
      return { current, history, availableEvents: this.getAvailableEvents() }
    },
  }
}

export { createStateMachine }
