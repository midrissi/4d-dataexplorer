/**
 * Connection configuration store for the desktop app.
 * Persists server connections to disk via Tauri's store plugin.
 */
import { load, type Store } from '@tauri-apps/plugin-store'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ConnectionConfig {
  id: string
  name: string
  baseUrl: string
  accessKey?: string
  username?: string
  password?: string
  headers?: Record<string, string>
  /** Cookies sent with every request (serialized into a `Cookie` header) */
  cookies?: Record<string, string>
  skipSSL?: boolean
  timeout?: number
  /** Color preset key (matches COLOR_PRESETS in the shared settings store) */
  color?: string
  /** Lucide icon name (matches ICON_PRESETS in the shared settings store) */
  icon?: string
  /** Open the connection in read-only mode */
  readonly?: boolean
  lastUsed: number
}

interface ConnectionStoreData {
  connections: ConnectionConfig[]
  activeConnectionId: string | null
}

// ─── Store Instance ─────────────────────────────────────────────────────────────

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('connections.json', {
      defaults: {},
      autoSave: true,
    })
  }
  return store
}

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get all saved connections, sorted by most recently used first
 */
export async function getConnections(): Promise<ConnectionConfig[]> {
  const s = await getStore()
  const data = await s.get<ConnectionStoreData>('data')
  const connections = data?.connections ?? []
  return connections.sort((a, b) => b.lastUsed - a.lastUsed)
}

/**
 * Get a specific connection by ID
 */
export async function getConnection(id: string): Promise<ConnectionConfig | null> {
  const connections = await getConnections()
  return connections.find((c) => c.id === id) ?? null
}

/**
 * Save a new connection or update an existing one
 */
export async function saveConnection(
  config: Omit<ConnectionConfig, 'id' | 'lastUsed'> & { id?: string }
): Promise<ConnectionConfig> {
  const s = await getStore()
  const data = (await s.get<ConnectionStoreData>('data')) ?? {
    connections: [],
    activeConnectionId: null,
  }

  const connection: ConnectionConfig = {
    ...config,
    id: config.id ?? generateId(),
    lastUsed: Date.now(),
  }

  const existingIndex = data.connections.findIndex((c) => c.id === connection.id)
  if (existingIndex >= 0) {
    data.connections[existingIndex] = connection
  } else {
    data.connections.push(connection)
  }

  await s.set('data', data)
  return connection
}

/**
 * Remove a connection by ID
 */
export async function removeConnection(id: string): Promise<void> {
  const s = await getStore()
  const data = (await s.get<ConnectionStoreData>('data')) ?? {
    connections: [],
    activeConnectionId: null,
  }

  data.connections = data.connections.filter((c) => c.id !== id)
  if (data.activeConnectionId === id) {
    data.activeConnectionId = null
  }

  await s.set('data', data)
}

/**
 * Get the active (currently connected) connection
 */
export async function getActiveConnection(): Promise<ConnectionConfig | null> {
  const s = await getStore()
  const data = await s.get<ConnectionStoreData>('data')
  if (!data?.activeConnectionId) return null
  const connection = data.connections.find((c) => c.id === data.activeConnectionId)
  return connection ?? null
}

/**
 * Set the active connection by ID (marks it as last used)
 */
export async function setActiveConnection(id: string): Promise<void> {
  const s = await getStore()
  const data = (await s.get<ConnectionStoreData>('data')) ?? {
    connections: [],
    activeConnectionId: null,
  }

  data.activeConnectionId = id

  // Update lastUsed timestamp
  const connection = data.connections.find((c) => c.id === id)
  if (connection) {
    connection.lastUsed = Date.now()
  }

  await s.set('data', data)
}

/**
 * Clear the active connection (disconnect)
 */
export async function clearActiveConnection(): Promise<void> {
  const s = await getStore()
  const data = (await s.get<ConnectionStoreData>('data')) ?? {
    connections: [],
    activeConnectionId: null,
  }

  data.activeConnectionId = null
  await s.set('data', data)
}

/**
 * Remove cookies from a saved connection (and any Cookie header).
 * Used on disconnect so the next connect starts without a prior session.
 */
export async function clearConnectionCookies(id: string): Promise<void> {
  const s = await getStore()
  const data = (await s.get<ConnectionStoreData>('data')) ?? {
    connections: [],
    activeConnectionId: null,
  }

  const connection = data.connections.find((c) => c.id === id)
  if (!connection) return

  connection.cookies = undefined
  if (connection.headers) {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(connection.headers)) {
      if (key.toLowerCase() === 'cookie') continue
      next[key] = value
    }
    connection.headers = Object.keys(next).length > 0 ? next : undefined
  }

  await s.set('data', data)
}
