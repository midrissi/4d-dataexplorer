import type { MethodExecutorTab } from '~/store/tabs'
import { MethodExecutor } from './MethodExecutor'

/** Kept mounted while its tab is open so form + result state survive tab switches. */
export function MethodExecutorTabView({ tab }: { tab: MethodExecutorTab }) {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <MethodExecutor tabId={tab.id} seed={tab.seed} />
    </div>
  )
}
