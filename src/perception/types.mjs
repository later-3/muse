/**
 * T14: PerceptionObject 类型定义与校验
 *
 * 所有外部输入标准化为 PerceptionObject，
 * 无论来自 Telegram / Web / Camera / IoT。
 */

/** 所有支持的输入类型 */
export const PERCEPTION_TYPES = ['text', 'image', 'audio', 'video', 'file', 'event']

/** Phase 2+T38 已实现处理的类型 */
export const SUPPORTED_TYPES = ['text', 'image', 'audio']

/** 类型的中文标签 (用于用户友好提示) */
export const TYPE_LABELS = {
  text: '文字消息',
  image: '图片',
  audio: '语音',
  video: '视频',
  file: '文件',
  event: '事件',
}

/**
 * 创建标准化感知对象
 *
 * @param {string} source - 器官来源: 'telegram' | 'web' | 'cli' | 'camera' | 'iot'
 * @param {string} type - 输入类型 (PERCEPTION_TYPES 之一)
 * @param {string} userId - 用户 ID
 * @param {object} data - 附加数据
 * @param {string} [data.text] - 文本内容 (type=text 时必填)
 * @param {object} [data.artifact] - 多媒体附件 { kind, mime, remoteUrl?, localPath? }
 * @param {string} [data.textFallback] - 无法处理时的降级文本
 * @param {object} [data.meta] - 来源特定元数据
 * @returns {object} PerceptionObject
 */
export function createPerception(source, type, userId, data = {}) {
  return {
    source,
    type,
    userId,
    text: data.text || null,
    artifact: data.artifact || null,
    textFallback: data.textFallback || null,
    meta: data.meta || {},
    timestamp: new Date().toISOString(),
  }
}

/**
 * 校验 PerceptionObject 必填字段
 * @param {object} obj
 * @returns {string[]} 错误列表 (空 = 合法)
 */
export function validatePerception(obj) {
  const errors = []

  if (!obj || typeof obj !== 'object') {
    return ['PerceptionObject must be a non-null object']
  }
  if (!obj.source || typeof obj.source !== 'string') {
    errors.push('source is required and must be a string')
  }
  if (!PERCEPTION_TYPES.includes(obj.type)) {
    errors.push(`type must be one of: ${PERCEPTION_TYPES.join(', ')}`)
  }
  if (!obj.userId || typeof obj.userId !== 'string') {
    errors.push('userId is required and must be a string')
  }

  // type=text 必须有 text
  if (obj.type === 'text' && (!obj.text || typeof obj.text !== 'string')) {
    errors.push('text is required for type=text')
  }

  // 非 text 类型必须有 textFallback 或 artifact
  if (obj.type !== 'text' && obj.type !== 'event') {
    if (!obj.artifact && !obj.textFallback) {
      errors.push('artifact or textFallback required for non-text types')
    }
  }

  return errors
}
