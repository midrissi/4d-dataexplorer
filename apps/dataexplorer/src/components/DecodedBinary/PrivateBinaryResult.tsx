import { cn } from '@4d/ui'
import { CodeEditor } from '@4d/ui/code-editor'
import { useState } from 'react'
import {
  BinaryObjectViewer,
  isPrivateBinaryObject,
  PRIVATE_BINARY_OBJECT_KEY,
} from '~/components/BinaryObjectViewer'
import { useTranslation } from '~/i18n'
import { isMobileShell } from '~/lib/platform'

type BinaryResultView = 'binary' | 'json'

function pretty(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2)
  return serialized === undefined ? String(value) : serialized
}

interface PrivateBinaryResultProps {
  value: unknown
  /** Show Binary | JSON toggle. Set false when the parent already has Preview/Raw. */
  showJsonToggle?: boolean
  className?: string
}

/**
 * Renders a top-level `__PRIVATE_BINARY_OBJECT` payload with BinaryObjectViewer,
 * optionally allowing a switch back to the original JSON envelope.
 */
export function PrivateBinaryResult({
  value,
  showJsonToggle = true,
  className,
}: PrivateBinaryResultProps) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const [view, setView] = useState<BinaryResultView>('binary')

  if (!isPrivateBinaryObject(value)) return null

  const base64 = value[PRIVATE_BINARY_OBJECT_KEY]

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden', className)}>
      {showJsonToggle ? (
        <div className="flex shrink-0 justify-end">
          <div
            className={cn(
              'inline-flex shrink-0 items-stretch overflow-hidden rounded-sm border p-px',
              mobile ? 'h-10 rounded-lg' : 'h-6'
            )}
          >
            {(
              [
                ['binary', t('entity.binaryObject')],
                ['json', t('entity.binaryViewJson')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'inline-flex cursor-pointer items-center leading-none transition-colors',
                  mobile ? 'h-9 px-3 text-sm' : 'h-5 px-2 text-[11px]',
                  view === id
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'json' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <CodeEditor value={pretty(value)} readOnly height="100%" toolbar />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <BinaryObjectViewer base64={base64} defaultExpanded name={PRIVATE_BINARY_OBJECT_KEY} />
        </div>
      )}
    </div>
  )
}
