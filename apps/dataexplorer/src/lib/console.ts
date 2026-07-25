import { type ConsoleLogLevel, type NetworkDetails, useConsoleStore } from '~/store/console'

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
  network: (details: NetworkDetails) =>
    useConsoleStore.getState().append({
      level: 'network',
      message: `${details.method} ${details.url}`,
      network: details,
    }),
  clear: () => useConsoleStore.getState().clear(),
}
