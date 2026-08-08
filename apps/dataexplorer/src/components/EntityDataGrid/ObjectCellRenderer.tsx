import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function ObjectCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={true}>
      <Value.Object value={value as unknown[] | Record<string, unknown>} />
    </CellTooltipWrapper>
  )
}
