/** Shared About dialog open event (desktop menu, mobile Tools, shortcuts). */

export const OPEN_ABOUT_DIALOG_EVENT = 'app://open-about-dialog'

const aboutOpenListeners = new Set<() => void>()

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

/** Subscribe to About activations. Returns unsubscribe. */
export function onOpenAboutDialog(listener: () => void): () => void {
  aboutOpenListeners.add(listener)
  return () => {
    aboutOpenListeners.delete(listener)
  }
}
