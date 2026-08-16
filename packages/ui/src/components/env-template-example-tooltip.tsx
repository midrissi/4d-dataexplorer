import { ExternalLink, Image, Info, Palette } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)|\b(true|false|null)\b/gi

function parseStructuredValue(value: string): unknown | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed !== null && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function imagePreviewForSuggestion(
  key: string,
  value: string
): { src: string; external: boolean } | null {
  if (!key.startsWith('$faker.image.')) return null
  if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value)) {
    return { src: value, external: false }
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? { src: url.href, external: true }
      : null
  } catch {
    return null
  }
}

function colorValueForSuggestion(key: string, value: string): string | null {
  if (!key.startsWith('$faker.color.') || typeof CSS === 'undefined') return null
  if (CSS.supports('color', value)) return value

  const parsed = parseStructuredValue(value)
  if (!Array.isArray(parsed) || !parsed.every(Number.isFinite)) {
    const normalizedColorName = value.replace(/[\s-]/g, '')
    return CSS.supports('color', normalizedColorName) ? normalizedColorName : null
  }

  const channels = parsed as number[]
  const [first, second, third, alpha] = channels
  const percentage = (channel: number) => `${channel * 100}%`
  const lightness = `${first <= 1 ? first * 100 : first}%`
  const color =
    key === '$faker.color.cmyk' && channels.length === 4
      ? `rgb(${Math.round(255 * (1 - first) * (1 - alpha))} ${Math.round(255 * (1 - second) * (1 - alpha))} ${Math.round(255 * (1 - third) * (1 - alpha))})`
      : key === '$faker.color.hsl' && (channels.length === 3 || channels.length === 4)
        ? `hsl(${first} ${percentage(second)} ${percentage(third)}${alpha == null ? '' : ` / ${alpha}`})`
        : key === '$faker.color.hwb' && channels.length === 3
          ? `hwb(${first} ${percentage(second)} ${percentage(third)})`
          : key === '$faker.color.lab' && channels.length === 3
            ? `lab(${lightness} ${second} ${third})`
            : key === '$faker.color.lch' && channels.length === 3
              ? `lch(${lightness} ${second} ${third})`
              : key === '$faker.color.colorByCSSColorSpace' && channels.length === 3
                ? `color(srgb ${first} ${second} ${third})`
                : null

  return color && CSS.supports('color', color) ? color : null
}

function renderStructuredValue(value: unknown): ReactNode {
  const source = JSON.stringify(value, null, 2)
  const nodes: ReactNode[] = []
  let position = 0

  for (const match of source.matchAll(JSON_TOKEN_RE)) {
    const index = match.index ?? 0
    if (index > position) nodes.push(source.slice(position, index))
    const className = match[1]
      ? 'text-primary'
      : match[2]
        ? 'text-success'
        : match[3]
          ? 'text-warning'
          : 'text-muted-foreground'
    nodes.push(
      <span key={index} className={className}>
        {match[0]}
      </span>
    )
    position = index + match[0].length
  }

  if (position < source.length) nodes.push(source.slice(position))
  return nodes
}

export function EnvTemplateExampleTooltip({
  suggestionKey,
  example,
  open,
  onOpenChange,
}: {
  suggestionKey: string
  example: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="iconXs"
      className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={`${suggestionKey}: ${example}`}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={() => onOpenChange(true)}
      onFocus={() => onOpenChange(true)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenChange(!open)
      }}
    >
      <Info aria-hidden />
    </Button>
  )

  if (!open) return trigger

  const imagePreview = imagePreviewForSuggestion(suggestionKey, example)
  const colorValue = colorValueForSuggestion(suggestionKey, example)
  const structuredValue = parseStructuredValue(example)

  return (
    <Tooltip
      open
      onOpenChange={(next) => {
        if (!next) onOpenChange(false)
      }}
    >
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="pointer-events-auto z-70 w-64 space-y-2 p-2.5"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {imagePreview ? (
          <div className="overflow-hidden rounded-sm border border-border bg-muted/30">
            {imagePreview.external ? (
              <a href={imagePreview.src} target="_blank" rel="noreferrer" className="group block">
                <img
                  src={imagePreview.src}
                  alt=""
                  className="aspect-video w-full object-cover transition-transform duration-fast group-hover:scale-[1.02]"
                />
              </a>
            ) : (
              <img src={imagePreview.src} alt="" className="aspect-video w-full object-cover" />
            )}
            <span className="flex items-center gap-1.5 truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
              <Image className="size-3 shrink-0" aria-hidden />
              <span className="truncate">
                {imagePreview.external ? imagePreview.src : 'data:image'}
              </span>
              {imagePreview.external ? (
                <ExternalLink className="ml-auto size-3 shrink-0" aria-hidden />
              ) : null}
            </span>
          </div>
        ) : colorValue ? (
          <div className="overflow-hidden rounded-sm border border-border bg-muted/30">
            <div className="h-16 border-border border-b" style={{ backgroundColor: colorValue }} />
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Palette className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{example}</span>
            </div>
          </div>
        ) : structuredValue ? (
          <pre className="max-h-48 overflow-auto rounded-sm border border-border bg-muted/30 p-2 font-mono text-[11px] text-foreground leading-relaxed">
            <code>{renderStructuredValue(structuredValue)}</code>
          </pre>
        ) : (
          <p className="max-h-32 overflow-auto break-all rounded-sm border border-border bg-muted/30 p-2">
            {example}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
