import { useCallback, useRef } from 'react'
import type { RuntimeArgument } from '~/store/method-executor-types'
import { pendingArgumentFlushes } from './arg-input'
import { MethodJsonEditor } from './MethodJsonEditor'

export function CustomArgumentEditor({
  argument,
  onChange,
}: {
  argument: Extract<RuntimeArgument, { kind: 'custom' }>
  onChange: (argument: RuntimeArgument) => void
}) {
  const argumentRef = useRef(argument)
  argumentRef.current = argument
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const onRegisterFlush = useCallback((flush: () => string) => {
    const wrapped = () => {
      const next = flush()
      if (next !== argumentRef.current.value) {
        onChangeRef.current({ ...argumentRef.current, value: next })
      }
    }
    pendingArgumentFlushes.add(wrapped)
    return () => {
      pendingArgumentFlushes.delete(wrapped)
      wrapped()
    }
  }, [])

  return (
    <div className="border-border/50 border-t px-2 py-1">
      <MethodJsonEditor
        value={argument.value}
        onChange={(value) => onChange({ ...argumentRef.current, value })}
        height={120}
        path={`method-executor:///arg-${argument.id}.json`}
        onRegisterFlush={onRegisterFlush}
      />
    </div>
  )
}
