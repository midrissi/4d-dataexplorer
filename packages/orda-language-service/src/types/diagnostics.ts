/**
 * Severity level for a diagnostic message.
 */
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/**
 * Numeric diagnostic codes.
 * 1xxx = syntax, 2xxx = semantic.
 */
export enum DiagnosticCode {
  // Syntax
  UnexpectedToken = 1001,
  UnexpectedEndOfInput = 1002,
  UnclosedParenthesis = 1003,
  UnclosedBracket = 1004,
  MissingComparator = 1005,
  MissingValue = 1006,
  InvalidPlaceholder = 1007,
  InvalidDate = 1008,
  UnexpectedComma = 1009,

  // Semantic
  UnknownAttribute = 2001,
  UnknownDataclass = 2002,
  TypeMismatch = 2003,
  InvalidOperatorForType = 2004,
  RelationTraversalError = 2005,
  InValueMustBeCollection = 2006,
  PercentOperatorOnNonString = 2007,
}

/**
 * A text range expressed as UTF-16 code unit offsets.
 */
export interface TextRange {
  readonly start: number
  readonly end: number
}

/**
 * A diagnostic (syntax or semantic) produced during query analysis.
 */
export interface Diagnostic {
  readonly message: string
  readonly severity: DiagnosticSeverity
  readonly range: TextRange
  readonly code: DiagnosticCode
}
