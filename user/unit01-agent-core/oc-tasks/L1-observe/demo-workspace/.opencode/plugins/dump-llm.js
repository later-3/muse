/**
 * dump-llm Plugin — 拦截 OpenCode 发给 LLM 的所有内容
 *
 * 这是一个 OpenCode Plugin，利用 hook 机制拦截 LLM 请求/响应链路。
 * 所有拦截到的数据会写到 demo-workspace/hook-dump/ 目录下的 JSON 文件。
 *
 * Hook 触发顺序:
 *   1. experimental.chat.messages.transform  — messages 数组（对话历史）
 *   2. experimental.chat.system.transform    — system prompt 数组
 *   3. chat.params                           — LLM 调用参数 (temperature/topP/topK)
 *   4. chat.headers                          — HTTP headers
 *   5. tool.execute.before / after           — 工具调用前后
 *   6. experimental.text.complete            — AI 回复文本完成时
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

export default async function (input) {
  // 用插件自身路径定位 dump 目录 (不依赖 CWD)
  const pluginDir = path.dirname(fileURLToPath(import.meta.url))
  const dumpDir = path.join(pluginDir, "..", "..", "hook-dump")  // .opencode/plugins/../../hook-dump = demo-workspace/hook-dump
  if (!fs.existsSync(dumpDir)) {
    fs.mkdirSync(dumpDir, { recursive: true })
  }
  console.log(`[dump-llm] 🚀 插件已加载! dump 目录: ${dumpDir}`)

  let callCounter = 0

  function dump(filename, data) {
    callCounter++
    const prefix = String(callCounter).padStart(3, "0")
    const filepath = path.join(dumpDir, `${prefix}-${filename}`)
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8")
    console.log(`[dump-llm] 📝 写入 hook-dump/${prefix}-${filename}`)
  }

  return {
    // ─── Hook 1: 对话消息拦截 ───
    // 时机: LLM 调用前，messages 数组已拼装完毕
    // 你能看到: 完整的对话历史（user/assistant/tool 消息）
    "experimental.chat.messages.transform": async (_ctx, output) => {
      const summary = output.messages.map((msg) => ({
        role: msg.info.role,
        id: msg.info.id,
        agent: msg.info.agent,
        model: msg.info.role === "user" ? msg.info.model : undefined,
        partsCount: msg.parts.length,
        parts: msg.parts.map((p) => ({
          type: p.type,
          // 文本内容截取前 200 字符
          text: p.type === "text" ? (p.text || "").slice(0, 200) : undefined,
          tool: p.type === "tool" ? p.tool : undefined,
          toolState: p.type === "tool" ? p.state?.status : undefined,
        })),
      }))

      dump("messages.json", {
        _desc: "发给 LLM 的完整对话历史",
        totalMessages: output.messages.length,
        messages: summary,
        // 完整的原始数据（可能很大）
        raw: output.messages,
      })
    },

    // ─── Hook 2: System Prompt 拦截 ───
    // 时机: system prompt 拼装完毕，即将发给 LLM
    // 你能看到: 完整的 system prompt（agent prompt + 环境信息 + 指令）
    "experimental.chat.system.transform": async (ctx, output) => {
      dump("system-prompt.json", {
        _desc: "发给 LLM 的 System Prompt",
        sessionID: ctx.sessionID,
        model: ctx.model
          ? {
              id: ctx.model.id,
              providerID: ctx.model.providerID,
            }
          : undefined,
        promptCount: output.system.length,
        // system prompt 通常分 2 段: [agent/provider prompt, 环境+指令]
        prompts: output.system.map((s, i) => ({
          index: i,
          length: s.length,
          preview: s.slice(0, 500) + (s.length > 500 ? "..." : ""),
          full: s,
        })),
      })
    },

    // ─── Hook 3: LLM 参数拦截 ───
    // 时机: 构建 streamText() 参数时
    // 你能看到: temperature, topP, topK, provider options
    "chat.params": async (ctx, output) => {
      dump("chat-params.json", {
        _desc: "LLM 调用参数",
        sessionID: ctx.sessionID,
        agent: ctx.agent,
        model: {
          id: ctx.model?.id,
          providerID: ctx.model?.providerID,
        },
        params: {
          temperature: output.temperature,
          topP: output.topP,
          topK: output.topK,
          options: output.options,
        },
      })
    },

    // ─── Hook 4: HTTP Headers 拦截 ───
    "chat.headers": async (ctx, output) => {
      dump("chat-headers.json", {
        _desc: "发给 LLM API 的 HTTP Headers",
        sessionID: ctx.sessionID,
        headers: output.headers,
      })
    },

    // ─── Hook 5: 工具调用前 ───
    "tool.execute.before": async (ctx, output) => {
      dump(`tool-before-${ctx.tool}.json`, {
        _desc: `工具调用前: ${ctx.tool}`,
        tool: ctx.tool,
        sessionID: ctx.sessionID,
        callID: ctx.callID,
        args: output.args,
      })
    },

    // ─── Hook 6: 工具调用后 ───
    "tool.execute.after": async (ctx, output) => {
      dump(`tool-after-${ctx.tool}.json`, {
        _desc: `工具调用后: ${ctx.tool}`,
        tool: ctx.tool,
        sessionID: ctx.sessionID,
        callID: ctx.callID,
        args: ctx.args,
        result: {
          title: output.title,
          output: (output.output || "").slice(0, 1000),
          metadata: output.metadata,
        },
      })
    },

    // ─── Hook 7: AI 回复文本完成 ───
    "experimental.text.complete": async (ctx, output) => {
      dump("text-complete.json", {
        _desc: "AI 回复文本（完整）",
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        partID: ctx.partID,
        text: output.text,
      })
    },
  }
}
