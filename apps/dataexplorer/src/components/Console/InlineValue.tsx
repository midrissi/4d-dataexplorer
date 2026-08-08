import { ConsoleValue } from './ObjectTree'

export function InlineValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? <span>{value}</span> : <ConsoleValue value={value} />
}
