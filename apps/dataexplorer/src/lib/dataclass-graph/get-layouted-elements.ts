import type { DataClass } from '@4d/rest'
import type { Edge, Node } from '@xyflow/react'
import { getElk } from './elk'
import { ELK_NODE_MARGIN, estimateCardDimensions } from './estimate-card-dimensions'
import type { LayoutPoint } from './layout-point'

export type ElkLayoutEdge = {
  id: string
  sections?: Array<{
    startPoint: LayoutPoint
    bendPoints?: LayoutPoint[]
    endPoint: LayoutPoint
  }>
}

export async function getLayoutedElements<T extends { dataclass: DataClass }>(
  nodes: Node<T>[],
  edges: Edge[],
  handleOffsets: Map<string, LayoutPoint>
): Promise<{ nodes: Node<T>[]; edges: Edge[] }> {
  const dimensionsByNodeId = new Map(
    nodes.map((node) => {
      const estimated = estimateCardDimensions(node.data.dataclass)
      const cardWidth = Math.max(estimated.width, node.measured?.width ?? 0)
      const cardHeight = Math.max(estimated.height, node.measured?.height ?? 0)
      return [
        node.id,
        {
          cardWidth,
          cardHeight,
          width: cardWidth + ELK_NODE_MARGIN * 2,
          height: cardHeight + ELK_NODE_MARGIN * 2,
        },
      ] as const
    })
  )
  const portsByNodeId = new Map<
    string,
    Array<{ id: string; x: number; y: number; width: number; height: number }>
  >()

  const getPortId = (nodeId: string, handleId: string | null | undefined) => {
    if (!handleId) return null
    const offset = handleOffsets.get(`${nodeId}:${handleId}`)
    const dimensions = dimensionsByNodeId.get(nodeId)
    if (!offset || !dimensions) return null

    const portId = `${nodeId}:${handleId}`
    const nodePorts = portsByNodeId.get(nodeId) ?? []
    if (!nodePorts.some((port) => port.id === portId)) {
      const isLeft = offset.x < dimensions.cardWidth / 2
      nodePorts.push({
        id: portId,
        x: isLeft ? 0 : dimensions.width,
        y: ELK_NODE_MARGIN + offset.y,
        width: 0,
        height: 0,
      })
      portsByNodeId.set(nodeId, nodePorts)
    }
    return portId
  }

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [getPortId(edge.source, edge.sourceHandle) ?? edge.source],
    targets: [getPortId(edge.target, edge.targetHandle) ?? edge.target],
  }))

  // Build ELK graph with dimensions matching the rendered DataclassNode card
  const elkNodes = nodes.map((node) => {
    const dimensions = dimensionsByNodeId.get(node.id)
    const ports = portsByNodeId.get(node.id)

    return {
      id: node.id,
      width: dimensions?.width ?? 0,
      height: dimensions?.height ?? 0,
      ...(ports
        ? {
            ports,
            layoutOptions: {
              'elk.portConstraints': 'FIXED_POS',
            },
          }
        : {}),
    }
  })

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.nodeNode': '24',
      'elk.spacing.componentComponent': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: elkNodes,
    edges: elkEdges,
  }

  // Run ELK layout
  const layoutedGraph = await getElk().layout(elkGraph)
  const routesByEdgeId = new Map<string, LayoutPoint[]>()
  for (const edge of (layoutedGraph.edges ?? []) as ElkLayoutEdge[]) {
    const section = edge.sections?.[0]
    if (!section) continue
    routesByEdgeId.set(edge.id, [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ])
  }

  // Map positions back to React Flow nodes (offset by margin so card sits inside ELK box)
  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id)
    if (elkNode) {
      const finalX = (elkNode.x ?? 0) + ELK_NODE_MARGIN
      const finalY = (elkNode.y ?? 0) + ELK_NODE_MARGIN
      return {
        ...node,
        position: { x: finalX, y: finalY },
      }
    }
    return node
  })

  const layoutedEdges = edges.map((edge) => {
    const layoutPoints = routesByEdgeId.get(edge.id)
    if (!layoutPoints) return edge
    return {
      ...edge,
      type: 'elk',
      data: {
        ...edge.data,
        layoutPoints,
      },
    }
  })

  return { nodes: layoutedNodes, edges: layoutedEdges }
}
