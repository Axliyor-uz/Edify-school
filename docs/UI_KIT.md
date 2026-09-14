# UI_KIT — Teacher design system (design.teacher.config.ts + components/ui)

> **Agent workflow:** read this BEFORE touching `components/ui/*`,
> `design.teacher.config.ts`, `tailwind.config.ts` token mappings, or restyling
> any `app/teacher/*` page; update it in the same change whenever you alter
> behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-23 (switchboard introduced; whole teacher tree already token-based since 2026-07-13).

## The one thing to know

**`/design.teacher.config.ts` (repo root) is the switchboard.** Change one word
there and the entire teacher panel re-skins — palette, light/dark, typeface,
shell navigation, shape, density, card/button/input/table/tab/list/tile/dialog
styles, page background, loading style, motion, page transitions. Nothing else
needs editing.

```ts
Color_palette: 'indigo',        // 10 professional M3 palettes
App_shell_navigation: 'sidebar',// 10 shells: 6 side recipes + rail/floating/topbar/toolbar
Mobile_navigation: 'dock',      // dock | floating | iconic | topline | drawer
Card_style: 'elevated',
Button_style: 'pill',
Motion_level: 'expressive',
```

It is typed against `TeacherDesignConfig`, so a typo is a **build error** with
a "did you mean" hint, and editors autocomplete the legal values.
⚠️ Deliberately **not** `as const` (same reason as the student switchboard —
`as const` narrows every value to its own literal and TS flags all untaken kit
branches as dead code).

**Premium default (2026-07-23):** indigo · system mode + in-app toggle ·
Manrope · sidebar/dock · soft shapes · comfortable density · elevated cards ·
pill buttons · outlined fields · aurora canvas · expressive motion.

## Scope

`app/teacher/**` only. Student (`design.config.ts` + `components/student-ui`,
see [STUDENT_UI.md](STUDENT_UI.md)), manager and admin trees are unaffected.
⚠️ **Two kits exist. Never mix them.**
`@/components/ui` = teacher · `@/components/student-ui` = student.

## Key files

| File | Responsibility |
|---|---|
| `design.teacher.config.ts` | **The switchboard.** 20 one-word choices + the `TeacherDesignConfig` type. |
| `components/ui/theme.css` | All tokens. Palettes auto-generated between the `T-PALETTES:START/END` markers; derived/shape/density/font/motion/canvas blocks below are hand-written. Imported once by `app/teacher/layout.tsx`. |
| `scripts/genTeacherPalettes.mjs` | Regenerates the palette blocks (`npx tsx`, needs `@material/material-color-utilities` installed `--no-save`). |
| `components/ui/config.ts` | Bridges the config to the kit (`teacherThemeAttributes()`, `MOTION_ON`, `springTransition`, `popIn`, `pageTransition`, stagger helpers). |
| `components/ui/TeacherThemeProvider.tsx` | Stamps `data-t-*` on `<html>`, resolves light/dark (config default → per-device localStorage override `edify-t-mode` → OS), pins `/teacher/print*` to light, exposes `useTeacherTheme()`. |
| `components/ui/shellStyles.ts` | The 6 sidebar recipes (`SIDE_STYLES`) as pure data — shared by the shell (`app/teacher/layout.tsx`) and the gallery previews. |
| `components/ui/*.tsx` | The kit. Barrel: `index.ts` (also re-exports the provider + motion helpers + `SIDE_STYLES`/`resolveSideStyle`). |
| `tailwind.config.ts` | Maps tokens to utilities — **additive only** (`t-*` names; student `s-*` and default scales untouched). |
| `app/theme-check-teacher/page.tsx` | Dev-only unguarded gallery: `/theme-check-teacher?palette=wine&mode=dark&…` for eyeballing/screenshotting combos without auth. Safe to delete. |

## How the switches actually work

1. **CSS-driven switches** (`Color_palette`, `Color_mode`, `Shape_style`,
   `Density`, `Font_style`, `Motion_level`, `Page_background`, and the pill
   half of `Button_style`) become `data-t-*` attributes on `<html>` via
   `TeacherThemeProvider`; `theme.css` keys every token off them.
   **Why `<html>`, not a scoped wrapper (student does the opposite):** toasts
   and dialogs portal to `<body>` and must resolve the ACTIVE palette. The
   attributes are removed on unmount so nothing leaks into other role trees;
   the student tree is additionally immune because it re-declares every
   `--m3-*` var inside its own scoped wrapper. A plain `:root` fallback block
   (default palette, light) keeps first paint and non-teacher consumers
   resolving exactly like the pre-switchboard status quo.
2. **Component-driven switches** (`Card_style`, `Button_style`, `Input_style`,
   `Table_style`, `Tab_style`, `List_style`, `StatTile_style`, `Dialog_style`,
   `Loading_style`) are read by the components as their **default variant**;
   any single usage can override with a prop (`<Card variant="glass">`).
3. **Shell switches** are rendered by `app/teacher/layout.tsx`.
   `App_shell_navigation` has **10 desktop personalities**: 6 *side recipes*
   (`sidebar` ⭐ — gliding pill · `classic` — grouped links, sliding left
   accent bar, tinted active row, user-card+logout footer · `tonal` —
   container-colored panel · `inverse` — always-contrast chrome · `gradient`
   — primary→tertiary panel · `minimal` — chromeless dot) plus 4 *containers*
   (`rail` pinned-collapsed, `floating` glass card, `topbar` 5+"More" single
   row, `toolbar` two-deck full nav row). The side recipes are pure data in
   `components/ui/shellStyles.ts` — consumed by BOTH the real shell and the
   gallery's static previews, so they can't drift. Every side shell (except
   rail) collapses with the `[` key (state in localStorage `edify-sb-rail`).
   `Mobile_navigation` has 5: `dock` ⭐ / `floating` / `iconic` (icon-only) /
   `topline` (sliding top accent line) / `drawer`; the bars show 4 key
   destinations (dashboard, create, classes, library) + "Menyu" opening the
   full drawer, which is styled by the same side recipe as the desktop
   sidebar, and every bar variant auto-hides on the `HIDE_BOTTOM_BAR` deep
   routes. The layout also owns the teacher language context: the chosen
   `uz|en|ru` persists per-device in localStorage `edify-teacher-lang`
   (restored post-hydration so the SSR 'uz' shell never mismatches).
   Pages never know which shell is active.

**Dark mode resolution order:** `/teacher/print*` pin to light (html-to-image
snapshots the screen) → per-device override from the in-app toggle (profile
popover; persists in localStorage `edify-t-mode`; "system" clears it) →
`Color_mode` in the config ('system' follows the OS live). Browser printing is
separately covered by a generated `@media print` block that re-pins every dark
selector to light values.

## Palettes

10 palettes × light + dark = 20 complete M3 dynamic-color schemes, generated
from one source color each by `@material/material-color-utilities` (HCT):

`indigo` (default) · `ocean` · `midnight` · `emerald` · `teal` · `plum` ·
`wine` · `bronze` · `steel` · `graphite` (mono)

To change or add one: edit `SOURCES` in `scripts/genTeacherPalettes.mjs`, then

```bash
npm install --no-save @material/material-color-utilities
npx tsx scripts/genTeacherPalettes.mjs     # tsx, not node — ESM resolution
```

- ⚠️ Only hue-preserving scheme variants (`SchemeTonalSpot`, `SchemeFidelity`,
  `SchemeNeutral` for mono). The script asserts hue drift ≤ 45° — keep the guard.
- `success`/`warning` are derived at fixed hues with clamped chroma (32–48);
  regenerate rather than hand-editing.
- ⚠️ The generator emits `--m3-scrim` **with baked-in alpha** (rgba, 0.45
  light / 0.6 dark), NOT the solid M3 scrim role — ~25 teacher call sites use
  `bg-scrim` directly as an overlay and rely on the translucency.

## Invariants & traps

- ⚠️ **Never hard-code a color, radius or shadow in a teacher page.** Only
  token utilities (`bg-primary`, `rounded-m3-lg`, `shadow-elev-2`, …) or
  `var(--m3-…)`/`var(--t-…)` in unavoidable inline styles.
- ⚠️ **Tailwind opacity modifiers do NOT work on token colors** (plain hex in
  `var()`; `bg-primary/50` renders opaque). Use the prebuilt translucent
  tokens: `bg-t-glass`, `border-t-glass-border`, `bg-t-bar-blur`,
  `bg-surface-blur`, `bg-background-blur`, `bg-scrim`, `bg-t-primary-soft`,
  `bg-state-hover`, `disabled-bg/fg` — or add a `color-mix()` var to theme.css.
- ⚠️ Tailwind mapping stays **additive**: never override default `rounded-*`
  scales or gray palettes; never touch `s-*` (student) or `brand.*` (finance)
  entries.
- ⚠️ `font-sans` in a teacher page defeats `Font_style` — use `font-t-body`
  (the 2026-07-23 sweep replaced all of them; don't reintroduce).
- Density flows through the kit only: `--t-control-h*`, `--t-card-pad`,
  `--t-row-h`, `--t-gap*`, `--t-page-x/y` (utilities `h-t-control`, `p-t-card`,
  `gap-t-gap`, `px-t-page-x`, …). Page-level hardcoded spacing is unaffected —
  prefer the `t-*` utilities in new/reworked pages.
- Motion: `Motion_level='none'` hard-kills CSS transitions/animations under the
  stamped attribute (spinner exempt) and `MOTION_ON` gates all framer-motion
  choreography; OS reduced-motion is honored independently. Gate any new JS
  animation on `MOTION_ON`.
- ⚠️ One `filled` Button per screen (main action); status colors are for state,
  never decoration. Sweep conventions (status-chip semantics, difficulty tones,
  inverse-surface for deliberately-dark elements, band-score thresholds) are
  unchanged from the 2026-07-13 migration.
- TextField/TextArea/Select keep an **opaque** `surface-container-lowest`
  background in outlined/filled variants — the floating-label patch depends on
  it; never make fields transparent.
- `IconButton` requires `aria-label` (typed as mandatory).
- `m3-switch`/`m3-checkbox`/`m3-radio`/`m3-spinner`/`m3-skeleton`/`t-dot`/
  `m3-interactive` classes live in theme.css — kit components break if that
  file isn't loaded (the teacher layout imports it).
- `.custom-scrollbar` is now really styled (slim, token-colored) but ONLY under
  the stamped `data-t-palette` attribute — it stays a no-op in other role trees.
- The layout's active-nav pills use framer `layoutId` — centering is done with
  `inset-x-0 mx-auto` on purpose (framer owns `transform`; translate-based
  centering breaks the pill).

## Fonts

Five options (`Font_style`): `manrope` (default) · `inter` · `jakarta` ·
`plex` · `grotesk` (Space Grotesk display over Inter body). All are declared in
**`app/layout.tsx`** via `next/font` as `--font-*` variables; `theme.css` maps
the chosen one to `--t-font-body` / `--t-font-display` (`font-t-body` /
`font-t-display` utilities). Unused families are never downloaded — @font-face
alone doesn't fetch. Space Grotesk is latin-only; Cyrillic headings fall back
per glyph (intended).

## How to verify changes

`npm run dev` → open `/theme-check-teacher` (no login needed) or any
`/teacher/*` page → in DevTools confirm `<html>` carries
`data-t-palette="indigo" data-t-mode="light|dark"` and `--m3-primary` resolves.
Then:

1. **Re-skin smoke test** — set `Color_palette: 'wine'`: every page shifts hue.
   `App_shell_navigation: 'topbar'`: side nav becomes a top bar.
   `Card_style: 'outlined'`: cards lose their shadow. Revert.
2. **Typo test** — set a bogus value; `npx tsc --noEmit` must fail with a
   "did you mean" hint.
3. **Dark mode** — toggle in the profile popover (light/system/dark); reload —
   the choice must persist; "system" must follow the OS live.
4. **Raw-color sweep** —
   `grep -rnE '(bg|text|border)-(zinc|slate|gray|violet|rose|green|amber|blue)-[0-9]' app/teacher`
   must return nothing beyond the documented leftovers below.
5. Check hover/press state layers, keyboard focus rings, a ConfirmDialog flow
   (bottom-sheet on mobile under `Dialog_style: 'sheet'`), and 360px width: no
   horizontal scroll, bottom nav reachable.
6. **Print** — `/teacher/print` renders light even in dark mode; browser print
   of any page uses light ink (generated `@media print` block).

## Known issues / dead code

- **Known non-token leftovers (deliberate, from the 2026-07-13 migration):**
  gold/silver/bronze medal inline hex in AssignmentsTab submissions;
  print-output inline styles (`PRINT_CSS`, html-to-image white bg) — printed
  ink, not theme; Recharts hexes in students/[id] pinned with a comment (SVG
  attrs can't resolve vars); dead `AiLimitCard.tsx`; hardcoded Uzbek
  IconButton aria-labels.
- `/theme-check-teacher` is an unguarded dev gallery (no data) — delete freely
  if it bothers production.
- The M3 Theme Lab artifact (old single-palette workflow) is superseded by the
  generator + switchboard; re-theming via copy-pasting artifact tokens is dead.
