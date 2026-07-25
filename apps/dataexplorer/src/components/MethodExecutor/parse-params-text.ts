import type { RuntimeArgument } from '~/store/method-executor-types'

const ENTITY_SELECTION_TYPE = /(?:^|\.)(?:4D\.)?(?:EntitySelection|[\w$]+Selection)$/i
const ENTITY_TYPE = /(?:^|\.)(?:4D\.)?(?:Entity|[\w$]+Entity)$/i

function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(' || char === '<' || char === '[') depth += 1
    if (char === ')' || char === '>' || char === ']') depth = Math.max(0, depth - 1)
    if ((char === ',' || char === ';') && depth === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts.filter(Boolean)
}

function argumentList(paramsText: string): string {
  const text = paramsText.trim()
  const open = text.indexOf('(')
  if (open >= 0) {
    let depth = 0
    for (let index = open; index < text.length; index += 1) {
      const char = text[index]
      if (char === '(') depth += 1
      if (char === ')') {
        depth -= 1
        if (depth === 0) return text.slice(open + 1, index)
      }
    }
  }
  return text
}

function dataclassFromType(type: string, suffix: 'Entity' | 'Selection'): string {
  const parts = type.split('.')
  const simple = parts[parts.length - 1] ?? ''
  if (!simple.toLowerCase().endsWith(suffix.toLowerCase())) return ''
  const name = simple.slice(0, -suffix.length)
  return name === '4D' ? '' : name
}

function scalarFromType(
  type: string
): Extract<RuntimeArgument, { kind: 'string' | 'number' | 'boolean' | 'date' | 'custom' }>['kind'] {
  const normalized = type.toLowerCase()
  if (/(boolean|bool)/.test(normalized)) return 'boolean'
  if (/(integer|long|real|number|int|float|double|byte|word)/.test(normalized)) return 'number'
  if (/\bdate\b/.test(normalized)) return 'date'
  if (/(text|string)/.test(normalized)) return 'string'
  return 'custom'
}

function customDefault(type: string): string {
  const normalized = type.toLowerCase()
  if (/(collection|array)/.test(normalized)) return '[]'
  if (/(object)/.test(normalized)) return '{}'
  if (/(time|uuid)/.test(normalized)) return '""'
  return 'null'
}

export function parseParamsText(paramsText?: string): RuntimeArgument[] {
  if (!paramsText?.trim()) return []
  const list = argumentList(paramsText)
  if (!list.trim()) return []

  return splitTopLevel(list).map((raw, index) => {
    const match = raw.match(/^\s*(\$[\w$]+|\$\d+|[\w$]+)?\s*(?::\s*(.+?))?\s*$/)
    const name = match?.[1] || `$${index + 1}`
    const sourceType = match?.[2]?.trim() || 'Variant'
    const id = crypto.randomUUID()

    if (ENTITY_SELECTION_TYPE.test(sourceType)) {
      return {
        id,
        kind: 'entitysel' as const,
        name,
        sourceType,
        dataClass: dataclassFromType(sourceType, 'Selection'),
        entitySetId: '',
      }
    }
    if (ENTITY_TYPE.test(sourceType)) {
      return {
        id,
        kind: 'entity' as const,
        name,
        sourceType,
        dataClass: dataclassFromType(sourceType, 'Entity'),
        key: '',
      }
    }

    const kind = scalarFromType(sourceType)
    if (kind === 'boolean') {
      return { id, kind, name, sourceType, value: false }
    }
    if (kind === 'number') {
      return { id, kind, name, sourceType, value: '0' }
    }
    if (kind === 'date') {
      return { id, kind, name, sourceType, value: '' }
    }
    if (kind === 'string') {
      return { id, kind, name, sourceType, value: '' }
    }
    return {
      id,
      kind: 'custom' as const,
      name,
      sourceType,
      value: customDefault(sourceType),
    }
  })
}
