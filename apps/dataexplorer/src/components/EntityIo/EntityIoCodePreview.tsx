import { CodeEditor } from '@4d/ui/code-editor'
import { useCodeEditorPrefs, useUpdateCodeEditorPrefs } from '~/store/settings'

export function EntityIoCodePreview({
  value,
  language,
  height = 160,
  onChange,
  onBlur,
}: {
  value: string
  language: string
  height?: number
  onChange?: (value: string) => void
  onBlur?: () => void
}) {
  const codeEditorPrefs = useCodeEditorPrefs()
  const updateCodeEditorPrefs = useUpdateCodeEditorPrefs()

  return (
    <CodeEditor
      value={value}
      language={language}
      readOnly={!onChange}
      onChange={onChange}
      onBlur={onBlur}
      height={height}
      className="rounded-none border-0"
      editorPrefs={codeEditorPrefs}
      onEditorPrefsChange={updateCodeEditorPrefs}
    />
  )
}
