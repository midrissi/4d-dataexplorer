import type { CodeEditor } from '@4d/ui'
import { JsonTreePreview } from '~/components/Console/ObjectTree'
import { ObjectCodeFieldEditor } from './ObjectCodeFieldEditor'

export function ObjectCodeField({
  value,
  isReadonly,
  onChange,
  labels,
  editorPrefs,
  onEditorPrefsChange,
}: {
  value: unknown
  isReadonly: boolean
  onChange: (value: unknown) => void
  labels: React.ComponentProps<typeof CodeEditor>['labels']
  editorPrefs: React.ComponentProps<typeof CodeEditor>['editorPrefs']
  onEditorPrefsChange: React.ComponentProps<typeof CodeEditor>['onEditorPrefsChange']
}) {
  if (isReadonly) {
    return (
      <div className="overflow-hidden rounded-md border">
        <JsonTreePreview
          value={value ?? null}
          className="h-auto max-h-72"
          contentClassName="max-h-64"
        />
      </div>
    )
  }

  return (
    <ObjectCodeFieldEditor
      value={value}
      onChange={onChange}
      labels={labels}
      editorPrefs={editorPrefs}
      onEditorPrefsChange={onEditorPrefsChange}
    />
  )
}
