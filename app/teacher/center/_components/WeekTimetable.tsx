'use client';

// Weekly timetable for a center teacher: every lesson slot across their center
// groups, merged into one Monday-first week. Read-only — `classes.schedule` is
// owned by the center manager (docs/ROOMS.md), the teacher has no write path.
//
// Layout: 7-column board ≥md, one day per row below that, so a phone shows the
// same information without horizontal scrolling.

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, DoorOpen, Clock, ChevronRight } from 'lucide-react';
import { Chip, EmptyState, cn } from '@/components/ui';
import {
  WEEK_MON_FIRST, flattenSchedule, groupSlotsByDay, findNextSlot,
  todayDowTashkent, nowHmTashkent, weekdayName,
} from '@/lib/weekSchedule';
import { groupHref, type TeacherCenterGroup } from '@/services/teacherCenterService';

const T: Record<string, any> = {
  uz: {
    title: 'Haftalik jadval', today: 'Bugun', next: 'Keyingi dars', tomorrow: 'Ertaga',
    inDays: (n: number) => `${n} kundan keyin`, noLesson: "Dars yo'q",
    perWeek: (n: number) => `Haftasiga ${n} ta dars`,
    empty: { title: 'Jadval belgilanmagan', desc: 'Markaz menejeri dars kunlarini belgilaganda jadval shu yerda paydo bo‘ladi.' },
  },
  en: {
    title: 'Weekly schedule', today: 'Today', next: 'Next lesson', tomorrow: 'Tomorrow',
    inDays: (n: number) => `in ${n} days`, noLesson: 'No lesson',
    perWeek: (n: number) => `${n} ${n === 1 ? 'lesson' : 'lessons'} per week`,
    empty: { title: 'No schedule set', desc: 'Lesson days appear here once the center manager sets them.' },
  },
  ru: {
    title: 'Расписание на неделю', today: 'Сегодня', next: 'Следующее занятие', tomorrow: 'Завтра',
    inDays: (n: number) => `через ${n} дн.`, noLesson: 'Нет занятия',
    perWeek: (n: number) => `Занятий в неделю: ${n}`,
    empty: { title: 'Расписание не задано', desc: 'Дни занятий появятся, когда менеджер центра их назначит.' },
  },
};

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

export default function WeekTimetable({
  groups, lang,
}: {
  groups: TeacherCenterGroup[];
  lang: string;
}) {
  const t = T[lang] || T.uz;
  const locale = LOCALES[lang] || LOCALES.uz;

  // Impure clock reads, once — see lib/weekSchedule.ts.
  const [todayDow] = useState(todayDowTashkent);
  const [nowHm] = useState(nowHmTashkent);

  const slots = flattenSchedule(groups);
  const byDay = groupSlotsByDay(slots);
  const next = findNextSlot(byDay, todayDow, nowHm);
  const byClassId = new Map(groups.map((g) => [g.id, g]));

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={30} strokeWidth={2.5} />}
        title={t.empty.title}
        description={t.empty.desc}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Next lesson */}
      {next && (
        <div className="flex items-center gap-4 rounded-m3-lg bg-primary-container p-4 text-on-primary-container shadow-elev-1">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-m3-md bg-[color-mix(in_oklab,var(--m3-on-primary-container)_14%,transparent)]">
            <Clock size={20} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-black uppercase tracking-[0.1em] opacity-75">{t.next}</p>
            <p className="truncate text-[16px] font-extrabold capitalize">
              {next.offset === 0 ? t.today : next.offset === 1 ? t.tomorrow : weekdayName(next.dayOfWeek, locale, 'long')}
              {' · '}
              <span className="tabular-nums">{next.slot.startTime}–{next.slot.endTime}</span>
            </p>
            <p className="mt-0.5 truncate text-[12px] font-bold opacity-90">
              {next.slot.classTitle}
              {next.slot.roomName ? ` · ${next.slot.roomName}` : ''}
              {next.offset > 1 ? ` · ${t.inDays(next.offset)}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
          <CalendarDays size={15} strokeWidth={3} className="text-primary" /> {t.title}
        </h3>
        <Chip size="sm">{t.perWeek(slots.length)}</Chip>
      </div>

      {/* Board: 7 columns on desktop, one day per row on phones */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {WEEK_MON_FIRST.map((dow) => {
          const daySlots = byDay.get(dow) || [];
          const isToday = dow === todayDow;
          return (
            <div
              key={dow}
              className={cn(
                'flex gap-2 rounded-m3-md p-2.5 md:flex-col md:gap-2',
                // M3 tokens are plain hex in var() — no Tailwind opacity
                // modifiers here (they render opaque). Today is marked with a
                // ring instead of a tinted background.
                isToday ? 'bg-surface-container-low ring-2 ring-primary' : 'bg-surface-container-low',
                daySlots.length === 0 && !isToday && 'opacity-60',
              )}
            >
              <div className="flex w-16 shrink-0 items-center gap-1.5 md:w-auto md:justify-between">
                <span className={cn(
                  'text-[11px] font-black uppercase tracking-wider',
                  isToday ? 'text-primary' : 'text-on-surface-variant',
                )}>
                  {weekdayName(dow, locale, 'short').slice(0, 3)}
                </span>
                {isToday && (
                  <span className="hidden h-1.5 w-1.5 rounded-full bg-primary md:block" aria-hidden />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 md:flex-col">
                {daySlots.length === 0 ? (
                  <span className="self-center text-[11.5px] font-semibold text-on-surface-variant md:self-start">
                    {t.noLesson}
                  </span>
                ) : (
                  daySlots.map((slot, i) => {
                    const group = byClassId.get(slot.classId);
                    const body = (
                      <>
                        <span className="block text-[11.5px] font-extrabold tabular-nums">
                          {slot.startTime}–{slot.endTime}
                        </span>
                        <span className="block truncate text-[12px] font-bold">{slot.classTitle}</span>
                        {slot.roomName && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold opacity-80">
                            <DoorOpen size={11} strokeWidth={2.5} /> {slot.roomName}
                          </span>
                        )}
                      </>
                    );
                    const cls = cn(
                      'group block min-w-0 max-w-full rounded-m3-sm px-2.5 py-2 text-left transition-colors',
                      isToday
                        ? 'bg-primary text-on-primary hover:opacity-90'
                        : 'bg-surface-container-high text-on-surface hover:bg-primary-container hover:text-on-primary-container',
                    );
                    return group ? (
                      <Link key={i} href={groupHref(group)} className={cls}>
                        {body}
                        <ChevronRight
                          size={12}
                          className="mt-0.5 hidden opacity-0 transition-opacity group-hover:opacity-100 md:inline"
                        />
                      </Link>
                    ) : (
                      <div key={i} className={cls}>{body}</div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
