import { describe, expect, it } from 'bun:test'
import { methodExecutionErrorResponse } from './method-execution-error'

describe('methodExecutionErrorResponse', () => {
  it('maps AbortError to a cancelled HTTP-style response', () => {
    const error = new DOMException('signal is aborted without reason', 'AbortError')
    const response = methodExecutionErrorResponse(error, {
      url: 'http://localhost:3002/rest/$catalog/justATest',
      durationMs: 4991,
    })

    expect(response.error).toBeTruthy()
    expect(response.errorInfo?.kind).toBe('cancelled')
    expect(response.errorInfo?.name).toBe('AbortError')
    expect(response.errorInfo?.url).toBe('http://localhost:3002/rest/$catalog/justATest')
    expect(response.durationMs).toBe(4991)
    expect(response.sizeBytes).toBe(0)
  })

  it('maps generic failures to network/unknown diagnostics', () => {
    const response = methodExecutionErrorResponse(new TypeError('Failed to fetch'), {
      url: 'http://localhost/rest/$catalog/x',
      durationMs: 12,
    })
    expect(response.errorInfo?.name).toBe('TypeError')
    expect(response.error).toContain('Failed to fetch')
  })
})
