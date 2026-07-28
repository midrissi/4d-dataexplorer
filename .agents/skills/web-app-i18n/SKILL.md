---
name: web-app-i18n
description: Add and keep en/fr/nl/de/es/it user-facing labels consistent (carya_min LOV languages). Use when adding UI copy, pages, or error messages.
---

# Web app i18n

## Source of truth

Labels live in `packages/i18n/src/locales/{en,fr,nl,de,es,it}/` as one file per namespace
(e.g. `home.ts`, `login.ts`). Each locale folder’s `index.ts` composes them.
Flat keys are derived (e.g. `home.title`).

Supported locales match carya_min LOV `userLanguagesISO2` (16068): **fr, nl, en, de, es, it**.

Indexed-string LOVs from carya `STR_LOVS_TRANSLATED.XLF` live under the `lovs.*` namespace
(e.g. `lovs.userDepartments.workshop`). Regenerate with:

```bash
bun --filter @4d/orda generate:lovs -- /path/to/carya
# optional: refresh machine translations first
bun --filter @4d/i18n translate:lovs
```

Attributes named `*_R_{listId}` (e.g. `Department_R_16002`) render as selects automatically.

## Workflow

1. Add the English key under `locales/en/<namespace>.ts`.
2. Mirror the same key path in `locales/fr/`, `locales/nl/`, `locales/de/`, `locales/es/`, and `locales/it/`.
3. Use `const { t } = useTranslation()` from `@4d/i18n` then `t('home.title')`.
4. Run `bun --filter @4d/i18n check-i18n` to verify key parity.

## Rules

- Never hard-code user-visible English in JSX.
- Support `{param}` interpolation via `t('key', { name: value })`.
- Keep keys namespaced by feature (`demo.*`, `home.*`, `common.*`).
- Product display name used in copy should stay aligned with branding (`bun run brand`).
