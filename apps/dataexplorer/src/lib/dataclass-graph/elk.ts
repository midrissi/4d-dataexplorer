import ELK, { type ELK as ElkInstance } from 'elkjs/lib/elk-api.js'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'

let elk: ElkInstance | null = null

export function getElk(): ElkInstance {
  if (!elk) {
    elk = new ELK({ workerUrl: elkWorkerUrl })
  }
  return elk
}

export function terminateElkWorker(): void {
  elk?.terminateWorker()
  elk = null
}
