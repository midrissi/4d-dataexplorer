import { afterEach, describe, expect, test } from 'bun:test'
import { createEmptyMetadata } from './assistant-metadata-schema'
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
  })

  test('creates an anchor, triggers download, and revokes the url', () => {
    let clicked = false
    const anchor: Record<string, unknown> = {
      click: () => {
        clicked = true
      },
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
        document: { createElement: (...args: unknown[]) => Record<string, unknown> }
      }
    ).document = {
      createElement: () => anchor,
    }

    const metadata = { ...createEmptyMetadata(), databaseName: 'Sales' }
    downloadMetadataSchema(metadata)

    expect(anchor.download).toBe('Sales.metadata-schema.json')
    expect(anchor.href).toBe('blob:test')
    expect(clicked).toBe(true)
    expect(revokedUrl).toBe('blob:test')
  })

  test('explicit database name overrides metadata databaseName', () => {
    const anchor: Record<string, unknown> = { click: () => {} }
    URL.createObjectURL = () => 'blob:x'
    URL.revokeObjectURL = () => {}
    ;(
      globalThis as unknown as {
        document: { createElement: (...args: unknown[]) => Record<string, unknown> }
      }
    ).document = {
      createElement: () => anchor,
    }

    downloadMetadataSchema(createEmptyMetadata(), 'Override')
    expect(anchor.download).toBe('Override.metadata-schema.json')
  })
})
