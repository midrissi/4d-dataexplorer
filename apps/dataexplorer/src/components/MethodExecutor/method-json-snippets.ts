export type MethodJsonSnippet = {
  id: string
  /** i18n key under `methodExecutor.snippets.*` */
  labelKey: string
  value: string
}

/** Default wrapper body for new method-executor sessions. */
export const DEFAULT_METHOD_WRAPPER_TEXT = `{
  "webEvent": { "eventType": "onclick", "data": {} },
  "webFormRef": "__default__"
}`

/** Predefined JSON objects for the method-call wrapper body. */
export const METHOD_WRAPPER_SNIPPETS: MethodJsonSnippet[] = [
  {
    id: 'web-form-event',
    labelKey: 'webFormEvent',
    value: DEFAULT_METHOD_WRAPPER_TEXT,
  },
  {
    id: 'web-form-ref',
    labelKey: 'webFormRef',
    value: `{ "webFormRef": "__default__" }`,
  },
  {
    id: 'web-event',
    labelKey: 'webEvent',
    value: `{
  "webEvent": { "eventType": "onclick", "data": {} }
}`,
  },
]
