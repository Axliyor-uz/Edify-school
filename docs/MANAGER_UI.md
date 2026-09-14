# MANAGER_UI — Manager design system (design.manager.config.ts + components/manager-ui)

> **Agent workflow:** read this BEFORE touching `components/manager-ui/*`,
> `design.manager.config.ts`, or restyling any `app/manager/*` page; update it
> in the same change whenever you alter behavior described here.
> Index: [README.md](README.md).

**Last verified:** 2026-07-23 (switchboard + full manager-tree token retrofit introduced; replaces the fixed amber/"Yashil CRM" look).

## The one thing to know

**`/design.manager.config.ts` (repo root) is the switchboard.** Change one word
there and the entire manager panel re-skins — palette, light/dark, typeface,
shell navigation, shape, density, card/button/input/table/tab/list/tile/dialog
styles, page background, loading style, motion, page transitions. Nothing else
needs editing. It is typed against `ManagerDesignConfig`, so a typo is a
**build error** with a "did you mean" hint. ⚠️ Deliberately **not** `as const`
(same reason as the other two switchboards).

**Premium default (2026-07-23):** emerald · system mode + in-app toggle ·
Inter · classic/dock · soft shapes · comfortable density · elevated cards ·
pill buttons · outlined fields · lined tables · underline tabs · accent stat
tiles · sheet dialogs · tinted canvas · skeleton loading · expressive motion.

## Scope

`app/manager/**` only. Teacher (`design.teacher.config.ts` +
`components/ui`, see [UI_KIT.md](UI_KIT.md)), student (`design.config.ts` +
`components/student-ui`, see [STUDENT_UI.md](STUDENT_UI.md)) and admin trees
are unaffected. ⚠️ **Three kits exist. Never mix them.**
`@/components/manager-ui` = manager · `@/components/ui` = teacher ·
`@/components/student-ui` = student.

## Key files

| File | Responsibility |
|---|---|
| `design.manager.config.ts` | **The switchboard.** 20 one-word choices + the `ManagerDesignConfig` type. |
| `components/manager-ui/theme.css` | All tokens. Palettes auto-generated between the `MG-PALETTES:START/END` markers; derived/shape/density/font/motion/canvas blocks below are hand-written. Imported once by `app/manager/layout.tsx`. |
| `scripts/genManagerPalettes.mjs` | Regenerates the palette blocks (`npx tsx`, needs `@material/material-color-utilities` installed `--no-save`). `DEFAULT_PALETTE = 'emerald'`. |
| `components/manager-ui/config.ts` | Bridges the config to the kit (`managerThemeAttributes()`, `MOTION_ON`, `springTransition`, `popIn`, `pageTransition`, stagger helpers). |
| `components/manager-ui/ManagerThemeProvider.tsx` | Stamps `data-mg-*` on `<html>`, resolves light/dark (config default → per-device localStorage override `edify-mg-mode` → OS), pins `/manager/print*` to light, exposes `useManagerTheme()`. |
| `components/manager-ui/*.tsx` | The kit (same component roster as the teacher kit). Barrel: `index.ts`. |
| `components/manager-ui/shellStyles.ts` | The 6 sidebar recipes (`SIDE_STYLES`) as pure data — shared by the shell and the gallery previews. |
| `app/manager/_components/ManagerSheet.tsx` | The manager modal primitive (bottom sheet on phones, centered ≥sm) — tokenized, framer-motion entrance; `ConfirmDialog`/`ApprovalGate` build on it. |
| `app/theme-check-manager/page.tsx` | Dev-only unguarded gallery: `/theme-check-manager?palette=wine&mode=dark&…` for eyeballing/screenshotting combos without auth. Safe to delete. |

## The one architectural difference from the teacher kit

The manager kit **reuses the teacher kit's CSS variable NAMES** (`--m3-*`,
`--t-*`) but scopes them under its own `data-mg-*` attributes. That gives it
the entire existing Tailwind token vocabulary (`bg-primary`, `rounded-m3-lg`,
`h-t-control`, `p-t-card`, `duration-t-med`, …) with **zero
tailwind.config.ts changes**. This can never clash: each provider stamps its
attributes only while its layout is mounted and removes them on unmount, CSS
is loaded per route segment, and attribute selectors beat both kits' plain
`:root` fallbacks. The student tree stays immune by re-declaring its vars in
its own scoped wrapper.

## How the switches actually work

1. **CSS-driven switches** (`Color_palette`, `Color_mode`, `Shape_style`,
   `Density`, `Font_style`, `Motion_level`, `Page_background`, pill half of
   `Button_style`) become `data-mg-*` attributes on `<html>` via
   `ManagerThemeProvider`; `theme.css` keys every token off them. `<html>`
   stamping (not a wrapper) because toasts/dialogs portal to `<body>`.
2. **Component-driven switches** (`Card_style`, `Button_style`, `Input_style`,
   `Table_style`, `Tab_style`, `List_style`, `StatTile_style`, `Dialog_style`,
   `Loading_style`) are the components' **default variant**; any single usage
   can override with a prop (`<Card variant="glass">`).
3. **Shell switches** are rendered by `app/manager/layout.tsx`.
   `App_shell_navigation` has **10 desktop personalities**: 6 *side recipes*
   (`classic` ⭐ — the original manager sidebar token-reborn: accent bar,
   tinted active row, user-card+logout footer · `sidebar` — gliding pill ·
   `tonal` — container-colored panel · `inverse` — always-contrast chrome ·
   `gradient` — primary→tertiary panel · `minimal` — chromeless dot) plus 4
   *containers* (`rail` pinned-collapsed, `floating` glass card, `topbar`
   5+Yana single row, `toolbar` two-deck full nav row). The side recipes are
   pure data in `components/manager-ui/shellStyles.ts` — consumed by BOTH the
   real shell and the gallery's static previews, so they can't drift. Every
   side shell (except rail) collapses with the `[` key. `Mobile_navigation`
   has 5: `dock` ⭐ / `floating` / `iconic` (icon-only) / `topline` (sliding
   top accent line) / `drawer`; the bars show 4 key destinations (dashboard,
   groups, attendance, finance) + "Menyu" opening the full drawer, which is
   styled by the same side recipe as the desktop sidebar.

**Dark mode resolution order:** `/manager/print*` pin to light → per-device
override from the in-app toggle (profile popover, opened from the sidebar
footer / topbar avatar / mobile-header avatar; persists in localStorage
`edify-mg-mode`; "system" clears it) → `Color_mode` in the config ('system'
follows the OS live). Browser printing is separately covered by a generated
`@media print` block.

The layout also keeps the manager-specific behavior it always had: role gate
(fail-closed), center name + approval status resolved BEFORE children render,
`ApprovalGate` wrapping every page, live avatar/name sync via `onSnapshot`,
and full-width treatment for attendance/staff-attendance/timetable/finance
(`WIDE_ROUTES`) while other pages stay centered at 1400px. Collapsible
sidebar state persists in localStorage `edify-mg-rail` (`[` toggles it).

## Palettes

Same 10-source professional roster as the teacher kit (one brand family), only
the default differs: `emerald` (default) · `indigo` · `ocean` · `midnight` ·
`teal` · `plum` · `wine` · `bronze` (heir to the old amber identity) · `steel`
· `graphite` (mono).

```bash
npm install --no-save @material/material-color-utilities
npx tsx scripts/genManagerPalettes.mjs     # tsx, not node — ESM resolution
```

- ⚠️ Only hue-preserving scheme variants; the script asserts hue drift ≤ 45°.
- ⚠️ The generator emits `--m3-scrim` **with baked-in alpha** (rgba 0.45
  light / 0.6 dark), NOT the solid M3 scrim role — `bg-scrim` is used directly
  as overlay backdrops (ManagerSheet, PhotoCropperModal, drawer).
- `success`/`warning` derived at fixed hues (145/75) with clamped chroma.

## Invariants & traps

- ⚠️ **Never hard-code a color, radius or shadow in a manager page.** Only
  token utilities or `var(--m3-…)` in unavoidable inline styles. (The whole
  tree was swept 2026-07-23.)
- ⚠️ **Tailwind opacity modifiers do NOT work on token colors** (`bg-primary/20`
  renders opaque). Use `bg-scrim`, `bg-surface-blur`, `bg-t-glass`,
  `bg-t-bar-blur`, `bg-t-primary-soft`, `bg-state-hover`, the `*-container`
  tokens — or add a `color-mix()` var to theme.css.
- ⚠️ Never import `@/components/ui` (teacher) or `@/components/student-ui` in
  the manager tree — the kit would read the WRONG switchboard.
- ⚠️ `tailwind.config.ts` needed **no theme/token changes** for this kit —
  keep it that way; the shared `t-*` utilities are palette-agnostic var
  readers. The only edit was adding `./lib/**` to `content`: `lib/roomColors.ts`
  spells class bundles that appear nowhere else (room identity hues as
  dark-aware `color-mix` arbitrary values), and without the glob Tailwind
  stops generating them the moment no page spells the raw classes.
- ⚠️ `font-sans` / `font-['Inter',…]` pins in a manager page defeat
  `Font_style` — the layout root sets `font-t-body`; don't reintroduce pins.
- The old `animate-in`/`animate-[dialogIn…]` classes were dead (plugin never
  installed; styled-jsx keyframes removed with the old layout) — don't bring
  them back; use ManagerSheet / framer-motion / kit primitives.
- Semantic mapping used by the retrofit: success=paid/present, error=debt/
  absent/destructive, warning=pending/late, tertiary=info accents,
  primary=main CTAs (old amber-500/brand-600/slate-900 CTAs). Status colors
  read as state, not decoration.
- Motion: `Motion_level='none'` hard-kills CSS animation under the stamped
  attribute (spinner exempt); gate new JS animation on `MOTION_ON`; OS
  reduced-motion honored independently.
- The layout's active-nav pills use framer `layoutId` (`mg-pill*`) — centering
  via `inset-x-0 mx-auto` on purpose (framer owns `transform`).
- `.custom-scrollbar` is styled only under `data-mg-palette` — no leaks.
- Manager UI is **trilingual uz/ru/en** (since 2026-07-23 evening; it was
  Uzbek-only before). Language system: `app/manager/_components/ManagerLanguage.tsx`
  — `ManagerLanguageProvider` (mounted by the layout), `useManagerLanguage()`,
  SVG `FlagSvg`, localStorage `edify-manager-lang` (hydration-safe restore).
  The switcher is a segmented flag control in the profile popover. Pages follow
  the teacher convention: per-file `TRANSLATIONS = { uz, ru, en }` dicts; uz is
  the default and fallback. Never hardcode a user-facing string in a manager
  page — route it through the dict.

## How to verify changes

`npm run dev` → open `/theme-check-manager` (no login) or any `/manager/*`
page → DevTools: `<html>` carries `data-mg-palette="emerald"
data-mg-mode="light|dark"` and `--m3-primary` resolves. Then:

1. **Re-skin smoke test** — `Color_palette: 'bronze'` → whole panel warms;
   `App_shell_navigation: 'topbar'` → side nav becomes a top bar;
   `Table_style: 'cards'` → finance tables become card rows. Revert.
2. **Typo test** — bogus value → `npx tsc --noEmit` fails with "did you mean".
3. **Dark mode** — toggle via avatar popover (light/system/dark); reload —
   persists; "system" follows the OS live; ApprovalGate + finance tables stay
   legible in dark.
4. **Raw-color sweep** —
   `grep -rnE '(bg|text|border)-(slate|amber|rose|emerald|sky|violet|brand)-[0-9]' app/manager`
   must return nothing beyond documented leftovers.
5. 360px width: no horizontal scroll outside intentionally-scrollable grids;
   dock reachable; sheets slide from the bottom.

## Known issues / dead code

- `/theme-check-manager` is an unguarded dev gallery (no data) — delete freely.
- `app/manager/finance/_components/financeFormat.ts` is pure logic — no tokens,
  intentionally untouched.
- Deliberate inline-style leftovers (if any) are listed in the retrofit change
  description; chart/SVG attrs that can't resolve CSS vars keep pinned hexes
  with a comment.
