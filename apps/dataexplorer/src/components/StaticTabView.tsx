import releaseNotesEs from '~/content/release-notes.es.md?raw'
import releaseNotesFr from '~/content/release-notes.fr.md?raw'
import releaseNotesEn from '~/content/release-notes.md?raw'
import type { Locale } from '~/i18n'
import { useTranslation } from '~/i18n'
import { useActiveStaticTab } from '~/store/tabs'
import { ReleaseNotesView } from './ReleaseNotesView'

const RELEASE_NOTES_BY_LOCALE: Record<Locale, string> = {
  en: releaseNotesEn,
  es: releaseNotesEs,
  fr: releaseNotesFr,
}

const STATIC_CONTENT: Record<string, string> = {}

export function StaticTabView() {
  const { t, language } = useTranslation()
  const activeStaticTab = useActiveStaticTab()
  if (!activeStaticTab) return null

  if (activeStaticTab.staticId === 'release-notes') {
    const markdown = RELEASE_NOTES_BY_LOCALE[language] ?? RELEASE_NOTES_BY_LOCALE.en
    return <ReleaseNotesView markdown={markdown} />
  }

  const markdown = STATIC_CONTENT[activeStaticTab.staticId]
  if (!markdown) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          {t('staticTab.unknownStaticContent', { id: activeStaticTab.staticId })}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <p className="text-muted-foreground text-sm">{activeStaticTab.staticId}</p>
    </div>
  )
}
