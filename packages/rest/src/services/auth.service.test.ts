import { describe, expect, it } from 'bun:test'
import { type FetchFunction, HttpClient } from '../core/http-client'
import { makeHttp } from '../mock-http.test-helper'
import { AuthService } from './auth.service'

function httpWithStatus(status: number, payload: unknown = {}) {
  const fetchFn = async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  return new HttpClient({
    baseUrl: 'http://127.0.0.1:8044',
    fetch: fetchFn as unknown as FetchFunction,
  })
}

describe('AuthService', () => {
  it('starts unauthenticated', () => {
    const { http } = makeHttp()
    expect(new AuthService(http).isAuthenticated).toBe(false)
  })

  it('setBasicAuth marks authenticated', () => {
    const { http } = makeHttp()
    const auth = new AuthService(http)
    auth.setBasicAuth('admin', 'pw')
    expect(auth.isAuthenticated).toBe(true)
  })

  it('setBearerToken marks authenticated', () => {
    const { http } = makeHttp()
    const auth = new AuthService(http)
    auth.setBearerToken('token')
    expect(auth.isAuthenticated).toBe(true)
  })

  it('login posts credentials to authentify and returns the result', async () => {
    const { http, calls } = makeHttp({ result: true })
    const auth = new AuthService(http)
    const ok = await auth.login({ username: 'a', password: 'b' })
    expect(ok).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(calls[0].path).toBe('/$catalog/authentify')
    expect(calls[0].body).toEqual([{ username: 'a', password: 'b' }])
  })

  it('login resets authentication and rethrows on error', async () => {
    const http = httpWithStatus(401)
    const auth = new AuthService(http)
    await expect(auth.login({ username: 'a', password: 'b' })).rejects.toThrow()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('loginWithCredentials delegates to login', async () => {
    const { http, calls } = makeHttp({ result: true })
    const ok = await new AuthService(http).loginWithCredentials('a', 'b')
    expect(ok).toBe(true)
    expect(calls[0].body).toEqual([{ username: 'a', password: 'b' }])
  })

  it('legacyLogin posts to $directory/login', async () => {
    const { http, calls } = makeHttp({ result: true })
    const auth = new AuthService(http)
    const ok = await auth.legacyLogin('a', 'b')
    expect(ok).toBe(true)
    expect(calls[0].path).toBe('/$directory/login')
    expect(calls[0].body).toEqual({ username: 'a', password: 'b' })
  })

  it('legacyLogin resets authentication and rethrows on error', async () => {
    const http = httpWithStatus(401)
    const auth = new AuthService(http)
    await expect(auth.legacyLogin('a', 'b')).rejects.toThrow()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('logout clears authentication', () => {
    const { http } = makeHttp()
    const auth = new AuthService(http)
    auth.setBasicAuth('a', 'b')
    auth.logout()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('verify returns true on success', async () => {
    const { http } = makeHttp({ dataClasses: [] })
    expect(await new AuthService(http).verify()).toBe(true)
  })

  it('verify returns false on authentication error', async () => {
    const http = httpWithStatus(401)
    const auth = new AuthService(http)
    auth.setBasicAuth('a', 'b')
    expect(await auth.verify()).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
  })

  it('verify rethrows non-authentication errors', async () => {
    const http = httpWithStatus(500)
    await expect(new AuthService(http).verify()).rejects.toThrow()
  })
})
