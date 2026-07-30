import {
  BookOpen,
  Braces,
  ExternalLink,
  FileCode2,
  PanelBottom,
  Sparkles,
  Terminal as TerminalIcon,
} from 'lucide-react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import type { TerminalSnippet } from '~/store/terminal-snippets'
import { snippetFileName } from './TerminalSnippetsFiles'

type TerminalEmptyStateProps = {
  snippets: TerminalSnippet[]
  onOpenSnippet: (snippet: TerminalSnippet) => void
  onNewSnippet: () => void
  onShowHelp: () => void
}

/**
 * First-run state for the ORDA terminal — snippet files + help entry points.
 */
export function TerminalEmptyState({
  snippets,
  onOpenSnippet,
  onNewSnippet,
  onShowHelp,
}: TerminalEmptyStateProps) {
  const { t } = useTranslation()

  return (
    <EmptyPanel
      icon={TerminalIcon}
      badgeIcon={Sparkles}
      badgeTone="primary"
      title={t('terminal.emptyTitle')}
      description={t('terminal.empty')}
      ghost="cards"
      size="md"
      align="start"
      className="h-full min-h-0 pt-3"
      contentClassName="max-w-xl px-2"
      chips={[
        { label: t('terminal.hintDs'), icon: Braces, tone: 'cyan' },
        { label: t('terminal.hintOpen'), icon: ExternalLink, tone: 'primary' },
        { label: t('terminal.hintConsole'), icon: PanelBottom, tone: 'amber' },
      ]}
      action={
        <>
          {snippets.slice(0, 6).map((snippet) => (
            <EmptyPanelAction key={snippet.id} onClick={() => onOpenSnippet(snippet)}>
              <span className="inline-flex items-center gap-1 font-mono">
                <FileCode2 className="h-3 w-3 opacity-70" aria-hidden />
                {snippetFileName(snippet.name)}
              </span>
            </EmptyPanelAction>
          ))}
          <EmptyPanelAction onClick={onNewSnippet}>
            <span className="inline-flex items-center gap-1 font-mono">
              <FileCode2 className="h-3 w-3 opacity-70" aria-hidden />
              {t('terminal.snippets.newFile')}
            </span>
          </EmptyPanelAction>
          <EmptyPanelAction onClick={onShowHelp}>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3 w-3" aria-hidden />
              {t('terminal.helpAction')}
            </span>
          </EmptyPanelAction>
        </>
      }
    />
  )
}
