import type { HttpClient } from '../core/http-client'
import type { EntitySetCacheInfo, InfoResponse, SessionInfo } from '../types'

/**
 * Service for $info operations
 */
export class InfoService {
  private readonly http: HttpClient

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Get full server info
   */
  async getInfo(): Promise<InfoResponse> {
    return this.http.get<InfoResponse>('/$info')
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ size: number; used: number }> {
    const info = await this.getInfo()
    return {
      size: info.cacheSize,
      used: info.usedCache,
    }
  }

  /**
   * Get all cached entity sets
   */
  async getEntitySets(): Promise<EntitySetCacheInfo[]> {
    const info = await this.getInfo()
    return info.entitySet
  }

  /**
   * Get entity set count
   */
  async getEntitySetCount(): Promise<number> {
    const info = await this.getInfo()
    return info.entitySetCount
  }

  /**
   * Get all user sessions
   */
  async getSessions(): Promise<SessionInfo[]> {
    const info = await this.getInfo()
    return info.sessionInfo
  }

  /**
   * Get current user's privileges
   */
  async getPrivileges(): Promise<string[]> {
    const info = await this.getInfo()
    return info.privileges?.map((p) => p.privilege) ?? []
  }
}
