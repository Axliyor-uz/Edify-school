'use client';

// Dashboard "today's lessons" widget: the student's center-group timetable at a
// glance (ordinary + IELTS groups — both are classes docs with a `schedule`).
// Renders NOTHING when the student has no scheduled center classes, so it is
// invisible to non-center students. Day keys/weekdays follow Asia/Tashkent via
// lib/dateUtils (rule #3 in docs/ATTENDANCE.md).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { getTodayKey } from '@/lib/dateUtils';
import { CalendarDays, DoorOpen, ChevronRight } from 'lucide-react';
import { Card, Chip, cn } from '@/components/student-ui';
import type { ScheduleEntry } from '@/types/attendance';

const T: any = {
  uz: {
    title: 'Bugungi darslar',
    empty: 'Bugun dars yo‘q 🎉',
    week: 'Hafta',
  },
  en: {
    title: "Today's lessons",
    empty: 'No lessons today 🎉',
    week: 'Week',
  },
  ru: {
    title: 'Уроки сегодня',
    empty: 'Сегодня занятий нет 🎉',
    week: 'Неделя',
  },
};
const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };

interface ScheduledClass {
  id: string;
  title: string;
  schedule: ScheduleEntry[];
  ieltsGroupId?: string;
}

// Module-level 60s cache (student-page convention).
const cache: Record<string, { at: number; data: ScheduledClass[] }> = {};
const CACHE_TTL = 60_000;
const DAY_MS = 86_400_000;

export default function TodayScheduleCard({ lang }: { lang: string }) {
  const { user } = useAuth();
  const t = T[lang] || T.en;
  const locale = LOCALES[lang] || LOCALES.en;

  const [classes, setClasses] = useState<ScheduledClass[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const cached = cache[user.uid];
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        if (alive) setClasses(cached.data);
        return;
      }
      try {
        const snap = await getDocs(query(
          collection(db, 'classes'),
          where('studentIds', 'array-contains', user.uid),
        ));
        const data: ScheduledClass[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((c) => c.centerId && Array.isArray(c.schedule) && c.schedule.length > 0)
          .map((c) => ({
            id: c.id, title: c.title || '', schedule: c.schedule,
            ...(c.ieltsGroupId ? { ieltsGroupId: c.ieltsGroupId } : {}),
          }));
        cache[user.uid] = { at: Date.now(), data };
        if (alive) setClasses(data);
      } catch { /* widget is best-effort */ }
    })();
    return () => { alive = false; };
  }, [user]);

  // "Today" in Asia/Tashkent — never device-local.
  const todayDate = useMemo(() => new Date(`${getTodayKey()}T00:00:00`), []);
  const todayDow = todayDate.getDay();

  const todayLessons = useMemo(() => classes
    .flatMap((c) => c.schedule
      .filter((s) => s.dayOfWeek === todayDow)
      .map((s) => ({ cls: c, slot: s })))
    .sort((a, b) => (a.slot.startTime < b.slot.startTime ? -1 : 1)),
  [classes, todayDow]);

  // 7-day strip starting today: a dot per day that has at least one lesson.
  const weekStrip = useMemo(() => {
    const lessonDays = new Set(classes.flatMap((c) => c.schedule.map((s) => s.dayOfWeek)));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate.getTime() + i * DAY_MS);
      return {
        label: d.toLocaleDateString(locale, { weekday: 'narrow' }),
        hasLesson: lessonDays.has(d.getDay()),
        isToday: i === 0,
      };
    });
  }, [classes, todayDate, locale]);

  if (classes.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11.5px] font-black uppercase tracking-[0.09em] text-on-surface-variant">
          <CalendarDays size={16} strokeWidth={3} className="text-primary" /> {t.title}
        </h3>
        {/* Week strip */}
        <div className="flex items-center gap-1.5" aria-label={t.week}>
          {weekStrip.map((d, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <span className={cn(
                'text-[9px] font-black uppercase leading-none',
                d.isToday ? 'text-primary' : 'text-on-surface-variant',
              )}>
                {d.label}
              </span>
              {/* NB: no opacity modifiers on M3 tokens (they render opaque) — use a
                  distinct token for non-today lesson days instead. */}
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                d.hasLesson ? (d.isToday ? 'bg-primary' : 'bg-secondary') : 'bg-outline-variant',
              )} />
            </span>
          ))}
        </div>
      </div>

      {todayLessons.length === 0 ? (
        <p className="text-[13.5px] font-bold text-on-surface-variant">{t.empty}</p>
      ) : (
        <div className="flex flex-col divide-y divide-outline-variant">
          {todayLessons.map(({ cls, slot }, i) => (
            <Link
              key={`${cls.id}-${i}`}
              href={cls.ieltsGroupId ? `/ielts/${cls.ieltsGroupId}` : `/classes/${cls.id}`}
              className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="s-num w-[88px] shrink-0 text-[13px] font-black text-on-surface">
                {slot.startTime}–{slot.endTime}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-on-surface group-hover:text-primary">
                {cls.title}
              </span>
              {cls.ieltsGroupId && <Chip status="primary" size="sm">IELTS</Chip>}
              {slot.roomName && (
                <Chip size="sm" icon={<DoorOpen size={11} strokeWidth={2.5} />}>{slot.roomName}</Chip>
              )}
              <ChevronRight size={15} strokeWidth={3} className="shrink-0 text-on-surface-variant group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
