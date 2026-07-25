import type { RefObject } from 'react'

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShowHelp: () => void
  /** When set, the palette is positioned below this element (e.g. header search bar) instead of centered. */
  anchorRef?: RefObject<HTMLElement | null>
  startInGoToMode?: boolean
  startInGoToPageMode?: boolean
  startInDataclassSelectMode?: boolean
  startInDataclassDataMode?: boolean
  startInSwitchTabsMode?: boolean
}
