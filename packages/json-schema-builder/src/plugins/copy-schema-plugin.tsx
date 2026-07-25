import { ClickToCopy } from '@4d/ui'
import { Copy } from 'lucide-react'
import { useSchemaBuilderContext, useSchemaBuilderI18n } from '../components/schema-builder'
import type { SchemaBuilderPlugin, SchemaBuilderPluginProps } from '../types'

function CopySchemaToolbar({ definitions }: SchemaBuilderPluginProps) {
  const t = useSchemaBuilderI18n()
  const { getRootForOutput } = useSchemaBuilderContext()
  const rootForOutput = getRootForOutput()
  const full =
    definitions && Object.keys(definitions).length > 0
      ? { ...rootForOutput, $defs: definitions }
      : rootForOutput
  const value = JSON.stringify(full, null, 2)

  return (
    <ClickToCopy
      as="button"
      value={value}
      tooltipLabel={t('pluginCopySchema')}
      tooltipCopiedLabel={t('pluginCopied')}
      className="flex h-6 items-center gap-1 rounded-sm border border-border bg-background px-2 text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
    >
      <Copy className="size-3.5 shrink-0" />
      <span>{t('pluginCopySchema')}</span>
    </ClickToCopy>
  )
}

export const copySchemaPlugin: SchemaBuilderPlugin = {
  id: 'copy-schema',
  toolbar: CopySchemaToolbar,
}
