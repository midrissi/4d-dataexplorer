import { cn } from '@4d/ui'
import type { ReactNode } from 'react'
import { DataclassIcon, getDataclassColorClasses } from '~/components/DataclassCustomizeModal'
import type { MethodScope } from '~/store/method-executor-types'
import { useDataclassCustomizations } from '~/store/settings'

function Dot() {
  return (
    <span className="text-muted-foreground/50" translate="no" aria-hidden="true">
      .
    </span>
  )
}

function DataclassToken({ dataClass, slot }: { dataClass?: string; slot?: ReactNode }) {
  const customizations = useDataclassCustomizations()
  const customization = dataClass ? customizations[dataClass] : undefined
  const colorClasses = getDataclassColorClasses(customization)

  if (slot) return <>{slot}</>
  if (!dataClass) return null

  return (
    <span
      style={colorClasses.style}
      className={cn('inline-flex items-center gap-1 leading-5', colorClasses.text)}
    >
      <DataclassIcon customization={customization} className="size-[1em] shrink-0" />
      <span className="leading-5">{dataClass}</span>
    </span>
  )
}

function SingletonToken({ name, slot }: { name?: string; slot?: ReactNode }) {
  if (slot) return <>{slot}</>
  if (!name) return null

  return (
    <span className="text-fuchsia-700 leading-5 dark:text-fuchsia-400" translate="no">
      {name}
    </span>
  )
}

/**
 * Renders a method call in scope-specific syntax:
 * - catalog: ds.method
 * - singleton: cs.Singleton.method
 * - dataclass: ds.Table.method
 * - entity: ds.Table.entity(key).method
 * - entitySelection: ds.Table.sel(key).method
 */
export function MethodCallExpression({
  scope,
  methodName,
  dataClass,
  singletonName,
  dataClassSlot,
  methodSlot,
  keySlot,
  keyDisplay,
}: {
  scope: MethodScope
  methodName: string
  dataClass?: string
  singletonName?: string
  dataClassSlot?: ReactNode
  /** Editable method picker (same pattern as dataclass select). */
  methodSlot?: ReactNode
  /** Editable key control inside entity()/sel(). */
  keySlot?: ReactNode
  /** Read-only key content (e.g. history with mod-click). */
  keyDisplay?: ReactNode
}) {
  const isSingleton = scope === 'singleton'
  const showDataClass = scope !== 'catalog' && !isSingleton
  const showSingleton = isSingleton
  const targetKind = scope === 'entity' ? 'entity' : scope === 'entitySelection' ? 'sel' : null
  const keyContent = keySlot ?? keyDisplay

  return (
    <code className="inline-flex min-w-max max-w-none flex-nowrap items-center gap-x-0 whitespace-nowrap font-mono text-xs leading-5">
      <span
        className={
          isSingleton ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-sky-600 dark:text-sky-400'
        }
        translate="no"
      >
        {isSingleton ? 'cs' : 'ds'}
      </span>
      {showSingleton ? (
        <>
          <Dot />
          <SingletonToken name={singletonName} slot={dataClassSlot} />
        </>
      ) : null}
      {showDataClass ? (
        <>
          <Dot />
          <DataclassToken dataClass={dataClass} slot={dataClassSlot} />
        </>
      ) : null}
      {targetKind ? (
        <>
          <Dot />
          <span className="text-violet-600 dark:text-violet-400" translate="no">
            {targetKind}
          </span>
          <span className="text-muted-foreground/50" translate="no">
            (
          </span>
          {keyContent}
          <span className="text-muted-foreground/50" translate="no">
            )
          </span>
        </>
      ) : null}
      <Dot />
      {methodSlot ?? (
        <span className="text-amber-600 dark:text-amber-400" translate="no">
          {methodName}
        </span>
      )}
    </code>
  )
}
