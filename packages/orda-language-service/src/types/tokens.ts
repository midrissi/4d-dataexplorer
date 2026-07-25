/**
 * All token kinds produced by the ORDA query lexer.
 */
export enum TokenKind {
  // Literals
  Identifier = 'Identifier',
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Null = 'Null',

  // Placeholders  :1  :name  :name.prop
  Placeholder = 'Placeholder',

  // Operators / comparators
  Equal = 'Equal', // =  ==
  StrictEqual = 'StrictEqual', // ===  IS
  NotEqual = 'NotEqual', // #  !=
  StrictNotEqual = 'StrictNotEqual', // !==  IS NOT
  LessThan = 'LessThan', // <
  GreaterThan = 'GreaterThan', // >
  LessThanOrEqual = 'LessThanOrEqual', // <=
  GreaterThanOrEqual = 'GreaterThanOrEqual', // >=
  In = 'In', // IN  in
  Contains = 'Contains', // %

  // Logical operators
  And = 'And', // AND  &  &&  and
  Or = 'Or', // OR  |  ||  or

  // Keywords
  Not = 'Not', // NOT  not
  Is = 'Is', // IS  is  (part of IS / IS NOT)
  OrderBy = 'OrderBy', // order by (lexed as single logical token)
  Asc = 'Asc', // ASC  asc
  Desc = 'Desc', // DESC  desc
  Eval = 'Eval', // eval

  // Punctuation
  Dot = 'Dot', // .
  LBracket = 'LBracket', // [
  RBracket = 'RBracket', // ]
  LParen = 'LParen', // (
  RParen = 'RParen', // )
  Comma = 'Comma', // ,
  Wildcard = 'Wildcard', // @

  // Meta
  EOF = 'EOF',
  Unknown = 'Unknown',
}

/**
 * A single token from the ORDA query input string.
 * `start` and `end` are UTF-16 code unit offsets (0-based, `end` is exclusive).
 */
export interface Token {
  readonly kind: TokenKind
  /** Raw text slice from the input */
  readonly text: string
  /** Start offset (inclusive) */
  readonly start: number
  /** End offset (exclusive) */
  readonly end: number
}

/** Convenience constructor */
export function makeToken(kind: TokenKind, text: string, start: number, end: number): Token {
  return { kind, text, start, end }
}
