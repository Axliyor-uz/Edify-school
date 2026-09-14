'use client';

// ─── "My Center" hub for a teacher ───────────────────────────────────────────
// One page for everything a CENTER teacher needs that isn't already inside a
// group: center identity, today's lessons, their groups, the merged weekly
// timetable, a monthly attendance overview and their own salary.
//
// Nothing here is manager functionality — the teacher cannot edit rosters,
// schedules or money (docs/MANAGER.md: center groups are manager-run, and the
// teacher-side rules branch requires `centerId == ''`). Every surface is
// read-only except the attendance deep-links, which land in the existing
// AttendanceGrid the teacher is already allowed to write.
//
// A teacher with NO center link is a normal, common state: the page renders a
// friendly empty state instead of an error, and the nav entry never appears.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage, type LangType } from '@/app/teacher/layout';
import { useTeacherCenter } from '@/hooks/useTeacherCenter';
import {
  Building2, School, Users, CalendarDays, CalendarCheck, Wallet, LayoutGrid,
} from 'lucide-react';
import { EmptyState, StatTile, Tabs, Skeleton, cn } from '@/components/ui';
import TeacherTodayLessons from '@/components/center/TeacherTodayLessons';
import {
  fetchTeacherCenterGroups, uniqueStudentCount, type TeacherCenterGroup,
} from '@/services/teacherCenterService';
import GroupsTab from './_components/GroupsTab';
import WeekTimetable from './_components/WeekTimetable';
import AttendanceTab from './_components/AttendanceTab';
import SalaryTab from './_components/SalaryTab';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    title: 'Mening Markazim', subtitle: 'Guruhlar, jadval, davomat va oylik',
    tabs: { overview: 'Umumiy', groups: 'Guruhlar', schedule: 'Jadval', attendance: 'Davomat', salary: 'Oylik' },
    stats: { groups: 'Guruhlar', students: "O'quvchilar", lessonsWeek: 'Haftalik darslar' },
    notLinked: {
      title: "Siz o'quv markaziga biriktirilmagansiz",
      desc: "Markaz menejeri sizni o'qituvchilar ro'yxatiga qo'shganda bu sahifada markaz guruhlari, jadval, davomat va oylik ma'lumotlaringiz ko'rinadi.",
    },
  },
  en: {
    title: 'My Center', subtitle: 'Groups, schedule, attendance and salary',
    tabs: { overview: 'Overview', groups: 'Groups', schedule: 'Schedule', attendance: 'Attendance', salary: 'Salary' },
    stats: { groups: 'Groups', students: 'Students', lessonsWeek: 'Lessons / week' },
    notLinked: {
      title: 'You are not linked to a learning center',
      desc: 'Once a center manager adds you to their teaching staff, this page shows your center groups, timetable, attendance and salary.',
    },
  },
  ru: {
    title: 'Мой Центр', subtitle: 'Группы, расписание, посещаемость и зарплата',
    tabs: { overview: 'Обзор', groups: 'Группы', schedule: 'Расписание', attendance: 'Посещаемость', salary: 'Зарплата' },
    stats: { groups: 'Группы', students: 'Ученики', lessonsWeek: 'Занятий в неделю' },
    notLinked: {
      title: 'Вы не привязаны к учебному центру',
      desc: 'Когда менеджер центра добавит вас в состав преподавателей, здесь появятся ваши группы, расписание, посещаемость и зарплата.',
    },
  },
};

type TabId = 'overview' | 'groups' | 'schedule' | 'attendance' | 'salary';

export default function TeacherCenterPage() {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage() as { lang: LangType };
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const center = useTeacherCenter();

  // Deep links land on a tab (`?tab=salary`). Read from the URL directly rather
  // than useSearchParams — the latter forces a Suspense boundary at build time.
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'overview';
    const wanted = new URLSearchParams(window.location.search).get('tab');
    const valid: TabId[] = ['overview', 'groups', 'schedule', 'attendance', 'salary'];
    return valid.includes(wanted as TabId) ? (wanted as TabId) : 'overview';
  });

  const [groups, setGroups] = useState<TeacherCenterGroup[] | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !center.centerId) return;
    let mounted = true;
    fetchTeacherCenterGroups(user.uid, center.centerId)
      .then((list) => mounted && setGroups(list))
      .catch((e) => {
        console.error('teacher center groups load failed', e);
        if (mounted) setGroups([]);
      });
    return () => { mounted = false; };
  }, [user, center.centerId]);

  // Token for the Admin-SDK salary route; fetched once and only when needed.
  useEffect(() => {
    if (!user || activeTab !== 'salary' || token) return;
    let mounted = true;
    user.getIdToken().then((tk) => mounted && setToken(tk)).catch(() => {});
    return () => { mounted = false; };
  }, [user, activeTab, token]);

  if (center.loading) {
    return (
      <Shell>
        <Skeleton className="h-28 w-full rounded-m3-lg" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-m3-lg" />)}
        </div>
      </Shell>
    );
  }

  // Not a center teacher — a normal state, never an error.
  if (!center.centerId) {
    return (
      <Shell>
        <EmptyState
          icon={<Building2 size={32} strokeWidth={2.5} />}
          title={t.notLinked.title}
          description={t.notLinked.desc}
        />
      </Shell>
    );
  }

  const list = groups || [];
  const lessonsPerWeek = list.reduce((sum, g) => sum + g.schedule.length, 0);

  const tabs = [
    { id: 'overview', label: t.tabs.overview, icon: LayoutGrid },
    { id: 'groups', label: t.tabs.groups, icon: School },
    { id: 'schedule', label: t.tabs.schedule, icon: CalendarDays },
    { id: 'attendance', label: t.tabs.attendance, icon: CalendarCheck },
    { id: 'salary', label: t.tabs.salary, icon: Wallet },
  ].map((tab) => ({
    id: tab.id,
    label: (
      <span className="flex items-center gap-1.5">
        <tab.icon size={15} strokeWidth={2.5} /> {tab.label}
      </span>
    ),
  }));

  return (
    <Shell>
      {/* ── Center identity ── */}
      <div className="flex items-center gap-4 rounded-m3-lg bg-primary p-5 text-on-primary shadow-elev-2">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-m3-md bg-[color-mix(in_oklab,var(--m3-on-primary)_18%,transparent)]">
          <Building2 size={24} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.12em] opacity-80">{t.title}</p>
          <h1 className="truncate text-[20px] font-extrabold leading-tight sm:text-[24px]">
            {center.centerName || '—'}
          </h1>
          <p className="mt-0.5 truncate text-[12px] font-semibold opacity-85">{t.subtitle}</p>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
        className="-mx-4 px-4 sm:mx-0 sm:px-0"
      />

      {groups === null ? (
        <Skeleton className="h-64 w-full rounded-m3-lg" />
      ) : activeTab === 'overview' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile icon={<School size={16} strokeWidth={2.8} />} label={t.stats.groups} value={list.length} tone="primary" />
            <StatTile icon={<Users size={16} strokeWidth={2.8} />} label={t.stats.students} value={uniqueStudentCount(list)} tone="secondary" />
            <StatTile
              icon={<CalendarDays size={16} strokeWidth={2.8} />}
              label={t.stats.lessonsWeek}
              value={lessonsPerWeek}
              tone="tertiary"
              className="col-span-2 lg:col-span-1"
            />
          </div>
          <TeacherTodayLessons groups={list} centerId={center.centerId} lang={lang} />
        </div>
      ) : activeTab === 'groups' ? (
        <GroupsTab groups={list} lang={lang} />
      ) : activeTab === 'schedule' ? (
        <WeekTimetable groups={list} lang={lang} />
      ) : activeTab === 'attendance' ? (
        <AttendanceTab groups={list} centerId={center.centerId} lang={lang} />
      ) : (
        <SalaryTab token={token} lang={lang} />
      )}
    </Shell>
  );
}

/** Page frame — matches the padding/width of the other teacher pages. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('min-h-[100dvh] bg-surface pb-28 md:pb-12')}>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
