export const UNAUTHORIZED_RESPONSE_EVENT = 'dataexplorer:unauthorized-response'

export type UnauthorizedResponseDetail = {
  message: string
}

export function dispatchUnauthorizedResponse(message: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<UnauthorizedResponseDetail>(UNAUTHORIZED_RESPONSE_EVENT, {
      detail: { message },
    })
  )
}
