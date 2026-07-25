import { AuthenticationError } from '../core/errors'
import type { HttpClient } from '../core/http-client'
import type { LoginResponse } from '../types'

/**
 * Authentication configuration
 */
export interface AuthConfig {
  username: string
  password: string
}

/**
 * Service for authentication operations
 */
export class AuthService {
  private readonly http: HttpClient
  private authenticated = false

  constructor(http: HttpClient) {
    this.http = http
  }

  /**
   * Check if currently authenticated
   */
  get isAuthenticated(): boolean {
    return this.authenticated
  }

  /**
   * Set Basic authentication credentials
   */
  setBasicAuth(username: string, password: string): void {
    this.http.setBasicAuth(username, password)
    this.authenticated = true
  }

  /**
   * Set Bearer token authentication
   */
  setBearerToken(token: string): void {
    this.http.setAuthorization('Bearer', token)
    this.authenticated = true
  }

  /**
   * Login using the $catalog/authentify endpoint
   * This is the recommended "force login" mode in 4D 20 R6+
   */
  async login(credentials: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await this.http.post<LoginResponse>('/$catalog/authentify', [credentials])
      this.authenticated = response.result
      return response.result
    } catch (error) {
      this.authenticated = false
      throw error
    }
  }

  /**
   * Login with username and password
   */
  async loginWithCredentials(username: string, password: string): Promise<boolean> {
    return this.login({ username, password })
  }

  /**
   * Legacy login using $directory/login
   * @deprecated Use login() with $catalog/authentify instead
   */
  async legacyLogin(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.http.post<LoginResponse>('/$directory/login', {
        username,
        password,
      })
      this.authenticated = response.result
      return response.result
    } catch (error) {
      this.authenticated = false
      throw error
    }
  }

  /**
   * Logout and clear credentials
   */
  logout(): void {
    this.http.clearAuthorization()
    this.authenticated = false
  }

  /**
   * Verify current authentication by making a test request
   */
  async verify(): Promise<boolean> {
    try {
      await this.http.get('/$catalog')
      return true
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.authenticated = false
        return false
      }
      throw error
    }
  }
}
