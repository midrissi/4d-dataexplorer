import { isDesktop } from '~/lib/platform'

export const OPEN_ABOUT_DIALOG_EVENT = 'desktop://open-about-dialog'

export type DesktopMenuLabels = {
  appName: string
  about: string
  help: string
  view: string
  reload: string
  services: string
  hide: string
  hideOthers: string
  showAll: string
  quit: string
}

const DEFAULT_LABELS: DesktopMenuLabels = {
  appName: 'Data Explorer',
  about: 'About {appName}...',
  help: 'Help',
  view: 'View',
  reload: 'Reload',
  services: 'Services',
  hide: 'Hide {appName}',
  hideOthers: 'Hide Others',
  showAll: 'Show All',
  quit: 'Quit {appName}',
}

/** Shown next to About in the native menu (⌘⇧A / Ctrl+Shift+A). */
const ABOUT_ACCELERATOR = 'CmdOrCtrl+Shift+A'
const ABOUT_ITEM_ID = 'open-about-dialog'
/** Browser-style reload (⌘R / Ctrl+R). */
const RELOAD_ACCELERATOR = 'CmdOrCtrl+R'
const RELOAD_ITEM_ID = 'reload-interface'

let setupMenuPromise: Promise<void> | null = null
let lastAppliedSignature: string | null = null

const aboutOpenListeners = new Set<() => void>()

function isMacOS(): boolean {
  return navigator.userAgent.toLowerCase().includes('mac')
}

function withAppName(template: string, appName: string): string {
  return template.replace(/\{appName\}/g, appName)
}

/** Hard-reload the desktop UI (same as browser Cmd/Ctrl+R). */
export function reloadDesktopInterface(): void {
  window.location.reload()
}

/** Notify React (and any other subscribers) that About should open. */
export function emitOpenAboutDialog(): void {
  for (const listener of aboutOpenListeners) {
    try {
      listener()
    } catch (err) {
      console.error('About dialog listener failed:', err)
    }
  }
  window.dispatchEvent(new Event(OPEN_ABOUT_DIALOG_EVENT))
}

/** Subscribe to About menu / shortcut activations. Returns unsubscribe. */
export function onOpenAboutDialog(listener: () => void): () => void {
  aboutOpenListeners.add(listener)
  return () => {
    aboutOpenListeners.delete(listener)
  }
}

async function findSubmenuByLabels(
  menu: Awaited<ReturnType<typeof import('@tauri-apps/api/menu')['Menu']['default']>>,
  labels: string[]
) {
  const wanted = new Set(labels.map((label) => label.trim().toLowerCase()))
  const items = await menu.items()
  for (const item of items) {
    if (item.kind !== 'Submenu') continue
    const submenu = item as Awaited<
      ReturnType<typeof import('@tauri-apps/api/menu')['Submenu']['new']>
    >
    const text = (await submenu.text()).trim().toLowerCase()
    if (wanted.has(text)) return submenu
  }
  return null
}

async function removeExistingMenuItemsById(
  submenu: Awaited<ReturnType<typeof import('@tauri-apps/api/menu')['Submenu']['new']>>,
  id: string
) {
  const items = await submenu.items()
  for (const item of items) {
    if (item.id === id) {
      await submenu.remove(item)
    }
  }
}

async function removeExistingAboutItems(
  helpSubmenu: Awaited<ReturnType<typeof import('@tauri-apps/api/menu')['Submenu']['new']>>,
  aboutText: string
) {
  const items = await helpSubmenu.items()
  const wanted = aboutText.trim().toLowerCase()
  for (const item of items) {
    if (item.id === ABOUT_ITEM_ID) {
      await helpSubmenu.remove(item)
      continue
    }
    if (item.kind !== 'MenuItem') continue
    try {
      const text = (await (item as { text: () => Promise<string> }).text()).trim().toLowerCase()
      if (text === wanted || text.startsWith('about ')) {
        await helpSubmenu.remove(item)
      }
    } catch {
      // ignore items that don't expose text()
    }
  }
}

/**
 * Installs desktop-native app menu customizations (About under Help, Reload under View).
 *
 * Idempotent for the same label set — safe to call from React effects in
 * Strict Mode. Rebuilds when labels change (e.g. language switch).
 */
export async function setupDesktopMenu(labels?: Partial<DesktopMenuLabels>): Promise<void> {
  if (!isDesktop()) return

  const resolved: DesktopMenuLabels = { ...DEFAULT_LABELS, ...labels }
  const signature = JSON.stringify(resolved)

  if (setupMenuPromise && signature === lastAppliedSignature) return setupMenuPromise
  lastAppliedSignature = signature

  setupMenuPromise = (async () => {
    const { Menu, MenuItem, Submenu } = await import('@tauri-apps/api/menu')

    const menu = await Menu.default()
    const aboutText = withAppName(resolved.about, resolved.appName)

    // MenuItem.new() wires the action through a Channel. Passing `{ action }`
    // directly to submenu.prepend() does not — the handler is dropped and the
    // item appears but never fires (modal never opens).
    const aboutItem = await MenuItem.new({
      id: ABOUT_ITEM_ID,
      text: aboutText,
      accelerator: ABOUT_ACCELERATOR,
      action: () => {
        emitOpenAboutDialog()
      },
    })

    const reloadItem = await MenuItem.new({
      id: RELOAD_ITEM_ID,
      text: resolved.reload,
      accelerator: RELOAD_ACCELERATOR,
      action: () => {
        reloadDesktopInterface()
      },
    })

    if (isMacOS()) {
      try {
        // App menu: standard macOS items only (About lives under Help).
        const appSubmenu = await Submenu.new({
          id: 'app-menu',
          text: resolved.appName,
          items: [
            { item: 'Services', text: resolved.services },
            { item: 'Separator' },
            { item: 'Hide', text: withAppName(resolved.hide, resolved.appName) },
            { item: 'HideOthers', text: resolved.hideOthers },
            { item: 'ShowAll', text: resolved.showAll },
            { item: 'Separator' },
            { item: 'Quit', text: withAppName(resolved.quit, resolved.appName) },
          ],
        })

        await menu.removeAt(0)
        await menu.insert(appSubmenu, 0)
      } catch (err) {
        console.error('Failed to customize app submenu:', err)
      }
    }

    try {
      let viewSubmenu = await findSubmenuByLabels(menu, [
        resolved.view,
        'View',
        'Affichage',
        'Vista',
      ])
      if (viewSubmenu) {
        await removeExistingMenuItemsById(viewSubmenu, RELOAD_ITEM_ID)
        await viewSubmenu.prepend(reloadItem)
      } else {
        viewSubmenu = await Submenu.new({
          id: 'view-menu',
          text: resolved.view,
          items: [reloadItem],
        })
        // Insert after the first submenu (App on macOS / File elsewhere).
        const insertAt = Math.min(1, (await menu.items()).length)
        await menu.insert(viewSubmenu, insertAt)
      }
    } catch (err) {
      console.error('Failed to customize view submenu:', err)
    }

    try {
      let helpSubmenu = await findSubmenuByLabels(menu, [resolved.help, 'Help', 'Aide', 'Ayuda'])
      if (helpSubmenu) {
        await removeExistingAboutItems(helpSubmenu, aboutText)
        await helpSubmenu.prepend(aboutItem)
      } else {
        helpSubmenu = await Submenu.new({
          id: 'help-menu',
          text: resolved.help,
          items: [aboutItem],
        })
        await menu.append(helpSubmenu)
      }
      if (isMacOS()) {
        await helpSubmenu.setAsHelpMenuForNSApp()
      }
    } catch (err) {
      console.error('Failed to customize help submenu:', err)
    }

    await menu.setAsAppMenu()
  })()

  return setupMenuPromise
}
