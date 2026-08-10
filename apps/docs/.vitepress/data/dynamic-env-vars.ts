import type { DocTableColumn, DocTableRow } from '../theme/doc-table'

/** Clock aliases (non-Faker). Full surface is `{{$faker.module.method}}`. */
export const dynamicEnvVarColumns: DocTableColumn[] = [
  { key: 'key', label: 'Variable', width: '36%' },
  { key: 'description', label: 'Description' },
]

export const dynamicEnvVarRows: DocTableRow[] = [
  { key: '`$timestamp`', description: 'Current UNIX timestamp in seconds' },
  { key: '`$isoTimestamp`', description: 'Current ISO timestamp at zero UTC' },
  {
    key: '`$faker.module.method`',
    description:
      'Any [Faker](https://fakerjs.dev/api/) method — e.g. `$faker.person.firstName`, `$faker.string.uuid`, `$faker.number.int`',
  },
]
