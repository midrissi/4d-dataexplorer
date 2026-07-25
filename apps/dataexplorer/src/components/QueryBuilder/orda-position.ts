/** A zero-based editor position used for annotations. */
export interface EditorPosition {
  row: number
  column: number
}

/**
 * Convert a raw character offset within `text` into a zero-based `{ row, column }`
 * position. The offset is clamped to the bounds of `text`.
 */
export function offsetToEditorPosition(text: string, rawOffset: number): EditorPosition {
  const offset = Math.max(0, Math.min(rawOffset, text.length))
  let row = 0
  let lastLineBreak = -1

  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') {
      row += 1
      lastLineBreak = i
    }
  }

  return { row, column: offset - (lastLineBreak + 1) }
}
