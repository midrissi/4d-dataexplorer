---
name: web-app-ui-enhance
description: Enhance and polish UI creatively while staying inside the @4d/ui design system. Use when improving visuals, layouts, empty states, spacing, motion, or making screens feel more refined.
---

# Enhance UI (design-system first)

Be creative: improve hierarchy, rhythm, atmosphere, and delight. Stay inside this project's design system — do not invent a parallel look.

## Design system source of truth

- Components & utilities: `packages/ui` (`@4d/ui`) — Button, Card, Input, Dialog, Tabs, Toast, `cn`, etc.
- Themes: `packages/ui/src/themes/*` (`slate`, `tangerine`, `violet-bloom`, `vercel`, `graphite`, `aurora`, `carya`) via `data-theme` + light/dark class
- Tokens: CSS variables from theme + Tailwind semantic colors (`background`, `foreground`, `primary`, `muted`, `border`, `destructive`, …)
- App styles: `apps/web/src/index.css` imports `@4d/ui/styles` and theme CSS

## Do

- Compose existing `@4d/ui` primitives; extend with Tailwind using **semantic token classes**, not one-off hex/rgb.
- Raise clarity: stronger hierarchy, consistent spacing scale, readable line lengths, clear primary actions.
- Add intentional motion sparingly (opacity/transform transitions using existing duration tokens when available).
- Improve empty/loading/error states with Skeleton, Alert, muted copy (i18n keys).
- Match the product's layout freedom (marketing, dashboard, etc.) without forcing a chrome pattern.
- Keep **one React component per file**, small files, testable extracted logic (see `AGENTS.md` code quality).
- **Check accessibility** before finishing (see below) — polish that fails contrast or keyboard use is incomplete.

## Don't

- Bypass the kit with custom buttons/inputs that duplicate `@4d/ui`.
- Hard-code colors, fonts, or radii that ignore CSS variables / themes.
- Default to generic AI aesthetics (purple gradients, glow stacks, pill spam, heavy shadows) unless the active theme already expresses that.
- Sacrifice accessibility (contrast, focus rings, keyboard, hit targets) for novelty.
- Grow mega-components — split when enhancing a large screen.

## Accessibility (required)

Verify the enhanced UI in **both light and dark** (and the active `data-theme`):

- **Contrast** — titles, body, muted copy, and Alert/Badge/Toast text must stay readable on their actual backgrounds. Soft surfaces (`bg-*/10`) must use the accent color for text (`text-warning`, `text-destructive`, …), not `*-foreground` (those tokens are for solid fills). Prefer fixing the shared primitive in `packages/ui` when the issue is system-wide.
- **Focus** — interactive controls keep visible focus rings (`ring` / kit defaults); never remove outline without a replacement.
- **Keyboard** — links, buttons, menus, and dialogs remain reachable and operable without a pointer.
- **Hit targets** — controls stay comfortably clickable/tappable; do not shrink for aesthetics.
- **Semantics** — meaningful headings, `role="alert"` / labels where appropriate, decorative icons `aria-hidden`.

When in doubt, run `web-design-guidelines` and `web-app-forms-a11y` on the touched files.

## Workflow

1. Identify the screen/route and current theme (`ThemeProvider` / `data-theme`).
2. Prefer composing/enhancing with `@4d/ui` before adding new primitives to `packages/ui`.
3. If a new primitive is needed, add it to `packages/ui` with CVA variants + tokens so all apps benefit.
4. Update i18n for any new copy; run `bun --filter @4d/i18n check-i18n`.
5. **Accessibility pass** — light + dark contrast, focus, keyboard, hit targets (see above). Fix kit tokens/variants when the bug is shared.
6. Cross-check with `web-design-guidelines` and `web-app-forms-a11y` when the change is form- or chrome-heavy.
