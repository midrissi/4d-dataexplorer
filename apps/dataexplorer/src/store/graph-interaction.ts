import { create } from 'zustand'

type HoveredEdge = {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

type GraphInteractionState = {
  selectedNodeId: string | null
  hoveredEdge: HoveredEdge | null
  overview: boolean
  overviewEdgesVisible: boolean
  setSelectedNodeId: (selectedNodeId: string | null) => void
  setHoveredEdge: (hoveredEdge: HoveredEdge | null) => void
  setOverview: (overview: boolean) => void
  setOverviewEdgesVisible: (overviewEdgesVisible: boolean) => void
}

export const useGraphInteractionStore = create<GraphInteractionState>((set) => ({
  selectedNodeId: null,
  hoveredEdge: null,
  overview: false,
  overviewEdgesVisible: false,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setHoveredEdge: (hoveredEdge) => set({ hoveredEdge }),
  setOverview: (overview) => set({ overview }),
  setOverviewEdgesVisible: (overviewEdgesVisible) => set({ overviewEdgesVisible }),
}))
