'use client';

// The teacher's center groups — navigation only. Each group already has a full
// page (`/teacher/classes/{id}`, or `/teacher/ielts/groups/{id}` for center
// IELTS twins, which are hidden from /teacher/classes), so this tab links out
// rather than duplicating roster/assignment UI.

import Link from 'next/link';
import { Users, DoorOpen, ChevronRight, School, Globe } from 'lucide-react';
import { EmptyState, cn } from '@/components/ui';
import { WEEK_MON_FIRST, weekdayName } from '@/lib/weekSchedule';
import { groupHref, type TeacherCenterGroup } from '@/services/teacherCenterService';

const T: Record<string, any> = {
  uz: {
    students: "o'quvchi", noSchedule: 'Jadval belgilanmagan', open: 'Ochish',
    empty: { title: 'Guruhlar yo‘q', desc: 'Markaz menejeri sizga guruh biriktirganda ular shu yerda ko‘rinadi.' },
  },
  en: {
    students: 'students', noSchedule: 'No schedule set', open: 'Open',
    empty: { title: 'No groups yet', desc: 'Groups appear here once the center manager assigns them to you.' },
  },
  ru: {
    students: 'учеников', noSchedule: 'Расписание не задано', open: 'Открыть',
    empty: { title: 'Групп пока нет', desc: 'Группы появятся, когда менеджер центра назначит их вам.' },
  },
};

const LOCALES: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

/** The kit's <Chip> renders a <button>, which is invalid inside a <Link>.
 *  These cards are entirely link-wrapped, so they use a span-based chip. */
function TagChip({ children, tone }: { children: React.ReactNode; tone?: 'accent' }) {
  return (
    <span className={cn(
      'inline-flex h-[26px] flex-none select-none items-center gap-1 rounded-m3-xs px-2.5 text-xs font-medium',
      tone === 'accent'
        ? 'bg-tertiary-container font-semibold text-on-tertiary-container'
        : 'text-on-surface-variant ring-1 ring-inset ring-outline-variant',
    )}>
      {children}
    </span>
  );
}

export default function GroupsTab({
  groups, lang,
}: {
  groups: TeacherCenterGroup[];
  lang: string;
}) {
  const t = T[lang] || T.uz;
  const locale = LOCALES[lang] || LOCALES.uz;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<School size={30} strokeWidth={2.5} />}
        title={t.empty.title}
        description={t.empty.desc}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {groups.map((group) => {
        // Monday-first so the chips read like the timetable does.
        const slots = [...group.schedule].sort(
          (a, b) =>
            WEEK_MON_FIRST.indexOf(a.dayOfWeek) - WEEK_MON_FIRST.indexOf(b.dayOfWeek) ||
            (a.startTime < b.startTime ? -1 : 1),
        );
        const rooms = [...new Set(slots.map((s) => s.roomName).filter(Boolean))];

        return (
          <Link
            key={group.id}
            href={groupHref(group)}
            className={cn(
              'group flex flex-col gap-3 rounded-m3-lg bg-surface-container-low p-4 shadow-elev-1',
              'transition-shadow hover:shadow-elev-2',
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-m3-md',
                group.ieltsGroupId
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-primary-container text-on-primary-container',
              )}>
                {group.ieltsGroupId ? <Globe size={20} strokeWidth={2.5} /> : <School size={20} strokeWidth={2.5} />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[15px] font-extrabold text-on-surface group-hover:text-primary">
                    {group.title || '—'}
                  </h3>
                  {group.ieltsGroupId && <TagChip tone="accent">IELTS</TagChip>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] font-semibold text-on-surface-variant">
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} strokeWidth={2.5} />
                    <span className="tabular-nums">{group.studentIds.length}</span> {t.students}
                  </span>
                  {rooms.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen size={12} strokeWidth={2.5} /> {rooms.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight size={18} className="mt-1 shrink-0 text-outline group-hover:text-primary" />
            </div>

            {slots.length === 0 ? (
              <p className="text-[11.5px] font-semibold text-on-surface-variant">{t.noSchedule}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot, i) => (
                  <TagChip key={i}>
                    <span className="tabular-nums capitalize">
                      {weekdayName(slot.dayOfWeek, locale, 'short').slice(0, 3)} {slot.startTime}–{slot.endTime}
                    </span>
                  </TagChip>
                ))}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
