import { cn, SegmentedControl, type SegmentedControlOption } from '@4d/ui'
import { isMobileShell } from '~/lib/platform'
import { SettingsField } from './SettingsField'

type SettingsSegmentedFieldProps<T extends string> = {
  label: string
  description?: string
  value: T
  options: SegmentedControlOption<T>[]
  onValueChange: (value: T) => void
  className?: string
}

/** Preference row with a full-width segmented control sized for touch on mobile. */
export function SettingsSegmentedField<T extends string>({
  label,
  description,
  value,
  options,
  onValueChange,
  className,
}: SettingsSegmentedFieldProps<T>) {
  const mobile = isMobileShell()

  return (
    <SettingsField label={label} description={description} className={className}>
      <SegmentedControl
        value={value}
        options={options}
        onValueChange={onValueChange}
        fullWidth
        aria-label={label}
        className={cn(
          'w-full',
          mobile
            ? 'min-h-10 gap-0.5 rounded-md p-0.5 [&_button]:h-9 [&_button]:rounded-sm [&_button]:px-2.5 [&_button]:text-xs [&_button_svg]:size-3.5'
            : 'min-h-6'
        )}
      />
    </SettingsField>
  )
}
