export const DOC_THEME_MODES = ['dark', 'light'] as const
export type DocThemeMode = (typeof DOC_THEME_MODES)[number]

export function screenshotFileName(name: string, theme: DocThemeMode): string {
  return `${theme}/${name}.png`
}

export function screenshotAbsolutePath(baseDir: string, name: string, theme: DocThemeMode): string {
  const base = baseDir.replace(/\/$/, '')
  return `${base}/${screenshotFileName(name, theme)}`
}

export function screenshotBaseName(src: string): string {
  return src
    .replace(/^\//, '')
    .replace(/^screenshots\//, '')
    .replace(/^(?:dark|light)\//, '')
    .replace(/\.png$/i, '')
}

export function docsScreenshotPaths(baseName: string): {
  dark: string
  light: string
  themed: boolean
} {
  return {
    dark: `/screenshots/dark/${baseName}.png`,
    light: `/screenshots/light/${baseName}.png`,
    themed: true,
  }
}
