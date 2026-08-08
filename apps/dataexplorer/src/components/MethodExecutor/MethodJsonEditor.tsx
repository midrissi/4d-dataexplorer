import {
  Button,
  CodeEditor,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@4d/ui'
import { Braces } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { MethodJsonSnippet } from './method-json-snippets'

/**
 * Shared JSON CodeEditor (with toolbar) used by custom method args and the wrapper.
 */
export function MethodJsonEditor({
  value,
  onChange,
  height = 140,
  path,
  snippets,
  className,
  readOnly,
  onRegisterFlush,
}: {
  value: string
  onChange: (value: string) => void
  height?: string | number
  /** Monaco model path — unique per editor instance. */
  path?: string
  snippets?: MethodJsonSnippet[]
  className?: string
  readOnly?: boolean
  /** Register a flush that commits draft → parent and returns the committed text. */
  onRegisterFlush?: (flush: () => string) => () => void
}) {
  const { t } = useTranslation()
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

  const applySnippet = (snippet: MethodJsonSnippet) => {
    draftRef.current = snippet.value
    setDraft(snippet.value)
    onChangeRef.current(snippet.value)
  }

  return (
    <div className={className}>
      {snippets && snippets.length > 0 ? (
        <div className="mb-1.5 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Braces className="h-3.5 w-3.5" />
                {t('methodExecutor.snippets.label')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {snippets.map((snippet) => (
                <DropdownMenuItem
                  key={snippet.id}
                  className="text-xs"
                  onSelect={() => applySnippet(snippet)}
                >
                  {t(`methodExecutor.snippets.${snippet.labelKey}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
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
      />
    </div>
  )
}
