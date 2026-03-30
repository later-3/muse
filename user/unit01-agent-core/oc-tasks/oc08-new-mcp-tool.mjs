/**
 * oc08 — 写一个新 MCP 工具: study_quiz
 *
 * 📖 USOLB: [B] 编译修改  [U] 使用
 * 🎯 Bloom Level: 4 — 创造
 * 🎯 对应理论: 01a §2.3 Augmented LLM + §2.6 ACI
 * 🎯 目标: 给 Muse 加一个 study_quiz 工具，pua 能调用它从 study docs 出题
 *
 * 📚 参照:
 * - src/mcp/dev-tools.mjs — 现有工具的写法
 * - src/mcp/planner-tools.mjs — 工具注册模式
 *
 * 🔧 使用方式:
 *   1. 完善下面的代码
 *   2. 在 MCP server 里注册这个工具
 *   3. 启动 Muse，让 pua 调用 study_quiz
 *   4. 验证: 问 pua "考考我 Agent 核心循环的知识"
 *
 * 💡 Later 走读指南:
 *   1. 先看 dev-tools.mjs 怎么定义工具的（结构）
 *   2. 看这个文件的工具定义（模仿）
 *   3. 理解 ACI 六原则在这里怎么体现的
 *   4. 注册 → 启动 → 测试
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ── 工具定义 (ACI 合规) ──────────────────────────
//
// ACI 原则落地:
//   原则1 名字清晰: study_quiz — 一看就知道是学习出题
//   原则2 描述准确: 告诉 LLM 什么时候该调
//   原则3 参数约束: unit 用 enum 限制可选值
//   原则4 返回可预测: JSON 格式 { question, options, answer, source }
//   原则5 错误可恢复: 找不到文件返回明确错误
//   原则6 防呆: unit 参数有默认值

export const studyQuizTool = {
  name: 'study_quiz',
  description: '从学习文档中随机出一道知识题。当用户说"考考我"、"出题"、"测试"时使用。',
  inputSchema: {
    type: 'object',
    properties: {
      unit: {
        type: 'string',
        enum: ['unit01', 'unit02', 'unit03', 'unit04'],
        description: '从哪个 unit 出题。默认 unit01。',
      },
      difficulty: {
        type: 'string',
        enum: ['basic', 'advanced'],
        description: 'basic=概念题, advanced=设计题',
      }
    }
  }
}

/**
 * study_quiz 工具实现
 *
 * @param {{ unit?: string, difficulty?: string }} args
 * @returns {{ question: string, options?: string[], answer: string, source: string }}
 */
export async function handleStudyQuiz(args = {}) {
  const { unit = 'unit01', difficulty = 'basic' } = args

  // Later: 这里是简化版，从 study 文档的面试题章节提取
  // 生产版可以用 LLM 动态生成题目
  const quizBank = {
    'unit01': {
      basic: [
        {
          question: 'Agent 和 Workflow 的本质区别是什么？',
          answer: '谁决定下一步: Workflow = 代码决定(预定义路径), Agent = LLM 动态决定',
          source: '01a §2.1'
        },
        {
          question: 'ReAct 循环的三个阶段是什么？',
          answer: 'Thought(推理) → Action(执行工具) → Observation(观察结果)，交替循环',
          source: '01e §1.2'
        },
        {
          question: 'ACI 的全称是什么？它解决什么问题？',
          answer: 'Agent-Computer Interface。解决工具设计问题——让 LLM 知道什么时候该调什么工具',
          source: '01a §2.6'
        },
      ],
      advanced: [
        {
          question: 'Muse 的编排模式属于 BEA 五种模式中的哪种？为什么？',
          answer: 'Orchestrator-Workers。planner 是 orchestrator，arch/coder/reviewer 是 workers。planner 动态拆解任务分派。',
          source: '01a §2.4 + src/core/orchestrator.mjs'
        },
      ]
    },
    // Later: 做到 unit02-04 时补充这里的题库
    'unit02': { basic: [], advanced: [] },
    'unit03': { basic: [], advanced: [] },
    'unit04': { basic: [], advanced: [] },
  }

  const bank = quizBank[unit]?.[difficulty]
  if (!bank || bank.length === 0) {
    return { error: `${unit} 的 ${difficulty} 题库暂时为空，请先完成对应 study 文档` }
  }

  const quiz = bank[Math.floor(Math.random() * bank.length)]
  return {
    question: quiz.question,
    answer: quiz.answer,
    source: quiz.source,
    hint: '先自己想 30 秒，再看答案！'
  }
}

// ── 注册说明 ──────────────────────────
// 在 MCP server 注册时 (参照 dev-tools.mjs):
//
//   server.tool(studyQuizTool.name, studyQuizTool.description,
//     studyQuizTool.inputSchema, async (args) => {
//       const result = await handleStudyQuiz(args)
//       return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
//     }
//   )
