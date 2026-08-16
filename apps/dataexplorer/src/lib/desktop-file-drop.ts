export type DesktopDroppedFile = {
  name: string
  bytes: Uint8Array
  type?: string
}

type FileListener = (file: DesktopDroppedFile) => void
type DragStateListener = (dragging: boolean) => void

const fileListeners = new Set<FileListener>()
const dragStateListeners = new Set<DragStateListener>()

/** Desktop shell calls this after converting a native drag-drop path into file bytes. */
export function emitDesktopFileDrop(file: DesktopDroppedFile): void {
  for (const listener of fileListeners) listener(file)
}

/** Desktop shell forwards native file drag enter/over/leave state for drop-zone feedback. */
export function emitDesktopFileDragState(dragging: boolean): void {
  for (const listener of dragStateListeners) listener(dragging)
}

/** Subscribe while a drop target is mounted. Returns an unsubscribe callback. */
export function subscribeDesktopFileDrop(listener: FileListener): () => void {
  fileListeners.add(listener)
  return () => fileListeners.delete(listener)
}

/** Subscribe while a desktop-native file drop target is mounted. */
export function subscribeDesktopFileDragState(listener: DragStateListener): () => void {
  dragStateListeners.add(listener)
  return () => dragStateListeners.delete(listener)
}
