import type { ReactNode } from 'react'

const SIGNATURE_TOKEN =
  /([\s():;,]+)|(4D\.\w+(?:\.\w+)*|cs\.\w+(?:\.\w+)*)|(\b(?:Text|Object|Integer|Boolean|Long|Number|Date|Blob|Variant|Collection|EntitySelection|String|Real)\b)|(\w+)/g

export function highlightMethodSignature(signature: string): ReactNode {
  const parts: ReactNode[] = []
  let m: RegExpExecArray | null
  SIGNATURE_TOKEN.lastIndex = 0
  m = SIGNATURE_TOKEN.exec(signature)
  while (m !== null) {
    if (m[1]) {
      parts.push(
        <span key={m.index} className="text-muted-foreground">
          {m[1]}
        </span>
      )
    } else if (m[2] || m[3]) {
      parts.push(
        <span key={m.index} className="text-blue-600 dark:text-blue-400">
          {m[2] ?? m[3]}
        </span>
      )
    } else if (m[4]) {
      parts.push(
        <span key={m.index} className="text-purple-600 dark:text-purple-400">
          {m[4]}
        </span>
      )
    }
    m = SIGNATURE_TOKEN.exec(signature)
  }
  return parts.length > 0 ? parts : signature
}
