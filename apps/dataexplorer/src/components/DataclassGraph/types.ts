import type { DataClass } from '@4d/rest'
import type { Edge } from '@xyflow/react'
import type { LayoutPoint } from '~/lib/dataclass-graph/layout-point'
import type { DataclassCustomization } from '~/store/settings'

export type { LayoutPoint }

export type DataclassNodeData = {
  dataclass: DataClass
  customization?: DataclassCustomization
  foreignKeys: Set<string> // Attributes that are foreign keys (source of relation)
  primaryKeyTargets: Set<string> // Primary keys that are targets of relations
  onCustomizeClick?: (dataclassName: string) => void
  onViewDataClick?: (dataclassName: string) => void
  /** Handles actually connected by current edges; unset = show all (e.g. before edges computed) */
  usedSourceHandles?: Set<string>
  usedTargetHandles?: Set<string>
}

export type RoutedEdgeData = {
  layoutPoints?: LayoutPoint[]
}

export type RoutedEdge = Edge<RoutedEdgeData, 'elk'>

export const GRAPH_DETAIL_ZOOM_THRESHOLD = 0.55

export type { ElkLayoutEdge } from '~/lib/dataclass-graph/get-layouted-elements'
