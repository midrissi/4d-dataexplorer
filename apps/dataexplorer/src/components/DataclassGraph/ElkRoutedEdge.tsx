import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { getRoutedEdgePath } from '~/lib/dataclass-graph/get-routed-edge-path'
import { useGraphInteractionStore } from '~/store/graph-interaction'
import type { RoutedEdge } from './types'

export function ElkRoutedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerStart,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps<RoutedEdge>) {
  const isHovered = useGraphInteractionStore((state) => state.hoveredEdge?.id === id)
  const route = data?.layoutPoints ?? []
  const { path, labelX, labelY } = getRoutedEdgePath([
    { x: sourceX, y: sourceY },
    ...route,
    { x: targetX, y: targetY },
  ])

  return (
    <BaseEdge
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={isHovered ? label : undefined}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={{ ...style, strokeWidth: isHovered ? 3 : 2, opacity: isHovered ? 1 : 0.6 }}
      interactionWidth={interactionWidth}
    />
  )
}
