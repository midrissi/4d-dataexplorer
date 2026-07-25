import type { HttpClientTab } from '~/store/tabs'
import { HttpClient } from './HttpClient'

/** Kept mounted while its tab is open so form + result state survive tab switches. */
export function HttpClientTabView({ tab }: { tab: HttpClientTab }) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <HttpClient tabId={tab.id} seed={tab.seed} />
    </div>
  )
}
