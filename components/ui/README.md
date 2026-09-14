# Edify Teacher UI Kit (Material Design 3)

Design chosen in the M3 Theme Lab: **Ocean Blue · Compact shapes · Elevated cards · Shaped buttons**.

## The one rule

**Teacher pages never use raw colors or ad-hoc component markup.** They use these
components and the token utility classes. That's what makes the whole app
re-themeable from one file.

```
change components/ui/theme.css  →  every teacher page changes
```

## Where things live

| File | What it controls |
|---|---|
| `theme.css` | **All** colors (light + dark), shape radii, elevation, state layers, switch/checkbox/radio styling |
| `tailwind.config.ts` (repo root) | Maps the CSS variables to utility classes — don't put values there, only `var(...)` references |
| `*.tsx` here | One component per concern; import from `@/components/ui` |

## Token utility classes (Tailwind)

- Colors: `bg-primary`, `text-on-primary`, `bg-primary-container`, `text-on-primary-container`,
  same for `secondary`/`tertiary`/`error`/`success`/`warning`; surfaces: `bg-surface`,
  `bg-surface-container-{lowest,low}`, `bg-surface-container`, `bg-surface-container-{high,highest}`;
  text: `text-on-surface`, `text-on-surface-variant`; borders: `border-outline`, `border-outline-variant`.
- Shape: `rounded-m3-xs` (chips/inputs) · `rounded-m3-sm` (list rows) · `rounded-m3-md` (buttons/small cards)
  · `rounded-m3-lg` (cards) · `rounded-m3-xl` (dialogs) · `rounded-m3-btn` (button radius token).
- Elevation: `shadow-elev-1/2/3`. States: `hover:bg-state-hover`, `bg-disabled-bg`, `text-disabled-fg`.

## Components

```tsx
import { Button, Card, CardHeader, StatusChip, TextField, ConfirmDialog, uiToast } from "@/components/ui";
```

| Component | Use for |
|---|---|
| `Button` (`filled/tonal/elevated/outlined/text/danger/danger-text`, `icon`, `loading`) | Every button. **One `filled` per screen** — it's the main action |
| `IconButton` (`standard/tonal/filled`) | Icon-only actions; `aria-label` is required |
| `Card` (`elevated` default, `tonal`, `outlined`, `hoverable`), `CardHeader` | Every content container |
| `Chip` (`selected`, `icon`, `onRemove`), `StatusChip` (`success/warning/error/info/muted`) | Filters/tags · read-only state labels |
| `TextField` / `TextArea` / `Select` / `SearchBar` (`label`, `error`, `supporting`) | All form inputs (M3 floating label) |
| `Switch` / `Checkbox` / `Radio` (`label`) | Toggles & choices |
| `ProgressBar` (`tone`), `Spinner`, `Skeleton` | Limits/progress · loading |
| `Dialog` / `ConfirmDialog` (`danger`, `loading`) | Modals; ConfirmDialog for deletes |
| `Banner` (`tone`, `icon`, `title`) | Inline notices (AI limits, plan hints) |
| `uiToast.success/error/info` | Toasts — never call raw `react-hot-toast` styles |
| `Tabs`, `Menu`, `ListItem`, `Avatar`, `Badge` | Navigation & rows |
| `Table`+`Th`/`TRow`/`Td`, `Pagination` | Data tables (scrolls horizontally on mobile) |
| `StatTile`, `EmptyState`, `PageHeader` | Dashboard KPIs · zero states · page tops |

## Conventions

- Status colors (green/amber/red) mean **state only** — never decoration.
- Numbers that align in columns: add `[font-variant-numeric:tabular-nums]` (StatTile does it already).
- Icons: `lucide-react`, sized by the components automatically.
- Dark mode is prepared but off: add `class="dark"` on a teacher-layout wrapper to enable.
- To re-theme (new palette/shape), regenerate values in the "M3 Theme Lab" artifact and
  replace the token blocks in `theme.css` — nothing else changes.
