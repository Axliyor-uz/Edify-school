'use client';

// Student-facing attendance for CENTER groups only (classes with centerId).
// Shared by BOTH student surfaces: the class page tab and the IELTS group tab
// (center IELTS groups mark attendance on their linked class) — the twin of
// AttendanceGrid on the staff side.
// Reads center_attendance by classId+date (composite index exists); the rules
// already allow this: `list: if isAuth()`, per-doc get via `uid in records`.
// Aggregation goes through services/attendanceService.ts — same helpers the
// manager grid uses, so both sides count a lesson the same way.

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTodayKey, toDateKey } from '@/lib/dateUtils';
import {
  normalizeRecords, isCountedLesson, tallyStudent, type CenterSession,
} from '@/services/attendanceService';
import type { LessonStatus } from '@/types/attendance';
import { CalendarCheck, CheckCircle2, Clock, XCircle, ShieldQuestion } from 'lucide-react';
import {
  Card, ListGroup, ListRow, Chip, Tile, EmptyState, LoadingState,
  type Status,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

const DAYS_BACK = 92; // ~3 months of history

const ATT_TRANSLATIONS: any = {
  uz: {
    rate: "Davomat", present: "Kelgan", late: "Kechikkan", absent: "Kelmagan", excused: "Sababli",
    empty: { title: "Hali davomat yo'q", desc: "O'qituvchi yoki menejer davomat olganida shu yerda ko'rinadi." },
    noRecord: "Belgilanmagan",
  },
  en: {
    rate: "Attendance", present: "Present", late: "Late", absent: "Absent", excused: "Excused",
    empty: { title: "No attendance yet", desc: "Sessions will appear here once your center marks attendance." },
    noRecord: "Not marked",
  },
  ru: {
    rate: "Посещаемость", present: "Присутствовал", late: "Опоздал", absent: "Отсутствовал", excused: "Уважительная",
    empty: { title: "Пока нет данных", desc: "Записи появятся, когда центр отметит посещаемость." },
    noRecord: "Не отмечено",
  },
};

const STATUS_STYLE: Record<string, { status: Status; Icon: any }> = {
  present: { status: 'success', Icon: CheckCircle2 },
  late: { status: 'warning', Icon: Clock },
  absent: { status: 'error', Icon: XCircle },
  excused: { status: 'neutral', Icon: ShieldQuestion },
};

export default function StudentAttendanceView({ classId, userId }: { classId: string; userId: string }) {
  const { lang } = useStudentLanguage();
  const t = ATT_TRANSLATIONS[lang] || ATT_TRANSLATIONS['en'];

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CenterSession[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const todayKey = getTodayKey();
        const startKey = toDateKey(new Date(Date.now() - DAYS_BACK * 86_400_000));
        const snap = await getDocs(query(
          collection(db, 'center_attendance'),
          where('classId', '==', classId),
          where('date', '>=', startKey),
          where('date', '<=', todayKey),
        ));
        const rows: CenterSession[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id, classId: data.classId, centerId: data.centerId, date: data.date,
            weekday: data.weekday ?? 0,
            lessonStatus: (data.lessonStatus as LessonStatus) || 'held',
            records: normalizeRecords(data.records),
          };
        });
        rows.sort((a, b) => (a.date < b.date ? 1 : -1));
        setSessions(rows);
      } catch (e) {
        console.error('attendance load failed', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [classId]);

  if (loading) return <LoadingState rows={3} />;

  const todayKey = getTodayKey();
  // Only sessions that actually count AND have a mark for me are listed.
  const mySessions = sessions.filter(
    (s) => isCountedLesson(s.lessonStatus, s.date, todayKey) && s.records[userId],
  );
  const tally = tallyStudent(sessions, userId, todayKey);

  if (mySessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck size={30} strokeWidth={2.5} />}
        title={t.empty.title}
        description={t.empty.desc}
      />
    );
  }

  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
  const stats: { key: 'present' | 'late' | 'absent' | 'excused'; value: number }[] = [
    { key: 'present', value: tally.present },
    { key: 'late', value: tally.late },
    { key: 'absent', value: tally.absent },
    { key: 'excused', value: tally.excused },
  ];

  return (
    <div className="space-y-s-gap">
      {/* SUMMARY */}
      <Card className="flex items-center gap-4 sm:gap-5">
        <Tile tone="primary" size="lg" className="s-num text-[18px] font-black">
          {tally.rate ?? '—'}{tally.rate !== null ? '%' : ''}
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{t.rate}</p>
          <div className="flex flex-wrap gap-2">
            {stats.map(({ key, value }) => (
              <Chip key={key} status={STATUS_STYLE[key].status} className="uppercase tracking-wider">
                {t[key]}: {value}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* SESSION LIST */}
      <ListGroup>
        {mySessions.map((s) => {
          const status = s.records[userId]?.status;
          const style = STATUS_STYLE[status] || STATUS_STYLE.excused;
          const Icon = style.Icon;
          const d = new Date(`${s.date}T00:00:00`);
          return (
            <ListRow
              key={s.id}
              title={d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
              trailing={
                <Chip status={style.status} icon={<Icon size={13} strokeWidth={3} />} className="uppercase tracking-wider">
                  {t[status] || t.noRecord}
                </Chip>
              }
            />
          );
        })}
      </ListGroup>
    </div>
  );
}
