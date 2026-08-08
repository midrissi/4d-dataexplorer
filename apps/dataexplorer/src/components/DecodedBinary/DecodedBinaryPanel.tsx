import type { JsonArray, JsonObject } from '@4d/base64-decoder'
import { cn } from '@4d/ui'
import { lazy, Suspense } from 'react'
import { ObjectTree } from '~/components/Console/ObjectTree'
import { BlobBinaryView } from './BlobBinaryView'
import { FormulaBinaryView } from './FormulaBinaryView'
import { GenericBinaryView } from './GenericBinaryView'
import { MailAttachmentBinaryView } from './MailAttachmentBinaryView'
import { OpaqueBinaryView } from './OpaqueBinaryView'
import { FileBinaryView, FolderBinaryView } from './PathBinaryView'
import { PointerBinaryView } from './PointerBinaryView'
import type { DecodedBinaryObject } from './types'
import {
  isBlobDecoded,
  isDecodedBinaryObject,
  isFileOrFolderDecoded,
  isFormulaDecoded,
  isMailAttachmentDecoded,
  isMethodDecoded,
  isOpaqueDecoded,
  isPointerDecoded,
  isVectorDecoded,
} from './types'
import { VectorBinaryView } from './VectorBinaryView'

const MethodBinaryView = lazy(() =>
  import('./MethodBinaryView').then((m) => ({ default: m.MethodBinaryView }))
)

interface DecodedBinaryPanelProps {
  decoded: DecodedBinaryObject
  className?: string
}

/** Renders a single root/nested 4D class (`__class` + `__decoded`). */
export function DecodedBinaryPanel({ decoded, className }: DecodedBinaryPanelProps) {
  const { __class, __decoded } = decoded

  if (isVectorDecoded(__decoded) && (__class === 'jvec' || __class === 'JVec')) {
    return <VectorBinaryView data={__decoded} className={className} />
  }

  if (isFileOrFolderDecoded(__decoded) && __class === 'JFil') {
    return <FileBinaryView data={__decoded} className={className} />
  }

  if (isFileOrFolderDecoded(__decoded) && __class === 'JFol') {
    return <FolderBinaryView data={__decoded} className={className} />
  }

  if (isBlobDecoded(__decoded) && __class === 'JBlb') {
    return <BlobBinaryView data={__decoded} className={className} />
  }

  if (isMailAttachmentDecoded(__decoded) && __class === 'MAtt') {
    return <MailAttachmentBinaryView data={__decoded} className={className} />
  }

  if (isPointerDecoded(__decoded) && __class === '4ptr') {
    return <PointerBinaryView data={__decoded} className={className} />
  }

  if (isFormulaDecoded(__decoded) && __class === '4fma') {
    return <FormulaBinaryView data={__decoded} className={className} />
  }

  if (isMethodDecoded(__decoded) && __class === 'VolM') {
    return (
      <Suspense fallback={<div className={cn('min-h-24', className)} />}>
        <MethodBinaryView data={__decoded} className={className} />
      </Suspense>
    )
  }

  // FileHandle + opaque runtime classes (pict, rest, soap, …) share metadata + payload shape.
  if (isOpaqueDecoded(__decoded)) {
    return <OpaqueBinaryView signature={__class} data={__decoded} className={className} />
  }

  return <GenericBinaryView signature={__class} data={__decoded} className={className} />
}

interface DecodedBinaryContentProps {
  /** Root class, object tree, or array that may nest class objects. */
  value: JsonObject | JsonArray
  className?: string
}

/**
 * Decoded tab content: dedicated class view for root classes, otherwise a JSON
 * tree (nested `__class` nodes render via {@link DecodedBinaryPanel}).
 * Sizes to content (like the console tree); scrolls only when taller than max-h.
 */
export function DecodedBinaryContent({ value, className }: DecodedBinaryContentProps) {
  if (isDecodedBinaryObject(value)) {
    return <DecodedBinaryPanel decoded={value} className={className} />
  }

  return (
    <div
      className={cn(
        'h-fit max-h-80 overflow-auto rounded-md border bg-muted/10 p-1.5 font-mono text-[11px]',
        className
      )}
    >
      <ObjectTree value={value} defaultOpen />
    </div>
  )
}
