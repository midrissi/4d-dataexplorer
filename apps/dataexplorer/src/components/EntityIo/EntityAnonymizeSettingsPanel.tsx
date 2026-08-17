import { Input, Label, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@4d/ui'
import { Info, WandSparkles } from 'lucide-react'
import { useTranslation } from '~/i18n'
import { type EntityIoFormatId, listExportFormats } from '~/lib/entity-io'
import { EntityIoPanel } from './EntityIoPanel'
import { EntityIoSelect } from './EntityIoSelect'

export function EntityAnonymizeSettingsPanel({
  seed,
  formatId,
  onSeedChange,
  onFormatChange,
}: {
  seed: string
  formatId: EntityIoFormatId
  onSeedChange: (value: string) => void
  onFormatChange: (value: EntityIoFormatId) => void
}) {
  const { t } = useTranslation()
  const formats = listExportFormats()

  return (
    <EntityIoPanel icon={WandSparkles} title="Faker">
      <div className="grid items-start gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex h-4 items-center gap-1">
            <Label htmlFor="anon-seed" className="leading-none">
              {t('entity.io.seed')}
            </Label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                {/* Non-focusable trigger: dialog autofocus must not open the help. */}
                <TooltipTrigger asChild>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                    <Info className="h-3 w-3" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {t('entity.io.seedHelp')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="anon-seed"
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
            placeholder="42"
            inputMode="numeric"
            aria-describedby="anon-seed-help"
          />
          <p id="anon-seed-help" className="sr-only">
            {t('entity.io.seedHelp')}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex h-4 items-center">
            <Label htmlFor="anon-format" className="leading-none">
              {t('entity.io.formatLabel')}
            </Label>
          </div>
          <EntityIoSelect
            id="anon-format"
            value={formatId}
            onValueChange={onFormatChange}
            options={formats.map((f) => ({
              value: f.id,
              label: t(`entity.io.formats.${f.id}`),
            }))}
          />
        </div>
      </div>
    </EntityIoPanel>
  )
}
