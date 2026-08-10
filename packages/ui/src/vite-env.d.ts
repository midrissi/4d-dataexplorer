/** Vite worker import typings (no dependency on the `vite` package). */
declare module '*?worker' {
  const workerConstructor: {
    new (options?: { name?: string }): Worker
  }
  export default workerConstructor
}
