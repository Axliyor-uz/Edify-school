# Student UI kit

The design system behind `app/(student)/**`.

## 👉 To change how the app looks, edit `/design.config.ts`

That file (repo root) is the switchboard. Change **one word** and the whole
student platform re-skins. You do not need to touch anything in this folder.

```ts
Color_palette: 'nebula',   // → 'sunset' repaints the entire app
Card_style: 'filled',      // → 'outlined' restyles every card
Button_style: 'game',      // → 'pill' changes every button's press feel
```

Full guide: [`docs/STUDENT_UI.md`](../../docs/STUDENT_UI.md).

## Using the kit in a page

```tsx
import { Page, PageHeader, Card, Button, ListGroup, ListRow, Chip } from '@/components/student-ui';

export default function MyPage() {
  return (
    <Page width="wide">
      <PageHeader title="My classes" subtitle="3 active" actions={<Button>Join</Button>} />
      <ListGroup header="Today">
        <ListRow
          title="Algebra · 9-A"
          subtitle="Assignment due tomorrow"
          trailing={<Chip status="warning">Due 1d</Chip>}
          clickable
        />
      </ListGroup>
    </Page>
  );
}
```

Every component already defaults to the configured variant. Pass a prop only
when **this one instance** should differ — e.g. `<Card variant="gradient">` for a
single hero card.

## Rules

1. **No raw colors.** Use token utilities only: `bg-primary`, `text-on-surface`,
   `text-on-surface-variant`, `bg-surface-container`, `border-outline-variant`,
   `rounded-m3-lg`, `shadow-elev-2`.
2. **No opacity modifiers on tokens.** `bg-surface/85` silently renders
   **opaque** — the tokens are hex inside `var()`. Use `bg-surface-blur`,
   `bg-surface-glass`, `bg-background-blur`, `bg-scrim-bg`, `bg-state-hover`,
   `bg-state-press`, `bg-disabled-bg`, `text-disabled-fg`.
3. **Never import `@/components/ui`** — that is the *teacher* kit.
4. **Never import `theme.css`** — the student layout does it once.
5. `IconButton` requires `aria-label`.
6. Add `s-num` to any digits that sit in a column (XP, scores, timers, money).
7. `<Page>` padding needs the `flush` prop to remove — `p-0` won't override it.

## What's in the box

| Area | Components |
|---|---|
| Layout | `Page` `PageHeader` `Stack` `Shell` `MobileDrawer` |
| Surfaces | `Card` `CardHeader` `Tile` `ListGroup` `ListRow` `Avatar` |
| Actions | `Button` `IconButton` `Fab` `SegmentedControl` `Tabs` |
| Inputs | `TextField` `SearchBar` `TextArea` `Select` `Switch` `Checkbox` `Radio` `Slider` `SettingRow` `FilterChip` |
| Feedback | `Dialog` `ConfirmDialog` `Banner` `sToast` `EmptyState` `ErrorState` |
| Progress | `ProgressBar` `Spinner` `Skeleton` `LoadingState` `WavyProgress` |
| Data | `StatTile` `StatBand` `Sparkline` `Chip` |
| Gamification | `XpProgress` `StreakDisplay` `Podium` `RankRow` `QuestList` `BadgeGrid` `Celebration` `PopOnChange` |

Read the component file for its props before using it — several take a
`variant` that overrides the global config.
