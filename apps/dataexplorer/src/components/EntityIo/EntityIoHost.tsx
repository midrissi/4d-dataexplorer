import { lazy, Suspense, useEffect, useState } from 'react'
import type { EntityIoTarget } from '~/lib/eventBus'
import { eventBus } from '~/lib/eventBus'

const EntityAnalyzeDialog = lazy(() =>
  import('./EntityAnalyzeDialog').then((m) => ({ default: m.EntityAnalyzeDialog }))
)
const EntityExportDialog = lazy(() =>
  import('./EntityExportDialog').then((m) => ({ default: m.EntityExportDialog }))
)
const EntityImportDialog = lazy(() =>
  import('./EntityImportDialog').then((m) => ({ default: m.EntityImportDialog }))
)
const EntityAnonymizeDialog = lazy(() =>
  import('./EntityAnonymizeDialog').then((m) => ({ default: m.EntityAnonymizeDialog }))
)

type DialogKind = 'analyze' | 'export' | 'import' | 'anonymize' | null

/**
 * Global host for entity analyze / export / import / anonymize dialogs.
 * Open via eventBus: `open-entity-analyze` | `open-entity-export` | …
 */
export function EntityIoHost() {
  const [kind, setKind] = useState<DialogKind>(null)
  const [target, setTarget] = useState<EntityIoTarget | null>(null)

  useEffect(() => {
    const subs = [
      eventBus.on('open-entity-analyze', (payload) => {
        setTarget(payload)
        setKind('analyze')
      }),
      eventBus.on('open-entity-export', (payload) => {
        setTarget(payload)
        setKind('export')
      }),
      eventBus.on('open-entity-import', (payload) => {
        setTarget(payload)
        setKind('import')
      }),
      eventBus.on('open-entity-anonymize', (payload) => {
        setTarget(payload)
        setKind('anonymize')
      }),
    ]
    return () => {
      for (const sub of subs) sub.unsubscribe()
    }
  }, [])

  const close = () => {
    setKind(null)
  }

  if (!kind) return null

  return (
    <Suspense fallback={null}>
      <EntityAnalyzeDialog
        open={kind === 'analyze'}
        onOpenChange={(open) => !open && close()}
        target={target}
      />
      <EntityExportDialog
        open={kind === 'export'}
        onOpenChange={(open) => !open && close()}
        target={target}
      />
      <EntityImportDialog
        open={kind === 'import'}
        onOpenChange={(open) => !open && close()}
        target={target}
      />
      <EntityAnonymizeDialog
        open={kind === 'anonymize'}
        onOpenChange={(open) => !open && close()}
        target={target}
      />
    </Suspense>
  )
}
