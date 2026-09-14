// app/(student)/raschmodel/layout.tsx

/**
 * The Rasch suite runs one density tighter than the rest of the student app.
 *
 * These pages are analytic: the level page alone stacks a heptagon, a skills
 * panel, chapter levels, a forecast and a chart, and at the app's comfortable
 * density that is a wall of padding a phone has to scroll through. `.s-dense`
 * ([components/student-ui/theme.css](../../../components/student-ui/theme.css))
 * re-declares the density custom properties on this wrapper, so every
 * `p-s-card` / `gap-s-*` **inside** the suite inherits the smaller value —
 * no per-card overrides to keep in sync, and design.config.ts › Density still
 * governs the rest of the app.
 *
 * ⚠️ A plain `<div>`, deliberately: no `overflow` and no `transform`, either of
 * which would break the `sticky` navbar and the runner's timer bar.
 */
export default function RaschLayout({ children }: { children: React.ReactNode }) {
  return <div className="s-dense">{children}</div>;
}
