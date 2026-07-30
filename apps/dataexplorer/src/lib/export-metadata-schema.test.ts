import { afterEach, describe, expect, test } from 'bun:test'
import { createEmptyMetadata } from './assistant-metadata-schema'
import { registerDownloadBytes } from './download-bytes'
import { downloadMetadataSchema, getMetadataExportFilename } from './export-metadata-schema'

describe('getMetadataExportFilename', () => {
  test('uses provided database name', () => {
    expect(getMetadataExportFilename('My DB')).toBe('My-DB.metadata-schema.json')
  })

  test('falls back to database when name missing', () => {
    expect(getMetadataExportFilename()).toBe('database.metadata-schema.json')
  })
})

describe('downloadMetadataSchema', () => {
  const originalDocument = (globalThis as { document?: unknown }).document
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  afterEach(() => {
    ;(globalThis as { document?: unknown }).document = originalDocument
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    registerDownloadBytes(null)
  })

  test('creates an anchor, triggers download, and revokes the url', async () => {
    let clicked = false
    const anchor: Record<string, unknown> = {
      click: () => {
        clicked = true
      },
      remove: () => {},
    }
    let createdUrl = ''
    let revokedUrl = ''
    URL.createObjectURL = () => {
      createdUrl = 'blob:test'
      return createdUrl
    }
    URL.revokeObjectURL = (url: string) => {
      revokedUrl = url
    }
    ;(
      globalThis as unknown as {
        document: {
          createElement: (...args: unknown[]) => Record<string, unknown>
          body: { appendChild: () => void; removeChild: () => void }
        }
      }
    ).document = {
      createElement: () => anchor,
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    }

    const metadata = { ...createEmptyMetadata(), databaseName: 'Sales' }
    await downloadMetadataSchema(metadata)

    expect(anchor.download).toBe('Sales.metadata-schema.json')
    expect(anchor.href).toBe('blob:test')
    expect(clicked).toBe(true)
    expect(revokedUrl).toBe('blob:test')
  })

  test('explicit database name overrides metadata databaseName', async () => {
    const anchor: Record<string, unknown> = { click: () => {}, remove: () => {} }
    URL.createObjectURL = () => 'blob:x'
    URL.revokeObjectURL = () => {}
    ;(
      globalThis as unknown as {
        document: {
          createElement: (...args: unknown[]) => Record<string, unknown>
          body: { appendChild: () => void; removeChild: () => void }
        }
      }
    ).document = {
      createElement: () => anchor,
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    }

    await downloadMetadataSchema(createEmptyMetadata(), 'Override')
    expect(anchor.download).toBe('Override.metadata-schema.json')
  })

  test('uses registered downloadBytes when available', async () => {
    let received: { filename: string; mime?: string } | undefined
    registerDownloadBytes(async (input) => {
      received = { filename: input.filename, mime: input.mime }
    })

    const metadata = { ...createEmptyMetadata(), databaseName: 'Sales' }
    await downloadMetadataSchema(metadata)

    expect(received).toEqual({
      filename: 'Sales.metadata-schema.json',
      mime: 'application/json',
    })
  })
})
