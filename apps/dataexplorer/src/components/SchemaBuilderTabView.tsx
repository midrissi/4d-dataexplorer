import {
  copySchemaPlugin,
  type JSONSchemaRoot,
  SchemaBuilder,
  testSchemaPlugin,
} from '@4d/json-schema-builder'
import { useCallback, useState } from 'react'
import { useCodeEditorPrefs, useSettingsStore, useUpdateCodeEditorPrefs } from '~/store/settings'

const INITIAL_SCHEMA: JSONSchemaRoot = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Display name' },
    count: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
  $defs: {},
}

export function SchemaBuilderTabView() {
  const language = useSettingsStore((state) => state.language)
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()
  const [schema, setSchema] = useState<JSONSchemaRoot>(INITIAL_SCHEMA)
  const handleSchemaChange = useCallback(
    (value: JSONSchemaRoot | import('@4d/json-schema-builder').JSONSchema) => {
      setSchema(value as JSONSchemaRoot)
    },
    []
  )
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SchemaBuilder
        value={schema}
        onChange={handleSchemaChange}
        lang={language === 'en' || language === 'fr' || language === 'es' ? language : 'en'}
        plugins={[copySchemaPlugin, testSchemaPlugin]}
        editorPrefs={codeEditorPrefs}
        onEditorPrefsChange={updateCodeEditorPrefs}
      />
    </div>
  )
}
