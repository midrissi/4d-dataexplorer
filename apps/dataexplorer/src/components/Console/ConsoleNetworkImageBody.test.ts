import { describe, expect, it } from 'bun:test'
import type { NetworkDetails } from '~/store/console'
import { imageMimeFromNetworkDetails } from './ConsoleNetworkImageBody'

function details(partial: Partial<NetworkDetails>): NetworkDetails {
  return {
    method: 'GET',
    url: 'https://example.test/rest/Employee(1)/photo?$imageformat=jpeg&$expand=photo',
    durationMs: 12,
    requestHeaders: {},
    ...partial,
  }
}

describe('imageMimeFromNetworkDetails', () => {
  it('reads image MIME from the body placeholder', () => {
    expect(imageMimeFromNetworkDetails(details({ responseBody: '[image/jpeg body]' }))).toBe(
      'image/jpeg'
    )
  })

  it('prefers Content-Type response header', () => {
    expect(
      imageMimeFromNetworkDetails(
        details({
          responseBody: '[binary body]',
          responseHeaders: { 'content-type': 'image/png; charset=binary' },
        })
      )
    ).toBe('image/png')
  })

  it('ignores non-image binary placeholders', () => {
    expect(
      imageMimeFromNetworkDetails(details({ responseBody: '[application/octet-stream body]' }))
    ).toBeNull()
  })

  it('ignores SVG (logged as text, not a binary placeholder)', () => {
    expect(
      imageMimeFromNetworkDetails(
        details({
          responseHeaders: { 'content-type': 'image/svg+xml' },
          responseBody: '<svg />',
        })
      )
    ).toBeNull()
  })
})
