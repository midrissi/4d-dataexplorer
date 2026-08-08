import { BaseEdge, type EdgeProps, getSmoothStepPath } from '@xyflow/react'
import { useGraphInteractionStore } from '~/store/graph-interaction'

export function InteractiveSmoothStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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
}: EdgeProps) {
  const isHovered = useGraphInteractionStore((state) => state.hoveredEdge?.id === id)
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

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
