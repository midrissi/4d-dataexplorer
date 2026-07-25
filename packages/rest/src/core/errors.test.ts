import { describe, expect, it } from 'bun:test'
import {
  AuthenticationError,
  NetworkError,
  NotFoundError,
  RESTAPIError,
  RESTClientError,
  SessionLimitError,
  StampMismatchError,
  TimeoutError,
} from './errors'

describe('Error classes', () => {
  describe('RESTClientError', () => {
    it('should create error with message and statusCode', () => {
      const error = new RESTClientError('Test error', 400)
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(400)
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError()
      expect(error.message).toContain('Authentication')
      expect(error.statusCode).toBe(401)
    })
  })

  describe('SessionLimitError', () => {
    it('should create session limit error', () => {
      const error = new SessionLimitError()
      expect(error.message).toContain('sessions')
      expect(error.statusCode).toBe(402)
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError()
      expect(error.message).toContain('not found')
      expect(error.statusCode).toBe(404)
    })
  })

  describe('NetworkError', () => {
    it('should create network error with message', () => {
      const error = new NetworkError('Network failed')
      expect(error.message).toBe('Network failed')
      expect(error.statusCode).toBeUndefined()
    })

    it('should create network error with cause', () => {
      const cause = new Error('Original error')
      const error = new NetworkError('Network failed', cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError()
      expect(error.message).toContain('timed out')
      expect(error.statusCode).toBe(408)
    })
  })

  describe('StampMismatchError', () => {
    it('should create stamp mismatch error', () => {
      const errors = [
        {
          message: 'Stamp mismatch',
          errCode: 409,
          componentSignature: 'TEST',
        },
      ]
      const error = new StampMismatchError(errors)
      expect(error.message).toContain('Stamp mismatch')
      expect(error.statusCode).toBeUndefined()
    })
  })

  describe('RESTAPIError', () => {
    it('should create from error response', () => {
      const errorResponse = {
        __ERROR: [
          {
            message: 'API Error',
            errCode: 500,
            componentSignature: 'TEST',
          },
        ],
      }
      const error = RESTAPIError.fromResponse(errorResponse, 500)
      expect(error.message).toContain('API Error')
      expect(error.statusCode).toBe(500)
      expect(error.errors).toHaveLength(1)
    })

    it('should expose errorCode and componentSignature from first error', () => {
      const errorResponse = {
        __ERROR: [
          {
            message: 'Validation failed',
            errCode: 422,
            componentSignature: '4D',
          },
        ],
      }
      const error = RESTAPIError.fromResponse(errorResponse, 422)
      expect(error.errorCode).toBe(422)
      expect(error.componentSignature).toBe('4D')
    })

    it('should join multiple error messages', () => {
      const errorResponse = {
        __ERROR: [
          { message: 'First', errCode: 1, componentSignature: 'A' },
          { message: 'Second', errCode: 2, componentSignature: 'B' },
        ],
      }
      const error = RESTAPIError.fromResponse(errorResponse, 400)
      expect(error.message).toContain('First')
      expect(error.message).toContain('Second')
      expect(error.errors).toHaveLength(2)
      expect(error.errorCode).toBe(1)
      expect(error.componentSignature).toBe('A')
    })
  })
})
