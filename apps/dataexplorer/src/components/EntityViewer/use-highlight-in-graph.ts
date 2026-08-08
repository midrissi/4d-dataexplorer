import { useCallback } from 'react'
import { eventBus } from '~/lib/eventBus'
import { useTabsStore } from '~/store/tabs'

export function useHighlightInGraph() {
  const openGraphTab = useTabsStore((s) => s.openGraphTab)
  return useCallback(
    (dataclassName: string) => {
      openGraphTab().then(() => {
        eventBus.emit('highlight-dataclass-in-graph', dataclassName)
      })
    },
    [openGraphTab]
  )
}
