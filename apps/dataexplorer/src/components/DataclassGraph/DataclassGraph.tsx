import type { DataClass, DatastoreMethod, SingletonFull } from '@4d/rest'
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import {
  Background,
  Controls,
  type Edge,
  type EdgeTypes,
  type InternalNode,
  MarkerType,
  MiniMap,
  type Node,
  type NodeTypes,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Eye,
  EyeOff,
  Globe,
  GlobeLock,
  LayoutGrid,
  Link2,
  Loader2,
  Maximize,
  Play,
  Sparkles,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import { client } from '~/lib/api'
import { isAssistantExposedMethod } from '~/lib/assistant-exposed-method'
import { terminateElkWorker } from '~/lib/dataclass-graph/elk'
import { estimateCardDimensions } from '~/lib/dataclass-graph/estimate-card-dimensions'
import { getLayoutedElements } from '~/lib/dataclass-graph/get-layouted-elements'
import type { LayoutPoint } from '~/lib/dataclass-graph/layout-point'
import { getMethodParamsText, getMethodReactKey } from '~/lib/dataclass-graph/method-meta'
import { buildDataclassGraphModel } from '~/lib/dataclass-graph-model'
import { eventBus } from '~/lib/eventBus'
import { pickEdgeHandleSides } from '~/lib/graph-edge-handles'
import {
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  isGraphViewportValid,
  normalizeGraphViewport,
} from '~/lib/graph-viewport'
import {
  getDataclassCustomizations,
  getGraphEditorState,
  saveGraphEditorState,
} from '~/lib/storage'
import { useTheme } from '~/providers/ThemeProvider'
import { useGraphInteractionStore } from '~/store/graph-interaction'
import { type DataclassCustomization, useSettingsStore } from '~/store/settings'
import { useTabsStore } from '~/store/tabs'
import { DataclassCustomizeModal } from '../DataclassCustomizeModal'
import { DataclassNode } from './DataclassNode'
import { ElkRoutedEdge } from './ElkRoutedEdge'
import { highlightMethodSignature } from './highlight-method-signature'
import { InteractiveSmoothStepEdge } from './InteractiveSmoothStepEdge'
import { type DataclassNodeData, GRAPH_DETAIL_ZOOM_THRESHOLD, type RoutedEdgeData } from './types'

const nodeTypes: NodeTypes = {
  dataclass: memo(DataclassNode),
}

const edgeTypes: EdgeTypes = {
  interactive: memo(InteractiveSmoothStepEdge),
  elk: memo(ElkRoutedEdge),
}

type RelationFilter = 'all' | 'none' | 'selected'

export function DataclassGraph() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const [catalog, setCatalog] = useState<DataClass[]>([])
  const [singletons, setSingletons] = useState<SingletonFull[]>([])
  const [catalogMethods, setCatalogMethods] = useState<DatastoreMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customizations, setCustomizations] = useState<Record<string, DataclassCustomization>>({})
  const [layoutRoutes, setLayoutRoutes] = useState<Record<string, LayoutPoint[]>>({})
  const [relationFilter, setRelationFilter] = useState<RelationFilter>('all')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isAutoOrganizing, setIsAutoOrganizing] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false)
  const [customizeDataclassName, setCustomizeDataclassName] = useState<string | null>(null)
  const [singletonsSectionOpen, setSingletonsSectionOpen] = useState(false)
  const [catalogMethodsSectionOpen, setCatalogMethodsSectionOpen] = useState(false)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const moveEndHandlerRef = useRef<(() => void) | null>(null)
  const hasRestoredViewportRef = useRef(false)
  const fitViewRequestRef = useRef(0)
  const layoutRequestRef = useRef(0)
  const completedLayoutRequestRef = useRef(0)
  const programmaticViewportRef = useRef(false)
  const programmaticViewportTimerRef = useRef<number | null>(null)
  /** Positions from the latest auto-organize; prevents the sync effect from reverting them. */
  const pendingLayoutPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const pendingLayoutRoutesRef = useRef<Record<string, LayoutPoint[]> | null>(null)
  const reactFlowInstanceRef = useRef<{
    fitView: (options?: {
      nodes?: Array<{ id: string }>
      padding?: number
      duration?: number
      minZoom?: number
      maxZoom?: number
    }) => void
    getNode: (nodeId: string) => Node | undefined
    getInternalNode: (nodeId: string) => InternalNode | undefined
    setViewport?: (
      viewport: { x: number; y: number; zoom: number },
      options?: { duration?: number }
    ) => void
  } | null>(null)

  const setDataclassCustomization = useSettingsStore((s) => s.setDataclassCustomization)
  const setDataclassPositions = useSettingsStore((s) => s.setDataclassPositions)
  const setInteractionSelectedNodeId = useGraphInteractionStore((s) => s.setSelectedNodeId)
  const setHoveredEdge = useGraphInteractionStore((s) => s.setHoveredEdge)
  const setOverview = useGraphInteractionStore((s) => s.setOverview)
  const setOverviewEdgesVisible = useGraphInteractionStore((s) => s.setOverviewEdgesVisible)
  const overviewMode = useGraphInteractionStore((s) => s.overview)
  const openTab = useTabsStore((s) => s.openTab)
  const openMethodExecutorTab = useTabsStore((s) => s.openMethodExecutorTab)

  const handleCustomizeClick = useCallback((dataclassName: string) => {
    setCustomizeDataclassName(dataclassName)
    setCustomizeModalOpen(true)
  }, [])

  const handleViewDataClick = useCallback(
    (dataclassName: string) => {
      openTab(dataclassName)
    },
    [openTab]
  )

  const markProgrammaticViewport = useCallback((durationMs = 600) => {
    programmaticViewportRef.current = true
    if (programmaticViewportTimerRef.current != null) {
      window.clearTimeout(programmaticViewportTimerRef.current)
    }
    programmaticViewportTimerRef.current = window.setTimeout(() => {
      programmaticViewportRef.current = false
      programmaticViewportTimerRef.current = null
    }, durationMs)
  }, [])

  useEffect(() => {
    return () => {
      if (programmaticViewportTimerRef.current != null) {
        window.clearTimeout(programmaticViewportTimerRef.current)
      }
      fitViewRequestRef.current += 1
      layoutRequestRef.current += 1
      terminateElkWorker()
      useGraphInteractionStore.getState().setSelectedNodeId(null)
      useGraphInteractionStore.getState().setHoveredEdge(null)
      useGraphInteractionStore.getState().setOverview(false)
      useGraphInteractionStore.getState().setOverviewEdgesVisible(false)
    }
  }, [])

  // Check for saved viewport early to prevent fitView from overriding it
  const savedViewport = useMemo(() => {
    const savedState = getGraphEditorState()
    if (savedState.zoom !== undefined && savedState.center) {
      const candidate = {
        x: savedState.center.x,
        y: savedState.center.y,
        zoom: savedState.zoom,
      }
      return isGraphViewportValid(candidate) ? normalizeGraphViewport(candidate) : null
    }
    return null
  }, [])

  useEffect(() => {
    setOverview((savedViewport?.zoom ?? 1) < GRAPH_DETAIL_ZOOM_THRESHOLD)
  }, [savedViewport, setOverview])

  // Fetch catalog and load customizations (also on sidebar/command catalog reload).
  useEffect(() => {
    let cancelled = false

    async function fetchCatalog() {
      try {
        setLoading(true)
        const result = await client.catalog.getAllWithMetadataCached()
        if (cancelled) return
        const dataClasses = result.dataClasses || []
        setOverview(
          savedViewport
            ? savedViewport.zoom < GRAPH_DETAIL_ZOOM_THRESHOLD
            : dataClasses.length >= 100
        )
        setCatalog(dataClasses)
        setSingletons(result.singletons ?? [])
        setCatalogMethods(result.methods ?? [])
        // Load customizations from storage (now that base BASEID is set)
        const stored = getDataclassCustomizations() as Record<string, DataclassCustomization>
        setCustomizations(stored)
        // Sync to Zustand store so sidebar can see them
        // Update store state directly so sidebar can access customizations immediately
        useSettingsStore.setState({ dataclassCustomizations: stored })
        // Load graph editor state
        const savedState = getGraphEditorState()
        if (savedState.relationFilter) {
          setRelationFilter(savedState.relationFilter)
        }
        // If we have a saved viewport, don't use fitView
        if (savedViewport) {
          setIsInitialLoad(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('dataclassGraph.failedToLoadCatalog'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchCatalog()
    const subscription = eventBus.on('catalog-reloaded', () => {
      void fetchCatalog()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [savedViewport, setOverview, t])

  // Color map for edges
  const edgeColorMap = useMemo<Record<string, string>>(
    () => ({
      red: '#ef4444',
      orange: '#f97316',
      amber: '#f59e0b',
      yellow: '#eab308',
      lime: '#84cc16',
      green: '#22c55e',
      emerald: '#10b981',
      teal: '#14b8a6',
      cyan: '#06b6d4',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a855f7',
      pink: '#ec4899',
      rose: '#f43f5e',
      default: '#6366f1', // indigo as default
    }),
    []
  )

  const graphModel = useMemo(() => buildDataclassGraphModel(catalog), [catalog])

  // Create nodes
  const initialNodes = useMemo((): Node<DataclassNodeData>[] => {
    return catalog.map((dc, index) => {
      const customization = customizations[dc.name]
      const savedPosition = customization?.position

      // Default grid position if no saved position
      const defaultX = (index % 4) * 350
      const defaultY = Math.floor(index / 4) * 300

      // Dimension hints let onlyRenderVisibleElements cull off-screen cards before
      // they are measured, so opening/reloading the graph doesn't render all cards.
      const { width, height } = estimateCardDimensions(dc)

      return {
        id: dc.name,
        type: 'dataclass',
        position: savedPosition || { x: defaultX, y: defaultY },
        initialWidth: width,
        initialHeight: height,
        data: {
          dataclass: dc,
          customization,
          foreignKeys: graphModel.foreignKeysByDataclass.get(dc.name) || new Set(),
          primaryKeyTargets: graphModel.primaryKeyTargetsByDataclass.get(dc.name) || new Set(),
          onCustomizeClick: handleCustomizeClick,
          onViewDataClick: handleViewDataClick,
        },
      }
    })
  }, [catalog, customizations, graphModel, handleCustomizeClick, handleViewDataClick])

  // Create edges from relations (base edges with logical handle ids; optimal handles set below)
  const allEdges = useMemo((): Edge[] => {
    const edges: Edge[] = []

    for (const relation of graphModel.relations) {
      const sourceCustomization = customizations[relation.source]
      const colorKey = sourceCustomization?.color || 'default'
      const strokeColor = edgeColorMap[colorKey] || edgeColorMap.default
      const labelText = relation.inverseName
        ? `① ${relation.sourceAttribute}  →  ⓝ ${relation.inverseName}`
        : `① ${relation.sourceAttribute}  →  ⓝ`

      edges.push({
        id: relation.id,
        source: relation.source,
        sourceHandle: `fk-${relation.sourceForeignKey}`,
        target: relation.target,
        targetHandle: `pk-${relation.targetPrimaryKey}`,
        type: 'interactive',
        zIndex: -1,
        style: {
          stroke: strokeColor,
          strokeWidth: 2,
          opacity: 0.6,
        },
        label: labelText,
        labelStyle: {
          fontSize: 11,
          fontWeight: 600,
          fill: 'var(--foreground)',
        },
        labelBgStyle: {
          fill: 'var(--card)',
          fillOpacity: 0.95,
          stroke: strokeColor,
          strokeWidth: 1,
        },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
      })
    }

    return edges
  }, [customizations, graphModel, edgeColorMap])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)

  // Map of node id -> bounds for O(1) handle-side picks (avoids O(edges*nodes) scans).
  // The Map reference is kept stable across data-only node updates (e.g. selecting
  // a dataclass) so `optimalEdges`/`edges` are not rebuilt unless geometry changes.
  const nodeBoundsCacheRef = useRef<{
    signature: string
    map: Map<string, { x: number; y: number; width: number; height: number }>
  }>({
    signature: '',
    map: new Map(),
  })
  const nodeBoundsById = useMemo(() => {
    let signature = ''
    for (const node of nodes) {
      const estimated = estimateCardDimensions(node.data.dataclass)
      const width = Math.max(estimated.width, node.measured?.width ?? 0, node.initialWidth ?? 0)
      const height = Math.max(estimated.height, node.measured?.height ?? 0, node.initialHeight ?? 0)
      signature += `${node.id}:${node.position.x},${node.position.y},${width},${height};`
    }
    if (signature === nodeBoundsCacheRef.current.signature) {
      return nodeBoundsCacheRef.current.map
    }
    const map = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const node of nodes) {
      const estimated = estimateCardDimensions(node.data.dataclass)
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: Math.max(estimated.width, node.measured?.width ?? 0, node.initialWidth ?? 0),
        height: Math.max(estimated.height, node.measured?.height ?? 0, node.initialHeight ?? 0),
      })
    }
    nodeBoundsCacheRef.current = { signature, map }
    return map
  }, [nodes])

  // Pick left/right handles from node bounds so edges face the other card
  // (avoids wrapping behind the source when cards are stacked vertically).
  const optimalEdges = useMemo((): Edge[] => {
    return allEdges.map((edge) => {
      const sourceBounds = nodeBoundsById.get(edge.source)
      const targetBounds = nodeBoundsById.get(edge.target)
      const sourceBase = (edge.sourceHandle as string) ?? ''
      const targetBase = (edge.targetHandle as string) ?? ''

      // Default: source right, target left (original behavior when positions unknown)
      let sourceHandle = `${sourceBase}-right`
      let targetHandle = `${targetBase}-left`

      if (sourceBounds && targetBounds) {
        const { sourceSide, targetSide } = pickEdgeHandleSides(sourceBounds, targetBounds)
        sourceHandle = `${sourceBase}-${sourceSide}`
        targetHandle = `${targetBase}-${targetSide}`
      }

      return {
        ...edge,
        sourceHandle,
        targetHandle,
      }
    })
  }, [allEdges, nodeBoundsById])

  const selectedRelationIds =
    relationFilter === 'selected' && selectedNodeId
      ? graphModel.incidentRelationIdsByDataclass.get(selectedNodeId)
      : undefined

  // Filter edges based on relationFilter
  const initialEdges = useMemo((): Edge[] => {
    let filteredEdges: Edge[]
    if (relationFilter === 'none') {
      filteredEdges = []
    } else if (relationFilter === 'selected') {
      filteredEdges = selectedRelationIds
        ? optimalEdges.filter((edge) => selectedRelationIds.has(edge.id))
        : []
    } else {
      filteredEdges = optimalEdges
    }

    return filteredEdges.map((edge) => {
      const layoutPoints = layoutRoutes[edge.id]
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
  }, [optimalEdges, relationFilter, selectedRelationIds, layoutRoutes])

  // ELK bend points were computed for specific ports; drop them when handle sides
  // flip (e.g. after drag/re-layout) so SmoothStep can use the new sides.
  const edgeHandleSignature = useMemo(
    () =>
      optimalEdges
        .map((e) => `${e.id}:${e.sourceHandle ?? ''}→${e.targetHandle ?? ''}`)
        .sort()
        .join('|'),
    [optimalEdges]
  )
  const edgeHandleSignatureRef = useRef(edgeHandleSignature)
  useEffect(() => {
    if (edgeHandleSignatureRef.current === edgeHandleSignature) return
    edgeHandleSignatureRef.current = edgeHandleSignature
    pendingLayoutRoutesRef.current = null
    setLayoutRoutes((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [edgeHandleSignature])

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const renderedEdges = overviewMode && relationFilter === 'all' ? [] : edges

  useEffect(() => {
    setOverviewEdgesVisible(overviewMode && renderedEdges.length > 0)
  }, [overviewMode, renderedEdges.length, setOverviewEdgesVisible])

  // Stable key for "which handles are used" so we only update nodes when this actually changed.
  // Avoids loop: setNodes -> nodes change -> optimalEdges/initialEdges new refs -> effect re-run.
  const usedHandlesSignature = useMemo(
    () =>
      initialEdges
        .map((e) => `${e.source}:${e.sourceHandle ?? ''}\t${e.target}:${e.targetHandle ?? ''}`)
        .sort()
        .join('\n'),
    [initialEdges]
  )

  const prevSyncRef = useRef<{
    initialNodes: Node<DataclassNodeData>[]
    usedHandlesSignature: string
  } | null>(null)

  // Update nodes when catalog/customizations or used-handles content change (not ref change)
  useEffect(() => {
    const sameContent =
      prevSyncRef.current?.usedHandlesSignature === usedHandlesSignature &&
      prevSyncRef.current?.initialNodes === initialNodes
    if (sameContent) {
      return
    }
    prevSyncRef.current = { initialNodes, usedHandlesSignature }

    const byNode = new Map<string, { sourceHandles: Set<string>; targetHandles: Set<string> }>()
    for (const edge of initialEdges) {
      const sh = edge.sourceHandle as string
      const th = edge.targetHandle as string
      if (sh) {
        const entry = byNode.get(edge.source) ?? {
          sourceHandles: new Set<string>(),
          targetHandles: new Set<string>(),
        }
        entry.sourceHandles.add(sh)
        byNode.set(edge.source, entry)
      }
      if (th) {
        const entry = byNode.get(edge.target) ?? {
          sourceHandles: new Set<string>(),
          targetHandles: new Set<string>(),
        }
        entry.targetHandles.add(th)
        byNode.set(edge.target, entry)
      }
    }

    setNodes((currentNodes) => {
      if (initialNodes.length === 0) {
        return currentNodes
      }

      const positionMap = new Map(currentNodes.map((node) => [node.id, node.position]))
      const pendingLayout = pendingLayoutPositionsRef.current
      return initialNodes.map((newNode) => {
        const currentPosition = positionMap.get(newNode.id)
        const layoutPosition = pendingLayout?.get(newNode.id)
        const handles = byNode.get(newNode.id)
        return {
          ...newNode,
          position: layoutPosition ?? currentPosition ?? newNode.position,
          data: {
            ...newNode.data,
            usedSourceHandles: handles?.sourceHandles,
            usedTargetHandles: handles?.targetHandles,
          },
        }
      })
    })
  }, [initialNodes, setNodes, initialEdges, usedHandlesSignature])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  // Save position when node is moved
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      pendingLayoutRoutesRef.current = null
      setLayoutRoutes({})
      const existing = customizations[node.id] || {}
      const updated = {
        ...existing,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      }
      setDataclassCustomization(node.id, updated)
      setCustomizations((prev) => ({ ...prev, [node.id]: updated }))
    },
    [customizations, setDataclassCustomization]
  )

  // Auto-organize layout using ELK
  const handleAutoOrganize = useCallback(async () => {
    if (nodes.length === 0 || isAutoOrganizing) return

    const requestId = ++layoutRequestRef.current
    setIsAutoOrganizing(true)

    try {
      const handleOffsets = new Map<string, LayoutPoint>()
      for (const node of nodes) {
        const handleBounds = reactFlowInstanceRef.current?.getInternalNode(node.id)?.internals
          .handleBounds
        for (const handle of [...(handleBounds?.source ?? []), ...(handleBounds?.target ?? [])]) {
          if (!handle.id) continue
          handleOffsets.set(`${node.id}:${handle.id}`, {
            x: handle.x + handle.width / 2,
            y: handle.y + handle.height / 2,
          })
        }
      }

      // Layout all cards with the currently visible topology. In selected-only mode,
      // unrelated cards become disconnected ELK components, reproducing the focused
      // layout while still reserving their full rendered dimensions.
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
        nodes,
        initialEdges,
        handleOffsets
      )
      if (requestId !== layoutRequestRef.current) return
      const nextLayoutRoutes: Record<string, LayoutPoint[]> = {}
      for (const edge of layoutedEdges) {
        const layoutPoints = (edge.data as RoutedEdgeData | undefined)?.layoutPoints
        if (layoutPoints) {
          nextLayoutRoutes[edge.id] = layoutPoints
        }
      }

      const layoutPositions = new Map(
        layoutedNodes.map((node) => [node.id, node.position] as const)
      )
      pendingLayoutPositionsRef.current = layoutPositions
      setOverview(true)
      graphContainerRef.current?.setAttribute('data-graph-detail', 'overview')
      pendingLayoutRoutesRef.current = nextLayoutRoutes

      const positions: Record<string, { x: number; y: number }> = {}
      for (const node of layoutedNodes) {
        positions[node.id] = {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        }
      }
      setNodes(layoutedNodes)
      completedLayoutRequestRef.current = requestId
      graphContainerRef.current?.setAttribute('data-layout-completed', String(requestId))

      requestAnimationFrame(() => {
        const instance = reactFlowInstanceRef.current
        if (instance) {
          markProgrammaticViewport(550)
          instance.fitView({
            padding: 0.2,
            duration: 500,
            minZoom: GRAPH_MIN_ZOOM,
            maxZoom: GRAPH_MAX_ZOOM,
          })
        }
        pendingLayoutPositionsRef.current = null
        const persist = () => setDataclassPositions(positions)
        const idleWindow = window as Window & {
          requestIdleCallback?: (
            callback: IdleRequestCallback,
            options?: IdleRequestOptions
          ) => number
        }
        if (idleWindow.requestIdleCallback) {
          idleWindow.requestIdleCallback(persist, { timeout: 2000 })
        } else {
          globalThis.setTimeout(persist, 0)
        }
      })
    } catch (err) {
      pendingLayoutPositionsRef.current = null
      console.error('Auto-organize failed:', err)
    } finally {
      if (requestId === layoutRequestRef.current) {
        setIsAutoOrganizing(false)
      }
    }
  }, [
    nodes,
    initialEdges,
    isAutoOrganizing,
    setNodes,
    setDataclassPositions,
    setOverview,
    markProgrammaticViewport,
  ])

  // Handle node click for selection (pane click clears; don't toggle off on repeat click)
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setInteractionSelectedNodeId(node.id)
    },
    [setInteractionSelectedNodeId]
  )

  // Handle pane click to deselect
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setInteractionSelectedNodeId(null)
  }, [setInteractionSelectedNodeId])

  // Edge hover handlers
  const handleEdgeMouseEnter = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setHoveredEdge({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? undefined,
        target: edge.target,
        targetHandle: edge.targetHandle ?? undefined,
      })
    },
    [setHoveredEdge]
  )

  const handleEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null)
  }, [setHoveredEdge])

  // Save relation filter when it changes
  useEffect(() => {
    if (!isInitialLoad) {
      const savedState = getGraphEditorState()
      saveGraphEditorState({
        ...savedState,
        relationFilter,
      })
    }
  }, [relationFilter, isInitialLoad])

  // Handler for viewport changes
  const handleMoveStart = useCallback(() => {
    graphContainerRef.current?.setAttribute('data-graph-moving', 'true')
  }, [])

  const handleMove = useCallback(
    (_: MouseEvent | TouchEvent | null, viewport: { zoom: number }) => {
      const overview = viewport.zoom < GRAPH_DETAIL_ZOOM_THRESHOLD
      const detail = overview ? 'overview' : 'full'
      if (graphContainerRef.current?.dataset.graphDetail !== detail) {
        graphContainerRef.current?.setAttribute('data-graph-detail', detail)
        setOverview(overview)
      }
    },
    [setOverview]
  )

  const handleMoveEnd = useCallback(() => {
    graphContainerRef.current?.removeAttribute('data-graph-moving')
    if (graphContainerRef.current?.dataset.graphDetail === 'full') {
      const pendingRoutes = pendingLayoutRoutesRef.current
      if (pendingRoutes) {
        pendingLayoutRoutesRef.current = null
        setLayoutRoutes(pendingRoutes)
      }
    }
    if (moveEndHandlerRef.current) {
      moveEndHandlerRef.current()
    }
  }, [])

  const fitToDataclass = useCallback(
    (dataclassName: string) => {
      const requestId = ++fitViewRequestRef.current

      const tryFitView = (attempts = 0) => {
        if (requestId !== fitViewRequestRef.current) {
          return
        }

        const instance = reactFlowInstanceRef.current
        if (instance) {
          const node = instance.getNode(dataclassName)
          if (node) {
            markProgrammaticViewport(550)
            instance.fitView({
              nodes: [{ id: dataclassName }],
              padding: 0.2,
              duration: 500,
              minZoom: GRAPH_MIN_ZOOM,
              maxZoom: 1.2,
            })
            return
          }
          if (attempts < 20) {
            window.setTimeout(() => tryFitView(attempts + 1), 100)
          }
          return
        }

        if (attempts < 20) {
          window.setTimeout(() => tryFitView(attempts + 1), 100)
        }
      }

      tryFitView()
    },
    [markProgrammaticViewport]
  )

  // Fit all nodes into view
  const handleFitView = useCallback(() => {
    const instance = reactFlowInstanceRef.current
    if (!instance) return
    markProgrammaticViewport(550)
    instance.fitView({
      padding: 0.2,
      duration: 500,
      minZoom: GRAPH_MIN_ZOOM,
      maxZoom: GRAPH_MAX_ZOOM,
    })
  }, [markProgrammaticViewport])

  // Listen for highlight events
  useEffect(() => {
    const subscription = eventBus.on('highlight-dataclass-in-graph', (dataclassName) => {
      if (typeof dataclassName !== 'string') {
        return
      }

      const exists = catalog.some((dc) => dc.name === dataclassName)
      if (!exists) {
        return
      }

      setSelectedNodeId(dataclassName)
      setInteractionSelectedNodeId(dataclassName)
      fitToDataclass(dataclassName)
    })
    if (catalog.length > 0) {
      useTabsStore.getState().notifyGraphTabReady()
    }
    return () => {
      subscription.unsubscribe()
      fitViewRequestRef.current += 1
    }
  }, [catalog, fitToDataclass, setInteractionSelectedNodeId])

  useEffect(() => {
    const subs = [
      eventBus.on('graph-auto-organize', () => {
        void handleAutoOrganize()
      }),
      eventBus.on('graph-set-relation-filter', (filter) => {
        if (filter === 'all' || filter === 'selected' || filter === 'none') {
          setRelationFilter(filter)
        }
      }),
      eventBus.on('graph-toggle-singletons', () => {
        setSingletonsSectionOpen((open) => !open)
      }),
      eventBus.on('graph-select-dataclass', (dataclassName) => {
        if (typeof dataclassName === 'string') {
          setSelectedNodeId(dataclassName)
          setInteractionSelectedNodeId(dataclassName)
        }
      }),
      eventBus.on('graph-deselect', () => {
        setSelectedNodeId(null)
        setInteractionSelectedNodeId(null)
      }),
    ]
    return () => {
      for (const sub of subs) sub.unsubscribe()
    }
  }, [handleAutoOrganize, setInteractionSelectedNodeId])

  // Inner component to handle viewport restoration and saving
  function GraphViewportManager() {
    const reactFlowInstance = useReactFlow()
    const updateNodeInternals = useUpdateNodeInternals()
    const overview = useGraphInteractionStore((state) => state.overview)
    const previousOverviewRef = useRef(overview)
    const { setViewport, getViewport, fitView, getNode, getInternalNode } = reactFlowInstance
    const saveTimeoutRef = useRef<number | null>(null)

    // Expose ReactFlow functions to parent via ref
    useEffect(() => {
      reactFlowInstanceRef.current = { fitView, getNode, getInternalNode, setViewport }
      return () => {
        reactFlowInstanceRef.current = null
      }
    }, [fitView, getNode, getInternalNode, setViewport])

    useEffect(() => {
      if (previousOverviewRef.current === overview) return
      previousOverviewRef.current = overview
      const frame = requestAnimationFrame(() => {
        updateNodeInternals(nodes.map((node) => node.id))
      })
      return () => cancelAnimationFrame(frame)
    }, [overview, updateNodeInternals])

    // Restore viewport when catalog is loaded (only once, never restore again)
    // This effect runs when setViewport becomes available AND when catalog becomes ready
    // loading and catalog.length are accessed via closure from parent component
    useEffect(() => {
      if (!hasRestoredViewportRef.current && !loading && catalog.length > 0) {
        const savedState = getGraphEditorState()
        if (savedState.zoom !== undefined && savedState.center) {
          const candidate = {
            x: savedState.center.x,
            y: savedState.center.y,
            zoom: savedState.zoom,
          }
          if (isGraphViewportValid(candidate)) {
            setViewport(normalizeGraphViewport(candidate), { duration: 0 })
          }
        }
        hasRestoredViewportRef.current = true
        setIsInitialLoad(false)
      }
    }, [setViewport])

    // Save viewport when it changes (debounced)
    const handleMoveEndInternal = useCallback(() => {
      if (!hasRestoredViewportRef.current || programmaticViewportRef.current) {
        return
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        if (programmaticViewportRef.current) {
          return
        }

        const viewport = normalizeGraphViewport(getViewport())
        if (!isGraphViewportValid(viewport)) {
          return
        }

        const savedState = getGraphEditorState()
        saveGraphEditorState({
          ...savedState,
          zoom: viewport.zoom,
          center: { x: viewport.x, y: viewport.y },
        })
      }, 300)
    }, [getViewport])

    // Expose handler via ref
    useEffect(() => {
      moveEndHandlerRef.current = handleMoveEndInternal
      return () => {
        moveEndHandlerRef.current = null
      }
    }, [handleMoveEndInternal])

    return null
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          {t('dataclassGraph.loadingDataclassSchema')}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">{t('dataclassGraph.failedToLoadSchema')}</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (catalog.length === 0) {
    return (
      <EmptyPanel
        icon={Database}
        badgeIcon={Sparkles}
        badgeTone="primary"
        title={t('dataclassGraph.noDataclassesFound')}
        description={t('dataclassGraph.noDataclassesToOrganize')}
        ghost="cards"
        size="lg"
        className="h-full min-h-0"
      />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={graphContainerRef}
        data-graph-detail={overviewMode ? 'overview' : 'full'}
        data-layout-completed={completedLayoutRequestRef.current}
        className="structure-graph flex h-full w-full flex-col [&_.react-flow__attribution]:hidden"
      >
        {/* Toolbar */}
        <div className="flex w-full items-center justify-center gap-1.5 border-b bg-card px-2 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconXs"
                onClick={handleFitView}
                disabled={catalog.length === 0 || isAutoOrganizing}
                className="h-6 w-6"
                aria-label={t('dataclassGraph.fitToView')}
              >
                <Maximize className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('dataclassGraph.fitToView')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconXs"
                onClick={handleAutoOrganize}
                disabled={catalog.length === 0}
                className="h-6 w-6"
                aria-label={
                  catalog.length === 0
                    ? t('dataclassGraph.noDataclassesToOrganize')
                    : t('dataclassGraph.autoOrganizeLayout')
                }
              >
                {isAutoOrganizing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LayoutGrid className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {catalog.length === 0
                ? t('dataclassGraph.noDataclassesToOrganize')
                : t('dataclassGraph.autoOrganizeLayout')}
            </TooltipContent>
          </Tooltip>

          <div className="inline-flex h-6 items-center rounded-sm border border-border bg-background">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={relationFilter === 'all' ? 'secondary' : 'ghost'}
                  size="iconXs"
                  onClick={() => setRelationFilter('all')}
                  disabled={allEdges.length === 0}
                  className="h-6 w-6 rounded-r-none border-border border-r"
                  aria-label={
                    allEdges.length === 0
                      ? t('dataclassGraph.noRelationsToShow')
                      : t('dataclassGraph.showAllRelations')
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {allEdges.length === 0
                  ? t('dataclassGraph.noRelationsToShow')
                  : t('dataclassGraph.showAllRelations')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={relationFilter === 'selected' ? 'secondary' : 'ghost'}
                  size="iconXs"
                  onClick={() => setRelationFilter('selected')}
                  disabled={!selectedNodeId || allEdges.length === 0}
                  className="h-6 w-6 rounded-none"
                  aria-label={
                    !selectedNodeId
                      ? t('dataclassGraph.selectDataclassFirst')
                      : allEdges.length === 0
                        ? t('dataclassGraph.noRelationsToShow')
                        : t('dataclassGraph.showSelectedOnly')
                  }
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!selectedNodeId
                  ? t('dataclassGraph.selectDataclassFirst')
                  : allEdges.length === 0
                    ? t('dataclassGraph.noRelationsToShow')
                    : t('dataclassGraph.showSelectedOnly')}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={relationFilter === 'none' ? 'secondary' : 'ghost'}
                  size="iconXs"
                  onClick={() => setRelationFilter('none')}
                  disabled={allEdges.length === 0}
                  className="h-6 w-6 rounded-l-none"
                  aria-label={
                    allEdges.length === 0
                      ? t('dataclassGraph.noRelationsToHide')
                      : t('dataclassGraph.hideAllRelations')
                  }
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {allEdges.length === 0
                  ? t('dataclassGraph.noRelationsToHide')
                  : t('dataclassGraph.hideAllRelations')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Graph View */}
        <div className="flex-1 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={renderedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onEdgeMouseEnter={handleEdgeMouseEnter}
            onEdgeMouseLeave={handleEdgeMouseLeave}
            onMoveStart={handleMoveStart}
            onMove={handleMove}
            onMoveEnd={handleMoveEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onlyRenderVisibleElements
            colorMode={theme}
            defaultViewport={savedViewport || undefined}
            fitView={savedViewport ? false : isInitialLoad}
            minZoom={GRAPH_MIN_ZOOM}
            maxZoom={GRAPH_MAX_ZOOM}
            // Space is used for typing in dialogs/inputs; don't steal it for pan
            panActivationKeyCode={null}
            defaultEdgeOptions={{
              type: 'smoothstep',
            }}
            proOptions={{ hideAttribution: true }}
          >
            <GraphViewportManager />
            <Background color="var(--border)" gap={20} size={1} />
            <Controls
              showInteractive={false}
              position="top-left"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
              className="[&>button:hover]:bg-muted [&>button]:border-border [&>button]:bg-card [&>button]:text-foreground"
            />
            <MiniMap
              position="bottom-right"
              nodeColor={(node) => {
                const customization = customizations[node.id]
                if (customization?.color && customization.color !== 'default') {
                  const colorMap: Record<string, string> = {
                    red: '#ef4444',
                    orange: '#f97316',
                    amber: '#f59e0b',
                    yellow: '#eab308',
                    lime: '#84cc16',
                    green: '#22c55e',
                    emerald: '#10b981',
                    teal: '#14b8a6',
                    cyan: '#06b6d4',
                    blue: '#3b82f6',
                    indigo: '#6366f1',
                    violet: '#8b5cf6',
                    purple: '#a855f7',
                    pink: '#ec4899',
                    rose: '#f43f5e',
                  }
                  return colorMap[customization.color] || '#3b82f6'
                }
                return '#3b82f6' // Use blue as default for better visibility
              }}
              nodeStrokeColor="var(--border)"
              nodeStrokeWidth={2}
              maskColor="rgba(0, 0, 0, 0.3)"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
            />

            {/* Info Panel */}
            <Panel
              position="bottom-left"
              className="rounded-lg border bg-card/90 p-3 backdrop-blur"
            >
              <div className="flex items-center gap-4 text-muted-foreground text-xs">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  <span>{catalog.length} dataclasses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>{edges.length} relations</span>
                </div>
              </div>
            </Panel>

            {/* Singletons & Catalog methods Panel */}
            {(singletons.length > 0 || catalogMethods.length > 0) && (
              <Panel
                position="top-right"
                className="max-h-[40vh] w-72 overflow-hidden rounded-lg border bg-card/90 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-1 p-2">
                  {singletons.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setSingletonsSectionOpen((o) => !o)}
                        className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left font-medium text-[10px] text-muted-foreground uppercase hover:bg-muted/50"
                      >
                        {singletonsSectionOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>
                          {t('dataclassGraph.singletons')} ({singletons.length})
                        </span>
                      </button>
                      {singletonsSectionOpen && (
                        <div className="max-h-48 space-y-1 overflow-y-auto pl-5">
                          {singletons.map((singleton) => (
                            <div
                              key={singleton.name}
                              className="rounded border border-border/50 bg-muted/30 p-1.5"
                            >
                              <div className="mb-1 flex items-center gap-1 font-medium font-mono text-[10px] text-purple-600">
                                {singleton.name}
                              </div>
                              <div className="space-y-0.5">
                                {(singleton.methods ?? []).map((method, index) => {
                                  const exposed = method.exposed === true
                                  const allowedGet = method.allowedOnHTTPGET === true
                                  const methodAny = method as unknown as Record<string, unknown>
                                  const paramsText = getMethodParamsText(methodAny)
                                  const fullSignature =
                                    method.name != null
                                      ? paramsText != null
                                        ? `${method.name}${paramsText}`
                                        : `${method.name}()`
                                      : (paramsText ?? null)
                                  const filePath =
                                    methodAny.filePath != null ? String(methodAny.filePath) : null
                                  const startLine = methodAny.startingLine
                                  const endLine = methodAny.endingLine
                                  const fileLine =
                                    filePath != null
                                      ? startLine != null && endLine != null
                                        ? `${filePath}#L${startLine}-${endLine}`
                                        : filePath
                                      : null
                                  const metaLines = [
                                    `name: ${method.name}`,
                                    `exposed: ${exposed}`,
                                    `allowedOnHTTPGET: ${allowedGet}`,
                                    fileLine != null ? `file: ${fileLine}` : null,
                                  ].filter(Boolean) as string[]
                                  return (
                                    <Tooltip key={getMethodReactKey(method, index, paramsText)}>
                                      <TooltipTrigger asChild>
                                        <div className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-muted/50">
                                          {exposed ? (
                                            <Eye
                                              className="h-2.5 w-2.5 shrink-0 text-green-600"
                                              aria-label="Exposed"
                                            />
                                          ) : (
                                            <EyeOff
                                              className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
                                              aria-label="Not exposed"
                                            />
                                          )}
                                          <span className="flex-1 truncate font-mono">
                                            {fullSignature ?? `${method.name}()`}
                                          </span>
                                          {allowedGet ? (
                                            <Globe
                                              className="h-2.5 w-2.5 shrink-0 text-green-600"
                                              aria-label="Allowed on HTTP GET"
                                            />
                                          ) : (
                                            <GlobeLock
                                              className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
                                              aria-label="Not allowed on HTTP GET"
                                            />
                                          )}
                                          {exposed ? (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 shrink-0"
                                              title="Execute method"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                openMethodExecutorTab({
                                                  scope: 'singleton',
                                                  methodName: method.name,
                                                  singletonName: singleton.name,
                                                  paramsText: paramsText ?? undefined,
                                                  allowedOnHTTPGET: allowedGet,
                                                })
                                              }}
                                            >
                                              <Play className="h-3 w-3" />
                                            </Button>
                                          ) : null}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="left"
                                        className="max-w-xs font-mono text-[10px]"
                                      >
                                        <div className="space-y-0.5">
                                          {fullSignature != null && (
                                            <div className="mb-1">
                                              <span className="text-muted-foreground">
                                                signature:
                                              </span>
                                              <code className="mt-0.5 block rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                                                {paramsText != null
                                                  ? highlightMethodSignature(fullSignature)
                                                  : fullSignature}
                                              </code>
                                            </div>
                                          )}
                                          {metaLines.map((line) =>
                                            line.startsWith('file: ') ? (
                                              <div key={line}>
                                                <span className="text-muted-foreground">
                                                  file:{' '}
                                                </span>
                                                <code className="rounded bg-muted/50 px-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                                  {line.slice(6)}
                                                </code>
                                              </div>
                                            ) : (
                                              <div key={line}>{line}</div>
                                            )
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {catalogMethods.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setCatalogMethodsSectionOpen((o) => !o)}
                        className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left font-medium text-[10px] text-muted-foreground uppercase hover:bg-muted/50"
                      >
                        {catalogMethodsSectionOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        <Code2 className="h-3 w-3 shrink-0" />
                        <span>
                          {t('dataclassGraph.datastoreMethods')} ({catalogMethods.length})
                        </span>
                      </button>
                      {catalogMethodsSectionOpen && (
                        <div className="max-h-48 space-y-0.5 overflow-y-auto pl-5">
                          {catalogMethods.map((method, index) => {
                            const exposed = isAssistantExposedMethod(method)
                            const allowedGet = method.allowedOnHTTPGET === true
                            const methodAny = method as unknown as Record<string, unknown>
                            const paramsText = getMethodParamsText(methodAny)
                            const fullSignature =
                              method.name != null
                                ? paramsText != null
                                  ? `${method.name}${paramsText}`
                                  : `${method.name}()`
                                : (paramsText ?? null)
                            const filePath =
                              methodAny.filePath != null ? String(methodAny.filePath) : null
                            const startLine = methodAny.startingLine
                            const endLine = methodAny.endingLine
                            const fileLine =
                              filePath != null
                                ? startLine != null && endLine != null
                                  ? `${filePath}#L${startLine}-${endLine}`
                                  : filePath
                                : null
                            const metaLines = [
                              `name: ${method.name}`,
                              method.applyTo != null ? `applyTo: ${method.applyTo}` : null,
                              `exposed: ${exposed}`,
                              `allowedOnHTTPGET: ${allowedGet}`,
                              fileLine != null ? `file: ${fileLine}` : null,
                              methodAny.scope != null ? `scope: ${String(methodAny.scope)}` : null,
                              methodAny.from != null ? `from: ${String(methodAny.from)}` : null,
                            ].filter(Boolean) as string[]
                            return (
                              <Tooltip key={getMethodReactKey(method, index, paramsText)}>
                                <TooltipTrigger asChild>
                                  <div className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-muted/50">
                                    {exposed ? (
                                      <Eye
                                        className="h-2.5 w-2.5 shrink-0 text-green-600"
                                        aria-label="Exposed"
                                      />
                                    ) : (
                                      <EyeOff
                                        className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
                                        aria-label="Not exposed"
                                      />
                                    )}
                                    <span className="flex-1 truncate font-mono">
                                      {fullSignature ?? `${method.name}()`}
                                    </span>
                                    {allowedGet ? (
                                      <Globe
                                        className="h-2.5 w-2.5 shrink-0 text-green-600"
                                        aria-label="Allowed on HTTP GET"
                                      />
                                    ) : (
                                      <GlobeLock
                                        className="h-2.5 w-2.5 shrink-0 text-muted-foreground"
                                        aria-label="Not allowed on HTTP GET"
                                      />
                                    )}
                                    {method.applyTo && (
                                      <span className="shrink-0 rounded bg-purple-500/10 px-1 text-[9px] text-purple-500">
                                        {method.applyTo}
                                      </span>
                                    )}
                                    {exposed ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0"
                                        title="Execute method"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openMethodExecutorTab({
                                            scope: 'catalog',
                                            methodName: method.name,
                                            paramsText: paramsText ?? undefined,
                                            allowedOnHTTPGET: allowedGet,
                                          })
                                        }}
                                      >
                                        <Play className="h-3 w-3" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="left"
                                  className="max-w-xs font-mono text-[10px]"
                                >
                                  <div className="space-y-0.5">
                                    {fullSignature != null && (
                                      <div className="mb-1">
                                        <span className="text-muted-foreground">signature:</span>
                                        <code className="mt-0.5 block rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                                          {paramsText != null
                                            ? highlightMethodSignature(fullSignature)
                                            : fullSignature}
                                        </code>
                                      </div>
                                    )}
                                    {metaLines.map((line) =>
                                      line.startsWith('file: ') ? (
                                        <div key={line}>
                                          <span className="text-muted-foreground">file: </span>
                                          <code className="rounded bg-muted/50 px-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                                            {line.slice(6)}
                                          </code>
                                        </div>
                                      ) : (
                                        <div key={line}>{line}</div>
                                      )
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Customization Modal */}
        {customizeDataclassName && (
          <DataclassCustomizeModal
            open={customizeModalOpen}
            onOpenChange={(open) => {
              setCustomizeModalOpen(open)
              if (!open) {
                // Reload customizations when modal closes (after save)
                // Preserve current node positions before reloading
                const currentNodesPositions = new Map(nodes.map((node) => [node.id, node.position]))
                const stored = getDataclassCustomizations() as Record<
                  string,
                  DataclassCustomization
                >

                // Merge current positions into stored customizations to preserve them
                const mergedCustomizations = { ...stored }
                for (const [nodeId, position] of currentNodesPositions.entries()) {
                  const roundedPosition = { x: Math.round(position.x), y: Math.round(position.y) }
                  if (mergedCustomizations[nodeId]) {
                    mergedCustomizations[nodeId] = {
                      ...mergedCustomizations[nodeId],
                      position: roundedPosition,
                    }
                  } else {
                    mergedCustomizations[nodeId] = {
                      position: roundedPosition,
                    }
                  }
                  // Save to storage to persist positions
                  setDataclassCustomization(nodeId, mergedCustomizations[nodeId])
                }

                // Update local state with merged customizations (positions preserved)
                setCustomizations(mergedCustomizations)
                setCustomizeDataclassName(null)
              }
            }}
            dataclassName={customizeDataclassName}
            currentCustomization={customizations[customizeDataclassName]}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
