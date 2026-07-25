import { AiTextareaField } from './AiFieldChrome'
import { isMissingDescription, MissingBadge } from './MissingBadge'

type DescriptionFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onGenerate?: () => void | Promise<void>
  aiEnabled: boolean
  generating?: boolean
  placeholder?: string
  rows?: number
}

export function DescriptionField({
  id,
  label,
  value,
  onChange,
  onGenerate,
  aiEnabled,
  generating = false,
  placeholder,
  rows = 3,
}: DescriptionFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-2 font-medium text-sm">
        {label}
        {isMissingDescription(value) ? <MissingBadge /> : null}
      </label>
      <AiTextareaField
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        onGenerate={onGenerate}
        aiEnabled={aiEnabled}
        generating={generating}
      />
    </div>
  )
}
