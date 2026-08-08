import { useState } from 'react'
import type { DetectedMethodResult } from './detect-method-result'

export type ResultPanelTab = 'body' | 'headers'
export type ResultBodyView = 'preview' | 'raw'

/** Reset Body/Headers + Preview/Raw when a new method result arrives. */
export function useResultPanelView(result: DetectedMethodResult | null) {
  const [tab, setTab] = useState<ResultPanelTab>('body')
  const [bodyView, setBodyView] = useState<ResultBodyView>('preview')
  const [viewedResult, setViewedResult] = useState(result)

  if (result !== viewedResult) {
    setViewedResult(result)
    setTab('body')
    setBodyView('preview')
  }

  return { tab, setTab, bodyView, setBodyView }
}
