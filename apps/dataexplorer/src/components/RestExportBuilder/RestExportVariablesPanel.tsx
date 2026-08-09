import { Input, Label } from '@4d/ui'
import { PostmanExportVariablesForm } from '~/components/PostmanExport/PostmanExportVariablesForm'
import { useTranslation } from '~/i18n'
import type { DataclassExportMode, ToolkitVariables } from '~/lib/rest-export'

export function RestExportVariablesPanel({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  variables,
  onVariablesChange,
  includeAccessKeyLogin,
  onIncludeAccessKeyLoginChange,
  dataclassMode,
}: {
  name: string
  description: string
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  variables: ToolkitVariables
  onVariablesChange: (value: Omit<ToolkitVariables, 'includeAccessKeyLogin'>) => void
  includeAccessKeyLogin: boolean
  onIncludeAccessKeyLoginChange: (value: boolean) => void
  dataclassMode: DataclassExportMode
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-0.5">
          <Label htmlFor="rest-export-name" className="text-xs">
            {t('restExportBuilder.collectionName')}
          </Label>
          <Input
            id="rest-export-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t('restExportBuilder.collectionNamePlaceholder')}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="rest-export-description" className="text-xs">
            {t('restExportBuilder.collectionDescription')}
          </Label>
          <Input
            id="rest-export-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>
      <PostmanExportVariablesForm
        variables={{
          baseUrl: variables.baseUrl,
          accessKey: variables.accessKey,
          username: variables.username,
          password: variables.password,
        }}
        onVariablesChange={onVariablesChange}
        includeAccessKeyLogin={includeAccessKeyLogin}
        onIncludeAccessKeyLoginChange={onIncludeAccessKeyLoginChange}
      />
      {dataclassMode === 'collectionVar' ? (
        <p className="text-[11px] text-muted-foreground">
          {t('restExportBuilder.dataclassVariableHint')}
        </p>
      ) : null}
    </div>
  )
}
