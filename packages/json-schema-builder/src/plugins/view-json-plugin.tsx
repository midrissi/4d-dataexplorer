import { CodeEditor, ScrollArea } from '@4d/ui'
import * as React from 'react'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from '../components/schema-builder'
import { getEditorLabels } from '../i18n'
import type { JSONSchemaRoot, SchemaBuilderPlugin, SchemaBuilderPluginProps } from '../types'

function ViewAsJsonPluginComponent(_props: SchemaBuilderPluginProps) {
  const { root, onChange, editorPrefs, onEditorPrefsChange } = useSchemaBuilderContext()
  const t = useSchemaBuilderI18n()
  const editorLabels = React.useMemo(() => getEditorLabels(t), [t])
  const [text, setText] = React.useState(() => JSON.stringify(root, null, 2))

  React.useEffect(() => {
    setText(JSON.stringify(root, null, 2))
  }, [root])

  const commit = React.useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed !== null && typeof parsed === 'object') {
        onChange(parsed as JSONSchemaRoot)
      }
    } catch {
      // Keep current text on invalid JSON
    }
  }, [text, onChange])

  return (
    <ScrollArea className="h-full w-full">
      <CodeEditor
        language="json"
        value={text}
        onChange={setText}
        onBlur={commit}
        height="400px"
        fontSize={13}
        showLineNumbers
        toolbar
        labels={editorLabels}
        editorPrefs={editorPrefs}
        onEditorPrefsChange={onEditorPrefsChange}
      />
    </ScrollArea>
  )
}

export const viewJsonPlugin: SchemaBuilderPlugin = {
  id: 'view-json',
  tabLabel: 'View JSON',
  tabContent: ViewAsJsonPluginComponent,
}
