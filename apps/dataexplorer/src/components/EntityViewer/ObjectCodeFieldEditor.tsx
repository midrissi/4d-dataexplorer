import { CodeEditor } from '@4d/ui'
import { useState } from 'react'

export function ObjectCodeFieldEditor({
  value,
  onChange,
  labels,
  editorPrefs,
  onEditorPrefsChange,
}: {
  value: unknown
  onChange: (value: unknown) => void
  labels: React.ComponentProps<typeof CodeEditor>['labels']
  editorPrefs: React.ComponentProps<typeof CodeEditor>['editorPrefs']
  onEditorPrefsChange: React.ComponentProps<typeof CodeEditor>['onEditorPrefsChange']
}) {
  const [text, setText] = useState(() => (value != null ? JSON.stringify(value, null, 2) : ''))
  const [invalid, setInvalid] = useState(false)

  const handleChange = (next: string) => {
    setText(next)
    if (!next.trim()) {
      setInvalid(false)
      onChange(null)
      return
    }
    try {
      const parsed = JSON.parse(next)
      setInvalid(false)
      onChange(parsed)
    } catch {
      // Keep the raw text so the user can keep typing; mark as invalid.
      setInvalid(true)
      onChange(next)
    }
  }

  const lineCount = text ? text.split('\n').length : 1
  const height = `${Math.min(Math.max(lineCount, 3), 18) * 21 + 16}px`

  return (
    <div className="overflow-hidden rounded-md border">
      <CodeEditor
        value={text}
        onChange={handleChange}
        language="json"
        showLineNumbers
        highlightActiveLine
        toolbar
        error={invalid}
        height={height}
        fontSize={12}
        labels={labels}
        editorPrefs={editorPrefs}
        onEditorPrefsChange={onEditorPrefsChange}
      />
    </div>
  )
}
