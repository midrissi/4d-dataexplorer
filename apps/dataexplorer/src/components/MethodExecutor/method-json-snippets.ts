export type MethodJsonSnippet = {
  id: string
  /** i18n key under `methodExecutor.snippets.*` */
  labelKey: string
  value: string
}

/** Predefined JSON objects for the method-call wrapper body. */
export const METHOD_WRAPPER_SNIPPETS: MethodJsonSnippet[] = [
  {
    id: 'web-form-ref',
    labelKey: 'webFormRef',
    value: `{
  "webFormRef": "__default__"
}`,
  },
  {
    id: 'web-event',
    labelKey: 'webEvent',
    value: `{
  "webEvent": {
    "eventType": "onclick",
    "data": {}
  }
}`,
  },
]
