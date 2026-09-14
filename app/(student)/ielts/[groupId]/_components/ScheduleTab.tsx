'use client';

// Weekly timetable for a center IELTS group. The schedule lives on the LINKED
// class doc (`ielts_groups.classId` → `classes.schedule`) — the same array the
// manager edits and attendance derives lesson dates from (docs/ROOMS.md).
// Week starts Monday; "today" is Asia/Tashkent, never device-local.

import { useMemo, useState } from 'react';
import { CalendarDays, DoorOpen, Clock, Building2 } from 'lucide-react';
import { Card, Chip, EmptyState, Tile, cn } from '@/components/student-ui';
import { getTodayKey, parseDateKey } from '@/lib/dateUtils';
import type { ScheduleEntry } from '@/types/attendance';

const T: any = {
  uz: {
    title: 'Haftalik jadval',
    empty: { title: "Jadval belgilanmagan", desc: "Markaz menejeri dars kunlarini belgilaganda shu yerda ko'rinadi." },
    today: 'Bugun',
    next: 'Keyingi dars',
    tomorrow: 'Ertaga',
    inDays: (n: number) => `${n} kundan keyin`,
    noLesson: 'Dars yo‘q',
    room: 'Xona',
    center: 'Markaz',
    lessonsPerWeek: (n: number) => `Haftasiga ${n} ta dars`,
  },
  en: {
    title: 'Weekly schedule',
    empty: { title: 'No schedule set', desc: 'Lesson days appear here once your center manager sets them.' },
    today: 'Today',
    next: 'Next lesson',
    tomorrow: 'Tomorrow',
    inDays: (n: number) => `in ${n} days`,
    noLesson: 'No lesson',
    room: 'Room',
    center: 'Center',
    lessonsPerWeek: (n: number) => `${n} ${n === 1 ? 'lesson' : 'lessons'} per week`,
  },
  ru: {
    title: 'Расписание на неделю',
    empty: { title: 'Расписание не задано', desc: 'Дни занятий появятся, когда менеджер центра их назначит.' },
    today: 'Сегодня',
    next: 'Следующее занятие',
    tomorrow: 'Завтра',
    inDays: (n: number) => `через ${n} дн.`,
    noLesson: 'Нет занятия',
    room: 'Кабинет',
    center: 'Центр',
    lessonsPerWeek: (n: number) => `Занятий в неделю: ${n}`,
  },
};

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };
// Monday-first week (dayOfWeek is 0=Sun in the stored schedule).
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduleTab({
  schedule, centerName, lang,
}: {
  schedule: ScheduleEntry[];
  centerName: string | null;
  lang: string;
}) {
  const t = T[lang] || T.uz;
  const locale = LOCALES[lang] || LOCALES.uz;

  // Clock reads are impure, so they happen ONCE in lazy state initializers —
  // inside a useMemo they make the React Compiler bail on the whole component.
  const [todayDow] = useState(() => parseDateKey(getTodayKey()).getDay());
  const [nowHm] = useState(() => new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tashkent',
  }));

  // Slots grouped per weekday, each sorted by start time.
  const byDay = useMemo(() => {
    const map = new Map<number, ScheduleEntry[]>();
    for (const s of schedule) {
      const list = map.get(s.dayOfWeek) || [];
      list.push(s);
      map.set(s.dayOfWeek, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
    return map;
  }, [schedule]);

  // The next lesson from today onward (today counts only if a slot is still
  // ahead). Deliberately NOT useMemo'd — a loop with early returns can't be
  // preserved by the React Compiler, which then skips optimizing the whole
  // component; ≤7 cheap iterations are better left to the compiler.
  const findNext = () => {
    for (let offset = 0; offset < 7; offset++) {
      const dow = (todayDow + offset) % 7;
      const slots = byDay.get(dow) || [];
      for (const slot of slots) {
        if (offset === 0 && slot.endTime <= nowHm) continue;
        return { slot, offset, dow };
      }
    }
    return null;
  };
  const next = findNext();

  const dayLabel = (dow: number, style: 'long' | 'short') =>
    new Date(Date.UTC(2024, 0, 7 + dow)).toLocaleDateString(locale, { weekday: style, timeZone: 'UTC' });

  if (schedule.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarDays size={30} strokeWidth={2.5} />}
          title={t.empty.title}
          description={t.empty.desc}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-s-gap">
      {/* Next lesson + center */}
      {next && (
        <Card variant="gradient" className="flex items-center gap-4">
          <Tile tone="primary" size="lg" className="bg-white/20 text-current">
            <Clock size={22} strokeWidth={2.5} />
          </Tile>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-80">{t.next}</p>
            <p className="s-display truncate text-[18px] font-bold capitalize">
              {next.offset === 0 ? t.today : next.offset === 1 ? t.tomorrow : dayLabel(next.dow, 'long')}
              {' · '}
              <span className="s-num">{next.slot.startTime}–{next.slot.endTime}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold opacity-90">
              {next.slot.roomName && (
                <span className="inline-flex items-center gap-1">
                  <DoorOpen size={13} strokeWidth={2.5} /> {next.slot.roomName}
                </span>
              )}
              {centerName && (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={13} strokeWidth={2.5} /> {centerName}
                </span>
              )}
              {next.offset > 1 && <span>{t.inDays(next.offset)}</span>}
            </div>
          </div>
        </Card>
      )}

      {/* Week board — every weekday, lesson days filled, rest days muted */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[11.5px] font-black uppercase tracking-[0.09em] text-on-surface-variant">
            <CalendarDays size={15} strokeWidth={3} className="text-primary" /> {t.title}
          </h3>
          <Chip status="neutral" size="sm">{t.lessonsPerWeek(schedule.length)}</Chip>
        </div>

        <div className="flex flex-col divide-y divide-outline-variant">
          {WEEK.map((dow) => {
            const slots = byDay.get(dow) || [];
            const isToday = dow === todayDow;
            return (
              <div
                key={dow}
                className={cn(
                  'flex items-start gap-3 py-2.5 first:pt-0 last:pb-0',
                  slots.length === 0 && 'opacity-45',
                )}
              >
                <span className={cn(
                  'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm text-[11px] font-black uppercase',
                  isToday
                    ? 'bg-primary text-on-primary'
                    : slots.length > 0
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant',
                )}>
                  {dayLabel(dow, 'short').slice(0, 3)}
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  {slots.length === 0 ? (
                    <p className="text-[13px] font-bold text-on-surface-variant">{t.noLesson}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((s, i) => (
                        <Chip key={i} status={isToday ? 'primary' : 'neutral'}>
                          <span className="s-num">{s.startTime}–{s.endTime}</span>
                          {s.roomName && (
                            <span className="inline-flex items-center gap-0.5 font-bold">
                              <DoorOpen size={11} strokeWidth={2.5} /> {s.roomName}
                            </span>
                          )}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                {isToday && <Chip status="primary" size="sm" className="shrink-0">{t.today}</Chip>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
