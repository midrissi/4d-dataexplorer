export type ThemeName = 'slate' | 'tangerine' | 'violet-bloom' | 'vercel' | 'graphite' | 'aurora'

export const themes: Record<ThemeName, { name: string }> = {
  slate: {
    name: 'Slate',
  },
  tangerine: {
    name: 'Tangerine',
  },
  'violet-bloom': {
    name: 'Violet Bloom',
  },
  vercel: {
    name: 'Vercel',
  },
  graphite: {
    name: 'Graphite',
  },
  aurora: {
    name: 'Aurora',
  },
}

export const defaultTheme: ThemeName = 'graphite'
