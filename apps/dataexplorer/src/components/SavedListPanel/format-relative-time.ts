/** Shared relative time for history / favourites list rows. */
export function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.round((timestamp - Date.now()) / 1000)
  const abs = Math.abs(deltaSec)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < 60) return rtf.format(deltaSec, 'second')
  const deltaMin = Math.round(deltaSec / 60)
  if (Math.abs(deltaMin) < 60) return rtf.format(deltaMin, 'minute')
  const deltaHour = Math.round(deltaMin / 60)
  if (Math.abs(deltaHour) < 24) return rtf.format(deltaHour, 'hour')
  return rtf.format(Math.round(deltaHour / 24), 'day')
}
