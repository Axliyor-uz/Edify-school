'use client';

// Monthly attendance overview across the teacher's center groups. Read-only —
// marking happens in each group's own Davomat tab (AttendanceGrid), which this
// links to. One `centerId+date` range query per month covers every group
// (docs/ATTENDANCE.md: `list: if isAuth()`, never a per-doc get()).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck, ChevronLeft, ChevronRight, TrendingUp, CheckCircle2, XCircle,
  Clock, ShieldQuestion,
} from 'lucide-react';
import { EmptyState, IconButton, ProgressBar, StatTile, Skeleton, cn } from '@/components/ui';
import { getTodayKey } from '@/lib/dateUtils';
import {
  fetchCenterSessions, isCountedLesson, rateOfSessions, type CenterSession,
} from '@/services/attendanceService';
import { groupHref, type TeacherCenterGroup } from '@/services/teacherCenterService';

const T: Record<string, any> = {
  uz: {
    rate: 'Davomat darajasi', lessons: 'Darslar', marked: 'Belgilangan',
    byGroup: 'Guruhlar bo‘yicha', recent: 'So‘nggi darslar',
    present: 'Kelgan', late: 'Kechikkan', absent: 'Kelmagan', excused: 'Sababli',
    noData: 'Bu oyda davomat yo‘q',
    noDataDesc: 'Dars o‘tkazilib davomat belgilanganda statistika shu yerda ko‘rinadi.',
    cancelled: 'Bekor qilingan', of: 'dan',
  },
  en: {
    rate: 'Attendance rate', lessons: 'Lessons', marked: 'Marked',
    byGroup: 'By group', recent: 'Recent lessons',
    present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused',
    noData: 'No attendance this month',
    noDataDesc: 'Statistics appear once lessons are held and marked.',
    cancelled: 'Cancelled', of: 'of',
  },
  ru: {
    rate: 'Уровень посещаемости', lessons: 'Занятия', marked: 'Отмечено',
    byGroup: 'По группам', recent: 'Последние занятия',
    present: 'Присутствовал', late: 'Опоздал', absent: 'Отсутствовал', excused: 'Уважительная',
    noData: 'В этом месяце нет посещаемости',
    noDataDesc: 'Статистика появится после проведённых и отмеченных занятий.',
    cancelled: 'Отменено', of: 'из',
  },
};

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

/** "YYYY-MM" shifted by `delta` months, without touching the current date. */
function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export default function AttendanceTab({
  groups, centerId, lang,
}: {
  groups: TeacherCenterGroup[];
  centerId: string;
  lang: string;
}) {
  const t = T[lang] || T.uz;
  const locale = LOCALES[lang] || LOCALES.uz;

  const [todayKey] = useState(getTodayKey);
  const [monthKey, setMonthKey] = useState(() => getTodayKey().slice(0, 7));
  // The loaded month is stored WITH its data: switching months makes the cached
  // result stale by comparison, so no synchronous `setSessions(null)` reset is
  // needed inside the effect (which would trigger a cascading render).
  const [loaded, setLoaded] = useState<{ monthKey: string; list: CenterSession[] } | null>(null);

  const thisMonth = todayKey.slice(0, 7);

  useEffect(() => {
    if (!centerId) return;
    let mounted = true;
    // "-32" safely covers every month length; date keys compare lexically.
    fetchCenterSessions(centerId, `${monthKey}-01`, `${monthKey}-32`)
      .then((all) => mounted && setLoaded({ monthKey, list: all }))
      .catch((e) => {
        console.error('center attendance month load failed', e);
        if (mounted) setLoaded({ monthKey, list: [] });
      });
    return () => { mounted = false; };
  }, [centerId, monthKey]);

  const sessions = loaded && loaded.monthKey === monthKey ? loaded.list : null;

  if (sessions === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-m3-lg" />
        <Skeleton className="h-48 w-full rounded-m3-lg" />
      </div>
    );
  }

  const classIds = new Set(groups.map((g) => g.id));
  const mine = sessions.filter((s) => classIds.has(s.classId));
  const counted = mine.filter((s) => isCountedLesson(s.lessonStatus, s.date, todayKey));
  const overall = rateOfSessions(mine, todayKey);

  // Status totals across every counted lesson.
  const totals = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const s of counted) {
    for (const uid of Object.keys(s.records)) {
      const st = s.records[uid].status;
      if (st in totals) totals[st as keyof typeof totals] += 1;
    }
  }

  const monthLabel = new Date(`${monthKey}-01T00:00:00`)
    .toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-5">
      {/* ── Month nav ── */}
      <div className="flex items-center justify-between gap-2">
        <IconButton
          aria-label="prev"
          variant="tonal"
          onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft size={18} />
        </IconButton>
        <span className="text-[14px] font-extrabold capitalize text-on-surface">{monthLabel}</span>
        <IconButton
          aria-label="next"
          variant="tonal"
          disabled={monthKey >= thisMonth}
          onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
        >
          <ChevronRight size={18} />
        </IconButton>
      </div>

      {counted.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={30} strokeWidth={2.5} />}
          title={t.noData}
          description={t.noDataDesc}
        />
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<TrendingUp size={16} strokeWidth={2.8} />}
              label={t.rate}
              value={overall.rate !== null ? `${overall.rate}%` : '—'}
              tone="primary"
              progress={overall.rate ?? 0}
            />
            <StatTile
              icon={<CalendarCheck size={16} strokeWidth={2.8} />}
              label={t.lessons}
              value={counted.length}
            />
            <StatTile
              icon={<CheckCircle2 size={16} strokeWidth={2.8} />}
              label={t.present}
              value={totals.present + totals.late}
              tone="success"
            />
            <StatTile
              icon={<XCircle size={16} strokeWidth={2.8} />}
              label={t.absent}
              value={totals.absent}
              tone="warning"
            />
          </div>

          {/* ── Per-group ── */}
          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
              {t.byGroup}
            </h3>
            <div className="flex flex-col gap-2">
              {groups.map((group) => {
                const groupSessions = mine.filter((s) => s.classId === group.id);
                const r = rateOfSessions(groupSessions, todayKey);
                const held = groupSessions.filter((s) => isCountedLesson(s.lessonStatus, s.date, todayKey)).length;
                return (
                  <Link
                    key={group.id}
                    href={groupHref(group)}
                    className="rounded-m3-md bg-surface-container-low p-3.5 shadow-elev-1 transition-shadow hover:shadow-elev-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[13.5px] font-bold text-on-surface">
                        {group.title || '—'}
                      </span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-on-surface">
                        {r.rate !== null ? `${r.rate}%` : '—'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        value={r.rate ?? 0}
                        // ProgressBar tones are primary | warning | error only.
                        tone={r.rate === null || r.rate >= 85 ? 'primary' : r.rate >= 65 ? 'warning' : 'error'}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-on-surface-variant tabular-nums">
                      {held} {t.lessons.toLowerCase()}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Recent sessions ── */}
          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
              {t.recent}
            </h3>
            <ul className="flex flex-col divide-y divide-outline-variant rounded-m3-md bg-surface-container-low px-3.5 shadow-elev-1">
              {[...mine]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 12)
                .map((s) => {
                  const group = groups.find((g) => g.id === s.classId);
                  const r = rateOfSessions([s], todayKey);
                  const off = s.lessonStatus === 'cancelled' || s.lessonStatus === 'holiday';
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-[52px] shrink-0 text-[11.5px] font-bold tabular-nums text-on-surface-variant">
                        {s.date.slice(5).replace('-', '/')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">
                        {group?.title || s.classId}
                      </span>
                      <span className={cn(
                        'shrink-0 text-[12px] font-extrabold tabular-nums',
                        off ? 'text-on-surface-variant' : 'text-on-surface',
                      )}>
                        {off
                          ? t.cancelled
                          : r.denom > 0
                            ? `${r.attended}/${r.denom}`
                            : `${Object.keys(s.records).length}`}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>

          {/* ── Status legend ── */}
          <div className="flex flex-wrap gap-2">
            {([
              ['present', totals.present, CheckCircle2, 'bg-success-container text-on-success-container'],
              ['late', totals.late, Clock, 'bg-warning-container text-on-warning-container'],
              ['absent', totals.absent, XCircle, 'bg-error-container text-on-error-container'],
              ['excused', totals.excused, ShieldQuestion, 'bg-surface-container-highest text-on-surface-variant'],
            ] as const).map(([key, count, Icon, tone]) => (
              <span
                key={key}
                className={cn('inline-flex items-center gap-1.5 rounded-m3-xs px-2.5 py-1 text-xs font-semibold', tone)}
              >
                <Icon size={13} strokeWidth={2.8} /> {t[key]}: <span className="tabular-nums">{count}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
