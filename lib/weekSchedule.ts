// ─── Weekly-timetable helpers (pure) ─────────────────────────────────────────
// Shared by the teacher center hub and the student center hub. Rendering CANNOT
// be shared (three separate UI kits — see CLAUDE.md), so the *logic* lives here
// instead: flattening `classes.schedule` into slots, grouping them Monday-first,
// and finding the next lesson.
//
// `dayOfWeek` is 0=Sun..6=Sat, matching `ScheduleEntry` (docs/ATTENDANCE.md).
// Times are "HH:MM" 24h strings, so lexical comparison == chronological.
//
// ⚠️ `todayDowTashkent()` / `nowHmTashkent()` read the clock and are therefore
// IMPURE — call them in a lazy `useState` initializer, never inside a `useMemo`
// (the React Compiler bails on the whole component if it can't preserve it).

import { getTodayKey, parseDateKey, CENTER_TZ } from '@/lib/dateUtils';
import type { ScheduleEntry } from '@/types/attendance';

/** Weekday order for display: Monday first, Sunday last. */
export const WEEK_MON_FIRST: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** The minimum a class needs to contribute to a timetable. */
export interface ScheduledClass {
  id: string;
  title?: string;
  schedule?: ScheduleEntry[];
  /** Present on center IELTS groups — the linked `ielts_groups` twin. */
  ieltsGroupId?: string;
}

/** One lesson slot, denormalized with the class it belongs to. */
export interface WeekSlot extends ScheduleEntry {
  classId: string;
  classTitle: string;
  ieltsGroupId?: string;
}

/** Where a lesson sits relative to now. */
export interface NextSlot {
  slot: WeekSlot;
  /** 0 = today, 1 = tomorrow, … up to 6. */
  offset: number;
  dayOfWeek: number;
}

/** Every schedule entry across `classes`, chronologically sorted within a day. */
export function flattenSchedule(classes: ScheduledClass[]): WeekSlot[] {
  const slots: WeekSlot[] = [];
  for (const cls of classes) {
    if (!Array.isArray(cls.schedule)) continue;
    for (const entry of cls.schedule) {
      // Defensive: a malformed schedule row must never break the whole board.
      if (typeof entry?.dayOfWeek !== 'number' || !entry.startTime) continue;
      slots.push({
        ...entry,
        classId: cls.id,
        classTitle: cls.title || '',
        ...(cls.ieltsGroupId ? { ieltsGroupId: cls.ieltsGroupId } : {}),
      });
    }
  }
  return slots.sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
}

/** Slots bucketed by weekday (0=Sun..6=Sat), each bucket already time-sorted. */
export function groupSlotsByDay(slots: WeekSlot[]): Map<number, WeekSlot[]> {
  const byDay = new Map<number, WeekSlot[]>();
  for (const slot of slots) {
    const list = byDay.get(slot.dayOfWeek);
    if (list) list.push(slot);
    else byDay.set(slot.dayOfWeek, [slot]);
  }
  return byDay;
}

/** Today's lessons only, in start-time order. */
export function slotsOnDay(slots: WeekSlot[], dayOfWeek: number): WeekSlot[] {
  return slots.filter((s) => s.dayOfWeek === dayOfWeek);
}

/**
 * The next lesson at or after `nowHm` today, scanning up to 7 days forward.
 * A lesson that has already ENDED today is skipped; one in progress is returned.
 */
export function findNextSlot(
  byDay: Map<number, WeekSlot[]>,
  todayDow: number,
  nowHm: string,
): NextSlot | null {
  for (let offset = 0; offset < 7; offset++) {
    const dayOfWeek = (todayDow + offset) % 7;
    for (const slot of byDay.get(dayOfWeek) || []) {
      if (offset === 0 && slot.endTime && slot.endTime <= nowHm) continue;
      return { slot, offset, dayOfWeek };
    }
  }
  return null;
}

/** ⚠️ Impure (reads the clock). Today's weekday in Asia/Tashkent, 0=Sun..6=Sat. */
export function todayDowTashkent(): number {
  return parseDateKey(getTodayKey()).getDay();
}

/** ⚠️ Impure (reads the clock). Current "HH:MM" in Asia/Tashkent, 24h. */
export function nowHmTashkent(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CENTER_TZ,
  });
}

/** Localized weekday name for a 0=Sun..6=Sat index (2024-01-07 was a Sunday). */
export function weekdayName(dayOfWeek: number, locale: string, style: 'long' | 'short'): string {
  return new Date(Date.UTC(2024, 0, 7 + dayOfWeek))
    .toLocaleDateString(locale, { weekday: style, timeZone: 'UTC' });
}
