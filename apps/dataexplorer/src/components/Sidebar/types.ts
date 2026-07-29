import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpZA } from 'lucide-react'
import type { SidebarSortOption } from '~/store/settings'

export type SidebarProps = {
  collapsed?: boolean
  /** Called after a dataclass tab is opened (e.g. close mobile catalog drawer). */
  onDataclassOpened?: () => void
  /** Mobile drawer close control rendered in the sidebar header. */
  onClose?: () => void
}

export type SortOption = SidebarSortOption

export const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: 'name-asc', label: 'Name (A-Z)', icon: ArrowDownAZ },
  { value: 'name-desc', label: 'Name (Z-A)', icon: ArrowUpZA },
  { value: 'count-desc', label: 'Count (High-Low)', icon: ArrowDownWideNarrow },
  { value: 'count-asc', label: 'Count (Low-High)', icon: ArrowUpNarrowWide },
]

export const SORT_LABEL_KEYS: Record<SortOption, string> = {
  none: '',
  'name-asc': 'sidebar.nameAsc',
  'name-desc': 'sidebar.nameDesc',
  'count-asc': 'sidebar.countAsc',
  'count-desc': 'sidebar.countDesc',
}
