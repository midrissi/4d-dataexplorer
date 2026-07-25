import { ClickToCopy, CodeEditor } from '@4d/ui'
import { Code2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from '~/i18n'
import { FOUR_D_LANGUAGE_ID, registerFourDLanguage } from '~/lib/monaco-4d-language'
import { ClassShell, Field } from './ClassBinaryShell'
import type { MethodDecoded } from './types'

function monacoLanguageFor(language: string | undefined): string {
  const normalized = (language ?? '4d').trim().toLowerCase()
  if (normalized === '4d' || normalized === '4dm' || normalized === '4dmethod') {
    return FOUR_D_LANGUAGE_ID
  }
  if (normalized === 'js' || normalized === 'javascript') return 'javascript'
  if (normalized === 'ts' || normalized === 'typescript') return 'typescript'
  if (normalized === 'json') return 'json'
  return 'plaintext'
}

export function MethodBinaryView({ data, className }: { data: MethodDecoded; className?: string }) {
  const { t } = useTranslation()
  const code = data.code?.replace(/\r\n?/g, '\n') ?? ''
  const hasCode = code.trim().length > 0
  const languageId = monacoLanguageFor(data.language)
  const title = data.methodName?.trim() || data.name
  const height = useMemo(() => {
    const lines = hasCode ? code.split('\n').length : 1
    return `${Math.min(Math.max(lines, 4), 16) * 18 + 12}px`
  }, [code, hasCode])

  return (
    <ClassShell
      icon={Code2}
      iconClassName="border-violet-500/30 text-violet-700 dark:text-violet-300"
      title={title}
      badges={
        <>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-800 uppercase tracking-wide dark:text-violet-200">
            VolM
          </span>
          {data.language ? (
            <span className="rounded-full border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
              {data.language}
            </span>
          ) : null}
        </>
      }
      className={className}
    >
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field
          label={t('entity.binaryMethodName')}
          value={data.methodName?.trim() || t('entity.binaryMethodNameEmpty')}
        />
        <Field
          label={t('entity.binaryDatabaseId')}
          value={data.databaseId?.trim() || t('entity.binaryDatabaseIdEmpty')}
        />
      </dl>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {t('entity.binaryMethodCode')}
          </span>
          {hasCode ? (
            <ClickToCopy
              value={code}
              tooltipLabel={t('entity.binaryMethodCopy')}
              tooltipCopiedLabel={t('common.copied')}
              className="inline-flex h-5 shrink-0 items-center rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {t('entity.binaryPathCopyShort')}
            </ClickToCopy>
          ) : null}
        </div>

        {hasCode ? (
          <CodeEditor
            value={code}
            language={languageId}
            readOnly
            showLineNumbers
            height={height}
            fontSize={12}
            toolbar={{ tools: ['copy', 'word-wrap'] }}
            onMount={(_editor, monaco) => {
              registerFourDLanguage(monaco)
              const model = _editor.getModel()
              if (model && languageId === FOUR_D_LANGUAGE_ID) {
                monaco.editor.setModelLanguage(model, FOUR_D_LANGUAGE_ID)
              }
            }}
          />
        ) : (
          <p className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
            {t('entity.binaryMethodCodeEmpty')}
          </p>
        )}
      </div>
    </ClassShell>
  )
}
