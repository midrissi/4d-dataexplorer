/// <reference types="vitepress/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.data' {
  // VitePress data loaders export `data` at build/dev time.
  export const data: unknown
}
