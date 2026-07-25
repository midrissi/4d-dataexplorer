export const GRAPH_MIN_ZOOM = 0.1
export const GRAPH_MAX_ZOOM = 2

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export function normalizeGraphViewport(viewport: GraphViewport): GraphViewport {
  const zoom = Number.isFinite(viewport.zoom) ? viewport.zoom : 1
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: Math.min(GRAPH_MAX_ZOOM, Math.max(GRAPH_MIN_ZOOM, zoom)),
  }
}

export function isGraphViewportValid(
  viewport: Partial<GraphViewport> | null | undefined
): viewport is GraphViewport {
  if (viewport == null) {
    return false
  }

  const { x, y, zoom } = viewport
  if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') {
    return false
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) {
    return false
  }

  return zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM
}
