import { cn } from '@4d/ui'
import { type InputHTMLAttributes, useEffect, useId, useState } from 'react'
import { useTranslation } from '~/i18n'
import { useTabsStore } from '~/store/tabs'

function isModClick(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}

/**
 * Auto-sized entity-selection key input.
 * ⌘/Ctrl+hover underlines; ⌘/Ctrl+click opens the selection (reuses tab if open).
 */
export function EntitySelectionKeyInput({
  id,
  name,
  value,
  label,
  dataClass,
  onChange,
  onKeyDown,
  ...inputProps
}: {
  id?: string
  name?: string
  value: string
  label: string
  dataClass: string
  onChange: (value: string) => void
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'name' | 'value' | 'onChange' | 'size' | 'children'
>) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const openEntitySetTab = useTabsStore((state) => state.openEntitySetTab)
  const [hovered, setHovered] = useState(false)
  const [modHeld, setModHeld] = useState(false)

  const trimmedKey = value.trim()
  const trimmedDataClass = dataClass.trim()
  const canOpen = Boolean(trimmedKey && trimmedDataClass)
  const showLink = canOpen && hovered && modHeld
  const widthCh = Math.max(value.length, 1)

  useEffect(() => {
    if (!hovered) return

    const syncMod = (event: KeyboardEvent) => {
      setModHeld(event.metaKey || event.ctrlKey)
    }
    const clearMod = () => setModHeld(false)

    window.addEventListener('keydown', syncMod)
    window.addEventListener('keyup', syncMod)
    window.addEventListener('blur', clearMod)
    return () => {
      window.removeEventListener('keydown', syncMod)
      window.removeEventListener('keyup', syncMod)
      window.removeEventListener('blur', clearMod)
    }
  }, [hovered])

  const openSelection = () => {
    if (!canOpen) return
    openEntitySetTab({
      dataclassName: trimmedDataClass,
      entitySetId: trimmedKey,
    })
  }

  return (
    <>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onMouseEnter={(event) => {
          setHovered(true)
          setModHeld(isModClick(event))
          inputProps.onMouseEnter?.(event)
        }}
        onMouseMove={(event) => {
          setModHeld(isModClick(event))
          inputProps.onMouseMove?.(event)
        }}
        onMouseLeave={(event) => {
          setHovered(false)
          setModHeld(false)
          inputProps.onMouseLeave?.(event)
        }}
        onClick={(event) => {
          inputProps.onClick?.(event)
          if (event.defaultPrevented) return
          if (!isModClick(event) || !canOpen) return
          event.preventDefault()
          openSelection()
        }}
        autoComplete="off"
        spellCheck={false}
        size={widthCh}
        title={showLink ? t('methodExecutor.openEntitySelection') : undefined}
        style={{ width: `${widthCh}ch`, fieldSizing: 'content' }}
        className={cn(
          'm-0 inline-block min-w-[1ch] appearance-none border-0 bg-transparent p-0 align-middle font-mono text-emerald-600 text-xs leading-5 outline-none ring-0 focus:outline-none dark:text-emerald-400',
          showLink && 'cursor-pointer underline underline-offset-2',
          inputProps.className
        )}
      />
    </>
  )
}
