import type { ErrorResponse, RESTError } from '../types'

/**
 * Base error class for REST API errors
 */
export class RESTClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'RESTClientError'
  }
}

/**
 * Error thrown when the 4D REST API returns an error response
 */
export class RESTAPIError extends RESTClientError {
  public readonly errors: RESTError[]

  constructor(errors: RESTError[], statusCode?: number) {
    const message = errors.map((e) => e.message).join('; ')
    super(message, statusCode)
    this.name = 'RESTAPIError'
    this.errors = errors
  }

  /**
   * Get the first error code
   */
  get errorCode(): number | undefined {
    return this.errors[0]?.errCode
  }

  /**
   * Get the component signature of the first error
   */
  get componentSignature(): string | undefined {
    return this.errors[0]?.componentSignature
  }

  /**
   * Create from an error response
   */
  static fromResponse(response: ErrorResponse, statusCode?: number): RESTAPIError {
    return new RESTAPIError(response.__ERROR, statusCode)
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends RESTClientError {
  constructor(message = 'Authentication failed') {
    super(message, 401)
    this.name = 'AuthenticationError'
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends RESTClientError {
  constructor(message = 'Resource not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

/**
 * Error thrown when there's a network error
 */
export class NetworkError extends RESTClientError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends RESTClientError {
  constructor(message = 'Request timed out') {
    super(message, 408)
    this.name = 'TimeoutError'
  }
}

/**
 * Error thrown when entity stamp doesn't match (optimistic locking)
 */
export class StampMismatchError extends RESTAPIError {
  constructor(errors: RESTError[]) {
    super(errors)
    this.name = 'StampMismatchError'
  }
}

/**
 * Error thrown when session limit is reached
 */
export class SessionLimitError extends RESTClientError {
  constructor(message = 'Maximum number of sessions reached') {
    super(message, 402)
    this.name = 'SessionLimitError'
  }
}
