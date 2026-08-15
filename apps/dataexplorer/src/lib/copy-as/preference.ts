import { type CopyAsFormatId, DEFAULT_COPY_AS_FORMAT, isCopyAsFormatId } from './types'

const STORAGE_KEY = 'copyAsFormat:v1'

export function loadCopyAsFormat(): CopyAsFormatId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isCopyAsFormatId(stored)) return stored
  } catch {
    // private mode / disabled storage
  }
  return DEFAULT_COPY_AS_FORMAT
}

export function saveCopyAsFormat(format: CopyAsFormatId): void {
  try {
    localStorage.setItem(STORAGE_KEY, format)
  } catch {
    // ignore quota / private mode
  }
}
