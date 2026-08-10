import { CodeEditor } from '@4d/ui/code-editor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEnvTemplateDecorations, registerEnvTemplateCompletionProvider } from '~/lib/env'

/**
 * Shared JSON CodeEditor (with toolbar) used by custom method args and the wrapper.
 */
export function MethodJsonEditor({
  value,
  onChange,
  height = 140,
  path,
  className,
  readOnly,
  onRegisterFlush,
}: {
  value: string
  onChange: (value: string) => void
  height?: string | number
  /** Monaco model path — unique per editor instance. */
  path?: string
  className?: string
  readOnly?: boolean
  /** Register a flush that commits draft → parent and returns the committed text. */
  onRegisterFlush?: (flush: () => string) => () => void
}) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  draftRef.current = draft
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setDraft(value)
    draftRef.current = value
  }, [value])

  const flush = useCallback(() => {
    const next = draftRef.current
    if (next !== valueRef.current) {
      onChangeRef.current(next)
    }
    return next
  }, [])

  useEffect(() => {
    if (!onRegisterFlush) return
    return onRegisterFlush(flush)
  }, [flush, onRegisterFlush])

  return (
    <div className={className}>
      <CodeEditor
        value={draft}
        onChange={(next) => {
          draftRef.current = next
          setDraft(next)
        }}
        height={height}
        language="json"
        showLineNumbers={false}
        toolbar
        path={path}
        onBlur={flush}
        readOnly={readOnly}
        onMount={(editor, monaco) => {
          applyEnvTemplateDecorations(editor, monaco)
          const completion = registerEnvTemplateCompletionProvider(monaco, 'json')
          const sub = editor.onDidChangeModelContent(() => {
            applyEnvTemplateDecorations(editor, monaco)
          })
          editor.onDidDispose(() => {
            sub.dispose()
            completion.dispose()
          })
        }}
      />
    </div>
  )
}
