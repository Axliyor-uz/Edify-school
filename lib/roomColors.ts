import type { RoomColor } from "@/types/rooms";

// Class bundles per room color. One source of truth so the rooms list, modal
// picker, timetable, and chips all render a room identically.
//
// Room colors are user-picked IDENTITY data (stored per room), so the seven
// hues must stay distinguishable and cannot collapse into the manager
// palette's own tokens. Instead each tint is a color-mix over the ACTIVE
// surface/on-surface vars, so the same bundle reads correctly in light and
// dark mode and under every switchboard palette.
//
// ⚠️ tailwind.config.ts includes "./lib/**" in `content` specifically so the
// arbitrary-value classes below get generated — they appear nowhere else.
export interface RoomTheme {
  bar: string;   // solid accent (card top bar / swatch)
  dot: string;   // small solid dot
  soft: string;  // soft tinted background
  text: string;  // readable text on soft bg
  ring: string;  // selected ring (color picker)
  cell: string;  // timetable cell (soft bg + border + text)
}

// hue → Tailwind 500 hex, kept as the stable identity anchor per color.
const HUES: Record<RoomColor, string> = {
  indigo:  "#6366f1",
  violet:  "#8b5cf6",
  teal:    "#14b8a6",
  amber:   "#f59e0b",
  rose:    "#f43f5e",
  sky:     "#0ea5e9",
  emerald: "#10b981",
};

/* Tailwind's scanner needs the class strings to appear literally, so the
   bundles below are spelled out rather than built from a helper. Keep the
   mix percentages consistent if you edit: soft/cell bg 14%, border 30%,
   text 55% (over on-surface). */
export const ROOM_THEME: Record<RoomColor, RoomTheme> = {
  indigo:  { bar: "bg-[#6366f1]", dot: "bg-[#6366f1]", soft: "bg-[color-mix(in_oklab,#6366f1_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#6366f1_55%,var(--m3-on-surface))]", ring: "ring-[#6366f1]", cell: "bg-[color-mix(in_oklab,#6366f1_14%,var(--m3-surface))] border-[color-mix(in_oklab,#6366f1_30%,var(--m3-surface))] text-[color-mix(in_oklab,#6366f1_55%,var(--m3-on-surface))]" },
  violet:  { bar: "bg-[#8b5cf6]", dot: "bg-[#8b5cf6]", soft: "bg-[color-mix(in_oklab,#8b5cf6_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#8b5cf6_55%,var(--m3-on-surface))]", ring: "ring-[#8b5cf6]", cell: "bg-[color-mix(in_oklab,#8b5cf6_14%,var(--m3-surface))] border-[color-mix(in_oklab,#8b5cf6_30%,var(--m3-surface))] text-[color-mix(in_oklab,#8b5cf6_55%,var(--m3-on-surface))]" },
  teal:    { bar: "bg-[#14b8a6]", dot: "bg-[#14b8a6]", soft: "bg-[color-mix(in_oklab,#14b8a6_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#14b8a6_55%,var(--m3-on-surface))]", ring: "ring-[#14b8a6]", cell: "bg-[color-mix(in_oklab,#14b8a6_14%,var(--m3-surface))] border-[color-mix(in_oklab,#14b8a6_30%,var(--m3-surface))] text-[color-mix(in_oklab,#14b8a6_55%,var(--m3-on-surface))]" },
  amber:   { bar: "bg-[#f59e0b]", dot: "bg-[#f59e0b]", soft: "bg-[color-mix(in_oklab,#f59e0b_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#f59e0b_55%,var(--m3-on-surface))]", ring: "ring-[#f59e0b]", cell: "bg-[color-mix(in_oklab,#f59e0b_14%,var(--m3-surface))] border-[color-mix(in_oklab,#f59e0b_30%,var(--m3-surface))] text-[color-mix(in_oklab,#f59e0b_55%,var(--m3-on-surface))]" },
  rose:    { bar: "bg-[#f43f5e]", dot: "bg-[#f43f5e]", soft: "bg-[color-mix(in_oklab,#f43f5e_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#f43f5e_55%,var(--m3-on-surface))]", ring: "ring-[#f43f5e]", cell: "bg-[color-mix(in_oklab,#f43f5e_14%,var(--m3-surface))] border-[color-mix(in_oklab,#f43f5e_30%,var(--m3-surface))] text-[color-mix(in_oklab,#f43f5e_55%,var(--m3-on-surface))]" },
  sky:     { bar: "bg-[#0ea5e9]", dot: "bg-[#0ea5e9]", soft: "bg-[color-mix(in_oklab,#0ea5e9_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#0ea5e9_55%,var(--m3-on-surface))]", ring: "ring-[#0ea5e9]", cell: "bg-[color-mix(in_oklab,#0ea5e9_14%,var(--m3-surface))] border-[color-mix(in_oklab,#0ea5e9_30%,var(--m3-surface))] text-[color-mix(in_oklab,#0ea5e9_55%,var(--m3-on-surface))]" },
  emerald: { bar: "bg-[#10b981]", dot: "bg-[#10b981]", soft: "bg-[color-mix(in_oklab,#10b981_14%,var(--m3-surface))]", text: "text-[color-mix(in_oklab,#10b981_55%,var(--m3-on-surface))]", ring: "ring-[#10b981]", cell: "bg-[color-mix(in_oklab,#10b981_14%,var(--m3-surface))] border-[color-mix(in_oklab,#10b981_30%,var(--m3-surface))] text-[color-mix(in_oklab,#10b981_55%,var(--m3-on-surface))]" },
};

export function roomTheme(color?: string): RoomTheme {
  return ROOM_THEME[(color as RoomColor)] || ROOM_THEME.indigo;
}
