import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '~/i18n'
import type { MethodMetadata } from '~/lib/assistant-metadata-schema'
import { DescriptionField } from './DescriptionField'
import { MethodArgumentsEditor } from './MethodArgumentsEditor'
import { isMissingDescription, MissingBadge } from './MissingBadge'

type MethodEditorProps = {
  methodName: string
  signature?: string | null
  applyTo?: string | null
  metadata: MethodMetadata
  onChange: (metadata: MethodMetadata) => void
  onGenerateDescription?: () => void | Promise<void>
  onGenerateArguments?: () => void | Promise<void>
  aiEnabled: boolean
  generatingDescription?: boolean
  generatingArguments?: boolean
}

export function MethodEditor({
  methodName,
  signature,
  applyTo,
  metadata,
  onChange,
  onGenerateDescription,
  onGenerateArguments,
  aiEnabled,
  generatingDescription = false,
  generatingArguments = false,
}: MethodEditorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/20"
      data-metadata-missing={isMissingDescription(metadata.description) || undefined}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm">{methodName}</div>
          {(signature || applyTo) && (
            <div className="truncate text-muted-foreground text-xs">
              {[applyTo, signature].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {isMissingDescription(metadata.description) ? <MissingBadge /> : null}
      </button>

      {open ? (
        <div className="space-y-4 border-border/60 border-t px-3 py-3">
          <DescriptionField
            id={`method-desc-${methodName}`}
            label={t('assistantMetadata.methodDescription')}
            value={metadata.description ?? ''}
            onChange={(description) => onChange({ ...metadata, description })}
            aiEnabled={aiEnabled}
            generating={generatingDescription}
            onGenerate={onGenerateDescription}
          />

          <MethodArgumentsEditor
            key={methodName}
            methodName={methodName}
            methodArguments={metadata.arguments}
            onChange={(methodArguments) => onChange({ ...metadata, arguments: methodArguments })}
            onGenerate={onGenerateArguments}
            aiEnabled={aiEnabled}
            generating={generatingArguments}
          />
        </div>
      ) : null}
    </div>
  )
}
