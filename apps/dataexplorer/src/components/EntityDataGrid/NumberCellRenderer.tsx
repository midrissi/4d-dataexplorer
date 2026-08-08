import { formatNumber } from '@4d/rest'
import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function NumberCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatNumber(value)}>
      <Value.Number value={value} formatter={formatNumber} />
    </CellTooltipWrapper>
  )
}
