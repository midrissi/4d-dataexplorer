import { ARG_INPUT_ATTR } from './arg-input'
import { useUncontrolledCommit } from './use-uncontrolled-commit'

export function AutoSizeKeyInput({
  id,
  name,
  value,
  label,
  onChange,
}: {
  id: string
  name: string
  value: string
  label: string
  onChange: (value: string) => void
}) {
  const { inputRef, flush, onInput, onKeyDown } = useUncontrolledCommit(value, onChange)

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        defaultValue={value}
        onBlur={flush}
        onInput={(event) => {
          onInput(event)
          const el = event.currentTarget
          const widthCh = Math.max(el.value.length, 1)
          el.size = widthCh
          el.style.width = `${widthCh}ch`
        }}
        onKeyDown={onKeyDown}
        data-param-name={name}
        {...{ [ARG_INPUT_ATTR]: '' }}
        autoComplete="off"
        spellCheck={false}
        size={Math.max(value.length, 1)}
        style={{ width: `${Math.max(value.length, 1)}ch`, fieldSizing: 'content' }}
        className="m-0 inline-block min-w-[1ch] appearance-none border-0 bg-transparent p-0 align-middle font-mono text-emerald-600 text-xs leading-5 outline-none ring-0 focus:outline-none dark:text-emerald-400"
      />
    </>
  )
}
