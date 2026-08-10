import type * as Monaco from 'monaco-editor'
import * as monacoClipboard from 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js'

type PasteMultiCommand = {
  addImplementation: (
    priority: number,
    name: string,
    implementation: () => boolean | Promise<void>
  ) => { dispose: () => void }
}

const PasteAction = (monacoClipboard as unknown as { PasteAction?: PasteMultiCommand }).PasteAction

/**
 * Last text copied/cut inside a CodeEditor in this page.
 * Used for context-menu Paste without `navigator.clipboard.readText()`,
 * which on macOS shows a floating system "Paste" confirmation.
 */
let editorClipboard = ''
let pasteTarget: Monaco.editor.IStandaloneCodeEditor | null = null
let pasteFixInstalled = false

function applyPaste(editor: Monaco.editor.IStandaloneCodeEditor, text: string): void {
  if (!text) return
  editor.focus()
  editor.trigger('keyboard', 'paste', {
    text,
    pasteOnNewLine: false,
    multicursorText: null,
    mode: null,
  })
}

function tryExecCommandPaste(editor: Monaco.editor.IStandaloneCodeEditor): boolean {
  editor.focus()
  const doc = editor.getContainerDomNode().ownerDocument
  try {
    return Boolean(doc.execCommand('paste'))
  } catch {
    return false
  }
}

function captureEditorClipboard(editor: Monaco.editor.IStandaloneCodeEditor): void {
  const model = editor.getModel()
  const selection = editor.getSelection()
  if (!model || !selection || selection.isEmpty()) return
  editorClipboard = model.getValueInRange(selection)
}

/**
 * Install a high-priority paste handler that never calls `clipboard.readText()`
 * (avoids the macOS/Chrome floating "Paste" permission control).
 */
export function installMonacoContextMenuPasteFix(
  editor: Monaco.editor.IStandaloneCodeEditor
): void {
  pasteTarget = editor
  editor.onDidFocusEditorText(() => {
    pasteTarget = editor
  })
  editor.onDidDispose(() => {
    if (pasteTarget === editor) pasteTarget = null
  })

  const dom = editor.getDomNode()
  if (dom) {
    dom.addEventListener('copy', () => captureEditorClipboard(editor))
    dom.addEventListener('cut', () => captureEditorClipboard(editor))
  }

  if (pasteFixInstalled || !PasteAction) return
  pasteFixInstalled = true

  PasteAction.addImplementation(20_000, 'code-editor-no-clipboard-prompt', () => {
    const target = pasteTarget
    if (!target?.getModel() || target.getRawOptions().readOnly) return false

    // 1) Prefer native execCommand into Monaco's textarea (editContext is off).
    if (tryExecCommandPaste(target)) return true

    // 2) Reuse text copied/cut inside the editor — no system clipboard read.
    if (editorClipboard) {
      applyPaste(target, editorClipboard)
      return true
    }

    // 3) Do not call navigator.clipboard.readText() — on macOS that shows a
    // floating "Paste" control on top of the context menu. ⌘V still works.
    return true
  })
}
