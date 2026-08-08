/**
 * 4D REST API error structure
 */
export interface RESTError {
  message: string
  componentSignature: string
  errCode: number
}

/**
 * Error response from 4D REST API
 */
export interface ErrorResponse {
  __ERROR: RESTError[]
}

/**
 * Progress indicator info from $info
 */
export interface ProgressInfo {
  UserInfo: string
  SessionCount: number
  Title: string
  CanInterrupt: boolean
}

/**
 * Session info from $info
 */
export interface SessionInfo {
  sessionID: string
  userID?: string
  userName?: string
  lifeTime: number
  expiration: string
}

/**
 * Entity set info from $info
 */
export interface EntitySetCacheInfo {
  id: string
  dataClass: string
  tableName?: string
  selectionSize: number
  sorted: boolean
  refreshed: string
  expires: string
}

/**
 * $info response
 */
export interface InfoResponse {
  cacheSize: number
  usedCache: number
  entitySetCount: number
  entitySet: EntitySetCacheInfo[]
  ProgressInfo: ProgressInfo[]
  sessionInfo: SessionInfo[]
  HTTPConnections?: unknown[]
  /** Privileges array (e.g. [{"privilege":"WebAdmin"}]) */
  privileges?: Array<{ privilege: string }>
}

/**
 * Authentication response
 */
export interface AuthResponse {
  result: boolean
  token?: string
}

/**
 * Singleton function call response
 */
export interface SingletonResponse<T = unknown> {
  result: T
}

/**
 * Class function call response
 */
export interface FunctionResponse<T = unknown> {
  result: T
  /** Present when the server sends web-form notifications / privilege stamps. */
  __WEBFORM?: {
    __PRIVILEGES?: { stamp?: number }
    __NOTIFICATION?: { message?: string; type?: string }
  }
}

/**
 * $directory/login response
 */
export interface LoginResponse {
  result: boolean
}

/**
 * $version response
 */
export interface VersionResponse {
  version: string
  build?: string
}

/**
 * Upload response
 */
export interface UploadResponse {
  ID: string
  size: number
  name: string
}

/**
 * Generic API response that might be an error
 */
export type APIResponse<T> = T | ErrorResponse

/**
 * Check if response is an error
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    '__ERROR' in response &&
    Array.isArray((response as ErrorResponse).__ERROR)
  )
}
