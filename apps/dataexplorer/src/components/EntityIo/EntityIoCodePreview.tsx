import { CodeEditor } from '@4d/ui/code-editor'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

export function EntityIoCodePreview({
  value,
  language,
  height = 160,
}: {
  value: string
  language: string
  height?: number
}) {
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()

  return (
    <CodeEditor
      value={value}
      language={language}
      readOnly
      height={height}
      className="rounded-none border-0"
      editorPrefs={codeEditorPrefs}
      onEditorPrefsChange={updateCodeEditorPrefs}
    />
  )
}
