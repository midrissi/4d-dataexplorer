import { describe, expect, it } from 'bun:test'
import { Window } from 'happy-dom'
import { shouldDeferShortcutsForEditableTarget } from './shortcut-editable-target'

function withDom(run: (dom: Window) => void): void {
  const dom = new Window()
  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
  }
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    HTMLTextAreaElement: dom.HTMLTextAreaElement,
    HTMLInputElement: dom.HTMLInputElement,
    HTMLSelectElement: dom.HTMLSelectElement,
  })
  try {
    run(dom)
  } finally {
    Object.assign(globalThis, prev)
    dom.close()
  }
}

function fakeEvent(partial: {
  metaKey?: boolean
  ctrlKey?: boolean
  target?: unknown
}): KeyboardEvent {
  return {
    metaKey: Boolean(partial.metaKey),
    ctrlKey: Boolean(partial.ctrlKey),
    target: (partial.target ?? null) as EventTarget | null,
  } as KeyboardEvent
}

describe('shouldDeferShortcutsForEditableTarget', () => {
  it('never defers when the target is not editable', () => {
    withDom((dom) => {
      const div = dom.document.createElement('div')
      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: div, metaKey: false }))
      ).toBe(false)
      expect(shouldDeferShortcutsForEditableTarget(fakeEvent({ target: div, metaKey: true }))).toBe(
        false
      )
    })
  })

  it('defers plain typing inside Monaco / text fields', () => {
    withDom((dom) => {
      const monaco = dom.document.createElement('div')
      monaco.className = 'monaco-editor'
      const textarea = dom.document.createElement('textarea')
      monaco.appendChild(textarea)
      dom.document.body.appendChild(monaco)

      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: textarea, metaKey: false }))
      ).toBe(true)
    })
  })

  it('allows Cmd/Ctrl shortcuts while focused in the terminal editor', () => {
    withDom((dom) => {
      const monaco = dom.document.createElement('div')
      monaco.className = 'monaco-editor'
      const textarea = dom.document.createElement('textarea')
      monaco.appendChild(textarea)
      dom.document.body.appendChild(monaco)

      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: textarea, metaKey: true }))
      ).toBe(false)
      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: textarea, ctrlKey: true }))
      ).toBe(false)
    })
  })

  it('defers Cmd/Ctrl chords inside shortcut-capture surfaces (Shortcut Radar)', () => {
    withDom((dom) => {
      const radar = dom.document.createElement('div')
      radar.setAttribute('data-shortcut-capture', '')
      const input = dom.document.createElement('input')
      radar.appendChild(input)
      dom.document.body.appendChild(radar)

      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: input, ctrlKey: true }))
      ).toBe(true)
      expect(
        shouldDeferShortcutsForEditableTarget(fakeEvent({ target: input, metaKey: true }))
      ).toBe(true)
    })
  })

  it('defers Cmd/Ctrl chords when the capture lock is held (BODY focus)', async () => {
    const { acquireShortcutCaptureLock } = await import('./shortcut-capture-lock')
    withDom((dom) => {
      const release = acquireShortcutCaptureLock()
      try {
        const body = dom.document.body
        expect(
          shouldDeferShortcutsForEditableTarget(fakeEvent({ target: body, ctrlKey: true }))
        ).toBe(true)
      } finally {
        release()
      }
    })
  })
})
