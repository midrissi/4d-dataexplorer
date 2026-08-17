import { describe, expect, it } from 'bun:test'
import type { PickListDeclaration } from '~/lib/env'
import {
  clonePickListDeclaration,
  listTransferTargets,
  transferListToScope,
  uniquePickListName,
} from './list-scope-transfer'

const roles: PickListDeclaration = {
  id: 'src-1',
  name: 'roles',
  type: 'hardcoded',
  values: ['USER', 'ADMIN'],
}

const employeeIds: PickListDeclaration = {
  id: 'src-2',
  name: 'employeeIds',
  type: 'dataclass',
  dataclass: 'Employee',
  attribute: 'ID',
}

describe('listTransferTargets', () => {
  it('omits the current scope and base when disconnected', () => {
    expect(listTransferTargets('globals', false)).toEqual(['profile'])
    expect(listTransferTargets('globals', true)).toEqual(['profile', 'base'])
    expect(listTransferTargets('base', true)).toEqual(['globals', 'profile'])
  })
})

describe('uniquePickListName', () => {
  it('keeps the name when free and suffixes _copy when taken', () => {
    expect(uniquePickListName('roles', [])).toBe('roles')
    expect(uniquePickListName('roles', ['roles'])).toBe('roles_copy')
    expect(uniquePickListName('roles', ['roles', 'roles_copy'])).toBe('roles_copy2')
    expect(uniquePickListName('  ', ['x'])).toBe('')
  })
})

describe('clonePickListDeclaration', () => {
  it('copies values and can keep or rotate the id', () => {
    const copy = clonePickListDeclaration(roles)
    expect(copy).toEqual({ ...roles, id: copy.id, values: ['USER', 'ADMIN'] })
    expect(copy.id).not.toBe(roles.id)
    expect(copy.type).toBe('hardcoded')
    if (copy.type === 'hardcoded') {
      expect(copy.values).not.toBe(roles.values)
    }
    expect(clonePickListDeclaration(employeeIds, { keepId: true }).id).toBe('src-2')
  })
})

describe('transferListToScope', () => {
  it('duplicates with a new id and unique name', () => {
    const result = transferListToScope({
      mode: 'duplicate',
      entry: roles,
      sourceLists: [roles, employeeIds],
      targetLists: [{ id: 'dst-1', name: 'roles', type: 'hardcoded', values: ['OLD'] }],
    })
    expect(result.sourceLists).toEqual([roles, employeeIds])
    expect(result.replaced).toBeNull()
    expect(result.clone.id).not.toBe(roles.id)
    expect(result.clone.name).toBe('roles_copy')
    expect(result.targetLists).toHaveLength(2)
    expect(result.targetLists[1]).toEqual(result.clone)
  })

  it('moves while keeping the id and replacing the same name', () => {
    const existing = { id: 'dst-1', name: 'roles', type: 'hardcoded' as const, values: ['OLD'] }
    const result = transferListToScope({
      mode: 'move',
      entry: roles,
      sourceLists: [roles, employeeIds],
      targetLists: [existing],
    })
    expect(result.sourceLists).toEqual([employeeIds])
    expect(result.replaced).toEqual(existing)
    expect(result.clone.id).toBe('src-1')
    expect(result.clone.name).toBe('roles')
    expect(result.targetLists).toEqual([result.clone])
  })
})
