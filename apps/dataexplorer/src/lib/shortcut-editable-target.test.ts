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
})
