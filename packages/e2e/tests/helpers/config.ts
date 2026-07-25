/**
 * Data Explorer base URL (no trailing slash).
 * Reads `process.env.DATAEXPLORER_URL` at call time so capture scripts can apply a fallback.
 * Default: http://localhost:7080
 */
export function getDataExplorerUrl(): string {
  return (process.env.DATAEXPLORER_URL || 'http://localhost:7080').replace(/\/$/, '')
}

/**
 * @deprecated Prefer {@link getDataExplorerUrl} — this value is frozen at module import.
 */
export const DATAEXPLORER_URL = process.env.DATAEXPLORER_URL || 'http://localhost:7080'
