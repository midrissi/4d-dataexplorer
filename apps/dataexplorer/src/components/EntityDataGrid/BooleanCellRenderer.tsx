import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function BooleanCellRenderer(props: ICellRendererParams) {
  if (props.value === null || props.value === undefined) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={props.value} isObject={false}>
      <Value.Boolean value={props.value} format="truefalse" />
    </CellTooltipWrapper>
  )
}
