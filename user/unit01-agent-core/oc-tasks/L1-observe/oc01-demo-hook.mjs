/**
 * oc01-demo-hook: 通过 Plugin Hook 观察 OpenCode 发给 LLM 的完整内容
 *
 * 本脚本配合 dump-llm 插件使用:
 *   1. 插件在 .opencode/plugins/dump-llm.js
 *   2. 插件通过 hook 拦截 system prompt、messages、params 等
 *   3. 拦截到的数据写到 demo-workspace/hook-dump/ 目录
 *   4. 本脚本发消息后，读取 dump 文件并格式化展示
 *
 * 前置:
 *   cd /Users/xulater/Code/assistant-agent/muse/make-muse/reference/opencode/packages/opencode
 *   OPENCODE_CONFIG_DIR=/Users/xulater/Code/assistant-agent/muse/user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace/.opencode bun --inspect --conditions=browser src/index.ts serve --port 5555 --print-logs
 *
 * 运行:
 *   node user/unit01-agent-core/oc-tasks/L1-observe/oc01-demo-hook.mjs
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.OC_PORT || 5555
const BASE = `http://127.0.0.1:${PORT}`
const DUMP_DIR = path.join(__dirname, "demo-workspace", "hook-dump")

// --- 工具函数 ---

async function api(method, apiPath, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${apiPath}`, opts)
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`${method} ${apiPath} → ${res.status}: ${await res.text()}`)
  return res.json()
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function clearDumpDir() {
  if (fs.existsSync(DUMP_DIR)) {
    for (const f of fs.readdirSync(DUMP_DIR)) {
      fs.unlinkSync(path.join(DUMP_DIR, f))
    }
  }
}

function readDumpFiles() {
  if (!fs.existsSync(DUMP_DIR)) return []
  return fs
    .readdirSync(DUMP_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({
      name: f,
      data: JSON.parse(fs.readFileSync(path.join(DUMP_DIR, f), "utf-8")),
    }))
}

// --- Main ---

async function main() {
  console.log("═══════════════════════════════════════════════")
  console.log("   oc01-demo-hook: Plugin Hook 观察 LLM 通信")
  console.log("═══════════════════════════════════════════════")
  console.log("")

  // 清空之前的 dump
  clearDumpDir()
  console.log(`🗑️  清空 hook-dump/ 目录`)
  console.log("")

  // Step 1: 创建 Session
  console.log("📋 Step 1: 创建 session")
  const session = await api("POST", "/session", {})
  console.log(`   ✅ id: ${session.id}`)
  console.log("")

  // Step 2: 发消息
  const message = "你好！请用一句话介绍你自己。"
  console.log(`💬 Step 2: 发消息 → "${message}"`)
  await api("POST", `/session/${session.id}/prompt_async`, {
    parts: [{ type: "text", text: message }],
  })
  console.log("   ✅ prompt_async 已接受")
  console.log("")

  // Step 3: 等待完成
  console.log("⏳ Step 3: 等待 Agent Loop 完成...")
  const startTime = Date.now()
  for (let i = 1; i <= 60; i++) {
    await sleep(1000)
    const allStatus = await api("GET", "/session/status")
    const entry = allStatus?.[session.id]
    if (entry) {
      process.stdout.write(`   ⏳ poll #${i} (${Math.round((Date.now() - startTime) / 1000)}s)    \r`)
    } else {
      console.log(`   ✅ 完成! 耗时 ${Math.round((Date.now() - startTime) / 1000)}s`)
      break
    }
    if (i === 60) {
      console.log("\n   ❌ 超时")
      return
    }
  }

  // 等一下让插件的文件写入完成
  await sleep(500)

  // Step 4: 读取 hook dump 文件
  console.log("")
  console.log("═══════════════════════════════════════════════")
  console.log("   🔍 Hook 拦截结果分析")
  console.log("═══════════════════════════════════════════════")

  const dumps = readDumpFiles()
  if (dumps.length === 0) {
    console.log("   ⚠️  没有找到 hook dump 文件")
    console.log("   💡 确认 .opencode/plugins/dump-llm.js 已存在")
    return
  }

  console.log(`   📂 共 ${dumps.length} 个 dump 文件`)
  console.log("")

  for (const { name, data } of dumps) {
    console.log(`  ┌─ 📄 ${name}`)
    console.log(`  │  📝 ${data._desc || ""}`)

    if (name.includes("system-prompt")) {
      // ─── System Prompt 展示 ───
      console.log(`  │  🔖 共 ${data.promptCount} 段 system prompt`)
      if (data.model) {
        console.log(`  │  🤖 Model: ${data.model.providerID}/${data.model.id}`)
      }
      for (const p of data.prompts || []) {
        console.log(`  │`)
        console.log(`  │  ── Segment ${p.index} (${p.length} chars) ──`)
        const lines = p.preview.split("\n").slice(0, 10)
        for (const line of lines) {
          console.log(`  │    ${line.slice(0, 100)}`)
        }
        if (p.length > 500) console.log(`  │    ... (截断，完整内容见 JSON 文件)`)
      }
    } else if (name.includes("messages")) {
      // ─── Messages 展示 ───
      console.log(`  │  📊 共 ${data.totalMessages} 条消息`)
      for (const msg of data.messages || []) {
        const icon = msg.role === "user" ? "👤" : msg.role === "assistant" ? "🤖" : "🔧"
        console.log(`  │  ${icon} [${msg.role}] id=${msg.id} parts=${msg.partsCount}`)
        for (const part of msg.parts || []) {
          if (part.type === "text" && part.text) {
            console.log(`  │     📝 "${part.text.slice(0, 100)}"`)
          } else if (part.type === "tool") {
            console.log(`  │     🔧 tool=${part.tool} status=${part.toolState}`)
          } else {
            console.log(`  │     [${part.type}]`)
          }
        }
      }
    } else if (name.includes("chat-params")) {
      // ─── LLM 参数展示 ───
      console.log(`  │  🤖 Model: ${data.model?.providerID}/${data.model?.id}`)
      console.log(`  │  🌡️  temperature: ${data.params?.temperature}`)
      console.log(`  │  📊 topP: ${data.params?.topP}`)
      console.log(`  │  📊 topK: ${data.params?.topK}`)
      if (data.params?.options) {
        console.log(`  │  ⚙️  options: ${JSON.stringify(data.params.options).slice(0, 200)}`)
      }
    } else if (name.includes("text-complete")) {
      // ─── AI 回复展示 ───
      console.log(`  │  💬 AI 回复:`)
      const lines = (data.text || "").split("\n").slice(0, 5)
      for (const line of lines) {
        console.log(`  │     ${line.slice(0, 100)}`)
      }
    } else if (name.includes("tool-before")) {
      console.log(`  │  🔧 工具: ${data.tool}`)
      console.log(`  │  📥 参数: ${JSON.stringify(data.args).slice(0, 200)}`)
    } else if (name.includes("tool-after")) {
      console.log(`  │  🔧 工具: ${data.tool}`)
      console.log(`  │  📤 结果: ${(data.result?.output || "").slice(0, 200)}`)
    } else if (name.includes("chat-headers")) {
      console.log(`  │  📋 Headers: ${JSON.stringify(data.headers).slice(0, 200)}`)
    }

    console.log(`  └─`)
    console.log("")
  }

  // 总结
  console.log("═══════════════════════════════════════════════")
  console.log("   📊 Hook 拦截链路总结")
  console.log("═══════════════════════════════════════════════")
  console.log("")
  console.log("   触发顺序:")
  dumps.forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.name} — ${d.data._desc || ""}`)
  })
  console.log("")
  console.log("   💡 完整 JSON 数据在: demo-workspace/hook-dump/")
  console.log("   💡 system prompt 完整内容: hook-dump/0xx-system-prompt.json")
  console.log("")
  console.log("✅ Demo 完成!")
}

main().catch((e) => {
  console.error(`\n❌ 错误: ${e.message}`)
  console.error("")
  console.error("💡 确保 OpenCode server 在 demo-workspace 目录下启动:")
  console.error("   cd user/unit01-agent-core/oc-tasks/L1-observe/demo-workspace")
  console.error(`   opencode serve --port ${PORT} --print-logs`)
  process.exit(1)
})
