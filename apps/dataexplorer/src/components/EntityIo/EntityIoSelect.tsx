import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@4d/ui'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export type EntityIoSelectOption<T extends string> = {
  value: T
  label: ReactNode
}

export function EntityIoSelect<T extends string>({
  id,
  value,
  options,
  onValueChange,
  disabled,
  ariaLabel,
  className,
}: {
  id?: string
  value: T
  options: EntityIoSelectOption<T>[]
  onValueChange: (value: T) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}) {
  const selected = options.find((option) => option.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('w-full justify-between font-normal text-xs', className)}
        >
          <span className="min-w-0 truncate">{selected?.label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto"
      >
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
