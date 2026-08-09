import { Checkbox, cn } from '@4d/ui'
import { useTranslation } from '~/i18n'
import { type ToolkitCategoryFlags, triState } from '~/lib/rest-export'
import { RestExportTriStateIconButton } from './RestExportTriStateIconButton'

const CORE_FLAGS: Array<keyof ToolkitCategoryFlags> = [
  'auth',
  'catalog',
  'info',
  'datastoreFunctions',
  'singletons',
  'crudList',
  'crudCreate',
  'crudGet',
  'crudUpdate',
  'crudDeleteByKey',
  'entitySetCreate',
  'entitySetPage',
  'entitySetClean',
  'entitySetRelease',
  'functions',
]

const ADVANCED_FLAGS: Array<keyof ToolkitCategoryFlags> = [
  'deleteAll',
  'deleteByFilter',
  'deleteEntitySet',
  'compute',
  'directoryLogin',
  'httpGetVariants',
  'includeNonExposed',
]

const CATEGORY_LABEL_KEYS: Record<keyof ToolkitCategoryFlags, string> = {
  auth: 'restExportBuilder.categoryAuth',
  catalog: 'restExportBuilder.categoryCatalog',
  info: 'restExportBuilder.categoryInfo',
  datastoreFunctions: 'restExportBuilder.categoryDatastoreFunctions',
  singletons: 'restExportBuilder.categorySingletons',
  crudList: 'restExportBuilder.categoryCrudList',
  crudCreate: 'restExportBuilder.categoryCrudCreate',
  crudGet: 'restExportBuilder.categoryCrudGet',
  crudUpdate: 'restExportBuilder.categoryCrudUpdate',
  crudDeleteByKey: 'restExportBuilder.categoryCrudDeleteByKey',
  entitySetCreate: 'restExportBuilder.categoryEntitySetCreate',
  entitySetPage: 'restExportBuilder.categoryEntitySetPage',
  entitySetClean: 'restExportBuilder.categoryEntitySetClean',
  entitySetRelease: 'restExportBuilder.categoryEntitySetRelease',
  functions: 'restExportBuilder.categoryFunctions',
  deleteAll: 'restExportBuilder.categoryDeleteAll',
  deleteByFilter: 'restExportBuilder.categoryDeleteByFilter',
  deleteEntitySet: 'restExportBuilder.categoryDeleteEntitySet',
  compute: 'restExportBuilder.categoryCompute',
  directoryLogin: 'restExportBuilder.categoryDirectoryLogin',
  httpGetVariants: 'restExportBuilder.categoryHttpGetVariants',
  includeNonExposed: 'restExportBuilder.categoryIncludeNonExposed',
}

function CategoryGroup({
  title,
  flags,
  categories,
  onChange,
  onSetAll,
}: {
  title: string
  flags: Array<keyof ToolkitCategoryFlags>
  categories: ToolkitCategoryFlags
  onChange: (key: keyof ToolkitCategoryFlags, value: boolean) => void
  onSetAll: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const state = triState(flags.filter((flag) => categories[flag]).length, flags.length)
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{title}</p>
        <RestExportTriStateIconButton
          state={state}
          labels={{
            false: t('restExportBuilder.selectAll'),
            indeterminate: t('restExportBuilder.selectAll'),
            true: t('restExportBuilder.selectNone'),
          }}
          onToggle={onSetAll}
        />
      </div>
      <div className="overflow-hidden rounded-md border bg-muted/20">
        {flags.map((flag) => {
          const id = `rest-export-cat-${flag}`
          return (
            <label
              key={flag}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer items-center gap-2 border-border/50 border-b px-2 py-1.5 last:border-b-0',
                'hover:bg-muted/50'
              )}
            >
              <Checkbox
                id={id}
                checked={categories[flag]}
                onCheckedChange={(value) => onChange(flag, value === true)}
              />
              <span className="min-w-0 truncate text-xs">{t(CATEGORY_LABEL_KEYS[flag])}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function flagsPatch(
  flags: Array<keyof ToolkitCategoryFlags>,
  value: boolean
): Partial<ToolkitCategoryFlags> {
  const patch: Partial<ToolkitCategoryFlags> = {}
  for (const flag of flags) patch[flag] = value
  return patch
}

export function RestExportCategoriesPanel({
  categories,
  onChange,
  onPatch,
}: {
  categories: ToolkitCategoryFlags
  onChange: (key: keyof ToolkitCategoryFlags, value: boolean) => void
  onPatch: (patch: Partial<ToolkitCategoryFlags>) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <CategoryGroup
        title={t('restExportBuilder.coreGroup')}
        flags={CORE_FLAGS}
        categories={categories}
        onChange={onChange}
        onSetAll={(value) => onPatch(flagsPatch(CORE_FLAGS, value))}
      />
      <CategoryGroup
        title={t('restExportBuilder.advancedGroup')}
        flags={ADVANCED_FLAGS}
        categories={categories}
        onChange={onChange}
        onSetAll={(value) => onPatch(flagsPatch(ADVANCED_FLAGS, value))}
      />
    </div>
  )
}
