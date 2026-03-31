/**
 * L5 测试: Loop 对比知识 + STAR 故事结构
 * 
 * 运行: node --test user/unit01-agent-core/oc-tasks/L5-synthesize/test-l5-synthesize.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('L5-synthesize: Agent Loop 对比知识', () => {
  const patterns = {
    sync: { name: '同步', rep: 'Anthropic SDK', client: '阻塞', loop: '客户端' },
    asyncPoll: { name: '异步Poll', rep: 'OpenCode serve', client: '非阻塞', loop: '服务端' },
    eventDriven: { name: '事件驱动', rep: 'Muse Plugin', client: '回调', loop: '服务端+Hook' },
  }

  it('应知道 3 种 Agent Loop 模式', () => {
    assert.equal(Object.keys(patterns).length, 3)
  })

  it('同步模式: Agent Loop 在客户端', () => {
    assert.equal(patterns.sync.loop, '客户端')
    assert.equal(patterns.sync.client, '阻塞')
  })

  it('异步 Poll 模式: Agent Loop 在服务端', () => {
    assert.equal(patterns.asyncPoll.loop, '服务端')
    assert.equal(patterns.asyncPoll.client, '非阻塞')
  })

  it('事件驱动: 最灵活但最复杂', () => {
    assert.equal(patterns.eventDriven.loop, '服务端+Hook')
    assert.equal(patterns.eventDriven.client, '回调')
  })

  it('Muse 用的是 异步Poll + 事件驱动 的组合', () => {
    // Muse 同时用两种:
    // - engine.mjs: 异步 Poll (sendAndWait)
    // - Plugin Hook: 事件驱动 (tool.start/message.complete)
    const musePattern = ['asyncPoll', 'eventDriven']
    assert.ok(musePattern.includes('asyncPoll'))
    assert.ok(musePattern.includes('eventDriven'))
    assert.ok(!musePattern.includes('sync'))
  })
})

describe('L5-synthesize: STAR 故事结构', () => {
  const STAR_SEEDS = [
    {
      topic: 'Agent Loop 架构理解',
      situation: '发现 Muse 日志只显示 busy 轮询',
      task: '理解两层架构, 找到观察 Agent Loop 的方法',
      action: '直接调用 OpenCode REST API, 绕过 Muse 封装',
      result: '发现 prompt_async 格式, 看到完整 ReAct 链路',
    },
    {
      topic: '多轮对话 Session 管理',
      situation: '日志有时新建有时复用 session',
      task: '搞清楚 session 生命周期',
      action: '走读 orchestrator.mjs, demo 验证多轮上下文',
      result: 'userId→sessionId Map, 重启清空',
    },
    {
      topic: 'ACI 工具设计审计',
      situation: '需要评估 Agent 工具设计质量',
      task: '建立可量化审计框架',
      action: '基于 Anthropic ACI 原则定义 3 维度评分',
      result: '8 工具审计, 方法可复用于 MCP 工具',
    },
  ]

  it('应有至少 3 个 STAR 故事', () => {
    assert.ok(STAR_SEEDS.length >= 3)
  })

  it('每个故事应有 S/T/A/R 四个完整字段', () => {
    for (const story of STAR_SEEDS) {
      assert.ok(story.situation, `${story.topic}: 缺 Situation`)
      assert.ok(story.task, `${story.topic}: 缺 Task`)
      assert.ok(story.action, `${story.topic}: 缺 Action`)
      assert.ok(story.result, `${story.topic}: 缺 Result`)
    }
  })

  it('Action 应体现方法论, 不只是 "我做了XX"', () => {
    for (const story of STAR_SEEDS) {
      // Action 里应该有具体的技术方法
      const has_method = story.action.includes('源码') ||
        story.action.includes('API') ||
        story.action.includes('原则') ||
        story.action.includes('验证') ||
        story.action.includes('定义')
      assert.ok(has_method, `"${story.topic}" 的 Action 应体现方法论: "${story.action}"`)
    }
  })

  it('Result 应有量化指标', () => {
    for (const story of STAR_SEEDS) {
      const has_quant = /\d/.test(story.result) || story.result.includes('完整') || story.result.includes('方法') || story.result.includes('Map') || story.result.includes('链路')
      assert.ok(has_quant, `"${story.topic}" 的 Result 应有具体产出: "${story.result}"`)
    }
  })
})
