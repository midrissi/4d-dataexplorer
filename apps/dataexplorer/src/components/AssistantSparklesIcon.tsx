import { cn } from '@4d/ui'
import { type LucideProps, Sparkles } from 'lucide-react'
import './assistant-sparkles-icon.css'

type AssistantSparklesIconProps = LucideProps & {
  twinkle?: boolean
}

export function AssistantSparklesIcon({
  className,
  twinkle = true,
  ...props
}: AssistantSparklesIconProps) {
  return <Sparkles {...props} className={cn(twinkle && 'assistant-icon-twinkle', className)} />
}
