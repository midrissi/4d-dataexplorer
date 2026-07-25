import type { CodeEditorLabels } from '@4d/ui'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import type {
  SchemaBuilderLang,
  SchemaBuilderLangOrOverrides,
  SchemaBuilderMessages,
  SchemaBuilderOverrides,
} from './types'

export type {
  SchemaBuilderLang,
  SchemaBuilderLangOrOverrides,
  SchemaBuilderMessages,
  SchemaBuilderOverrides,
} from './types'

export const messages: Record<SchemaBuilderLang, SchemaBuilderMessages> = {
  en,
  fr,
  es,
}

const DEFAULT_LANG: SchemaBuilderLang = 'en'

function isOverrides(lang: SchemaBuilderLangOrOverrides): lang is SchemaBuilderOverrides {
  return typeof lang === 'object' && lang !== null
}

function resolveDict(lang: SchemaBuilderLangOrOverrides): SchemaBuilderMessages {
  if (!isOverrides(lang)) {
    const dict = messages[lang as SchemaBuilderLang] ?? en
    return dict
  }
  const base = lang.base ?? DEFAULT_LANG
  const baseDict = messages[base] ?? en
  const { base: _omit, ...overrides } = lang
  return { ...baseDict, ...overrides } as SchemaBuilderMessages
}

export type TFunction = (
  key: keyof SchemaBuilderMessages,
  params?: Record<string, string | number>
) => string

/**
 * Returns a translation function for the given language.
 * - If `lang` is a string ('en' | 'fr' | 'es'), uses that locale's messages.
 * - If `lang` is an object, uses `base` locale (default 'en') and merges optional overrides;
 *   all keys in the object are optional; missing keys fall back to the base locale.
 * Replaces {key} placeholders in the result when `params` is provided.
 */
export function getT(lang: SchemaBuilderLangOrOverrides): TFunction {
  const dict = resolveDict(lang)
  return (key, params) => {
    let s = dict[key] ?? en[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return s
  }
}

export function getEditorLabels(t: TFunction): CodeEditorLabels {
  return {
    formatDocument: t('editorFormatDocument'),
    copyCode: t('editorCopyCode'),
    copied: t('editorCopied'),
    undo: t('editorUndo'),
    redo: t('editorRedo'),
    zoomIn: t('editorZoomIn'),
    zoomOut: t('editorZoomOut'),
    resetZoom: t('editorResetZoom'),
    enableWordWrap: t('editorEnableWordWrap'),
    disableWordWrap: t('editorDisableWordWrap'),
    showMinimap: t('editorShowMinimap'),
    hideMinimap: t('editorHideMinimap'),
    moveToolbarToTop: t('editorMoveToolbarToTop'),
    moveToolbarToBottom: t('editorMoveToolbarToBottom'),
  }
}
