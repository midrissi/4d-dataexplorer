import { CodeEditor } from '@4d/ui/code-editor'
import type { ReactNode } from 'react'
import { isPrivateBinaryObject } from '~/components/BinaryObjectViewer'
import { PrivateBinaryResult } from '~/components/DecodedBinary/PrivateBinaryResult'
import { EntityViewer } from '~/components/EntityViewer'
import type { DetectedMethodResult } from './detect-method-result'
import { EntitySelectionResult } from './EntitySelectionResult'
import { entityDataclassName } from './entity-dataclass-name'
import { prettyJson } from './pretty-json'
import { WebformMetaBar } from './WebformMetaBar'

export function PreviewBody({
  result,
  selectionTabTitle,
}: {
  result: DetectedMethodResult
  selectionTabTitle?: string
}) {
  const webformBar = result.webform ? <WebformMetaBar webform={result.webform} /> : null

  let body: ReactNode
  if (result.kind === 'entity') {
    body = (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <EntityViewer entity={result.value} dataclassName={entityDataclassName(result.value)} />
      </div>
    )
  } else if (result.kind === 'entitysel') {
    body = <EntitySelectionResult result={result} selectionTabTitle={selectionTabTitle} />
  } else if (isPrivateBinaryObject(result.value)) {
    body = <PrivateBinaryResult value={result.value} />
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeEditor value={prettyJson(result.value)} readOnly height="100%" toolbar />
      </div>
    )
  }

  if (!webformBar) return body

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {webformBar}
      {body}
    </div>
  )
}
