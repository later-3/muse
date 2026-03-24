/**
 * T11: Memory MCP Server
 *
 * MCP stdio server exposing Muse's Memory as tools:
 *   search_memory, set_memory, get_user_profile, get_recent_episodes, add_episode
 *   create_goal, list_goals, update_goal, create_thread, list_threads, get_thread
 *   start_dev_task, dev_status, approve_dev, reject_dev
 *   send_photo, send_message
 *
 * Usage: opencode.json → mcp.memory-server → node mcp/memory.mjs
 * Env:   MEMORY_DB_PATH, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

// Load .env from muse/ directory (MCP process is spawned by OpenCode, not Muse)
import { config as loadEnv } from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '..', '.env') })

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Memory } from '../core/memory.mjs'
import { Goals } from '../core/goals.mjs'
import { Threads } from '../core/threads.mjs'
import { DevStore } from '../dev/store.mjs'
import { DEV_TOOLS, handleStartDevTask, handleDevStatus, handleApproveDev, handleRejectDev } from './dev-tools.mjs'
import { PLANNER_TOOLS, handleWorkflowCreate, handleWorkflowAdminTransition, handleWorkflowInspect, handleWorkflowRollback, handleHandoffToMember, handleReadArtifact } from './planner-tools.mjs'

// --- Config ---

const DB_PATH = process.env.MEMORY_DB_PATH || './data/memory.db'
const AGENT_ID = process.env.AGENT_ID || 'muse'
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'search_memory',
    description: '搜索用户相关的记忆。当需要回忆用户偏好、习惯、个人信息、目标或历史事件时调用。\nscope 缩小范围: identity(身份), preference(偏好), goal(目标), general(其他)。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        type: { type: 'string', enum: ['semantic', 'episodic', 'all'], default: 'all', description: '搜索范围' },
        scope: { type: 'string', enum: ['identity', 'preference', 'goal', 'general', 'all'], default: 'all', description: '语义分类过滤' },
        limit: { type: 'number', default: 10, description: '返回数量上限' },
      },
      required: ['query'],
    },
  },
  {
    name: 'set_memory',
    description: '存储用户的新信息。当用户明确告知偏好/习惯/个人信息时主动调用。\nsource: user_stated(用户说的,高置信), ai_inferred(AI推断,中置信), ai_observed(行为观察,需验证)。\n注意: ai_inferred 不能覆盖 user_stated，ai_observed 只能追加低置信值。',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '记忆标识 (如 user_name, fav_language)' },
        value: { type: 'string', description: '记忆内容' },
        category: { type: 'string', enum: ['identity', 'preference', 'goal', 'general'], default: 'general', description: '分类' },
        source: { type: 'string', enum: ['user_stated', 'ai_inferred', 'ai_observed'], default: 'user_stated', description: '来源' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'], default: 'high', description: '置信度' },
        tags: { type: 'array', items: { type: 'string' }, default: [], description: '标签' },
        meta: { type: 'object', default: {}, description: '扩展元数据 (预留 goal/thread/artifact)' },
        writer: { type: 'string', enum: ['main_session', 'hook', 'subagent', 'background', 'family_agent'], default: 'main_session', description: '写入者' },
        session_id: { type: 'string', description: '关联的 session ID' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'get_user_profile',
    description: '获取用户的完整画像，按层次结构组织。在对话开始或需要全面了解用户时调用。返回结构化视图: identity(身份), preferences(偏好), goals(目标), current_focus(近期关注)。',
    inputSchema: {
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'string' }, description: '指定返回的部分 (identity/preferences/goals/current_focus)' },
      },
    },
  },
  {
    name: 'get_recent_episodes',
    description: '获取最近的对话摘要。在需要回顾历史对话、了解之前聊过什么时调用。scope 可按 meta.related_goal 过滤。',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 3, description: '最近几天 (默认 3)' },
        scope: { type: 'string', description: '过滤条件: goal key 或 thread id (匹配 meta.related_goal / meta.related_thread)' },
      },
    },
  },
  {
    name: 'add_episode',
    description: '记录本次对话的关键信息。每次有意义的对话结束时调用。通过 meta 关联到长期目标或生活线索。',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '摘要内容' },
        tags: { type: 'array', items: { type: 'string' }, default: [], description: '标签' },
        meta: { type: 'object', default: {}, description: '扩展: { related_goal, related_thread, artifact_refs }' },
        session_id: { type: 'string', description: '关联的 session ID (不传则自动生成)' },
        writer: { type: 'string', enum: ['main_session', 'hook', 'subagent', 'background', 'family_agent'], default: 'main_session', description: '写入者' },
      },
      required: ['summary'],
    },
  },
]

// T35: Goal MCP Tools (Agent-First core interface)
const GOAL_TOOLS = [
  {
    name: 'create_goal',
    description: '为用户创建一个目标。当用户表达想做某事时主动调用。\n例如: "我想学 Rust" → create_goal({ title: "学会 Rust" })',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: '目标标题' },
        description: { type: 'string', description: '详细描述' },
        deadline:    { type: 'string', description: 'ISO 日期，如 2026-06-01' },
        category:    { type: 'string', description: 'personal/work/health/learning', default: 'personal' },
        source:      { type: 'string', default: 'user', description: '来源: user/ai_suggested/agent:xxx' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_goals',
    description: '查看用户的目标列表。需要了解用户目标时调用。\n可按 status 或 category 过滤。',
    inputSchema: {
      type: 'object',
      properties: {
        status:   { type: 'string', description: '按状态过滤 (active/achieved/abandoned/paused)' },
        category: { type: 'string', description: '按分类过滤' },
      },
    },
  },
  {
    name: 'update_goal',
    description: '更新目标的进度或状态。用户报告进展、完成、放弃时调用。\n进度 0-100；状态: active/achieved/abandoned/paused。',
    inputSchema: {
      type: 'object',
      properties: {
        id:       { type: 'string', description: '目标 ID' },
        progress: { type: 'number', description: '进度 0-100' },
        status:   { type: 'string', description: '新状态 (active/achieved/abandoned/paused)' },
        note:     { type: 'string', description: '进展备注' },
      },
      required: ['id'],
    },
  },
]

// T36: Thread MCP Tools (Agent-First: AI queries AND creates topic threads)
const THREAD_TOOLS = [
  {
    name: 'create_thread',
    description: '创建一条新的生活主题线。当 AI 发现用户反复谈论某个话题但还没有对应 Thread 时主动创建。\nThreadWeaver 也会批量自动创建，但 AI 可以更及时地主动建线。',
    inputSchema: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: '主题名称 (简短描述性)' },
        category: { type: 'string', description: '分类: health/work/learning/travel/personal/general' },
        summary:  { type: 'string', description: '可选主题摘要' },
        goalId:   { type: 'string', description: '可选关联 Goal ID' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_threads',
    description: '列出用户的生活主题线。了解用户近期关注或回顾历史时调用。\n可按 category 过滤 (health/work/learning/travel/personal)。',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '按分类过滤' },
        limit:    { type: 'number', default: 20, description: '最多返回条数' },
      },
    },
  },
  {
    name: 'get_thread',
    description: '获取一条主题线的详情和关联对话。深入了解某个话题的演变时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '主题线 ID' },
      },
      required: ['id'],
    },
  },
]

// Telegram Action Tools — 让 AI 能主动给用户发消息/图片
const TELEGRAM_TOOLS = [
  {
    name: 'send_photo',
    description: '发送图片给用户 (Later)。当你生成了图片、找到了有趣的图、或用户要求发图时调用。\nphoto_url 可以是网络 URL 或 Telegram file_id。如果是本地文件路径，请先确认文件存在。',
    inputSchema: {
      type: 'object',
      properties: {
        photo_url: { type: 'string', description: '图片 URL 或 file_id' },
        caption: { type: 'string', description: '图片说明文字 (可选)' },
        chat_id: { type: 'string', description: '目标 chat ID (不传则使用默认 TELEGRAM_CHAT_ID)' },
      },
      required: ['photo_url'],
    },
  },
  {
    name: 'send_message',
    description: '主动给用户 (Later) 发送一条 Telegram 消息。当你需要在正常回复之外额外发送通知、提醒时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '消息文字' },
        chat_id: { type: 'string', description: '目标 chat ID (不传则使用默认 TELEGRAM_CHAT_ID)' },
      },
      required: ['text'],
    },
  },
]

// Image Tools — 文生图 + 图片搜索
const IMAGE_TOOLS = [
  {
    name: 'generate_image',
    description: '根据文字描述生成图片 (文生图/Text-to-Image)。用 AI 凭空生成一张全新图片。\\n返回图片 URL，可以直接用 send_photo 发给用户。\\nprompt 用英文描述效果更好。生成需要 5-15 秒。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述 (英文效果更好，如: a cute anime girl with purple hair)' },
        width: { type: 'number', default: 1024, description: '图片宽度 (默认 1024)' },
        height: { type: 'number', default: 1024, description: '图片高度 (默认 1024)' },
        model: { type: 'string', default: 'flux', description: '模型: flux (高质量) 或 turbo (更快)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'search_image',
    description: '搜索已有的真实图片 (图片搜索)。从免费图库搜索高清照片。\\n返回图片 URL 列表，可以用 send_photo 发给用户。\\n适合找风景、动物、食物、人物等真实场景照片。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词 (英文效果更好)' },
        count: { type: 'number', default: 3, description: '返回数量 (默认 3，最多 5)' },
      },
      required: ['query'],
    },
  },
]

// --- Tool Handlers ---

/** Pending keys (ai_observed staging) should not appear as confirmed facts */
function isPendingKey(key) {
  return key.endsWith('__pending')
}

function handleSearchMemory(memory, args) {
  const { query, type = 'all', scope = 'all', limit = 10 } = args

  const results = { semantic: [], episodic: [] }

  // Semantic search — exclude __pending keys by default
  if (type === 'semantic' || type === 'all') {
    let hits = memory.searchMemories(query)
      .filter(h => !isPendingKey(h.key))
    if (scope !== 'all') {
      hits = hits.filter(h => h.category === scope)
    }
    results.semantic = hits.slice(0, limit).map(h => ({
      key: h.key,
      value: h.value,
      category: h.category,
      source: h.source,
      confidence: h.confidence || 'medium',
      tags: safeParseJson(h.tags, []),
      updated_at: h.updated_at,
    }))
  }

  // Episodic search
  if (type === 'episodic' || type === 'all') {
    const hits = memory.searchEpisodes(query, limit)
    results.episodic = hits.map(h => ({
      id: h.id,
      role: h.role,
      content: h.content?.slice(0, 200),
      summary: h.summary,
      created_at: h.created_at,
    }))
  }

  const total = results.semantic.length + results.episodic.length
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ total, ...results }, null, 2),
    }],
  }
}

function handleSetMemory(memory, args) {
  const { key, value, category, source, confidence, tags, meta, writer, session_id } = args

  if (!key || !value) {
    return errorResult('key and value are required')
  }

  const result = memory.setMemory(key, value, {
    category: category || 'general',
    source: source || 'user_stated',
    confidence: confidence || 'high',
    tags: tags || [],
    meta: meta || {},
    writer: writer || 'main_session',
    session_id: session_id || null,
  })

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  }
}

function handleGetUserProfile(memory, args, { threads, goals: goalsModule } = {}) {
  const sections = args.sections || ['identity', 'preferences', 'goals', 'structured_goals', 'current_focus', 'important_threads']
  // Exclude __pending keys from profile — they are unconfirmed observations
  const all = memory.listMemories().filter(m => !isPendingKey(m.key))

  const profile = {
    identity: {},
    preferences: {},
    goals: [],
    current_focus: [],
    important_threads: [],
    structured_goals: [],
  }

  // Build from semantic memories
  for (const m of all) {
    const entry = {
      value: m.value,
      source: m.source,
      confidence: m.confidence || 'medium',
      updated_at: m.updated_at,
    }

    // Aggregation: confidence=low doesn't enter identity/preferences
    const isLowConfidence = (m.confidence || 'medium') === 'low'

    if (m.category === 'identity' && !isLowConfidence) {
      if (sections.includes('identity')) {
        // Conflict: user_stated > ai_inferred > ai_observed
        const existing = profile.identity[m.key]
        if (!existing || sourcePriority(m.source) >= sourcePriority(existing.source)) {
          profile.identity[m.key] = entry
        }
      }
    } else if (m.category === 'preference' && !isLowConfidence) {
      if (sections.includes('preferences')) {
        const existing = profile.preferences[m.key]
        if (!existing || sourcePriority(m.source) >= sourcePriority(existing.source)) {
          profile.preferences[m.key] = entry
        }
      }
    } else if (m.category === 'goal') {
      if (sections.includes('goals')) {
        profile.goals.push({ key: m.key, value: m.value, source: m.source, updated_at: m.updated_at })
      }
    }
  }

  // current_focus: recent 7-day high-frequency tags
  if (sections.includes('current_focus')) {
    try {
      const recent = memory.getRecentEpisodes(7)
      const tagCount = {}
      for (const ep of recent) {
        const tags = safeParseJson(ep.tags, [])
        for (const t of tags) {
          tagCount[t] = (tagCount[t] || 0) + 1
        }
      }
      profile.current_focus = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }))
    } catch {
      // If episodes unavailable, empty focus
    }
  }

  // T35: structured_goals — from goals.mjs (independent table, not semantic memory)
  if (sections.includes('structured_goals') && goalsModule) {
    try {
      const active = goalsModule.getActive()
      const overdue = goalsModule.getOverdue()
      profile.structured_goals = active.map(g => ({
        id: g.id,
        title: g.title,
        status: g.status,
        progress: g.progress,
        category: g.category,
        deadline: g.deadline || null,
        is_overdue: overdue.some(o => o.id === g.id),
      }))
    } catch {
      // Goals unavailable, keep empty
    }
  }

  // T36: important_threads — active life threads for holistic user understanding
  if (sections.includes('important_threads') && threads) {
    try {
      const activeThreads = threads.list({ limit: 10 })
      profile.important_threads = activeThreads.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        episode_count: t.episode_count,
        summary: t.summary || null,
        last_activity: t.last_episode_at || t.updated_at,
      }))
    } catch {
      // Threads unavailable, keep empty
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(profile, null, 2),
    }],
  }
}

function handleGetRecentEpisodes(memory, args) {
  const days = args.days || 3
  const scope = args.scope || null
  let episodes = memory.getRecentEpisodes(days)

  // scope filter: match meta.related_goal or meta.related_thread
  if (scope) {
    episodes = episodes.filter(ep => {
      const meta = safeParseJson(ep.meta, {})
      return meta.related_goal === scope || meta.related_thread === scope
    })
  }

  const formatted = episodes.map(ep => ({
    id: ep.id,
    session_id: ep.session_id,
    role: ep.role,
    summary: ep.summary,
    content_preview: ep.content?.slice(0, 150),
    tags: safeParseJson(ep.tags, []),
    meta: safeParseJson(ep.meta, {}),
    writer: ep.writer || 'main_session',
    created_at: ep.created_at,
  }))

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ count: formatted.length, episodes: formatted }, null, 2),
    }],
  }
}

function handleAddEpisode(memory, args) {
  const { summary, tags, meta, session_id, writer } = args

  if (!summary) {
    return errorResult('summary is required')
  }

  const sessionId = session_id || `mcp-${Date.now()}`
  const actualWriter = writer || 'main_session'
  const id = memory.addEpisode(sessionId, 'assistant', summary, {
    summary,
    tags: tags || [],
    meta: meta || {},
    writer: actualWriter,
  })

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ episode_id: Number(id) }, null, 2),
    }],
  }
}

// T35: Goal Handlers

function handleCreateGoal(goals, args) {
  if (!args.title) return errorResult('title is required')
  try {
    const goal = goals.create(args)
    return { content: [{ type: 'text', text: JSON.stringify(goal, null, 2) }] }
  } catch (e) {
    return errorResult(`create_goal failed: ${e.message}`)
  }
}

function handleListGoals(goals, args) {
  const list = goals.list(args || {})
  return {
    content: [{ type: 'text', text: JSON.stringify({ count: list.length, goals: list }, null, 2) }],
  }
}

function handleUpdateGoal(goals, args) {
  const { id, progress, status, note } = args
  if (!id) return errorResult('id is required')
  try {
    let goal
    if (status === 'achieved') goal = goals.achieve(id, note)
    else if (status === 'abandoned') goal = goals.abandon(id, note)
    else if (status === 'paused') goal = goals.pause(id)
    else if (status === 'active') goal = goals.resume(id)
    else if (progress !== undefined) goal = goals.updateProgress(id, progress, note)
    else goal = goals.update(id, args)
    return { content: [{ type: 'text', text: JSON.stringify(goal, null, 2) }] }
  } catch (e) {
    return errorResult(`update_goal failed: ${e.message}`)
  }
}

// T36: Thread Handlers

function handleCreateThread(threads, args) {
  if (!args?.title?.trim()) return errorResult('title is required')
  try {
    const thread = threads.create({
      title: args.title,
      category: args.category,
      summary: args.summary,
      goalId: args.goalId,
    })
    return { content: [{ type: 'text', text: JSON.stringify(thread, null, 2) }] }
  } catch (e) {
    return errorResult(`create_thread failed: ${e.message}`)
  }
}

function handleListThreads(threads, args) {
  const list = threads.list(args || {})
  return {
    content: [{ type: 'text', text: JSON.stringify({ count: list.length, threads: list }, null, 2) }],
  }
}

function handleGetThread(threads, args) {
  if (!args?.id) return errorResult('id is required')
  const thread = threads.get(args.id)
  if (!thread) return errorResult(`Thread not found: ${args.id}`)
  const episodes = threads.getEpisodes(args.id)
  return {
    content: [{ type: 'text', text: JSON.stringify({ thread, episodes }, null, 2) }],
  }
}

// --- Image Handlers ---

// 供应商优先级: DashScope (阿里) → Silicon Flow → Pollinations.ai
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY

async function handleGenerateImage(args) {
  if (!args.prompt) return errorResult('prompt 必填')
  const width = args.width || 1024
  const height = args.height || 1024
  const errors = []

  // Provider 1: DashScope (阿里通义万象)
  if (DASHSCOPE_API_KEY) {
    try {
      const result = await generateViaDashScope(args.prompt, width, height)
      if (result.ok) return imageSuccess(result, 'dashscope')
      errors.push(`DashScope: ${result.error}`)
    } catch (e) { errors.push(`DashScope: ${e.message}`) }
  }

  // Provider 2: Silicon Flow (FLUX)
  if (SILICONFLOW_API_KEY) {
    try {
      const result = await generateViaSiliconFlow(args.prompt, `${width}x${height}`)
      if (result.ok) return imageSuccess(result, 'siliconflow')
      errors.push(`SiliconFlow: ${result.error}`)
    } catch (e) { errors.push(`SiliconFlow: ${e.message}`) }
  }

  // Provider 3: Pollinations.ai (免费兜底)
  try {
    const result = await generateViaPollinations(args.prompt, width, height, args.model)
    if (result.ok) return imageSuccess(result, 'pollinations')
    errors.push(`Pollinations: ${result.error}`)
  } catch (e) { errors.push(`Pollinations: ${e.message}`) }

  return errorResult(`所有供应商都失败了: ${errors.join(' | ')}`)
}

function imageSuccess(result, provider) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ok: true,
        image_url: result.url,
        provider,
        prompt: result.prompt,
        hint: '图片已生成！用 send_photo 工具把 image_url 发给用户',
      }, null, 2),
    }],
  }
}

// --- DashScope (阿里通义万象 wanx) ---
async function generateViaDashScope(prompt, width, height) {
  // 步骤 1: 创建异步任务
  const createRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: 'wanx-v1',
      input: { prompt },
      parameters: { size: `${width}*${height}`, n: 1 },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const createData = await createRes.json()
  const taskId = createData?.output?.task_id
  if (!taskId) return { ok: false, error: createData?.message || '创建任务失败' }

  // 步骤 2: 轮询结果 (最多 60 秒)
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${DASHSCOPE_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    })
    const statusData = await statusRes.json()
    const status = statusData?.output?.task_status
    if (status === 'SUCCEEDED') {
      const url = statusData?.output?.results?.[0]?.url
      if (url) return { ok: true, url, prompt }
      return { ok: false, error: '任务成功但无 URL' }
    }
    if (status === 'FAILED') return { ok: false, error: statusData?.output?.message || '生成失败' }
  }
  return { ok: false, error: '超时 (60s)' }
}

// --- Silicon Flow (FLUX) ---
async function generateViaSiliconFlow(prompt, imageSize) {
  const res = await fetch('https://api.siliconflow.cn/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt,
      image_size: imageSize,
      num_inference_steps: 20,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json()
  const url = data?.images?.[0]?.url
  if (url) return { ok: true, url, prompt }
  return { ok: false, error: data?.error?.message || data?.message || '生成失败' }
}

// --- Pollinations.ai (免费兜底) ---
async function generateViaPollinations(prompt, width, height, model) {
  const seed = Math.floor(Math.random() * 999999)
  const encodedPrompt = encodeURIComponent(prompt)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model || 'flux'}&seed=${seed}&nologo=true`
  const res = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(60_000) })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  return { ok: true, url: imageUrl, prompt }
}

async function handleSearchImage(args) {
  if (!args.query) return errorResult('query 必填')
  const count = Math.min(args.count || 3, 5)
  const encodedQ = encodeURIComponent(args.query)

  // Pexels 免费 API (200 req/hour, 高质量图片)
  const PEXELS_KEY = process.env.PEXELS_API_KEY || 'tiNc4kq4uJOmCOZqiezHsi2lXiZOwApQBjV5SwomQXVEzAs7mgYnBay2'
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodedQ}&per_page=${count}`
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()

    if (data.photos && data.photos.length > 0) {
      const images = data.photos.map(p => ({
        url: p.src.large,
        preview: p.src.small,
        tags: p.alt || '',
        photographer: p.photographer,
        source: 'pexels',
      }))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: true,
            count: images.length,
            images,
            hint: '用 send_photo 工具把 images[].url 发给用户',
          }, null, 2),
        }],
      }
    }
    return errorResult(`搜索 "${args.query}" 未找到图片`)
  } catch (e) {
    return errorResult(`搜索图片失败: ${e.message}`)
  }
}

// --- Telegram Action Handlers ---

async function handleSendPhoto(args) {
  if (!TELEGRAM_BOT_TOKEN) return errorResult('TELEGRAM_BOT_TOKEN 未配置')
  const chatId = args.chat_id || TELEGRAM_CHAT_ID
  if (!chatId) return errorResult('chat_id 必填 (或设置 TELEGRAM_CHAT_ID 环境变量)')
  if (!args.photo_url) return errorResult('photo_url 必填')

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
    const body = { chat_id: chatId, photo: args.photo_url }
    if (args.caption) body.caption = args.caption

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    if (!data.ok) return errorResult(`Telegram API 错误: ${data.description}`)
    return { content: [{ type: 'text', text: `✅ 图片已发送 (message_id: ${data.result?.message_id})` }] }
  } catch (e) {
    return errorResult(`发送图片失败: ${e.message}`)
  }
}

async function handleSendMessage(args) {
  if (!TELEGRAM_BOT_TOKEN) return errorResult('TELEGRAM_BOT_TOKEN 未配置')
  const chatId = args.chat_id || TELEGRAM_CHAT_ID
  if (!chatId) return errorResult('chat_id 必填 (或设置 TELEGRAM_CHAT_ID 环境变量)')
  if (!args.text) return errorResult('text 必填')

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
    const body = { chat_id: chatId, text: args.text, parse_mode: 'Markdown' }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    if (!data.ok) return errorResult(`Telegram API 错误: ${data.description}`)
    return { content: [{ type: 'text', text: `✅ 消息已发送 (message_id: ${data.result?.message_id})` }] }
  } catch (e) {
    return errorResult(`发送消息失败: ${e.message}`)
  }
}

// --- Helpers ---

function sourcePriority(source) {
  const map = { user_stated: 3, ai_inferred: 2, ai_observed: 1, auto: 2 }
  return map[source] || 0
}

function safeParseJson(str, fallback) {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

// --- Main ---

async function main() {
  // Init Memory
  const config = { memory: { dbPath: DB_PATH, maxEpisodicDays: 7 } }
  const memory = new Memory(config, AGENT_ID)
  await memory.start()

  // T35: Goals shares Memory's DB
  const goals = new Goals(memory.getDb(), AGENT_ID)
  goals.init()

  // T36: Threads shares Memory's DB
  const threads = new Threads(memory.getDb(), AGENT_ID)
  threads.init()

  // T37: DevStore shares Memory's DB
  const devStore = new DevStore(memory.getDb(), AGENT_ID)
  devStore.init()

  // T37: TaskOrchestrator (lazy — only creates if Engine available)
  // In MCP context, dev tools work with DevStore directly for queries
  // start_dev_task saves to DB, main process picks up via orchestrator
  let devOrchestrator = null
  try {
    const { TaskOrchestrator } = await import('../dev/orchestrator.mjs')
    const config = {
      engine: {
        workspace: process.env.OPENCODE_WORKSPACE || process.cwd(),
        host: process.env.ENGINE_HOST || 'http://localhost',
        port: parseInt(process.env.ENGINE_PORT || '4096'),
      },
    }
    devOrchestrator = new TaskOrchestrator({ store: devStore, config })
  } catch (e) {
    // TaskOrchestrator init may fail in MCP context — dev_status still works via DevStore
    console.error('[mcp] TaskOrchestrator 初始化失败 (dev_status 仍可用):', e.message)
  }

  // Init MCP Server
  const server = new Server(
    { name: 'muse-memory', version: '0.2.0' },
    { capabilities: { tools: {} } },
  )

  // List tools
  const allTools = [...TOOLS, ...GOAL_TOOLS, ...THREAD_TOOLS, ...DEV_TOOLS, ...TELEGRAM_TOOLS, ...IMAGE_TOOLS, ...PLANNER_TOOLS]

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }))

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'search_memory':
          return handleSearchMemory(memory, args || {})
        case 'set_memory':
          return handleSetMemory(memory, args || {})
        case 'get_user_profile':
          return handleGetUserProfile(memory, args || {}, { threads, goals })
        case 'get_recent_episodes':
          return handleGetRecentEpisodes(memory, args || {})
        case 'add_episode':
          return handleAddEpisode(memory, args || {})
        // T35: Goal tools
        case 'create_goal':
          return handleCreateGoal(goals, args || {})
        case 'list_goals':
          return handleListGoals(goals, args || {})
        case 'update_goal':
          return handleUpdateGoal(goals, args || {})
        // T36: Thread tools
        case 'create_thread':
          return handleCreateThread(threads, args || {})
        case 'list_threads':
          return handleListThreads(threads, args || {})
        case 'get_thread':
          return handleGetThread(threads, args || {})
        // T37: Dev tools
        case 'start_dev_task':
          if (!devOrchestrator) return { content: [{ type: 'text', text: 'Error: TaskOrchestrator 未初始化' }], isError: true }
          return await handleStartDevTask(devOrchestrator, args || {})
        case 'dev_status':
          if (!devOrchestrator) {
            // Fallback: 直接查 DevStore
            const tasks = devStore.list({ status: args?.status })
            return { content: [{ type: 'text', text: JSON.stringify({ total: tasks.length, tasks }, null, 2) }] }
          }
          return handleDevStatus(devOrchestrator, args || {})
        case 'approve_dev':
          if (!devOrchestrator) return { content: [{ type: 'text', text: 'Error: TaskOrchestrator 未初始化' }], isError: true }
          return await handleApproveDev(devOrchestrator, args || {})
        case 'reject_dev':
          if (!devOrchestrator) return { content: [{ type: 'text', text: 'Error: TaskOrchestrator 未初始化' }], isError: true }
          return await handleRejectDev(devOrchestrator, args || {})
        // Telegram action tools
        case 'send_photo':
          return await handleSendPhoto(args || {})
        case 'send_message':
          return await handleSendMessage(args || {})
        // Image tools
        case 'generate_image':
          return await handleGenerateImage(args || {})
        case 'search_image':
          return await handleSearchImage(args || {})
        // T42: Planner workflow tools (旧 WORKFLOW_TOOLS 已移除)
        // T42-4: Planner tools
        case 'workflow_create':
          return await handleWorkflowCreate(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        case 'workflow_admin_transition':
          return await handleWorkflowAdminTransition(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        case 'workflow_inspect':
          return await handleWorkflowInspect(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        case 'workflow_rollback':
          return await handleWorkflowRollback(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        case 'handoff_to_member':
          return await handleHandoffToMember(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        case 'read_artifact':
          return await handleReadArtifact(
            args?.session_id || process.env.OPENCODE_SESSION_ID || 'unknown', args || {})
        default:
          return errorResult(`Unknown tool: ${name}`)
      }
    } catch (e) {
      return errorResult(`Tool error: ${e.message}`)
    }
  })

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await memory.stop()
    await server.close()
    process.exit(0)
  })
}

// Only start server when run directly, not when imported for testing
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))
if (isMain) {
  main().catch(e => {
    console.error('Memory MCP Server failed:', e)
    process.exit(1)
  })
}

export { TOOLS, GOAL_TOOLS, THREAD_TOOLS, handleSearchMemory, handleSetMemory, handleGetUserProfile, handleGetRecentEpisodes, handleAddEpisode, handleCreateGoal, handleListGoals, handleUpdateGoal, handleCreateThread, handleListThreads, handleGetThread, sourcePriority, safeParseJson }
