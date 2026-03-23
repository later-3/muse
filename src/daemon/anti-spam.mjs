/**
 * T32: Anti-Spam — proactive message frequency control
 *
 * Guards Pulse trigger dispatch with:
 *   1. DND mode (complete silence)
 *   2. Quiet hours (configurable time window)
 *   3. Rate limit (max per hour)
 *   4. Frequency reduction (based on unresponsed count)
 *
 * skipAntiSpam on trigger bypasses all checks (for T33 health checks).
 */
import { createLogger } from '../logger.mjs'

const log = createLogger('anti-spam')

/**
 * Check if a trigger should be allowed to fire
 * @param {object} state - PulseState snapshot
 * @param {object} config - pulse config
 * @param {object} trigger - { id, interval, action, skipAntiSpam? }
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function shouldAllow(state, config, trigger) {
  // 1. skipAntiSpam bypass (e.g. health check triggers)
  if (trigger?.skipAntiSpam) {
    log.debug(`放行: trigger=${trigger.id} (skipAntiSpam)`)
    return { allowed: true }
  }

  const trigId = trigger?.id || 'unknown'

  // 2. DND mode
  if (state?.dnd) {
    log.info(`拦截: trigger=${trigId} reason=dnd`)
    return { allowed: false, reason: 'dnd' }
  }

  // 3. Quiet hours
  const quietHours = config?.quietHours || { start: 23, end: 7 }
  const hour = new Date().getHours()
  if (isQuietHour(hour, quietHours.start, quietHours.end)) {
    log.info(`拦截: trigger=${trigId} reason=quiet_hours (hour=${hour})`)
    return { allowed: false, reason: 'quiet_hours' }
  }

  // 4. Rate limit (max per hour)
  const maxPerHour = config?.maxPerHour ?? 2
  const lastAt = state?.lastProactiveAt
  if (lastAt) {
    const hoursSinceLast = (Date.now() - new Date(lastAt).getTime()) / 3600_000
    if (hoursSinceLast < 1) {
      // Count how many in this hour window based on triggerHistory
      const recentCount = countRecentTriggers(state?.triggerHistory, 3600_000)
      if (recentCount >= maxPerHour) {
        log.info(`拦截: trigger=${trigId} reason=rate_limited (count=${recentCount}/${maxPerHour})`)
        return { allowed: false, reason: 'rate_limited' }
      }
    }
  }

  // 5. Frequency reduction based on unresponsed count
  const unresponsed = state?.unresponsedCount || 0
  if (unresponsed >= 3 && lastAt) {
    const multiplier = unresponsed >= 6 ? 4 : 2
    const effectiveInterval = (trigger?.interval || 3600_000) * multiplier
    const elapsed = Date.now() - new Date(lastAt).getTime()
    if (elapsed < effectiveInterval) {
      log.info(`拦截: trigger=${trigId} reason=frequency_reduced (unresponsed=${unresponsed}, multiplier=${multiplier}x)`)
      return { allowed: false, reason: 'frequency_reduced' }
    }
  }

  // Default: allow
  log.debug(`放行: trigger=${trigId}`)
  return { allowed: true }
}

/**
 * Check if hour is within quiet period
 * Handles wrap-around (e.g. 23:00 → 07:00)
 */
export function isQuietHour(hour, start, end) {
  if (start > end) {
    // Wraps midnight: 23→7 means 23,0,1,2,3,4,5,6 are quiet
    return hour >= start || hour < end
  }
  return hour >= start && hour < end
}

/**
 * Count triggers that fired within the given window
 */
function countRecentTriggers(triggerHistory, windowMs) {
  if (!triggerHistory) return 0
  const cutoff = Date.now() - windowMs
  let count = 0
  for (const ts of Object.values(triggerHistory)) {
    if (new Date(ts).getTime() > cutoff) count++
  }
  return count
}
