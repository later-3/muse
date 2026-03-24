/**
 * T39: workflow-prompt hook — experimental.chat.system.transform
 *
 * 将当前节点的七要素编译成结构化指令注入 system prompt。
 * AI 在每次对话中都能看到完整的节点工作指令。
 *
 * T39-1.3 升级：
 * - 删除 loadWorkflowState / ensurePromptRegistry（M5b 迁移）
 * - registry 在 plugin init 时已加载到全局
 */

import { existsSync, readdirSync } from 'node:fs'
import * as nodePath from 'node:path'

import { getRegistry } from '../../workflow/registry.mjs'
import { restoreRegistryFromBridge } from '../../workflow/bridge.mjs'
import { resolveCapabilities } from '../../workflow/gate-enforcer.mjs'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 写 prompt 调试日志到 trace 目录（按日归档）
 */
function promptDebugLog(logDir, msg) {
  try {
    const ts = new Date().toISOString()
    const dir = join(logDir, new Date().toISOString().slice(0, 10))
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'wf-prompt-debug.log'), `${ts} ${msg}\n`)
  } catch { /* ignore */ }
}

export function createWorkflowPrompt() {
  const logDir = process.env.MUSE_TRACE_DIR || '/tmp/muse-trace'
  // 日志去重：记录已记过完整日志的 session+node 组合
  const loggedKeys = new Set()

  return async (input, output) => {
    const sessionID = input?.sessionID
    if (!sessionID) return

    let registry = getRegistry()
    if (!registry || registry.size === 0) {
      registry = await restoreRegistryFromBridge()
    }
    if (!registry) return

    let sm = registry.getBySession(sessionID)
    // session 找不到 → 增量恢复
    if (!sm) {
      await restoreRegistryFromBridge()
      registry = getRegistry()
      sm = registry?.getBySession(sessionID)
    }
    if (!sm) return

    // ── T39-1.4: Handoff 状态感知 ──
    const { lookupInstance, loadInstanceState, saveInstanceState } = await import('../../workflow/bridge.mjs')
    const instanceId = sm.instanceId
    const state = loadInstanceState(instanceId)

    if (state?.handoff?.targetSession === sessionID) {
      const hStatus = state.handoff.status

      if (hStatus === 'pending') {
        // bind-only: ACK 写回 + 抑制正常 prompt
        state.handoff.status = 'acked'
        state.handoff.ackedAt = new Date().toISOString()
        saveInstanceState(instanceId, state)
        promptDebugLog(logDir, `[handoff] ACK 写回 sid=${sessionID} instance=${instanceId}`)
        output.system.push('═══ WORKFLOW BIND: 绑定确认中，等待工作指令 ═══')
        return
      }

      if (hStatus === 'acked') {
        // 等待 source 发送 handoff prompt → 抑制
        output.system.push('═══ WORKFLOW BIND: 等待工作指令，暂不操作 ═══')
        return
      }

      if (hStatus === 'executing') {
        // ★ 投递确认：target 收到 handoff prompt → 写 delivered → 继续注入
        state.handoff.status = 'delivered'
        state.handoff.deliveredAt = new Date().toISOString()
        saveInstanceState(instanceId, state)
        promptDebugLog(logDir, `[handoff] 投递确认 delivered sid=${sessionID} instance=${instanceId}`)

        // 通知用户：target muse 接管了
        const node = sm.getCurrentNode()
        import('../../workflow/notify.mjs').then(m =>
          m.notifyHandoffReceived({
            instanceId,
            workflowId: sm.workflowId,
            nodeName: node?.id || 'unknown',
            nodeObjective: node?.objective || '',
          })
        ).catch(() => {})

        // 不 return，继续走正常 prompt 注入
      }

      if (hStatus === 'failed') {
        // 失败独立提示
        output.system.push(
          '═══ WORKFLOW ERROR: 工作流交接失败 ═══\n' +
          `handoff 从 ${state.handoff.source} 到 ${state.handoff.target} 失败。\n` +
          '当前处于冻结状态，等待 source 端执行 workflow_retry_handoff 或 workflow_cancel_handoff。\n' +
          '═══ 暂不执行任何操作 ═══'
        )
        return
      }
      // delivered → 继续走正常路径
    }

    // ── 正常 prompt 注入 ──
    const participantStatus = registry.getParticipantStatus(sessionID)
    const node = sm.getCurrentNode()
    if (!node) return

    const prompt = compileNodePrompt(node, sm, participantStatus)
    output.system.push(prompt)

    // 日志去重：同一 session+node 只记一次完整 prompt
    const logKey = `${sessionID}:${node.id}`
    if (!loggedKeys.has(logKey)) {
      loggedKeys.add(logKey)
      promptDebugLog(logDir, [
        `[inject] sid=${sessionID} node=${node.id} status=${participantStatus}`,
        '--- PROMPT START ---',
        prompt,
        '--- PROMPT END ---',
      ].join('\n'))
    }
  }
}

/**
 * 将节点七要素编译成 system prompt 文本
 */
export function compileNodePrompt(node, sm, participantStatus) {
  const sections = []

  // 工作流 + 节点标题
  const wfName = sm.definition?.name || sm.workflowId
  const wfDesc = sm.definition?.description || ''
  sections.push(`═══ WORKFLOW "${wfName}": 你当前在节点 "${node.id}" ═══`)
  if (wfDesc) sections.push(`描述: ${wfDesc}`)

  // ★ Pre-check：验证输入 artifact 是否存在
  const requiredInputs = node.input?.artifacts || []
  if (requiredInputs.length > 0) {
    const home = process.env.MUSE_HOME
    const family = process.env.MUSE_FAMILY
    if (home && family) {
      const artDir = nodePath.join(home, family, 'workflow', 'instances', sm.instanceId, 'artifacts')
      const missing = requiredInputs.filter(f => !existsSync(nodePath.join(artDir, f)))
      if (missing.length > 0) {
        sections.push(`\n## ❌ 输入缺失 — 工作流暂停`)
        sections.push(`节点 "${node.id}" 需要以下输入文件，但不存在：`)
        missing.forEach(f => sections.push(`- ⛔ ${f} (应在 ${nodePath.join(artDir, f)})`))
        sections.push(`\n请通知用户处理此问题，不要执行任何操作。`)
        sections.push(`\n═══ END WORKFLOW ═══`)

        // Telegram 通知
        import('../../workflow/notify.mjs').then(m =>
          m.notifyWorkflowError?.({
            instanceId: sm.instanceId,
            workflowId: sm.workflowId,
            nodeName: node.id,
            error: `输入缺失: ${missing.join(', ')}`,
          })
        ).catch(() => {})

        return sections.join('\n')
      }
      // 输入都在 → 在 prompt 里列出完整路径
      sections.push(`\n## 输入文件`)
      requiredInputs.forEach(f => sections.push(`- ${f}: ${nodePath.join(artDir, f)}`))
    }
  }

  // 参与者状态
  if (participantStatus === 'frozen') {
    sections.push(`\n## ⚠️ 你当前处于冻结状态`)
    sections.push(`当前节点由 "${node.participant}" 负责，你处于等待状态。`)
    sections.push(`你只能使用: read, glob, grep, workflow_status`)
    sections.push(`\n═══ END WORKFLOW ═══`)
    return sections.join('\n')
  }

  // ★ T41-4: 系统通知头（只对 active 参与者生效）
  // frozen / 输入缺失 分支已在上方提前 return，不会执行到此处
  const wfDisplayName = sm.definition?.name || sm.workflowId
  const isPlannerMode = sm.definition?.driver === 'planner'

  sections.push(
    `[系统通知] 你在工作流「${wfDisplayName}」的「${node.id}」节点。` +
    `当前任务行为以节点要求为准（P2 日常行为让位），安全/身份边界持续生效。` +
    (isPlannerMode ? `完成后通知 Planner。` : (node.wait_for_user ? '' : `完成后调 workflow_transition 推进。`))
  )
  sections.push('')

  // ★ 执行模式（自主执行 vs 等待用户 vs Planner 驱动）
  if (isPlannerMode) {
    // ★ Planner 模式：统一行为，不区分 wait_for_user
    sections.push(`\n## ⚠️ 执行规则（Planner 驱动）`)
    sections.push(`你由 Planner 指挥官调度。你必须：`)
    sections.push(`- 按照步骤指引完成所有操作`)
    sections.push(`- 完成后通知 Planner，说明产出和结果`)
    sections.push(`- ⛔ 不要调用 workflow_transition，由 Planner 统一推进`)
    sections.push(`- ⛔ 不要直接通过 Telegram 联系用户，由 Planner 中转`)
  } else if (node.wait_for_user) {
    sections.push(`\n## ⏸️ 等待用户指令`)
    sections.push(`此节点需要用户参与。你必须：`)
    sections.push(`- 向用户展示需要审核的内容`)
    sections.push(`- 等待用户通过 Telegram 回复指示`)
    sections.push(`- 根据用户指示调用相应的 workflow_transition`)
    sections.push(`- 不要自主决定通过或拒绝`)
  } else {
    sections.push(`\n## ⚠️ 执行规则`)
    sections.push(`你是自主执行的 Agent。你必须：`)
    sections.push(`- 按照步骤指引完成所有操作，不要跳过任何步骤`)
    sections.push(`- 完成后立即调用 workflow_transition 推进到下一节点`)
    sections.push(`- 不要停下来等待用户确认或反馈`)
    sections.push(`- 不要只回复文字而不执行工具调用`)
  }

  // ★ 前置阅读（read_first）：只注入路径，AI 自己去 read
  const readFirst = node.read_first || []
  if (readFirst.length > 0) {
    sections.push(`\n## 前置阅读`)
    sections.push(`执行前先 read 以下文件（不要跳过）：`)
    readFirst.forEach(f => sections.push(`- ${f}`))
  }

  // 目标
  if (node.objective) {
    sections.push(`\n## 目标\n${node.objective}`)
  }

  // 怎么做
  if (node.instructions?.length) {
    sections.push(`\n## 步骤指引`)
    node.instructions.forEach((s, i) => sections.push(`${i + 1}. ${s}`))
  }

  // 不能做什么
  if (node.constraints?.length) {
    sections.push(`\n## ⛔ 禁止事项`)
    node.constraints.forEach(c => sections.push(`- ${c}`))
  }

  // 能用什么工具
  const resolvedTools = [...resolveCapabilities(node.capabilities || [])]
  sections.push(`\n## 可用工具\n${resolvedTools.join(', ')}`)
  sections.push(`调用不在列表中的工具会被系统拦截。`)

  // 完成条件
  if (node.exit_criteria) {
    sections.push(`\n## 完成条件`)
    if (node.exit_criteria.artifacts) {
      sections.push(`需要产出: ${node.exit_criteria.artifacts.join(', ')}`)
    }
    if (node.exit_criteria.checks) {
      node.exit_criteria.checks.forEach(c => sections.push(`- ✓ ${c}`))
    }
    if (node.exit_criteria.actor) {
      sections.push(`等待: ${node.exit_criteria.actor}`)
    }
  }

  // 可用的 transition（只显示 agent 可触发的）
  // ★ Planner 模式下不显示 transition 调用指令
  if (!isPlannerMode) {
    const agentTransitions = Object.entries(node.transitions || {})
      .filter(([_, t]) => t.actor === 'agent')
    if (agentTransitions.length) {
      sections.push(`\n## 状态流转`)
      agentTransitions.forEach(([event, t]) =>
        sections.push(`- workflow_transition("${event}") → 进入 "${t.target}"`))
    }
  }

  // 自定义 prompt
  if (node.prompt_template) {
    sections.push(`\n## 补充指令\n${node.prompt_template}`)
  }

  // ★ Artifact 目录（告诉 AI 在哪里读/写 artifact）
  try {
    const home = process.env.MUSE_HOME
    const family = process.env.MUSE_FAMILY
    if (home && family) {
      const artDir = nodePath.join(home, family, 'workflow', 'instances', sm.instanceId, 'artifacts')
      sections.push(`\n## 工作流 Artifact 目录`)
      sections.push(`路径: ${artDir}`)
      sections.push(`读取前序节点产出物和写入本节点产出物都在此目录。`)
      if (existsSync(artDir)) {
        const files = readdirSync(artDir)
        if (files.length > 0) {
          sections.push(`已有文件: ${files.join(', ')}`)
        }
      }
    }
  } catch { /* 降级 */ }

  // 工作流状态
  sections.push(`\n## 工作流状态`)
  sections.push(`实例: ${sm.instanceId}`)
  sections.push(`任务: ${sm.taskId}`)
  sections.push(`状态: ${sm.status}`)

  sections.push(`\n═══ END WORKFLOW ═══`)
  return sections.join('\n')
}
