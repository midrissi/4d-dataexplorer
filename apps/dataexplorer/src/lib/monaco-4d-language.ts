import type * as Monaco from 'monaco-editor'

const LANGUAGE_ID = '4d'

const KEYWORDS =
  'Break Catch Continue Else False For Function If Method Null Procedure Repeat Return True Try Until Use While property return var'

const TYPE_KEYWORDS =
  'Boolean Blob Collection Date Integer Longint Object Picture Pointer Real Text Time Variant String Number'

let registered = false

/** Register a Monaco Monarch tokenizer for 4D method source (idempotent). */
export function registerFourDLanguage(monaco: typeof Monaco): void {
  if (registered) return
  if (monaco.languages.getLanguages().some((lang) => lang.id === LANGUAGE_ID)) {
    registered = true
    return
  }

  monaco.languages.register({ id: LANGUAGE_ID, aliases: ['4D', '4dm'] })
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    ignoreCase: true,
    defaultToken: '',
    keywords: KEYWORDS.split(/\s+/),
    typeKeywords: TYPE_KEYWORDS.split(/\s+/),
    operators: [
      '->',
      ':=',
      '=',
      '<>',
      '<=',
      '>=',
      '<',
      '>',
      '+',
      '-',
      '*',
      '/',
      '%',
      '&',
      '|',
      '^',
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    tokenizer: {
      root: [
        [/#DECLARE\b/i, 'meta'],
        [/Case\s+of\b/i, 'keyword'],
        [/Class\s+constructor\b/i, 'keyword'],
        [/End\s+case\b/i, 'keyword'],
        [/End\s+for\s+each\b/i, 'keyword'],
        [/End\s+for\b/i, 'keyword'],
        [/End\s+if\b/i, 'keyword'],
        [/End\s+method\b/i, 'keyword'],
        [/End\s+procedure\b/i, 'keyword'],
        [/End\s+try\b/i, 'keyword'],
        [/End\s+use\b/i, 'keyword'],
        [/End\s+while\b/i, 'keyword'],
        [/For\s+each\b/i, 'keyword'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/\$[\w]+/, 'variable'],
        [/<>[\w]+/, 'variable'],
        [/\b\d[\d_]*(\.\d[\d_]*)?([eE][-+]?\d+)?\b/, 'number'],
        [
          /[a-zA-Z_][\w]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          },
        ],
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/[,;:]/, 'delimiter'],
        [/\s+/, 'white'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  })

  registered = true
}

export const FOUR_D_LANGUAGE_ID = LANGUAGE_ID
