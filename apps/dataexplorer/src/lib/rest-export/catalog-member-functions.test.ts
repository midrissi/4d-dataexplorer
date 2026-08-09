import { describe, expect, it } from 'bun:test'
import {
  dataClassesWithMemberFunctions,
  hasMemberFunctions,
  memberFunctionCount,
} from './catalog-member-functions'

const company = {
  name: 'Company',
  methods: [
    { name: 'allActive', exposed: true },
    { name: 'hidden', exposed: false },
  ],
}

const region = {
  name: 'Region',
  methods: [],
}

const color: { name: string; methods?: typeof company.methods } = {
  name: 'Color',
}

describe('catalog member functions', () => {
  it('counts exposed methods by default', () => {
    expect(memberFunctionCount(company)).toBe(1)
    expect(memberFunctionCount(company, true)).toBe(2)
    expect(memberFunctionCount(region)).toBe(0)
    expect(memberFunctionCount(color)).toBe(0)
  })

  it('filters dataclasses that have member functions', () => {
    expect(hasMemberFunctions(company)).toBe(true)
    expect(hasMemberFunctions(region)).toBe(false)
    expect(dataClassesWithMemberFunctions([company, region, color]).map((dc) => dc.name)).toEqual([
      'Company',
    ])
    expect(dataClassesWithMemberFunctions([company, region], true).map((dc) => dc.name)).toEqual([
      'Company',
    ])
  })
})
