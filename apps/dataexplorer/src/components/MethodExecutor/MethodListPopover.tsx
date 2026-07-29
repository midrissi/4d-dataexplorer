import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@4d/ui'
import { ChevronDown, Code2, Play } from 'lucide-react'
import { EmptyPanel } from '~/components/EmptyPanel'
import { useTranslation } from '~/i18n'
import {
  mobileMenuCollisionProps,
  mobileMenuContentClass,
  mobileMenuHeaderClass,
  mobileMenuItemClass,
} from '~/lib/mobile-menu'
import { isMobileShell } from '~/lib/platform'
import type { MethodScope } from '~/store/method-executor-types'
import { useTabsStore } from '~/store/tabs'
import { useMethodCatalog } from './useMethodCatalog'

export function MethodListPopover({
  dataClass,
  scopes,
  entityKey,
  entitySetId,
  compact = false,
}: {
  dataClass: string
  scopes: MethodScope[]
  entityKey?: string | null
  entitySetId?: string | null
  compact?: boolean
}) {
  const { t } = useTranslation()
  const mobile = isMobileShell()
  const { methods, loading } = useMethodCatalog()
  const openMethodExecutorTab = useTabsStore((state) => state.openMethodExecutorTab)
  const methodsLabel = t('methodExecutor.methods')
  const visible = methods.filter(
    (method) => method.dataClass === dataClass && scopes.includes(method.scope)
  )

  const trigger = (
    <Button
      variant="outline"
      size="xs"
      className={cn('h-6 gap-1 px-2 text-xs', mobile && 'h-9 px-2.5')}
      disabled={loading}
      aria-label={methodsLabel}
    >
      <Play className="h-3.5 w-3.5" />
      {compact ? null : methodsLabel}
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </Button>
  )

  return (
    <DropdownMenu>
      {compact ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{methodsLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align="end"
        side="bottom"
        className={cn(
          mobile
            ? mobileMenuContentClass('max-h-[min(70dvh,32rem)]')
            : 'max-h-[min(24rem,70vh)] w-72 overflow-y-auto'
        )}
        {...(mobile ? mobileMenuCollisionProps : { collisionPadding: 12, avoidCollisions: true })}
      >
        <DropdownMenuLabel className={mobile ? mobileMenuHeaderClass('text-sm') : undefined}>
          {dataClass} · {t('methodExecutor.methods')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <EmptyPanel
            icon={Code2}
            title={t('methodExecutor.noMethodsForClassTitle')}
            description={t('methodExecutor.noMethodsForClassDescription')}
            ghost="none"
            size="sm"
            className="min-h-0 py-4"
          />
        ) : (
          visible.map((method) => {
            const needsEntity = method.scope === 'entity'
            return (
              <DropdownMenuItem
                key={method.id}
                className={mobile ? mobileMenuItemClass('items-start') : undefined}
                disabled={needsEntity && !entityKey}
                onClick={() =>
                  openMethodExecutorTab({
                    scope: method.scope,
                    methodName: method.methodName,
                    dataClass,
                    key: method.scope === 'entity' ? (entityKey ?? undefined) : undefined,
                    entitySetId:
                      method.scope === 'entitySelection' ? (entitySetId ?? undefined) : undefined,
                    paramsText: method.paramsText,
                    allowedOnHTTPGET: method.allowedOnHTTPGET,
                  })
                }
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{method.methodName}</div>
                  <div className="truncate text-muted-foreground text-xs">
                    {method.applyTo ?? method.scope}
                    {needsEntity && !entityKey ? ` · ${t('methodExecutor.selectEntityFirst')}` : ''}
                  </div>
                </div>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
