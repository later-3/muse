const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info

function formatTime() {
  return new Date().toISOString().slice(11, 23)
}

/** 创建带模块名的结构化日志 [time][level][module] */
export function createLogger(module = 'muse') {
  const fmt = (level) => `[${formatTime()}] [${level}] [${module}]`
  return {
    debug: (...args) => currentLevel <= LEVELS.debug && console.debug(fmt('DEBUG'), ...args),
    info:  (...args) => currentLevel <= LEVELS.info  && console.log(fmt('INFO'), ...args),
    warn:  (...args) => currentLevel <= LEVELS.warn  && console.warn(fmt('WARN'), ...args),
    error: (...args) => currentLevel <= LEVELS.error && console.error(fmt('ERROR'), ...args),
  }
}

export const log = createLogger('muse')
