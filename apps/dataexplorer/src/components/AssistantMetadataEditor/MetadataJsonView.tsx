import { Button, CodeEditor, cn, ScrollArea } from '@4d/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { AssistantMetadataSchema } from '~/lib/assistant-metadata-schema'
import { parseMetadataSchema } from '~/lib/assistant-metadata-schema'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

type MetadataJsonViewProps = {
  metadata: AssistantMetadataSchema
  onChange: (metadata: AssistantMetadataSchema) => void
}

export function MetadataJsonView({ metadata, onChange }: MetadataJsonViewProps) {
  const { t } = useTranslation()
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const [text, setText] = useState(() => JSON.stringify(metadata, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    setText(JSON.stringify(metadata, null, 2))
    setParseError(null)
  }, [metadata])

  const editorLabels = useMemo(
    () => ({
      format: t('assistantMetadata.jsonFormat'),
      copy: t('assistantMetadata.jsonCopy'),
      copied: t('assistantMetadata.jsonCopied'),
      wrap: t('assistantMetadata.jsonWrap'),
      theme: t('assistantMetadata.jsonTheme'),
      fontSize: t('assistantMetadata.jsonFontSize'),
    }),
    [t]
  )

  const commit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const schema = parseMetadataSchema(parsed)
      if (!schema) {
        setParseError(t('assistantMetadata.jsonInvalid'))
        return
      }
      setParseError(null)
      onChange(schema)
    } catch {
      setParseError(t('assistantMetadata.jsonInvalid'))
    }
  }, [text, onChange, t])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-muted-foreground text-xs">{t('assistantMetadata.jsonHint')}</p>
        <Button type="button" variant="outline" size="sm" onClick={commit}>
          {t('assistantMetadata.jsonApply')}
        </Button>
      </div>
      {parseError ? (
        <p className={cn('px-1 text-destructive text-xs')} role="alert">
          {parseError}
        </p>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <CodeEditor
          language="json"
          value={text}
          onChange={setText}
          onBlur={commit}
          height="420px"
          fontSize={13}
          showLineNumbers
          toolbar
          labels={editorLabels}
          editorPrefs={codeEditorPrefs}
          onEditorPrefsChange={updateCodeEditorPrefs}
        />
      </ScrollArea>
    </div>
  )
}
