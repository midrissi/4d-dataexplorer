/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '*.md?raw' {
  const content: string
  export default content
}

declare module 'react-syntax-highlighter' {
  import type { ComponentType } from 'react'
  export interface SyntaxHighlighterProps {
    language?: string
    style?: Record<string, unknown>
    customStyle?: Record<string, unknown>
    PreTag?: keyof JSX.IntrinsicElements
    codeTagProps?: Record<string, unknown>
    useInlineStyles?: boolean
    children?: string
  }
  export const Prism: ComponentType<SyntaxHighlighterProps>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, unknown>
}
