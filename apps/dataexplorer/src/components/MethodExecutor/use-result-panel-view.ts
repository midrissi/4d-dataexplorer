import { useState } from 'react'
import type { HttpClientResponse } from '~/store/http-client-types'
import type { DetectedMethodResult } from './detect-method-result'

export type ResultPanelTab = 'body' | 'headers'
export type ResultBodyView = 'preview' | 'raw'

/** Reset Body/Headers + Preview/Raw when a new method result or error arrives. */
export function useResultPanelView(
  result: DetectedMethodResult | null,
  errorResponse?: HttpClientResponse | null
) {
  const [tab, setTab] = useState<ResultPanelTab>('body')
  const [bodyView, setBodyView] = useState<ResultBodyView>('preview')
  const [viewedResult, setViewedResult] = useState(result)
  const [viewedError, setViewedError] = useState(errorResponse)

  if (result !== viewedResult || errorResponse !== viewedError) {
    setViewedResult(result)
    setViewedError(errorResponse)
    setTab('body')
    setBodyView('preview')
  }

  return { tab, setTab, bodyView, setBodyView }
}
