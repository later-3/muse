/**
 * exp07 — Prompt 分层注入
 *
 * 巩固 Day 07: Prompt 工程 7 层结构
 * - Layer 1: System (角色定义)
 * - Layer 2: Identity (人格/性格)
 * - Layer 3: Memory (用户画像/记忆)
 * - Layer 4: Context (当前上下文)
 * - Layer 5: Task (具体任务)
 * - Layer 6: Constraints (约束/禁止)
 * - Layer 7: Output Format (输出格式)
 */

function createPromptBuilder() {
  const layers = new Map()
  const order = ['system', 'identity', 'memory', 'context', 'task', 'constraints', 'format']

  return {
    set(layer, content) {
      if (!order.includes(layer)) throw new Error(`Unknown layer: ${layer}`)
      layers.set(layer, content)
      return this
    },

    remove(layer) {
      layers.delete(layer)
      return this
    },

    build() {
      const parts = []
      for (const name of order) {
        if (layers.has(name)) {
          parts.push(`[${name.toUpperCase()}]\n${layers.get(name)}`)
        }
      }
      return parts.join('\n\n')
    },

    getLayers() {
      return order.filter(l => layers.has(l))
    },

    getTokenEstimate() {
      // 粗估：1 token ≈ 4 chars (中英混合)
      const text = this.build()
      return Math.ceil(text.length / 4)
    },
  }
}

export { createPromptBuilder }
