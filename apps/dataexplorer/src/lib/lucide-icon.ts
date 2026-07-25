import { icons, type LucideIcon } from 'lucide-react'

/**
 * Lucide renamed some icons in the `icons` registry while keeping the old
 * named exports as aliases (e.g. UserCircle → CircleUser). Saved preferences
 * and ICON_PRESETS may still use the old names.
 */
const ICON_ALIASES: Record<string, string> = {
  UserCircle: 'CircleUser',
}

export function resolveLucideIcon(name: string | undefined | null): LucideIcon | undefined {
  if (!name) return undefined
  const resolved = ICON_ALIASES[name] ?? name
  return icons[resolved as keyof typeof icons] as LucideIcon | undefined
}

/** True for Lucide-style names (PascalCase), as opposed to emoji / free text. */
export function looksLikeLucideIconName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]+$/.test(name)
}
