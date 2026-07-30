import { Braces, ExternalLink, PanelBottom, Sparkles, Terminal as TerminalIcon } from 'lucide-react'
import { EmptyPanel, EmptyPanelAction } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'

const EXAMPLE_IDS = ['all', 'query', 'get', 'snippet'] as const

export type TerminalExampleId = (typeof EXAMPLE_IDS)[number]

type TerminalEmptyStateProps = {
  onInsertExample: (id: TerminalExampleId) => void
}

/**
 * First-run state for the ORDA terminal — shared EmptyPanel chrome + example actions.
 */
export function TerminalEmptyState({ onInsertExample }: TerminalEmptyStateProps) {
  const { t } = useTranslation()
  const exampleAll = t('terminal.example.all')
  const exampleQuery = t('terminal.example.query')
  const exampleGet = t('terminal.example.get')
  const exampleSnippet = t('terminal.example.snippet')
  const exampleLabels: Record<TerminalExampleId, string> = {
    all: exampleAll,
    query: exampleQuery,
    get: exampleGet,
    snippet: exampleSnippet,
  }

  return (
    <EmptyPanel
      icon={TerminalIcon}
      badgeIcon={Sparkles}
      badgeTone="primary"
      title={t('terminal.emptyTitle')}
      description={t('terminal.empty')}
      ghost="cards"
      size="md"
      className="h-full min-h-0"
      contentClassName="max-w-xl px-2"
      chips={[
        { label: t('terminal.hintDs'), icon: Braces, tone: 'cyan' },
        { label: t('terminal.hintOpen'), icon: ExternalLink, tone: 'primary' },
        { label: t('terminal.hintConsole'), icon: PanelBottom, tone: 'amber' },
      ]}
      action={EXAMPLE_IDS.map((id) => (
        <EmptyPanelAction key={id} onClick={() => onInsertExample(id)}>
          <span className="font-mono">{exampleLabels[id]}</span>
        </EmptyPanelAction>
      ))}
    />
  )
}
