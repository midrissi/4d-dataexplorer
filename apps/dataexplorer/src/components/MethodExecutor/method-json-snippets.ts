export type MethodJsonSnippet = {
  id: string
  /** i18n key under `methodExecutor.snippets.*` */
  labelKey: string
  value: string
}

/** Predefined JSON objects for the method-call wrapper body. */
export const METHOD_WRAPPER_SNIPPETS: MethodJsonSnippet[] = [
  {
    id: 'web-event',
    labelKey: 'webEvent',
    value: `{
  "webEvent": {
    "caller": "",
    "eventType": "onclick",
    "data": {}
  },
  "webFormRef": "__default__"
}`,
  },
]
