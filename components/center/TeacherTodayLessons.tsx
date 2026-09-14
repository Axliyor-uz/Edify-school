'use client';

// ─── Today's lessons for a center teacher ────────────────────────────────────
// Rendered on BOTH the teacher dashboard and the center hub, so it lives here
// rather than in a route-local `_components/`. Teacher UI kit only
// (`@/components/ui`) — it is never mounted outside `app/teacher/*`.
//
// Lessons come from `classes.schedule` (the manager owns that array — the
// teacher has no write path to it, docs/ROOMS.md). Marking progress is LIVE:
// one `center_attendance where centerId== and date==today` listener covers every
// group at once, which the `centerId+date` composite index already serves and
// the `list: if isAuth()` rule already allows (docs/ATTENDANCE.md rule #2 — a
// per-doc `get()` here would blow the document-access limit).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CalendarCheck, Clock, DoorOpen, Users, CheckCircle2, ChevronRight } from 'lucide-react';
import { Chip, StatusChip, cn } from '@/components/ui';
import { getTodayKey } from '@/lib/dateUtils';
import {
  flattenSchedule, slotsOnDay, todayDowTashkent, nowHmTashkent, type WeekSlot,
} from '@/lib/weekSchedule';
import { normalizeRecords } from '@/services/attendanceService';
import { groupHref, type TeacherCenterGroup } from '@/services/teacherCenterService';

const T: Record<string, any> = {
  uz: {
    title: "Bugungi darslar", none: "Bugun dars yo'q",
    noneDesc: "Dam oling — jadval bo'yicha bugun darsingiz yo'q.",
    mark: "Davomat olish", marked: "Belgilangan", partial: "Qisman",
    cancelled: "Bekor qilingan", holiday: "Dam olish", now: "Hozir",
    students: "o'quvchi", lessons: (n: number) => `${n} ta dars`,
  },
  en: {
    title: "Today's lessons", none: 'No lessons today',
    noneDesc: 'Nothing scheduled for today — enjoy the break.',
    mark: 'Take attendance', marked: 'Marked', partial: 'Partial',
    cancelled: 'Cancelled', holiday: 'Holiday', now: 'Now',
    students: 'students', lessons: (n: number) => `${n} ${n === 1 ? 'lesson' : 'lessons'}`,
  },
  ru: {
    title: 'Занятия сегодня', none: 'Сегодня занятий нет',
    noneDesc: 'По расписанию на сегодня занятий нет.',
    mark: 'Отметить', marked: 'Отмечено', partial: 'Частично',
    cancelled: 'Отменено', holiday: 'Выходной', now: 'Сейчас',
    students: 'учеников', lessons: (n: number) => `Занятий: ${n}`,
  },
};

/** Live marking state of one class for today, keyed by classId. */
interface DaySession {
  markedCount: number;
  lessonStatus: string;
}

export default function TeacherTodayLessons({
  groups, centerId, lang, className,
}: {
  groups: TeacherCenterGroup[];
  centerId: string;
  lang: string;
  className?: string;
}) {
  const t = T[lang] || T.uz;

  // Clock reads are impure — once, in lazy initializers (never inside useMemo,
  // or the React Compiler stops optimizing this component).
  const [todayDow] = useState(todayDowTashkent);
  const [nowHm] = useState(nowHmTashkent);
  const [todayKey] = useState(getTodayKey);

  const [sessions, setSessions] = useState<Record<string, DaySession>>({});

  useEffect(() => {
    if (!centerId) return;
    const q = query(
      collection(db, 'center_attendance'),
      where('centerId', '==', centerId),
      where('date', '==', todayKey),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, DaySession> = {};
        for (const d of snap.docs) {
          const data = d.data();
          next[data.classId] = {
            markedCount: Object.keys(normalizeRecords(data.records)).length,
            lessonStatus: data.lessonStatus || 'held',
          };
        }
        setSessions(next);
      },
      // A listener error must never blank the card — the schedule still renders.
      (err) => console.error('today lessons listener', err),
    );
    return () => unsub();
  }, [centerId, todayKey]);

  const todaySlots = slotsOnDay(flattenSchedule(groups), todayDow);
  const byClassId = new Map(groups.map((g) => [g.id, g]));

  if (todaySlots.length === 0) {
    return (
      <section className={cn('rounded-m3-lg bg-surface-container-low p-5 shadow-elev-1', className)}>
        <Header t={t} count={0} />
        <div className="flex items-center gap-3 pt-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-m3-md bg-surface-container-high text-on-surface-variant">
            <CalendarCheck size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-on-surface">{t.none}</p>
            <p className="text-[12px] font-medium text-on-surface-variant">{t.noneDesc}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn('rounded-m3-lg bg-surface-container-low p-4 shadow-elev-1 sm:p-5', className)}>
      <Header t={t} count={todaySlots.length} />

      <ul className="mt-3 flex flex-col divide-y divide-outline-variant">
        {todaySlots.map((slot, i) => (
          <LessonRow
            key={`${slot.classId}-${slot.startTime}-${i}`}
            slot={slot}
            group={byClassId.get(slot.classId)}
            session={sessions[slot.classId]}
            nowHm={nowHm}
            t={t}
          />
        ))}
      </ul>
    </section>
  );
}

function Header({ t, count }: { t: any; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-on-surface-variant">
        <CalendarCheck size={15} strokeWidth={3} className="text-primary" /> {t.title}
      </h2>
      {count > 0 && <Chip size="sm">{t.lessons(count)}</Chip>}
    </div>
  );
}

function LessonRow({
  slot, group, session, nowHm, t,
}: {
  slot: WeekSlot;
  group?: TeacherCenterGroup;
  session?: DaySession;
  nowHm: string;
  t: any;
}) {
  const total = group?.studentIds.length ?? 0;
  const marked = session?.markedCount ?? 0;
  const status = session?.lessonStatus || 'held';
  const off = status === 'cancelled' || status === 'holiday';
  // "Fully marked" needs a roster to compare against; an empty group counts as
  // marked once a session doc exists, so it doesn't nag forever.
  const isDone = !off && marked > 0 && marked >= total;
  const inProgress = !off && slot.startTime <= nowHm && nowHm < slot.endTime;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
      {/* Time — fixed column so rows align */}
      <div className={cn(
        'flex w-[64px] shrink-0 flex-col rounded-m3-sm px-2 py-1.5 text-center',
        inProgress ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface',
      )}>
        <span className="text-[13px] font-extrabold leading-tight tabular-nums">{slot.startTime}</span>
        <span className={cn(
          'text-[10px] font-bold tabular-nums',
          inProgress ? 'opacity-80' : 'text-on-surface-variant',
        )}>
          {slot.endTime}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-on-surface">
          {slot.classTitle || '—'}
          {inProgress && (
            <span className="ml-2 align-middle text-[10px] font-black uppercase tracking-wider text-primary">
              {t.now}
            </span>
          )}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] font-semibold text-on-surface-variant">
          {slot.roomName && (
            <span className="inline-flex items-center gap-1">
              <DoorOpen size={12} strokeWidth={2.5} /> {slot.roomName}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users size={12} strokeWidth={2.5} /> <span className="tabular-nums">{total}</span> {t.students}
          </span>
        </div>
      </div>

      {/* Action / state — wraps to its own full-width line on narrow phones */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {off ? (
          <Chip size="sm">{status === 'holiday' ? t.holiday : t.cancelled}</Chip>
        ) : isDone ? (
          <StatusChip tone="success" noDot className="gap-1">
            <CheckCircle2 size={12} strokeWidth={3} /> {t.marked}
          </StatusChip>
        ) : group ? (
          // A styled <Link>, not <Link><Button> — the kit's Button renders a
          // <button>, which is invalid inside an anchor.
          <Link
            href={`${groupHref(group)}?tab=attendance`}
            className={cn(
              'm3-interactive inline-flex h-t-control-sm items-center gap-1.5 rounded-m3-sm px-3.5',
              'bg-secondary-container text-[13px] font-semibold text-on-secondary-container',
            )}
          >
            <Clock size={15} strokeWidth={2.5} />
            {marked > 0 ? `${t.partial} ${marked}/${total}` : t.mark}
            <ChevronRight size={14} />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
