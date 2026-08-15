import { describe, expect, it } from 'bun:test'
import { createKeyValuePair } from '~/store/http-client-types'
import { extractQueryExplain, mergeQueryExplain, queryExplainHasData } from './extract'
import {
  detectQueryExplainAccess,
  maxQueryExplainTime,
  normalizeQueryPath,
  normalizeQueryPlan,
  summarizeQueryExplain,
} from './normalize'
import { areQueryExplainParamsEnabled, setQueryExplainParams } from './params'
import { displayExplainAttribute, formatExplainIdentifier } from './parse-description'

const DOC_PLAN = {
  And: [
    {
      item: 'Join on Table : Company : People.employer = Company.ID',
      subquery: [{ item: 'Company.name = acme' }],
    },
    { item: 'People.lastName = Jones' },
  ],
}

const DOC_PATH = {
  steps: [
    {
      description: 'AND',
      time: 1,
      recordsfounds: 4,
      steps: [
        {
          description: 'Join on Table : Company : Employee.employer = Company.ID',
          time: 1,
          recordsfounds: 4,
          steps: [
            {
              steps: [
                {
                  description: 'Company.name LIKE a*',
                  time: 0,
                  recordsfounds: 2,
                },
              ],
            },
          ],
        },
        {
          description: 'Employee.lastName # smith',
          time: 0,
          recordsfounds: 4,
        },
      ],
    },
  ],
}

describe('extractQueryExplain', () => {
  it('returns null when not requested', () => {
    expect(extractQueryExplain({ __queryPlan: DOC_PLAN }, false)).toBeNull()
  })

  it('reads underscored REST keys', () => {
    const payload = extractQueryExplain({ __queryPlan: DOC_PLAN, __queryPath: DOC_PATH })
    expect(payload?.plan).toEqual(DOC_PLAN)
    expect(payload?.path).toEqual(DOC_PATH)
  })

  it('reads aliases and nested result', () => {
    const payload = extractQueryExplain({
      result: { queryPlan: { item: 'A = 1' }, queryPath: { description: 'A = 1', time: 2 } },
    })
    expect(payload?.plan).toEqual({ item: 'A = 1' })
    expect(isRecordPath(payload?.path)).toBe(true)
  })

  it('treats a bare path body as path', () => {
    const payload = extractQueryExplain(DOC_PATH)
    expect(payload?.path).toEqual(DOC_PATH)
    expect(payload?.plan).toBeNull()
  })

  it('treats a bare plan body as plan', () => {
    const payload = extractQueryExplain(DOC_PLAN)
    expect(payload?.plan).toEqual(DOC_PLAN)
    expect(payload?.path).toBeNull()
  })
})

describe('queryExplainHasData / mergeQueryExplain', () => {
  it('detects empty vs present payloads', () => {
    expect(queryExplainHasData({ requested: true, plan: null, path: null })).toBe(false)
    expect(queryExplainHasData({ requested: true, plan: DOC_PLAN, path: null })).toBe(true)
  })

  it('prefers primary fields and fills from fallback', () => {
    const merged = mergeQueryExplain(
      { requested: true, plan: DOC_PLAN, path: null },
      { requested: true, plan: null, path: DOC_PATH }
    )
    expect(merged?.plan).toEqual(DOC_PLAN)
    expect(merged?.path).toEqual(DOC_PATH)
  })
})

describe('normalizeQueryPlan', () => {
  it('builds an AND tree from the 4D docs example', () => {
    const root = normalizeQueryPlan(DOC_PLAN)
    expect(root?.label).toBe('AND')
    expect(root?.access).toBe('operator')
    expect(root?.children).toHaveLength(2)
    expect(root?.children[0]?.access).toBe('join')
    expect(root?.children[0]?.children[0]?.label).toBe('Company.name = acme')
    expect(root?.children[1]?.label).toContain('lastName')
    expect(root?.children[0]?.table).toBe('Company')
    expect(root?.children[0]?.joinOn).toEqual({
      left: 'People.employer',
      right: 'Company.ID',
    })
  })
})

describe('normalizeQueryPath', () => {
  it('unwraps empty step wrappers and keeps timings', () => {
    const root = normalizeQueryPath(DOC_PATH)
    expect(root?.label).toBe('AND')
    expect(root?.timeMs).toBe(1)
    expect(root?.recordsFound).toBe(4)
    expect(root?.children).toHaveLength(2)
    const join = root?.children[0]
    expect(join?.access).toBe('join')
    expect(join?.children[0]?.label).toContain('Company.name LIKE')
    expect(join?.children[0]?.recordsFound).toBe(2)
    expect(join?.table).toBe('Company')
    expect(join?.joinOn).toEqual({
      left: 'Employee.employer',
      right: 'Company.ID',
    })
  })

  it('summarizes sequential vs join steps', () => {
    const root = normalizeQueryPath({
      description: 'AND',
      time: 5,
      recordsfounds: 10,
      steps: [
        {
          description: 'Indexed query on Table : People : lastName = Jones',
          time: 1,
          recordsfounds: 10,
        },
        {
          description: 'Sequential scan on Table : People with filter : age > 30',
          time: 4,
          recordsfounds: 3,
        },
      ],
    })
    const summary = summarizeQueryExplain(root)
    expect(summary.timeMs).toBe(5)
    expect(summary.recordsFound).toBe(10)
    expect(summary.indexCount).toBe(1)
    expect(summary.sequentialCount).toBe(1)
    expect(maxQueryExplainTime(root)).toBe(5)
  })
})

describe('detectQueryExplainAccess', () => {
  it('classifies 4D step text', () => {
    expect(detectQueryExplainAccess('AND')).toBe('operator')
    expect(detectQueryExplainAccess('Join on Table : Company : People.employer = Company.ID')).toBe(
      'join'
    )
    expect(detectQueryExplainAccess('Indexed query on Table : People')).toBe('index')
    expect(detectQueryExplainAccess('Sequential scan on Table : People')).toBe('sequential')
    expect(detectQueryExplainAccess('People.lastName = Jones')).toBe('filter')
  })
})

describe('nested relation query (Agency.manager.employeeAgency.name)', () => {
  const PATH_BLOB =
    'Join on Table : Employee  :  Agency.ID_manager = Employee.ID with filter {Join on Table : Employee  :  Agency.ID_manager = Employee.IDJoin on Table : Agency(1)  :  Employee.ID_agency = Agency(1).ID with filter {Agency(1).name == A@}}'

  const PLAN = {
    item: 'Join on Table : Employee  :  Agency.ID_manager = Employee.ID',
    subquery: [
      {
        item: 'Join on Table : Agency(1)  :  Employee.ID_agency = Agency(1).ID',
        subquery: [{ item: 'Agency(1).name == A@' }],
      },
    ],
  }

  it('expands a concatenated path description into join → join → where', () => {
    const root = normalizeQueryPath({
      steps: [{ description: PATH_BLOB, time: 3, recordsfounds: 104 }],
    })
    expect(root?.access).toBe('join')
    expect(root?.title).toBe('Employee')
    expect(root?.table).toBe('Employee')
    expect(root?.joinOn).toEqual({
      left: 'Agency.ID_manager',
      right: 'Employee.ID',
    })
    expect(root?.timeMs).toBe(3)
    expect(root?.recordsFound).toBe(104)
    expect(root?.children).toHaveLength(1)

    const related = root?.children[0]
    expect(related?.access).toBe('join')
    expect(related?.table).toBe('Agency')
    expect(related?.tableInstance).toBe('1')
    expect(related?.joinOn).toEqual({
      left: 'Employee.ID_agency',
      right: 'Agency(1).ID',
    })
    expect(related?.children).toHaveLength(1)

    const where = related?.children[0]
    expect(where?.access).toBe('filter')
    expect(where?.predicate).toEqual({
      attribute: 'Agency(1).name',
      operator: '==',
      value: 'A@',
    })
  })

  it('parses the matching plan tree without flattening', () => {
    const root = normalizeQueryPlan(PLAN)
    expect(root?.table).toBe('Employee')
    expect(root?.children[0]?.table).toBe('Agency')
    expect(root?.children[0]?.children[0]?.access).toBe('filter')
    expect(root?.children[0]?.children[0]?.predicate?.value).toBe('A@')
  })
})

describe('AND of two relation paths (category.label and manager.employeeAgency.category.label)', () => {
  const PATH_BLOB =
    '(Join on Table : CategoryAgency(1)  :  Agency.ID_category_agency = CategoryAgency(1).ID with filter {CategoryAgency(1).label == A@a}) And (Join on Table : Employee  :  Agency.ID_manager = Employee.ID with filter {Join on Table : Employee  :  Agency.ID_manager = Employee.IDJoin on Table : Agency(1)  :  Employee.ID_agency = Agency(1).ID with filter {Join on Table : Agency(1)  :  Employee.ID_agency = Agency(1).IDJoin on Table : CategoryAgency  :  Agency(1).ID_category_agency = CategoryAgency.ID with filter {CategoryAgency.label == A@a}}})'

  const PLAN = {
    And: [
      {
        item: 'Join on Table : CategoryAgency(1)  :  Agency.ID_category_agency = CategoryAgency(1).ID',
        subquery: [{ item: 'CategoryAgency(1).label == A@a' }],
      },
      {
        item: 'Join on Table : Employee  :  Agency.ID_manager = Employee.ID',
        subquery: [
          {
            item: 'Join on Table : Agency(1)  :  Employee.ID_agency = Agency(1).ID',
            subquery: [
              {
                item: 'Join on Table : CategoryAgency  :  Agency(1).ID_category_agency = CategoryAgency.ID',
                subquery: [{ item: 'CategoryAgency.label == A@a' }],
              },
            ],
          },
        ],
      },
    ],
  }

  it('turns a parenthesized path And into AND with two join branches', () => {
    const root = normalizeQueryPath({
      steps: [{ description: PATH_BLOB, time: 2, recordsfounds: 0 }],
    })
    expect(root?.access).toBe('operator')
    expect(root?.title).toBe('AND')
    expect(root?.timeMs).toBe(2)
    expect(root?.recordsFound).toBe(0)
    expect(root?.children).toHaveLength(2)

    const direct = root?.children[0]
    expect(direct?.access).toBe('join')
    expect(direct?.table).toBe('CategoryAgency')
    expect(direct?.joinOn).toEqual({
      left: 'Agency.ID_category_agency',
      right: 'CategoryAgency(1).ID',
    })
    expect(direct?.children).toHaveLength(1)
    expect(direct?.children[0]?.access).toBe('filter')
    expect(direct?.children[0]?.predicate).toEqual({
      attribute: 'CategoryAgency(1).label',
      operator: '==',
      value: 'A@a',
    })

    const viaManager = root?.children[1]
    expect(viaManager?.access).toBe('join')
    expect(viaManager?.table).toBe('Employee')
    expect(viaManager?.children[0]?.table).toBe('Agency')
    expect(viaManager?.children[0]?.children[0]?.table).toBe('CategoryAgency')
    expect(viaManager?.children[0]?.children[0]?.children[0]?.access).toBe('filter')
    expect(viaManager?.children[0]?.children[0]?.children[0]?.predicate?.value).toBe('A@a')
  })

  it('keeps the structured plan And tree aligned with the path', () => {
    const root = normalizeQueryPlan(PLAN)
    expect(root?.access).toBe('operator')
    expect(root?.title).toBe('AND')
    expect(root?.children).toHaveLength(2)
    expect(root?.children[0]?.table).toBe('CategoryAgency')
    expect(root?.children[1]?.table).toBe('Employee')
    expect(root?.children[1]?.children[0]?.table).toBe('Agency')
    expect(root?.children[1]?.children[0]?.children[0]?.table).toBe('CategoryAgency')
  })
})

describe('formatExplainIdentifier', () => {
  it('strips 4D related-table instance numbers', () => {
    expect(formatExplainIdentifier('Agency(1).ID')).toBe('Agency.ID')
    expect(displayExplainAttribute('Agency(1).name', 'Agency')).toBe('name')
  })
})

describe('setQueryExplainParams', () => {
  it('adds both REST flags and reports enabled', () => {
    const next = setQueryExplainParams([], true)
    expect(areQueryExplainParamsEnabled(next)).toBe(true)
    expect(next.map((pair) => pair.key)).toEqual(['$queryplan', '$querypath'])
  })

  it('re-enables existing rows instead of duplicating', () => {
    const existing = [
      createKeyValuePair({ key: '$queryplan', value: 'false', enabled: false }),
      createKeyValuePair({ key: '$top', value: '20', enabled: true }),
    ]
    const next = setQueryExplainParams(existing, true)
    expect(next.filter((pair) => pair.key === '$queryplan')).toHaveLength(1)
    expect(next.find((pair) => pair.key === '$queryplan')?.value).toBe('true')
    expect(next.find((pair) => pair.key === '$top')?.value).toBe('20')
  })

  it('removes managed rows when turning off', () => {
    const enabled = setQueryExplainParams([], true)
    const off = setQueryExplainParams(enabled, false)
    expect(areQueryExplainParamsEnabled(off)).toBe(false)
    expect(off).toHaveLength(0)
  })
})

function isRecordPath(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'description' in value)
}
