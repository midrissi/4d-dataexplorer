import {
  type ConsoleLogLevel,
  createEntryId,
  type NetworkDetails,
  useConsoleStore,
} from '~/store/console'

function append(level: ConsoleLogLevel, values: unknown[]): void {
  const [message, ...args] = values
  useConsoleStore.getState().append({
    level,
    message,
    args: args.length > 0 ? args : undefined,
  })
}

export const consoleService = {
  log: (...values: unknown[]) => append('log', values),
  info: (...values: unknown[]) => append('info', values),
  warn: (...values: unknown[]) => append('warn', values),
  error: (...values: unknown[]) => append('error', values),
  /** Append a completed (or failed) network entry. Prefer start/update for in-flight logging. */
  network: (details: NetworkDetails) =>
    useConsoleStore.getState().append({
      level: 'network',
      message: `${details.method} ${details.url}`,
      network: details,
    }),
  /** Create a pending network row as soon as the request is sent. Returns the entry id. */
  networkStart: (details: Omit<NetworkDetails, 'pending' | 'cancelled' | 'durationMs'> & {
    durationMs?: number
  }): string => {
    const id = createEntryId()
    useConsoleStore.getState().append({
      id,
      level: 'network',
      message: `${details.method} ${details.url}`,
      network: {
        ...details,
        durationMs: details.durationMs ?? 0,
        pending: true,
        cancelled: false,
      },
    })
    return id
  },
  networkUpdate: (id: string, patch: Partial<NetworkDetails>) =>
    useConsoleStore.getState().updateNetwork(id, patch),
  clear: () => useConsoleStore.getState().clear(),
}
