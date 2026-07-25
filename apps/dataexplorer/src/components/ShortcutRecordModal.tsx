import {
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@4d/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/i18n'
import type { KeyCombo } from '~/store/settings'
import { isMacOS } from '~/store/settings'

/** Format combo as lowercase "ctrl+shift+cmd+k" for the input display */
function formatComboForInput(combo: KeyCombo | null): string {
  if (!combo) return ''
  const parts: string[] = []
  if (combo.modifiers.ctrl) parts.push('ctrl')
  if (combo.modifiers.alt) parts.push(isMacOS() ? 'option' : 'alt')
  if (combo.modifiers.shift) parts.push('shift')
  if (combo.modifiers.meta) parts.push(isMacOS() ? 'cmd' : 'ctrl')
  const key =
    combo.key === ' ' ? 'space' : combo.key.length === 1 ? combo.key.toLowerCase() : combo.key
  parts.push(key)
  return parts.join('+')
}

interface ShortcutRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcutLabel: string
  isChord: boolean
  /** When provided, show "Record as chord" checkbox in the modal */
  onRecordAsChordChange?: (value: boolean) => void
  conflictMessage: string | null
  /** Return true to close modal, false to show conflict and keep open */
  onSave: (single: KeyCombo) => boolean
  onSaveChord: (first: KeyCombo, second: KeyCombo) => boolean
  onCancel: () => void
}

export function ShortcutRecordModal({
  open,
  onOpenChange,
  shortcutLabel,
  isChord,
  onRecordAsChordChange,
  conflictMessage,
  onSave,
  onSaveChord,
  onCancel,
}: ShortcutRecordModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<0 | 1>(0)
  const [currentCombo, setCurrentCombo] = useState<KeyCombo | null>(null)
  const [firstCombo, setFirstCombo] = useState<KeyCombo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayText =
    step === 1 && firstCombo
      ? `${formatComboForInput(firstCombo)}  ${t('settings.shortcutThen')}  ${formatComboForInput(currentCombo)}`
      : formatComboForInput(currentCombo)

  const instruction =
    step === 0
      ? isChord
        ? t('settings.pressFirstKeyThenEnter')
        : t('settings.pressDesiredKeyThenEnter')
      : t('settings.pressSecondKeyThenEnter')

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
        onCancel()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (!currentCombo || ['Control', 'Alt', 'Shift', 'Meta'].includes(currentCombo.key)) return
        if (isChord && step === 0) {
          setFirstCombo(currentCombo)
          setCurrentCombo(null)
          setStep(1)
          return
        }
        if (isChord && step === 1 && firstCombo) {
          if (onSaveChord(firstCombo, currentCombo)) onOpenChange(false)
          return
        }
        if (!isChord && onSave(currentCombo)) {
          onOpenChange(false)
        }
        return
      }

      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return

      e.preventDefault()
      let key = e.key
      if (key === ' ') key = 'Space'
      if (key.length === 1) key = key.toUpperCase()
      // Record actual modifiers for both parts (single, chord first, chord second).
      // ShortcutController accepts chord second part with or without modifiers:
      // if second has no modifiers it matches key-only; if it has modifiers it requires exact match.
      setCurrentCombo({
        key,
        modifiers: {
          meta: e.metaKey,
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
        },
      })
    },
    [open, isChord, step, currentCombo, firstCombo, onSave, onSaveChord, onCancel, onOpenChange]
  )

  useEffect(() => {
    if (!open) return
    setStep(0)
    setCurrentCombo(null)
    setFirstCombo(null)
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  const mods = currentCombo?.modifiers ?? {
    meta: false,
    ctrl: false,
    shift: false,
    alt: false,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-md"
        hideCloseButton={false}
        onPointerDownOutside={(e) => {
          e.preventDefault()
          onOpenChange(false)
          onCancel()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center">{t('settings.recordShortcut')}</DialogTitle>
          <DialogDescription className="text-center">{shortcutLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-center text-muted-foreground text-sm">{instruction}</p>

          <Input
            ref={inputRef}
            readOnly
            value={displayText}
            placeholder={t('settings.pressKeysPlaceholder')}
            className="text-center font-mono text-sm"
            aria-label={t('settings.keyCombinationAria')}
          />

          {onRecordAsChordChange && (
            <label
              className="flex cursor-pointer items-center gap-2 text-muted-foreground text-sm"
              htmlFor="record-as-chord-modal"
            >
              <Checkbox
                id="record-as-chord-modal"
                checked={isChord}
                onCheckedChange={(v) => onRecordAsChordChange(v === true)}
                disabled={step === 1}
                className="h-3.5 w-3.5"
              />
              {t('settings.recordAsChord')}
            </label>
          )}

          {conflictMessage && (
            <p className="text-center text-destructive text-xs">{conflictMessage}</p>
          )}

          {/* Modifier key indicators (Control, Shift, Alt, Command) */}
          <div className="flex items-center justify-center gap-2">
            <ModifierKey
              active={!!mods.ctrl}
              label={isMacOS() ? '⌃' : t('settings.modifierCtrl')}
            />
            <ModifierKey active={!!mods.shift} label="⇧" />
            <ModifierKey active={!!mods.alt} label={isMacOS() ? '⌥' : t('settings.modifierAlt')} />
            <ModifierKey active={!!mods.meta} label={isMacOS() ? '⌘' : t('settings.modifierWin')} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModifierKey({ active, label }: { active: boolean; label: string }) {
  return (
    <kbd
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded border font-mono text-sm transition-colors',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border bg-muted/50 text-muted-foreground'
      )}
      aria-hidden
    >
      {label}
    </kbd>
  )
}
