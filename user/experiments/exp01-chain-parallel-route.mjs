/**
 * exp01 — 3 种基础编排模式 (链式 / 并行 / 路由)
 *
 * 巩固 Day 01 学习内容 (Anthropic BEA):
 * - Chain: 任务按顺序串联，每一步的输出是下一步的输入
 * - Parallel: 多个任务同时执行，最后合并结果
 * - Route: 根据输入特征分发到不同处理器
 *
 * 不依赖任何 LLM API，用纯 JS 模拟 Agent 调用以验证模式本身
 */

// ── 通用 Step 接口 ──

/**
 * 模拟一个 Agent Step（真实场景中是 LLM 调用）
 * @param {string} name 步骤名
 * @param {function} fn 处理函数 (input) => output
 * @returns {{ name, run }}
 */
function createStep(name, fn) {
  return {
    name,
    async run(input) {
      const t0 = Date.now()
      const result = await fn(input)
      return { step: name, result, elapsedMs: Date.now() - t0 }
    },
  }
}

// ── Pattern 1: Chain (链式) ──

/**
 * 链式执行：step1 → step2 → step3
 * 每一步的输出作为下一步的输入
 *
 * 对应 Muse 场景：planner → arch → coder → reviewer
 */
async function chain(steps, initialInput) {
  const trace = []
  let current = initialInput

  for (const step of steps) {
    const output = await step.run(current)
    trace.push(output)
    current = output.result
  }

  return { pattern: 'chain', finalResult: current, trace }
}

// ── Pattern 2: Parallel (并行) ──

/**
 * 并行执行：所有步骤同时跑，结果合并
 * aggregator 将多个结果聚合为一个
 *
 * 对应 Muse 场景：多个 reviewer 同时审查不同文件
 */
async function parallel(steps, input, aggregator) {
  const results = await Promise.all(steps.map((s) => s.run(input)))
  const aggregated = aggregator(results.map((r) => r.result))
  return { pattern: 'parallel', results, aggregated }
}

// ── Pattern 3: Route (路由) ──

/**
 * 路由分发：根据 classifier 的结果选择不同的处理器
 *
 * 对应 Muse 场景：Orchestrator 判断消息类型 → 分发到不同 Agent
 * (闲聊→pua, 代码→coder, 架构→arch)
 */
async function route(classifier, handlers, input) {
  const category = await classifier(input)
  const handler = handlers[category]
  if (!handler) {
    return { pattern: 'route', error: `unknown category: ${category}`, input }
  }
  const result = await handler.run(input)
  return { pattern: 'route', category, ...result }
}

// ── 导出 ──

export { createStep, chain, parallel, route }
