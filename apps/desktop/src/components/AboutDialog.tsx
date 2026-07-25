import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@4d/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Package,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/i18n'
import { OPEN_ABOUT_DIALOG_EVENT, onOpenAboutDialog } from '~desktop/lib/menu'

type AppMeta = {
  appName: string
  version: string
  identifier: string
  tauriVersion: string
}

const UNKNOWN = '—'

const WEBSITE_URL = 'https://midrissi.github.io/4d-dataexplorer/'

const RESOURCES = [
  {
    id: 'guide',
    url: 'https://midrissi.github.io/4d-dataexplorer/guide/',
    icon: BookOpen,
  },
  {
    id: 'releaseNotes',
    url: 'https://midrissi.github.io/4d-dataexplorer/release-notes/',
    icon: FileText,
  },
  {
    id: 'restDocs',
    url: 'https://developer.4d.com/docs/REST/gettingStarted',
    icon: BookOpen,
  },
  {
    id: 'ordaDocs',
    url: 'https://developer.4d.com/docs/ORDA/overview',
    icon: BookOpen,
  },
  {
    id: 'github',
    url: 'https://github.com/midrissi/4d-dataexplorer',
    icon: Package,
  },
] as const

function openExternal(url: string) {
  void openUrl(url).catch((error) => {
    console.error('Failed to open URL', url, error)
  })
}

export function AboutDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [meta, setMeta] = useState<AppMeta>({
    appName: t('app.title'),
    version: UNKNOWN,
    identifier: UNKNOWN,
    tauriVersion: UNKNOWN,
  })

  const refreshMeta = useCallback(async () => {
    try {
      const { getIdentifier, getName, getTauriVersion, getVersion } = await import(
        '@tauri-apps/api/app'
      )
      const [appName, version, identifier, tauriVersion] = await Promise.all([
        getName(),
        getVersion(),
        getIdentifier(),
        getTauriVersion(),
      ])
      setMeta({ appName, version, identifier, tauriVersion })
    } catch {
      setMeta((prev) => ({
        ...prev,
        appName: t('app.title'),
      }))
    }
  }, [t])

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setCopied(false)
      void refreshMeta()
    }
    const unsubscribe = onOpenAboutDialog(onOpen)
    window.addEventListener(OPEN_ABOUT_DIALOG_EVENT, onOpen)
    return () => {
      unsubscribe()
      window.removeEventListener(OPEN_ABOUT_DIALOG_EVENT, onOpen)
    }
  }, [refreshMeta])

  const detailsText = useMemo(
    () =>
      [
        `${t('desktopAbout.nameLabel')}: ${meta.appName}`,
        `${t('desktopAbout.versionLabel')}: ${meta.version}`,
        `${t('desktopAbout.identifierLabel')}: ${meta.identifier}`,
        `${t('desktopAbout.tauriLabel')}: ${meta.tauriVersion}`,
        `${t('desktopAbout.websiteLabel')}: ${WEBSITE_URL}`,
      ].join('\n'),
    [meta, t]
  )

  const copyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }, [detailsText])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden border-border p-0 sm:max-w-md">
        <div className="relative bg-primary/10 p-3">
          <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('desktopAbout.title')}
            </DialogTitle>
            <DialogDescription className="text-xs">{t('desktopAbout.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="relative mt-3 grid gap-1.5 sm:grid-cols-2">
            <div className="rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
              <p className="text-muted-foreground text-xs">{t('desktopAbout.versionLabel')}</p>
              <p className="font-semibold text-xs">{meta.version}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
              <p className="text-muted-foreground text-xs">{t('desktopAbout.tauriLabel')}</p>
              <p className="font-semibold text-xs">{meta.tauriVersion}</p>
            </div>
          </div>

          <div className="relative mt-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
            <p className="text-muted-foreground text-xs">{t('desktopAbout.identifierLabel')}</p>
            <p className="font-mono text-xs">{meta.identifier}</p>
          </div>

          <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 bg-background/80 px-2 py-0.5 text-xs">
              <Package className="h-3 w-3" />
              {meta.appName}
            </span>
            <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 bg-background/80 px-2 py-0.5 text-xs">
              <Info className="h-3 w-3" />
              {t('desktopAbout.builtWith')}
            </span>
          </div>
        </div>

        <div className="space-y-2 p-3">
          <button
            type="button"
            onClick={() => openExternal(WEBSITE_URL)}
            className="flex w-full items-center gap-2.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
              <Globe className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-muted-foreground text-xs">
                {t('desktopAbout.websiteLabel')}
              </span>
              <span className="block truncate font-medium text-xs">
                {t('desktopAbout.websiteTitle')}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>

          <div className="space-y-1.5">
            <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              {t('desktopAbout.resourcesLabel')}
            </p>
            <ul className="space-y-0.5">
              {RESOURCES.map((resource) => {
                const Icon = resource.icon
                return (
                  <li key={resource.id}>
                    <button
                      type="button"
                      onClick={() => openExternal(resource.url)}
                      className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs transition-colors hover:bg-muted/50"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {t(`desktopAbout.resources.${resource.id}`)}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <DialogFooter className="border-border border-t px-3 py-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyDetails}>
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? t('desktopAbout.copied') : t('desktopAbout.copyDetails')}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
            {t('desktopAbout.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
