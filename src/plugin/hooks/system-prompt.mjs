/**
 * T10.5: Muse Plugin — experimental.chat.system.transform hook
 *
 * 动态上下文注入: 只注入运行时动态信息 (当前时间等)。
 *
 * ⚠️ 评审守则: 不能承载人格! 人格主载体是 AGENTS.md (T12)。
 * 这里只补 AGENTS.md 无法提供的动态信息。
 */

export function createSystemPrompt() {
  return async (_input, output) => {
    try {
      // output: { system: string[] }
      // 只 append，不覆盖
      const now = new Date()
      const timeStr = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })

      output.system.push(
        `[Muse 动态上下文]\n当前时间: ${timeStr}\n`
      )

      // T15: 注入能力摘要 (如果 registry 可用)
      if (globalThis.__museRegistry) {
        const capSummary = globalThis.__museRegistry.summary()
        output.system.push(`[能力自知] ${capSummary}\n`)
      }
    } catch (e) {
      // 降级: 不影响主流程，但记录以便排查
      // eslint-disable-next-line no-console
      console.warn(`[system-prompt] 动态上下文注入失败 (已降级): ${e?.message || e}`)
    }
  }
}
