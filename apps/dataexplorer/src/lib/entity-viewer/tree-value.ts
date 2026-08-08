export function isDurationFieldName(keyName: string | number): boolean {
  const lowerKey = String(keyName).toLowerCase()
  return (
    lowerKey.includes('duration') ||
    lowerKey.includes('elapsed') ||
    (lowerKey.includes('time') && !lowerKey.includes('timestamp'))
  )
}

export function looksLikeDurationNumber(value: number): boolean {
  return value >= 1000 && value <= 604800000
}

export function isDateStringPattern(value: string): boolean {
  return (
    value === '0!0!0' ||
    /^\d{4}-\d{2}-\d{2}/.test(value) ||
    /^\d{1,2}!\d{1,2}!\d{4}$/.test(value) ||
    /^!!\d{4}-\d{2}-\d{2}!!$/.test(value)
  )
}
