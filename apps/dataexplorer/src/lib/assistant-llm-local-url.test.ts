import { describe, expect, test } from 'bun:test'
import { isLocalLlmBaseUrl } from './assistant-llm-configured'

describe('isLocalLlmBaseUrl', () => {
  test('accepts loopback hosts', () => {
    expect(isLocalLlmBaseUrl('http://localhost:11434')).toBe(true)
    expect(isLocalLlmBaseUrl('http://127.0.0.1:1234/v1')).toBe(true)
    expect(isLocalLlmBaseUrl('http://[::1]:8080')).toBe(true)
    expect(isLocalLlmBaseUrl('http://0.0.0.0:11434')).toBe(true)
    expect(isLocalLlmBaseUrl('localhost:11434')).toBe(true)
  })

  test('accepts .local and RFC1918 hosts', () => {
    expect(isLocalLlmBaseUrl('http://ollama.local/v1')).toBe(true)
    expect(isLocalLlmBaseUrl('http://10.0.0.12:11434')).toBe(true)
    expect(isLocalLlmBaseUrl('http://192.168.1.20:1234')).toBe(true)
    expect(isLocalLlmBaseUrl('http://172.16.0.4:8080')).toBe(true)
    expect(isLocalLlmBaseUrl('http://172.31.255.1:8080')).toBe(true)
  })

  test('rejects public and empty URLs', () => {
    expect(isLocalLlmBaseUrl('')).toBe(false)
    expect(isLocalLlmBaseUrl(null)).toBe(false)
    expect(isLocalLlmBaseUrl('https://api.openai.com/v1')).toBe(false)
    expect(isLocalLlmBaseUrl('https://openrouter.ai/api/v1')).toBe(false)
    expect(isLocalLlmBaseUrl('http://172.32.0.1:8080')).toBe(false)
    expect(isLocalLlmBaseUrl('not a url')).toBe(false)
  })
})
