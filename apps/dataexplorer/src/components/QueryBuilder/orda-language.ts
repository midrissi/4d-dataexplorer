import type * as MonacoEditor from 'monaco-editor'

/** Monaco language id registered for the ORDA filter expression editor. */
export const ORDA_LANGUAGE_ID = 'orda-query'

/** Reserved words recognised by the ORDA query grammar. */
export const ORDA_KEYWORDS = [
  'and',
  'or',
  'not',
  'in',
  'is',
  'order',
  'by',
  'asc',
  'desc',
  'true',
  'false',
  'null',
  'eval',
]

/** Monarch tokenizer used for syntax highlighting ORDA query expressions. */
export const ORDA_MONARCH_LANGUAGE: MonacoEditor.languages.IMonarchLanguage = {
  defaultToken: '',
  ignoreCase: true,
  keywords: ORDA_KEYWORDS,
  tokenizer: {
    root: [
      [/\s+/, 'white'],
      [/:[0-9]+/, 'variable'],
      [/:[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*/, 'variable'],
      [/!![0-9]{4}-[0-9]{2}-[0-9]{2}!!/, 'number'],
      [/'([^'\\]|\\.)*'?/, 'string'],
      [/"([^"\\]|\\.)*"?/, 'string'],
      [/[0-9]+(?:\.[0-9]+)?/, 'number'],
      [/(?:===|!==|==|!=|<=|>=|=|#|%|<|>)/, 'operator'],
      [/[()[\],.]/, 'delimiter'],
      [
        /[a-zA-Z_][\w]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
    ],
  },
}

/** Bracket / auto-closing configuration for the ORDA query editor. */
export const ORDA_LANGUAGE_CONFIGURATION: MonacoEditor.languages.LanguageConfiguration = {
  brackets: [
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
}
