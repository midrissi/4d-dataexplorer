import { AlertCircle, ChevronRight, CircleAlert, Globe2, Info } from 'lucide-react'
import type { ConsoleEntry } from '~/store/console'

export function LevelIcon({ entry }: { entry: ConsoleEntry }) {
  if (entry.level === 'error') return <CircleAlert className="h-3.5 w-3.5 text-destructive" />
  if (entry.level === 'warn') return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
  if (entry.level === 'info') return <Info className="h-3.5 w-3.5 text-blue-500" />
  if (entry.level === 'network') return <Globe2 className="h-3.5 w-3.5 text-cyan-600" />
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
}
