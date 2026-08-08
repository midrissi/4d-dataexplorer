import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function TextCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false}>
      <Value.String value={String(value)} />
    </CellTooltipWrapper>
  )
}
