import { describe, expect, it } from 'bun:test'
import { parseParamsText } from './parse-params-text'

describe('parseParamsText', () => {
  it('parses scalar arguments and ignores the return type', () => {
    const args = parseParamsText('authenticate($user : Text; $attempts : Integer) : Boolean')
    expect(args).toHaveLength(2)
    expect(args[0]).toMatchObject({ kind: 'string', name: '$user', value: '' })
    expect(args[1]).toMatchObject({ kind: 'number', name: '$attempts', value: '0' })
  })

  it('detects boolean and date scalar types', () => {
    const args = parseParamsText('run($flag : Boolean; $when : Date)')
    expect(args[0]).toMatchObject({ kind: 'boolean', value: false })
    expect(args[1]).toMatchObject({ kind: 'date', value: '' })
  })

  it('detects entity and entity selection types', () => {
    const args = parseParamsText(
      'run($city : cs.CityEntity, $students : cs.StudentsSelection) : Object'
    )
    expect(args[0]).toMatchObject({ kind: 'entity', dataClass: 'City', key: '' })
    expect(args[1]).toMatchObject({
      kind: 'entitysel',
      dataClass: 'Students',
      entitySetId: '',
    })
  })

  it('supports params-only catalog signatures', () => {
    expect(parseParamsText('$1 : Text')[0]).toMatchObject({
      kind: 'string',
      name: '$1',
      sourceType: 'Text',
    })
  })

  it('returns no arguments for an empty signature', () => {
    expect(parseParamsText('version() : Text')).toEqual([])
    expect(parseParamsText()).toEqual([])
  })
})
