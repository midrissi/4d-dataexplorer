#!/usr/bin/env bun
/**
 * Rebuild OS icons + in-app brand marks from a single SVG source.
 *
 * Usage:
 *   bun run branding
 *   bun run branding path/to/icon.svg
 *   bun run branding --dry-run
 *   bun run branding --skip-tauri path/to/icon.svg
 *
 * Default source: branding/icon-source.svg (full-bleed OS master)
 *
 * Updates:
 *   - branding/ + desktop + mobile icon-source.svg
 *   - Tauri icon sets (icns/ico/png/ios/android) via `tauri icon`
 *   - iOS gen/ AppIcon sync + splash patch into gen/
 *   - Android adaptive launcher background color
 *   - Squircle brand marks: favicon, docs logo, AppBrandIcon asset
 *   - Mobile splash logos (rounded)
 *   - Docs og-image.svg / og-image.png
 *   - Desktop macOS readme logo
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { $ } from 'bun'

const ROOT = join(import.meta.dir, '..')
const SQUIRCLE_RATIO = 0.22375

const PATHS = {
  brandingSource: join(ROOT, 'branding/icon-source.svg'),
  brandingLogo: join(ROOT, 'branding/logo.svg'),
  desktopSource: join(ROOT, 'apps/desktop/src-tauri/icon-source.svg'),
  mobileSource: join(ROOT, 'apps/mobile/src-tauri/icon-source.svg'),
  desktopIcons: join(ROOT, 'apps/desktop/src-tauri/icons'),
  mobileIcons: join(ROOT, 'apps/mobile/src-tauri/icons'),
  mobileGenApple: join(ROOT, 'apps/mobile/src-tauri/gen/apple'),
  mobileGenAndroid: join(ROOT, 'apps/mobile/src-tauri/gen/android'),
  brandMark: join(ROOT, 'apps/dataexplorer/src/assets/brand-mark.svg'),
  favicon: join(ROOT, 'apps/dataexplorer/public/favicon.svg'),
  docsLogo: join(ROOT, 'apps/docs/public/logo.svg'),
  ogSvg: join(ROOT, 'apps/docs/public/og-image.svg'),
  ogPng: join(ROOT, 'apps/docs/public/og-image.png'),
  macosReadme: join(ROOT, 'apps/desktop/scripts/macos-readme.html'),
  splashPublic: join(ROOT, 'apps/mobile/public/splash-logo.png'),
  splashPublicSvg: join(ROOT, 'apps/mobile/public/splash-logo.svg'),
  splashImageset: join(ROOT, 'apps/mobile/src-tauri/splash/SplashLogo.imageset'),
  splashPatch: join(ROOT, 'apps/mobile/scripts/patch-mobile-splash.sh'),
  desktopAndroidBg: join(
    ROOT,
    'apps/desktop/src-tauri/icons/android/values/ic_launcher_background.xml'
  ),
  mobileAndroidBg: join(
    ROOT,
    'apps/mobile/src-tauri/icons/android/values/ic_launcher_background.xml'
  ),
} as const

type Args = {
  input: string
  dryRun: boolean
  skipTauri: boolean
}

function fail(message: string): never {
  console.error(`\x1b[31m❌ ${message}\x1b[0m`)
  process.exit(1)
}

function log(message: string) {
  console.log(`\x1b[36m🔹 ${message}\x1b[0m`)
}

function ok(message: string) {
  console.log(`\x1b[32m✅ ${message}\x1b[0m`)
}

function warn(message: string) {
  console.warn(`\x1b[33m⚠️  ${message}\x1b[0m`)
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const skipTauri = argv.includes('--skip-tauri')
  const positional = argv.filter((a) => !a.startsWith('-'))
  const fallback = existsSync(PATHS.brandingSource) ? PATHS.brandingSource : PATHS.desktopSource
  const input = resolve(positional[0] ?? fallback)
  return { input, dryRun, skipTauri }
}

function ensureTools() {
  if (!Bun.which('rsvg-convert')) {
    fail('rsvg-convert not found (install librsvg: brew install librsvg)')
  }
}

function extractSvgSize(svg: string): number {
  const viewBox = svg.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i)
  if (viewBox) {
    const w = Number(viewBox[3])
    const h = Number(viewBox[4])
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      if (Math.abs(w - h) > 0.5) {
        fail(`Source SVG must be square (viewBox ${w}×${h})`)
      }
      return w
    }
  }
  const width = svg.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/i)
  const height = svg.match(/\bheight=["'](\d+(?:\.\d+)?)["']/i)
  if (width && height) {
    const w = Number(width[1])
    const h = Number(height[1])
    if (Math.abs(w - h) > 0.5) fail(`Source SVG must be square (${w}×${h})`)
    return w
  }
  fail('Could not read SVG size (need viewBox or width/height)')
}

/**
 * Vector squircle mark for web (favicon, brand-mark, docs logo).
 * Keep source coordinate space (no downscale). Prefix IDs on the full
 * inner markup before splitting so url(#…) refs stay in sync with defs.
 * Strip filters — feDropShadow often blanks the filtered group in WebKit <img>.
 */
function extractSvgInner(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/i)
  const close = svg.match(/<\/svg>\s*$/i)
  if (!open || !close) fail('Invalid SVG: missing <svg>…</svg>')
  return svg.slice((open.index ?? 0) + open[0].length, close.index ?? svg.length).trim()
}

function prefixSvgIds(inner: string, prefix: string): string {
  const ids = new Set<string>()
  for (const match of inner.matchAll(/\bid=["']([^"']+)["']/g)) {
    ids.add(match[1])
  }
  let out = inner
  for (const id of ids) {
    const next = `${prefix}${id}`
    out = out.replaceAll(`id="${id}"`, `id="${next}"`)
    out = out.replaceAll(`id='${id}'`, `id='${next}'`)
    out = out.replaceAll(`url(#${id})`, `url(#${next})`)
    out = out.replaceAll(`url('#${id}')`, `url('#${next}')`)
    out = out.replaceAll(`url("#${id}")`, `url("#${next}")`)
  }
  return out
}

function splitSvgDefsAndBody(inner: string): { defs: string; body: string } {
  const defsMatch = inner.match(/<defs\b[^>]*>[\s\S]*?<\/defs>/i)
  const defs = defsMatch
    ? defsMatch[0]
        .replace(/^<defs\b[^>]*>/i, '')
        .replace(/<\/defs>\s*$/i, '')
        .trim()
    : ''
  let body = defsMatch ? inner.replace(defsMatch[0], '') : inner
  body = body.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '').trim()
  return { defs, body }
}

/** Remove SVG filters — unreliable when the mark is loaded via <img> (WebKit). */
function stripSvgFilters(markup: string): string {
  return markup
    .replace(/<filter\b[^>]*>[\s\S]*?<\/filter>/gi, '')
    .replace(/\sfilter=(["'])(?:(?!\1).)*\1/gi, '')
}

function buildSquircleMarkSvg(opts: {
  sourceSvg: string
  idPrefix: string
  title: string
}): string {
  const side = extractSvgSize(opts.sourceSvg)
  const rx = (side * SQUIRCLE_RATIO).toFixed(2)
  // Prefix on the full inner first so url(#id) in the body matches def ids.
  const prefixed = stripSvgFilters(prefixSvgIds(extractSvgInner(opts.sourceSvg), opts.idPrefix))
  const { defs, body } = splitSvgDefsAndBody(prefixed)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}" fill="none">
  <title>${opts.title}</title>
  <defs>
    <clipPath id="${opts.idPrefix}clip">
      <rect width="${side}" height="${side}" rx="${rx}" ry="${rx}"/>
    </clipPath>
${defs ? `    ${defs.replace(/\n/g, '\n    ')}\n` : ''}  </defs>
  <g clip-path="url(#${opts.idPrefix}clip)">
${body
  .split('\n')
  .map((line) => (line.trim() ? `    ${line}` : line))
  .join('\n')}
  </g>
</svg>
`
}

function writeText(path: string, contents: string, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] write ${path}`)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
}

async function rasterizeSvg(svgPath: string, size: number, outPng: string, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] rsvg-convert -w ${size} ${svgPath} → ${outPng}`)
    return
  }
  mkdirSync(dirname(outPng), { recursive: true })
  await $`rsvg-convert -w ${size} -h ${size} ${svgPath} -o ${outPng}`.quiet()
}

async function runPython(code: string, dryRun: boolean) {
  if (dryRun) {
    log('[dry-run] python pillow step')
    return
  }
  const proc = Bun.spawn(['python3', '-c', code], { stdout: 'pipe', stderr: 'pipe' })
  const stderr = await new Response(proc.stderr).text()
  const codeExit = await proc.exited
  if (codeExit !== 0) {
    fail(stderr.trim() || 'python step failed (Pillow required: pip3 install pillow)')
  }
}

async function sampleBrandColor(iconPng: string, dryRun: boolean): Promise<string> {
  if (dryRun || !existsSync(iconPng)) return '#f97316'
  const proc = Bun.spawn(
    [
      'python3',
      '-c',
      `
from PIL import Image
im = Image.open(${JSON.stringify(iconPng)}).convert('RGBA')
# Sample near a corner — full-bleed brand fill; mark often covers top-center.
px = im.getpixel((8, 8))
print('#{:02x}{:02x}{:02x}'.format(px[0], px[1], px[2]))
`,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) {
    warn(err || 'Pillow sample failed; using #f97316')
    return '#f97316'
  }
  const color = out.trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#f97316'
}

function androidBgXml(color: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">${color}</color>
</resources>
`
}

async function roundPng(src: string, dst: string, size: number, dryRun: boolean) {
  await runPython(
    `
from PIL import Image, ImageDraw
im = Image.open(${JSON.stringify(src)}).convert('RGBA').resize((${size}, ${size}), Image.Resampling.LANCZOS)
w, h = im.size
radius = max(1, round(min(w, h) * ${SQUIRCLE_RATIO}))
mask = Image.new('L', (w, h), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
out.paste(im, (0, 0), mask=mask)
out.save(${JSON.stringify(dst)}, format='PNG')
`,
    dryRun
  )
}

async function compositeAndroidLaunchers(androidRoot: string, bg: string, dryRun: boolean) {
  if (!existsSync(androidRoot)) return
  await runPython(
    `
from pathlib import Path
from PIL import Image
bg_hex = ${JSON.stringify(bg)}.lstrip('#')
r, g, b = int(bg_hex[0:2], 16), int(bg_hex[2:4], 16), int(bg_hex[4:6], 16)
ORANGE = (r, g, b, 255)
root = Path(${JSON.stringify(androidRoot)})
count = 0
for path in root.rglob('ic_launcher*.png'):
    if 'foreground' in path.name:
        continue
    im = Image.open(path).convert('RGBA')
    base = Image.new('RGBA', im.size, ORANGE)
    Image.alpha_composite(base, im).save(path)
    count += 1
print(count)
`,
    dryRun
  )
}

async function runTauriIcon(appDir: string, sourceSvg: string, iosColor: string, dryRun: boolean) {
  if (dryRun) {
    log(`[dry-run] tauri icon in ${appDir}`)
    return
  }
  const iconsDir = join(appDir, 'src-tauri/icons')
  // Force-refresh platform sets — tauri icon can leave stale iOS PNGs otherwise.
  for (const name of ['ios', 'android']) {
    const dir = join(iconsDir, name)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
  log(`🛠️  Generating Tauri icons in ${appDir.replace(`${ROOT}/`, '')}…`)
  await $`bunx tauri icon ${sourceSvg} --ios-color ${iosColor}`.cwd(appDir)
}

async function syncIosAppIcons(dryRun: boolean) {
  const desktopIos = join(PATHS.desktopIcons, 'ios')
  const mobileIos = join(PATHS.mobileIcons, 'ios')
  const genAppIcon = join(PATHS.mobileGenApple, 'Assets.xcassets/AppIcon.appiconset')

  if (dryRun) {
    log('[dry-run] sync AppIcon → mobile icons/ios + gen/apple')
    return
  }

  // Mobile `tauri icon` often writes straight into gen/apple and skips icons/ios.
  // Mirror desktop's icons/ios so ios-prepare has a stable source of truth.
  if (existsSync(desktopIos)) {
    mkdirSync(mobileIos, { recursive: true })
    await $`bash -lc ${`cp -f "${desktopIos}"/*.png "${mobileIos}/"`}`.quiet()
    ok('📱 Mirrored desktop icons/ios → mobile icons/ios')
  } else if (!existsSync(mobileIos)) {
    log('⏭️  skip AppIcon sync: no icons/ios on desktop or mobile')
    return
  }

  if (!existsSync(genAppIcon)) {
    log('⏭️  skip AppIcon sync: gen/apple missing (run tauri ios init / ios-prepare)')
    return
  }
  await $`bash -lc ${`cp -f "${mobileIos}"/*.png "${genAppIcon}/"`}`.quiet()
  ok('📲 Synced iOS AppIcon → gen/apple Assets.xcassets')
}

async function syncAndroidAppIcons(dryRun: boolean) {
  const mobileAndroid = join(PATHS.mobileIcons, 'android')
  const genRes = join(PATHS.mobileGenAndroid, 'app/src/main/res')

  if (dryRun) {
    log('[dry-run] sync Android launcher icons → gen/android')
    return
  }

  if (!existsSync(mobileAndroid)) {
    log('⏭️  skip Android icon sync: no icons/android')
    return
  }
  if (!existsSync(genRes)) {
    log('⏭️  skip Android icon sync: gen/android missing (run tauri android init)')
    return
  }

  const densities = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
    'mipmap-anydpi-v26',
  ]
  for (const density of densities) {
    const src = join(mobileAndroid, density)
    if (!existsSync(src)) continue
    const dst = join(genRes, density)
    mkdirSync(dst, { recursive: true })
    await $`bash -lc ${`cp -f "${src}"/* "${dst}/"`}`.quiet()
  }
  const bgSrc = join(mobileAndroid, 'values/ic_launcher_background.xml')
  if (existsSync(bgSrc)) {
    const bgDst = join(genRes, 'values')
    mkdirSync(bgDst, { recursive: true })
    await $`bash -lc ${`cp -f "${bgSrc}" "${bgDst}/"`}`.quiet()
  }
  ok('🤖 Synced Android launcher icons → gen/android')
}

async function patchMobileSplash(dryRun: boolean) {
  if (!existsSync(PATHS.splashPatch)) return
  const hasApple = existsSync(PATHS.mobileGenApple)
  const hasAndroid = existsSync(PATHS.mobileGenAndroid)
  if (!hasApple && !hasAndroid) {
    log('⏭️  skip splash patch: gen/apple and gen/android missing')
    return
  }
  if (dryRun) {
    log('[dry-run] patch-mobile-splash.sh')
    return
  }
  await $`bash ${PATHS.splashPatch}`.cwd(join(ROOT, 'apps/mobile'))
  ok('💧 Patched mobile splash into gen/')
}

function replaceBetweenMarkers(
  source: string,
  start: string,
  end: string,
  inner: string,
  label: string
): string {
  const startIdx = source.indexOf(start)
  const endIdx = source.indexOf(end)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    fail(`Missing ${label} markers: ${start} … ${end}`)
  }
  return `${source.slice(0, startIdx)}${start}\n${inner}\n${end}${source.slice(endIdx + end.length)}`
}

function ensureOgMarkers(og: string): string {
  if (og.includes('<!-- BRAND_MARK_START -->')) return og
  const replaced = og.replace(
    /\n\s*<rect x="64" y="52" width="48" height="48"[\s\S]*?<\/g>\n\s*<text x="128" y="82"/,
    `\n  <!-- BRAND_MARK_START -->\n  <!-- BRAND_MARK_END -->\n  <text x="128" y="82"`
  )
  if (!replaced.includes('<!-- BRAND_MARK_START -->')) {
    fail('Could not migrate og-image.svg brand mark markers')
  }
  return replaced
}

function ensureReadmeMarkers(html: string): string {
  if (html.includes('<!-- BRAND_MARK_START -->')) return html
  const replaced = html.replace(
    /<svg class="nav__logo"[\s\S]*?<\/svg>/,
    '<!-- BRAND_MARK_START -->\n          <!-- BRAND_MARK_END -->'
  )
  if (!replaced.includes('<!-- BRAND_MARK_START -->')) {
    fail('Could not migrate macos-readme.html brand mark markers')
  }
  return replaced
}

function markSvgForHtml(markSvg: string, className: string): string {
  let body = markSvg.replace(/^\s*<\?xml[^>]*>\s*/i, '').trim()
  body = body.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = String(attrs)
      .replace(/\sclass=(["']).*?\1/i, '')
      .replace(/\saria-hidden=(["']).*?\1/i, '')
    return `<svg class="${className}"${cleaned} aria-hidden="true">`
  })
  return `          ${body.replace(/\n/g, '\n          ')}`
}

async function main() {
  const args = parseArgs()
  ensureTools()

  console.log('')
  console.log('🎨  Data Explorer branding')
  console.log('────────────────────────────')

  if (!existsSync(args.input)) {
    fail(`Source SVG not found: ${args.input}`)
  }

  const sourceSvg = readFileSync(args.input, 'utf8')
  extractSvgSize(sourceSvg)
  log(`📄 Source: ${args.input}`)

  const normalized = sourceSvg.endsWith('\n') ? sourceSvg : `${sourceSvg}\n`
  writeText(PATHS.brandingSource, normalized, args.dryRun)
  writeText(PATHS.desktopSource, normalized, args.dryRun)
  writeText(PATHS.mobileSource, normalized, args.dryRun)
  ok('📝 Updated branding + desktop + mobile icon-source.svg')

  const tmpDir = join(ROOT, '.tmp/branding')
  const tmpMasterPng = join(tmpDir, 'master-1024.png')
  await rasterizeSvg(args.input, 1024, tmpMasterPng, args.dryRun)
  const brandColor = await sampleBrandColor(tmpMasterPng, args.dryRun)
  log(`🎨 Brand sample color: ${brandColor}`)

  // Squircle / transparent-corner sources leave a white ring on iOS — warn loudly.
  if (!args.dryRun && existsSync(tmpMasterPng)) {
    const cornerCheck = await Bun.spawn(
      [
        'python3',
        '-c',
        `
from PIL import Image
im = Image.open(${JSON.stringify(tmpMasterPng)}).convert('RGBA')
a = im.getpixel((0, 0))[3]
print(a)
`,
      ],
      { stdout: 'pipe', stderr: 'pipe' }
    )
    const alpha = Number((await new Response(cornerCheck.stdout).text()).trim())
    await cornerCheck.exited
    if (Number.isFinite(alpha) && alpha < 250) {
      warn(
        'Source has transparent corners. Use a full-bleed square SVG for OS icons (no baked squircle).'
      )
    }
  }

  if (!args.skipTauri) {
    await runTauriIcon(join(ROOT, 'apps/desktop'), PATHS.desktopSource, brandColor, args.dryRun)
    await runTauriIcon(join(ROOT, 'apps/mobile'), PATHS.mobileSource, brandColor, args.dryRun)
    writeText(PATHS.desktopAndroidBg, androidBgXml(brandColor), args.dryRun)
    writeText(PATHS.mobileAndroidBg, androidBgXml(brandColor), args.dryRun)
    await compositeAndroidLaunchers(join(PATHS.desktopIcons, 'android'), brandColor, args.dryRun)
    await compositeAndroidLaunchers(join(PATHS.mobileIcons, 'android'), brandColor, args.dryRun)
    ok('🖥️  Generated desktop + mobile Tauri icon sets')
  } else {
    log('⏭️  Skipped tauri icon (--skip-tauri)')
  }

  // Vector marks for web UI (stay sharp when scaled). PNG only for OG embed.
  const faviconSvg = buildSquircleMarkSvg({
    sourceSvg,
    idPrefix: 'deFavicon',
    title: 'Data Explorer',
  })
  const logoSvg = buildSquircleMarkSvg({
    sourceSvg,
    idPrefix: 'deLogo',
    title: 'Data Explorer logo',
  })
  const brandMarkSvg = buildSquircleMarkSvg({
    sourceSvg,
    idPrefix: 'deBrand',
    title: 'Data Explorer',
  })
  writeText(PATHS.favicon, faviconSvg, args.dryRun)
  writeText(PATHS.docsLogo, logoSvg, args.dryRun)
  writeText(PATHS.brandMark, brandMarkSvg, args.dryRun)
  writeText(PATHS.brandingLogo, logoSvg, args.dryRun)
  writeText(PATHS.splashPublicSvg, logoSvg, args.dryRun)
  ok('🌐 Updated favicon.svg, docs logo.svg, brand-mark.svg, branding/logo.svg, splash-logo.svg')

  const splashTargets: Array<{ path: string; size: number }> = [
    { path: join(PATHS.splashImageset, 'splash-logo.png'), size: 120 },
    { path: join(PATHS.splashImageset, 'splash-logo@2x.png'), size: 240 },
    { path: join(PATHS.splashImageset, 'splash-logo@3x.png'), size: 360 },
    { path: PATHS.splashPublic, size: 192 },
  ]
  for (const target of splashTargets) {
    await roundPng(tmpMasterPng, target.path, target.size, args.dryRun)
  }
  ok('💧 Updated mobile splash PNGs (native LaunchScreen)')

  await syncIosAppIcons(args.dryRun)
  await syncAndroidAppIcons(args.dryRun)
  await patchMobileSplash(args.dryRun)

  if (existsSync(PATHS.ogSvg)) {
    const tmpMark48 = join(tmpDir, 'mark-48.png')
    await roundPng(tmpMasterPng, tmpMark48, 48, args.dryRun)
    const dataUri = args.dryRun
      ? 'data:image/png;base64,'
      : `data:image/png;base64,${Buffer.from(readFileSync(tmpMark48)).toString('base64')}`

    let og = ensureOgMarkers(readFileSync(PATHS.ogSvg, 'utf8'))
    og = replaceBetweenMarkers(
      og,
      '<!-- BRAND_MARK_START -->',
      '<!-- BRAND_MARK_END -->',
      `  <image x="64" y="52" width="48" height="48" href="${dataUri}" xlink:href="${dataUri}" xmlns:xlink="http://www.w3.org/1999/xlink" />`,
      'og-image'
    )
    writeText(PATHS.ogSvg, og, args.dryRun)
    if (!args.dryRun) {
      await $`rsvg-convert -w 1200 -h 630 ${PATHS.ogSvg} -o ${PATHS.ogPng}`.quiet()
    } else {
      log('[dry-run] rsvg-convert og-image.png')
    }
    ok('🖼️  Updated docs og-image.svg / og-image.png')
  }

  if (existsSync(PATHS.macosReadme)) {
    let html = ensureReadmeMarkers(readFileSync(PATHS.macosReadme, 'utf8'))
    html = replaceBetweenMarkers(
      html,
      '<!-- BRAND_MARK_START -->',
      '<!-- BRAND_MARK_END -->',
      markSvgForHtml(logoSvg, 'nav__logo'),
      'macos-readme'
    )
    writeText(PATHS.macosReadme, html, args.dryRun)
    ok('🍎 Updated macOS readme logo')
  }

  console.log('')
  ok(args.dryRun ? 'Dry run complete' : 'Branding updated')
  console.log(`
👉 Next:
  • 🌐 Web: reload to pick up favicon / AppBrandIcon
  • 💻 Desktop: rebuild the app to refresh the OS icon
  • 📱 Mobile: delete the app from the simulator/device, then reinstall
    (SpringBoard caches icons). Prefer: bun --filter @4d/mobile tauri:ios:dev
`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
