import { formatDuration } from '@4d/rest'
import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function DurationCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatDuration(value)}>
      <Value.Duration value={value} formatter={formatDuration} />
    </CellTooltipWrapper>
  )
}
