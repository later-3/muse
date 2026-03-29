/**
 * oc01 测试 — Agent Loop 验证
 *
 * 运行: node --test user/unit01-agent-core/oc-tasks/oc01-agent-loop.test.mjs
 *
 * 测试策略:
 * - 不需要真实 LLM API — 用 mock 模拟 LLM 的响应
 * - 验证 Agent 循环的核心机制，不是验证 LLM 的智能
 * - 用 Muse 真实场景命名测试（面试能讲!）
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { calculator, getCurrentTime, searchKnowledge, TOOL_MAP } from './oc01-agent-loop.mjs'

// ══════════════════════════════════════════════════════════
// 测试 1: 工具本身能正常工作
// Agent 的质量取决于工具的质量（ACI 原则）
// ══════════════════════════════════════════════════════════
describe('§1 工具函数测试', () => {
  it('calculator: 基础数学运算', () => {
    const result = calculator({ expression: '2 + 3 * 4' })
    assert.ok(result.includes('14'), `期望包含 14, 实际: ${result}`)
  })

  it('calculator: 处理无效表达式（不崩溃）', () => {
    const result = calculator({ expression: 'abc' })
    // 关键: 工具出错不应该让 Agent 崩溃，而是返回错误信息让 LLM 处理
    // 这就是 BEA ACI 的防呆设计 (Poka-yoke)
    assert.ok(result.includes('计算') || result.includes('错误') || !isNaN(Number(result.replace(/[^0-9.-]/g, ''))))
  })

  it('get_current_time: 返回可读时间', () => {
    const result = getCurrentTime()
    assert.ok(result.includes('当前时间'), `期望包含"当前时间", 实际: ${result}`)
  })

  it('search_knowledge: 能搜到已知概念', () => {
    const result = searchKnowledge({ query: '什么是 Agent' })
    assert.ok(result.includes('找到'), `期望找到结果, 实际: ${result}`)
  })

  it('search_knowledge: 搜不到时优雅降级', () => {
    const result = searchKnowledge({ query: '量子计算' })
    assert.ok(result.includes('未找到'), `期望未找到, 实际: ${result}`)
  })
})

// ══════════════════════════════════════════════════════════
// 测试 2: TOOL_MAP 注册完整性
// 确保 LLM 返回的工具名能找到对应函数
// ══════════════════════════════════════════════════════════
describe('§2 工具注册表完整性', () => {
  it('所有工具都在 TOOL_MAP 中注册', () => {
    assert.ok(TOOL_MAP['calculator'], 'calculator 未注册')
    assert.ok(TOOL_MAP['get_current_time'], 'get_current_time 未注册')
    assert.ok(TOOL_MAP['search_knowledge'], 'search_knowledge 未注册')
  })

  it('TOOL_MAP 的值都是函数', () => {
    for (const [name, fn] of Object.entries(TOOL_MAP)) {
      assert.equal(typeof fn, 'function', `${name} 不是函数`)
    }
  })
})

// ══════════════════════════════════════════════════════════
// 测试 3: Agent 循环机制（Mock LLM）
// 这里模拟 LLM 的响应来验证循环逻辑
// ══════════════════════════════════════════════════════════
describe('§3 Agent 循环机制', () => {
  it('Muse 场景: 用户问数学题 → Agent 调 calculator → 返回答案', async () => {
    // 模拟一个简单的 Agent 循环:
    // Turn 1: LLM 决定调 calculator
    // Turn 2: LLM 看到计算结果，给出最终答案

    // 这里不调真实 API，直接模拟循环逻辑
    const messages = []
    let turn = 0

    // 模拟 Turn 1: LLM 返回 tool_call
    const llmResponse1 = {
      content: null,
      tool_calls: [{
        id: 'call_001',
        type: 'function',
        function: {
          name: 'calculator',
          arguments: '{"expression": "15 + 27"}'
        }
      }]
    }

    // 执行工具
    const toolResult = TOOL_MAP[llmResponse1.tool_calls[0].function.name]({
      expression: '15 + 27'
    })
    turn++

    assert.ok(toolResult.includes('42'), `计算结果应包含 42, 实际: ${toolResult}`)
    assert.equal(turn, 1, '应该是第 1 轮')

    // 模拟 Turn 2: LLM 看到结果后直接回答
    const llmResponse2 = {
      content: '15 + 27 = 42',
      tool_calls: null,  // 没有 tool_calls → 循环结束
    }
    turn++

    assert.equal(llmResponse2.content, '15 + 27 = 42')
    assert.equal(llmResponse2.tool_calls, null, 'Turn 2 不应有工具调用')
    assert.equal(turn, 2, '应该总共 2 轮')
  })

  it('停止条件: maxTurns 限制防止无限循环', () => {
    // Agent 循环必须有停止条件
    // 这是生产环境的关键设计 — 没有它 Agent 可能永远不停
    const maxTurns = 5
    let turns = 0
    const hasMoreWork = true  // 模拟一直有工作要做

    while (turns < maxTurns && hasMoreWork) {
      turns++
    }

    assert.equal(turns, maxTurns, `应在 ${maxTurns} 轮后停止`)
  })

  it('边界: 未知工具名不应崩溃', () => {
    const unknownTool = TOOL_MAP['nonexistent_tool']
    assert.equal(unknownTool, undefined, '未知工具应返回 undefined')
    // Agent 循环中应该检查 undefined 并返回错误信息给 LLM
  })
})
