import { EMPTY_VALUE, formatDate } from '@4d/rest'
import { Value } from '@4d/ui'
import type { ICellRendererParams } from 'ag-grid-community'
import { CellTooltipWrapper } from './CellTooltipWrapper'

export function DateCellRenderer(props: ICellRendererParams) {
  const value = props.value
  if (value === null || value === undefined) {
    return <Value.Null />
  }
  const locale = (props.context as { locale?: string } | undefined)?.locale
  const formatted = formatDate(value, undefined, locale)
  // Check if the date is a null date (like !!0000-00-00!!)
  if (formatted === EMPTY_VALUE) {
    return <Value.Null />
  }
  return (
    <CellTooltipWrapper value={value} isObject={false} formatted={formatted}>
      <Value.Date value={formatted} />
    </CellTooltipWrapper>
  )
}
