/**
 * oc01 — 从零实现一个 Agent Loop (Reason → Action → Observe)
 *
 * 📖 对应 Unit 01: Agent 核心循环
 * 🎯 实战目标: 理解 Agent 的本质 — 就是一个 while 循环 + LLM 调用 + 工具执行
 * 📦 类型: A.理论实操
 *
 * 📌 核心概念:
 * - Agent Loop (Agent 循环): LLM 不断 思考→行动→观察 直到任务完成
 * - ReAct (Reason + Act): 先想清楚要做什么 (Thought)，再执行 (Action)，再看结果 (Observation)
 * - Tool Use (工具调用): LLM 不直接回答，而是调用工具获取信息
 * - Stop Condition (停止条件): Agent 判断任务完成，输出最终答案
 *
 * 📚 参考资源:
 * - [W5] Anthropic BEA: https://www.anthropic.com/engineering/building-effective-agents
 * - [P6] ReAct 论文: arxiv 2210.03629
 * - [G6] Swarm core.py: repos/swarm/swarm/core.py (run 方法就是这个循环)
 *
 * 🔧 运行方式:
 *   # 直接运行（会进入交互式对话）
 *   LLM_API_KEY=你的key node user/unit01-agent-core/oc-tasks/oc01-agent-loop.mjs
 *
 *   # 跑测试（不需要 API key，用 mock）
 *   node --test user/unit01-agent-core/oc-tasks/oc01-agent-loop.test.mjs
 *
 * 🏗️ Muse 映射:
 *   这个循环就是 Muse 每个 member (pua/arch/coder) 内部做的事。
 *   OpenCode 帮我们封装了这个循环，但底层原理就是这个。
 *
 * ──────────────────────────────────────────────────────────
 * 💡 Later 走读指南:
 *   1. 先看 §0 — 理解 Agent 循环的全貌（5 行伪代码）
 *   2. 看 §1 — 工具注册表，理解"LLM 怎么知道有什么工具"
 *   3. 看 §2 — callLLM，理解"LLM 怎么决定调工具还是直接回答"
 *   4. 看 §3 — agentLoop，这是核心！理解 while 循环的每一步
 *   5. 改参数玩 — 改 MAX_TURNS / 换工具 / 改 system prompt
 * ──────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════
// §0  Agent 循环全貌 — 5 行伪代码看懂 Agent 本质
// ══════════════════════════════════════════════════════════
//
//   while (true) {
//     response = LLM(messages)          // 1. 让 LLM 思考
//     if (response 没有 tool_calls)      // 2. LLM 没调工具？
//       return response.text            //    → 任务完成，返回最终答案
//     for (tool of response.tool_calls)  // 3. LLM 要调工具？
//       result = 执行工具(tool)          //    → 执行工具
//       messages.push(result)            //    → 把结果告诉 LLM
//   }                                   // 4. 回到 step 1，继续循环
//
// 就这么简单。Swarm 的 core.py 就是这个循环。
// Claude Code 也是这个循环。OpenCode 也是。
// ══════════════════════════════════════════════════════════

// ── §1  工具注册表 ──────────────────────────────────────
//
// Agent 的"能力"来自工具。没有工具的 Agent 就是普通聊天机器人。
// 工具定义遵循 Anthropic ACI 六原则 (01a §2.3):
//   1. 名字清晰 (calculator 而不是 tool1)
//   2. 参数要有描述
//   3. 返回值要有格式
//   4. 错误要有处理

/**
 * 工具 1: 计算器
 * LLM 不擅长数学运算，但擅长判断"什么时候该用计算器"
 * 
 * @param {{ expression: string }} args - 数学表达式，如 "2 + 3 * 4"
 * @returns {string} 计算结果
 */
function calculator({ expression }) {
  try {
    // ⚠️ 生产环境不要用 eval！这里只是教学演示
    // 真实场景用 mathjs 等安全库
    const result = Function(`"use strict"; return (${expression})`)()
    return `计算结果: ${expression} = ${result}`
  } catch (e) {
    return `计算错误: 表达式 "${expression}" 无法计算 — ${e.message}`
  }
}

/**
 * 工具 2: 获取当前时间
 * 演示一个无参数的简单工具
 * 
 * @returns {string} 当前时间
 */
function getCurrentTime() {
  return `当前时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
}

/**
 * 工具 3: 搜索知识库（模拟）
 * 演示一个需要字符串参数的工具
 * 真实场景中这会查向量数据库 (unit03 会深入)
 * 
 * @param {{ query: string }} args - 搜索关键词
 * @returns {string} 搜索结果
 */
function searchKnowledge({ query }) {
  // 模拟一个简单的知识库
  const kb = {
    'agent': 'Agent = LLM + 循环 + 工具。核心是 ReAct 循环 (Reason → Action → Observe)。',
    'muse': 'Muse 是 Later 的 AI 伙伴项目，基于 OpenCode 构建，支持多角色协作。',
    'react': 'ReAct (Reason + Act) 来自 2022 年论文 (arxiv 2210.03629)，让 LLM 交替思考和行动。',
    'prompteng': 'Prompt Engineering 是通过设计输入来控制 LLM 输出的技术。Agent Prompt 有 7 层结构。',
  }
  const key = Object.keys(kb).find(k => query.toLowerCase().includes(k))
  return key ? `找到相关信息: ${kb[key]}` : `未找到 "${query}" 的相关信息`
}

/**
 * 工具注册表 — 告诉 LLM "你有什么工具可以用"
 * 
 * 格式遵循 OpenAI Function Calling 标准 (也是 MCP 的基础)
 * Muse 的 MCP 工具注册也是这个原理，只是通过 MCP 协议暴露
 * 
 * 🔑 关键: LLM 看的是 description，不是代码！
 *    description 写得好 → LLM 知道什么时候调
 *    description 写得差 → LLM 不知道该不该调（BEA ACI 第一原则）
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: '计算数学表达式。当用户问到数学运算、百分比、统计时使用。',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '要计算的数学表达式，如 "2 + 3 * 4" 或 "100 * 0.15"'
          }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前中国时间。当用户问"现在几点"或需要时间信息时使用。',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '搜索知识库。当用户问关于 Agent、Muse、ReAct 等概念时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词'
          }
        },
        required: ['query']
      }
    }
  }
]

/**
 * 工具名 → 实际函数的映射
 * Agent 循环中，LLM 返回 tool_calls 里的 name，我们用这个 map 找到对应函数去执行
 */
const TOOL_MAP = {
  calculator,
  get_current_time: getCurrentTime,
  search_knowledge: searchKnowledge,
}


// ── §2  调用 LLM ──────────────────────────────────────
//
// 这里用 OpenAI 兼容 API（大多数国产模型都兼容这个格式）
// 你可以用: MiniMax / Qwen / DeepSeek / GLM-4 / Ollama 本地模型
// 只要支持 Function Calling 的模型都行

/**
 * 调用 LLM API
 * 
 * 🔑 关键参数:
 * - messages: 完整对话历史（含 system prompt + 用户消息 + 工具结果）
 * - tools: 工具定义列表（LLM 看这个决定要不要调工具）
 * - tool_choice: "auto" = LLM 自己决定调不调工具
 * 
 * @param {Array} messages - 对话历史
 * @param {Object} options - 可选配置
 * @returns {Object} LLM 的响应 { content, tool_calls }
 */
async function callLLM(messages, options = {}) {
  const {
    // 🔧 Later: 改这里换不同的模型试试
    baseURL = process.env.LLM_BASE_URL || 'https://api.minimax.chat/v1',
    apiKey  = process.env.LLM_API_KEY,
    model   = process.env.LLM_MODEL || 'MiniMax-Text-01',
  } = options

  if (!apiKey) {
    throw new Error(
      '❌ 需要设置 LLM_API_KEY 环境变量!\n' +
      '   MiniMax: LLM_API_KEY=你的key node oc01-agent-loop.mjs\n' +
      '   Qwen:    LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 LLM_API_KEY=你的key LLM_MODEL=qwen-plus node oc01-agent-loop.mjs'
    )
  }

  // 标准 OpenAI 兼容 API 调用
  // Anthropic/OpenAI/MiniMax/Qwen 都用这个格式
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',  // LLM 自己决定要不要调工具
      temperature: 0.3,     // 低温度 = 更确定性的回答（Agent 场景推荐）
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LLM API 错误 ${response.status}: ${text}`)
  }

  const data = await response.json()
  return data.choices[0].message
}


// ── §3  Agent 循环（核心！）──────────────────────────
//
// 这就是整个 oc01 的灵魂。
// 对应: Swarm core.py 的 run()  /  Claude Code 的主循环  /  ReAct 论文的算法
//
// 对照 §0 的伪代码，你会发现代码和伪代码一一对应。

/**
 * Agent 循环 — Reason → Action → Observe
 * 
 * 工作流程:
 *   1. 用户说话 → 加入 messages
 *   2. 调 LLM → LLM 思考后返回 { content, tool_calls }
 *   3. 如果有 tool_calls → 执行工具 → 把结果加入 messages → 回到 2
 *   4. 如果没有 tool_calls → LLM 的 content 就是最终答案 → 结束
 * 
 * @param {string} userMessage - 用户的输入
 * @param {Object} options - 配置项
 * @param {string} options.systemPrompt - Agent 的身份定义
 * @param {number} options.maxTurns - 最大循环次数（防止无限循环）
 * @param {boolean} options.verbose - 是否打印中间过程
 * @returns {{ answer: string, turns: number, toolCalls: Array }}
 */
async function agentLoop(userMessage, options = {}) {
  const {
    systemPrompt = '你是一个有用的助手。你可以使用工具来帮助用户。回答要简洁。',
    maxTurns = 10,   // 🔧 Later: 改小看看 Agent 会不会被截断
    verbose = true,
    llmOptions = {},
  } = options

  // ── Step 0: 初始化对话历史 ──
  // messages 数组就是 Agent 的"短期记忆"
  // 和 Muse 的 OpenCode session 里的 messages 一样的概念
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  const allToolCalls = []  // 记录所有工具调用（用于分析）
  let turns = 0

  // ══════════════════════════════════════
  // ██  核心循环开始  ██
  // 对应伪代码的 while (true)
  // ══════════════════════════════════════
  while (turns < maxTurns) {
    turns++
    if (verbose) console.log(`\n🔄 Turn ${turns}/${maxTurns}`)

    // ── Step 1: Reason — 让 LLM 思考 ──
    // LLM 看到完整的 messages（包括之前工具的结果）后做出判断:
    //   - 要调工具？→ 返回 tool_calls
    //   - 能直接回答？→ 返回 content
    const response = await callLLM(messages, llmOptions)

    // ── Step 2: 判断 — 有没有工具调用？ ──
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // ── 没有工具调用 → 任务完成！ ──
      // LLM 认为已经有足够信息直接回答了
      if (verbose) console.log(`✅ Agent 完成! 答案: ${response.content}`)

      return {
        answer: response.content,
        turns,
        toolCalls: allToolCalls,
      }
    }

    // ── Step 3: Action — 执行工具 ──
    // 先把 LLM 的响应（含 tool_calls）加入历史
    messages.push(response)

    for (const toolCall of response.tool_calls) {
      const fnName = toolCall.function.name
      const fnArgs = JSON.parse(toolCall.function.arguments || '{}')

      if (verbose) console.log(`  🔧 调用工具: ${fnName}(${JSON.stringify(fnArgs)})`)

      // 找到对应的工具函数并执行
      const fn = TOOL_MAP[fnName]
      let result
      if (fn) {
        result = fn(fnArgs)
      } else {
        result = `错误: 未知工具 "${fnName}"`
      }

      if (verbose) console.log(`  📋 工具结果: ${result}`)

      // ── Step 4: Observe — 把工具结果告诉 LLM ──
      // role: "tool" 告诉 LLM "这是工具返回的结果，不是用户说的"
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: String(result),
      })

      allToolCalls.push({ name: fnName, args: fnArgs, result })
    }

    // 回到 while 循环顶部 → LLM 会看到工具结果 → 决定下一步
    // 这就是 ReAct 的 Observe → 回到 Reason
  }

  // 超过 maxTurns → 强制停止（防止无限循环）
  return {
    answer: `[Agent 超过最大轮次 ${maxTurns}，强制停止]`,
    turns,
    toolCalls: allToolCalls,
  }
}


// ── §4  导出（给测试用）──────────────────────────────

export {
  agentLoop,
  callLLM,
  calculator,
  getCurrentTime,
  searchKnowledge,
  TOOLS,
  TOOL_MAP,
}


// ── §5  交互式运行（直接 node 运行时启动）──────────────

// 只在直接运行时执行，import 时不执行
const isMainModule = process.argv[1]?.endsWith('oc01-agent-loop.mjs')

if (isMainModule) {
  console.log('═══════════════════════════════════════')
  console.log('  oc01: Agent Loop 演示')
  console.log('  输入问题，Agent 会自动决定用不用工具')
  console.log('═══════════════════════════════════════')

  // 演示几个场景
  const demos = [
    '帮我算一下 (15 + 27) * 3 等于多少',
    '什么是 Agent？',
    '现在几点了？然后帮我算一下距离晚上 10 点还有几小时',
  ]

  for (const q of demos) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`👤 用户: ${q}`)
    try {
      const result = await agentLoop(q)
      console.log(`\n📊 总结: ${result.turns} 轮, ${result.toolCalls.length} 次工具调用`)
    } catch (e) {
      console.error(`❌ 错误: ${e.message}`)
      break
    }
  }
}
