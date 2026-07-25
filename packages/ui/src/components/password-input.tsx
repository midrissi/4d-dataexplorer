import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { cn } from '../lib/utils'
import { Input } from './input'

export interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  /** Accessible label when the value is hidden. Defaults to "Show password". */
  showPasswordLabel?: string
  /** Accessible label when the value is visible. Defaults to "Hide password". */
  hidePasswordLabel?: string
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      disabled,
      showPasswordLabel = 'Show password',
      hidePasswordLabel = 'Hide password',
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-8', className)}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-2 text-muted-foreground transition-colors duration-fast hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
