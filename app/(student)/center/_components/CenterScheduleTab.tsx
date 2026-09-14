'use client';

// Weekly timetable for a student across ALL their groups in one center.
// Slots come from `classes.schedule` — the array the manager edits and the one
// attendance derives lesson dates from (docs/ROOMS.md). Week starts Monday and
// "today" is Asia/Tashkent, never device-local.

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, DoorOpen, Clock, Building2 } from 'lucide-react';
import { Card, Chip, EmptyState, Tile, cn } from '@/components/student-ui';
import {
  WEEK_MON_FIRST, flattenSchedule, groupSlotsByDay, findNextSlot,
  todayDowTashkent, nowHmTashkent, weekdayName, type ScheduledClass,
} from '@/lib/weekSchedule';

const T: Record<string, any> = {
  uz: {
    title: 'Haftalik jadval', next: 'Keyingi dars', today: 'Bugun', tomorrow: 'Ertaga',
    inDays: (n: number) => `${n} kundan keyin`, noLesson: 'Dars yo‘q',
    perWeek: (n: number) => `Haftasiga ${n} ta dars`,
    empty: { title: 'Jadval belgilanmagan', desc: 'Markaz menejeri dars kunlarini belgilaganda jadval shu yerda ko‘rinadi.' },
  },
  en: {
    title: 'Weekly schedule', next: 'Next lesson', today: 'Today', tomorrow: 'Tomorrow',
    inDays: (n: number) => `in ${n} days`, noLesson: 'No lesson',
    perWeek: (n: number) => `${n} ${n === 1 ? 'lesson' : 'lessons'} per week`,
    empty: { title: 'No schedule set', desc: 'Lesson days appear here once your center manager sets them.' },
  },
  ru: {
    title: 'Расписание на неделю', next: 'Следующее занятие', today: 'Сегодня', tomorrow: 'Завтра',
    inDays: (n: number) => `через ${n} дн.`, noLesson: 'Нет занятия',
    perWeek: (n: number) => `Занятий в неделю: ${n}`,
    empty: { title: 'Расписание не задано', desc: 'Дни занятий появятся, когда менеджер центра их назначит.' },
  },
};

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

export default function CenterScheduleTab({
  groups, centerName, lang,
}: {
  groups: ScheduledClass[];
  centerName: string;
  lang: string;
}) {
  const t = T[lang] || T.uz;
  const locale = LOCALES[lang] || LOCALES.uz;

  // Impure clock reads — once, in lazy initializers (see lib/weekSchedule.ts).
  const [todayDow] = useState(todayDowTashkent);
  const [nowHm] = useState(nowHmTashkent);

  const slots = flattenSchedule(groups);
  const byDay = groupSlotsByDay(slots);
  const next = findNextSlot(byDay, todayDow, nowHm);

  if (slots.length === 0) {
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
      {/* Next lesson */}
      {next && (
        <Card variant="gradient" className="flex items-center gap-4">
          <Tile tone="primary" size="lg" className="bg-white/20 text-current">
            <Clock size={22} strokeWidth={2.5} />
          </Tile>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-80">{t.next}</p>
            <p className="s-display truncate text-[18px] font-bold capitalize">
              {next.offset === 0 ? t.today : next.offset === 1 ? t.tomorrow : weekdayName(next.dayOfWeek, locale, 'long')}
              {' · '}
              <span className="s-num">{next.slot.startTime}–{next.slot.endTime}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold opacity-90">
              <span className="truncate">{next.slot.classTitle}</span>
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
          <Chip status="neutral" size="sm">{t.perWeek(slots.length)}</Chip>
        </div>

        <div className="flex flex-col divide-y divide-outline-variant">
          {WEEK_MON_FIRST.map((dow) => {
            const daySlots = byDay.get(dow) || [];
            const isToday = dow === todayDow;
            return (
              <div
                key={dow}
                className={cn(
                  'flex items-start gap-3 py-2.5 first:pt-0 last:pb-0',
                  daySlots.length === 0 && 'opacity-45',
                )}
              >
                <span className={cn(
                  'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-m3-sm text-[11px] font-black uppercase',
                  isToday
                    ? 'bg-primary text-on-primary'
                    : daySlots.length > 0
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant',
                )}>
                  {weekdayName(dow, locale, 'short').slice(0, 3)}
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  {daySlots.length === 0 ? (
                    <p className="text-[13px] font-bold text-on-surface-variant">{t.noLesson}</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {daySlots.map((slot, i) => {
                        const href = slot.ieltsGroupId
                          ? `/ielts/${slot.ieltsGroupId}`
                          : `/classes/${slot.classId}`;
                        return (
                          <Link
                            key={i}
                            href={href}
                            className={cn(
                              'flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-m3-sm px-2.5 py-2 s-press',
                              isToday
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-surface-container-high text-on-surface',
                            )}
                          >
                            <span className="s-num text-[12.5px] font-black">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                              {slot.classTitle}
                            </span>
                            {slot.roomName && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold opacity-80">
                                <DoorOpen size={11} strokeWidth={2.5} /> {slot.roomName}
                              </span>
                            )}
                          </Link>
                        );
                      })}
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
