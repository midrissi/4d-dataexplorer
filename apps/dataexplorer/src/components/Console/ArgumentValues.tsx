import { useState } from 'react'
import { InlineValue } from './InlineValue'

export function ArgumentValues({ values }: { values: unknown[] }) {
  const [items] = useState(() =>
    values.map((value) => ({
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      value,
    }))
  )
  return items.map((item) => <InlineValue key={item.id} value={item.value} />)
}
