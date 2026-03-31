/**
 * oc11 Demo: 面试 STAR 故事生成器
 *
 * Bloom L5 (综合): 把前面 oc01-10 学到的知识组装成面试可用的故事
 *
 * 学到什么:
 *   1. STAR 模型: Situation → Task → Action → Result
 *   2. 如何把技术实操转化为面试叙事
 *   3. 用 Agent 辅助生成高质量 STAR 故事
 *
 * 前置: opencode serve --port 5555 在 demo-workspace/ 下跑着
 */

import { createClient, extractReplyText } from '../L1-observe/opencode-client.mjs'

const client = createClient(process.env.OC_PORT || 5555)

// 基于 oc01-10 的实操经验，描述可用的 STAR 素材
const STAR_SEEDS = [
  {
    topic: 'Agent Loop 架构理解',
    situation: '我在学习 AI Agent 架构时，发现 Muse 引擎日志只显示 "busy" 轮询，看不到 Agent Loop 内部细节',
    task: '需要理解 Muse 的两层架构 (Muse → OpenCode)，并找到观察 Agent Loop 的方法',
    action: '直接调用 OpenCode REST API (创建 session → 发消息 → poll → 获取完整消息链)，绕过 Muse 封装层',
    result: '发现了 prompt_async 的正确参数格式 ({parts:[{type:"text"}]})，看到了完整的 ReAct 链路',
  },
  {
    topic: '多轮对话 Session 管理',
    situation: 'Muse 日志显示有时 "新建" 有时 "复用" session，需要理解 session 管理机制',
    task: '搞清楚 session 的完整生命周期和多轮对话的实现原理',
    action: '走读 orchestrator.mjs 源码，发现 #resolveSession 的分支逻辑；用 demo 验证同一 session 多次 prompt 能保留上下文',
    result: 'Telegram 适配器用 userId→sessionId 的内存 Map 实现多轮对话，重启后清空',
  },
  {
    topic: 'ACI 工具设计审计',
    situation: '需要评估 AI Agent 的工具设计质量，参考 Anthropic BEA 的 ACI 原则',
    task: '建立一个可量化的工具审计框架，评估 OpenCode 的 8 个内置工具',
    action: '定义 3 个评分维度 (名称直观性/参数最少化/描述清晰度)，编写自动化审计脚本',
    result: '大部分工具达到 A/B 级，审计方法可复用于 Muse MCP 工具的质量改进',
  },
]

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('   oc11: 面试 STAR 故事生成器')
  console.log('   Bloom L5: 综合实操经验, 生成面试叙事')
  console.log('═══════════════════════════════════════════════\n')

  // 先展示原始 STAR 素材
  console.log('📋 STAR 素材 (基于 oc01-10 实操):\n')

  for (let i = 0; i < STAR_SEEDS.length; i++) {
    const s = STAR_SEEDS[i]
    console.log(`  ─── Story ${i + 1}: ${s.topic} ───`)
    console.log(`  S: ${s.situation}`)
    console.log(`  T: ${s.task}`)
    console.log(`  A: ${s.action}`)
    console.log(`  R: ${s.result}`)
    console.log('')
  }

  // 用 AI 打磨第一个故事
  console.log('═══════════════════════════════════════════════')
  console.log('   🤖 用 Agent 打磨 STAR 故事')
  console.log('═══════════════════════════════════════════════\n')

  const seed = STAR_SEEDS[0]
  const prompt = `你是面试辅导教练。请把以下 STAR 素材优化成一个 2 分钟的面试回答，要求：
1. 用第一人称
2. 体现系统性思维
3. 突出"通过实验发现架构差异"的思考过程  
4. 结尾强调学到的可迁移技能

STAR 素材:
- Situation: ${seed.situation}
- Task: ${seed.task}  
- Action: ${seed.action}
- Result: ${seed.result}

请直接输出优化后的面试回答。`

  const session = await client.createSession()
  await client.sendMessage(session.id, prompt)
  console.log('⏳ AI 正在打磨故事...')
  await client.waitForCompletion(session.id)
  const msgs = await client.getMessages(session.id)
  const polished = extractReplyText(msgs)

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   📖 AI 优化后的面试回答')
  console.log('═══════════════════════════════════════════════')
  console.log(polished.slice(0, 800))
  if (polished.length > 800) console.log('   ...(截断)')

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('   💡 面试技巧')
  console.log('═══════════════════════════════════════════════')
  console.log('   1. STAR 里的 Action 要体现方法论, 不只是"我做了XX"')
  console.log('   2. Result 要量化: "8个工具审计" 比 "审计了工具" 更有力')
  console.log('   3. 每个故事可以对应不同面试问题:')
  console.log('      • "说说你的调试经验" → Story 1 (两层架构发现)')
  console.log('      • "如何学习新技术" → Story 2 (源码走读+实验)')
  console.log('      • "如何做技术方案" → Story 3 (ACI审计框架)')
  console.log('')
  console.log('✅ oc11 完成!')
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1) })
