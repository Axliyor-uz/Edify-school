'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserMinus, Loader2, Award, UserCheck, Search, X, BookOpen, Headphones, PenTool, Mic, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner, EmptyState } from '@/components/ui';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { removeStudentFromGroup } from '@/services/ieltsService';
import { fetchUsersLite } from '@/services/userLookup';
import { GroupAttempt, effectiveBand, submittedMillis, timeAgo, toDateSafe } from './groupData';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    unknown: "Noma'lum",
    deletedProfile: "O'chirilgan profil",
    confirmRemove: (name: string) => `${name}ni guruhdan chiqarasizmi?`,
    removed: (name: string) => `${name} chiqarildi`,
    error: "Xatolik yuz berdi",
    noStudents: "O'quvchilar yo'q",
    emptyPre: "Guruhga o'quvchilarni qo'shish uchun yuqoridagi ",
    emptyPost: " tugmasini bosing.",
    searchPlaceholder: "O'quvchini qidirish...",
    studentsCount: (n: number) => `${n} o'quvchi`,
    removeFromGroup: "Guruhdan chiqarish",
    historyTitle: "Urinishlar tarixi",
    noAttempts: "Bu o'quvchi hali test topshirmagan.",
    pendingReview: "Tekshirilmoqda",
    close: "Yopish",
  },
  en: {
    unknown: "Unknown",
    deletedProfile: "Deleted profile",
    confirmRemove: (name: string) => `Remove ${name} from the group?`,
    removed: (name: string) => `${name} removed`,
    error: "An error occurred",
    noStudents: "No students",
    emptyPre: "To add students to the group, click the ",
    emptyPost: " button above.",
    searchPlaceholder: "Search students...",
    studentsCount: (n: number) => `${n} students`,
    removeFromGroup: "Remove from group",
    historyTitle: "Attempt history",
    noAttempts: "This student hasn't taken any tests yet.",
    pendingReview: "Pending review",
    close: "Close",
  },
  ru: {
    unknown: "Неизвестно",
    deletedProfile: "Удалённый профиль",
    confirmRemove: (name: string) => `Удалить ${name} из группы?`,
    removed: (name: string) => `${name} удалён`,
    error: "Произошла ошибка",
    noStudents: "Нет учеников",
    emptyPre: "Чтобы добавить учеников в группу, нажмите кнопку ",
    emptyPost: " выше.",
    searchPlaceholder: "Поиск ученика...",
    studentsCount: (n: number) => `${n} учеников`,
    removeFromGroup: "Удалить из группы",
    historyTitle: "История попыток",
    noAttempts: "Этот ученик ещё не сдавал тесты.",
    pendingReview: "На проверке",
    close: "Закрыть",
  },
};

function bandPill(band: number | null) {
  if (band == null)  return 'bg-surface-container-high text-on-surface-variant border-outline-variant';
  if (band >= 8)     return 'bg-success-container text-on-success-container';
  if (band >= 6.5)   return 'bg-warning-container text-on-warning-container';
  return                    'bg-error-container text-on-error-container';
}

/** Tiny inline band trend (last 5 attempts), band 4–9 normalized. */
function Sparkline({ bands }: { bands: number[] }) {
  if (bands.length < 2) return null;
  const w = 56, h = 18, pad = 2;
  const points = bands
    .map((b, i) => {
      const x = pad + (i * (w - 2 * pad)) / (bands.length - 1);
      const y = h - pad - ((Math.min(9, Math.max(4, b)) - 4) / 5) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  groupId: string;
  studentIds: string[];
  attempts: GroupAttempt[];
  /** Center-managed group: the roster belongs to the center manager — view-only here. */
  readOnly?: boolean;
}

const SKILL_ICON: Record<string, typeof BookOpen> = {
  reading: BookOpen, listening: Headphones, writing: PenTool, speaking: Mic,
};

/** Per-student attempt history overlay — every row links to the teacher review page. */
function StudentHistoryModal({
  student, attempts, t, lang, onClose,
}: {
  student: any; attempts: GroupAttempt[]; t: any; lang: string; onClose: () => void;
}) {
  const router = useRouter();
  const list = attempts
    .filter(a => a.userId === student.uid)
    .sort((a, b) => submittedMillis(b) - submittedMillis(a));
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-[color-mix(in_srgb,var(--m3-scrim)_50%,transparent)] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl border border-outline-variant shadow-elev-3 p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-black text-on-surface truncate">{student.displayName}</h3>
            <p className="text-[12px] font-bold text-on-surface-variant">{t.historyTitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="w-9 h-9 rounded-m3-md bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center transition-colors shrink-0"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        {list.length === 0 ? (
          <p className="text-[13px] font-bold text-on-surface-variant py-6 text-center">{t.noAttempts}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map(a => {
              const Icon = SKILL_ICON[a.skill] || BookOpen;
              const band = effectiveBand(a);
              return (
                <button
                  key={a.id}
                  onClick={() => router.push(`/teacher/ielts/review/${a.id}`)}
                  className="flex items-center gap-3 p-3 rounded-m3-md bg-surface-container-lowest border border-outline-variant hover:border-primary hover:shadow-elev-1 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-m3-sm bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <Icon size={16} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-black text-on-surface capitalize truncate">IELTS {a.skill}</p>
                    <p className="text-[11px] font-bold text-on-surface-variant">{timeAgo(toDateSafe(a.submittedAt), lang)}</p>
                  </div>
                  {band != null ? (
                    <span className={`px-2 py-1 rounded-m3-xs text-[12px] font-black ${bandPill(band)}`}>{band.toFixed(1)}</span>
                  ) : a.reviewStatus === 'pending_review' ? (
                    <span className="px-2 py-1 rounded-m3-xs text-[11px] font-black bg-warning-container text-on-warning-container">{t.pendingReview}</span>
                  ) : null}
                  <ChevronRight size={15} strokeWidth={2.5} className="text-on-surface-variant shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IeltsRosterTab({ groupId, studentIds, attempts, readOnly }: Props) {
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [students, setStudents]     = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [historyFor, setHistoryFor] = useState<any | null>(null);

  // Per-student band history (chronological), from group attempts passed down by the page
  const bandsByUser = useMemo(() => {
    const m: Record<string, number[]> = {};
    const sorted = [...attempts].sort((a, b) => submittedMillis(a) - submittedMillis(b));
    for (const a of sorted) {
      const band = effectiveBand(a);
      if (band == null) continue;
      (m[a.userId] ??= []).push(band);
    }
    return m;
  }, [attempts]);

  useEffect(() => {
    const fetchRoster = async () => {
      if (!studentIds || studentIds.length === 0) {
        setStudents([]); setIsLoading(false); return;
      }
      setIsLoading(true);
      try {
        // Batched 'in' queries + module cache (services/userLookup) instead of N getDocs.
        const profiles = await fetchUsersLite(studentIds);
        setStudents(studentIds.map(uid => {
          const p = profiles[uid];
          return p
            ? { uid, displayName: p.displayName || t.unknown, username: p.username || 'user', photoUrl: p.photoUrl }
            : { uid, displayName: t.deletedProfile, username: 'unknown' };
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIds]);

  const handleRemove = async (student: any) => {
    if (!confirm(t.confirmRemove(student.displayName))) return;
    setRemovingUid(student.uid);
    try {
      await removeStudentFromGroup(groupId, student.uid);
      toast.success(t.removed(student.displayName));
    } catch {
      toast.error(t.error);
    } finally {
      setRemovingUid(null);
    }
  };

  const filtered = students.filter(s =>
    s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return (
    <div className="py-16 flex justify-center">
      <Spinner size={28} />
    </div>
  );

  if (students.length === 0) return (
    <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
      <EmptyState
        icon={<UserCheck strokeWidth={2.5} />}
        title={t.noStudents}
        description={<>{t.emptyPre}<strong>+</strong>{t.emptyPost}</>}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Search + count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 bg-surface-container-lowest border border-outline-variant hover:border-outline transition-colors rounded-m3-md px-4 py-3 max-w-md">
          <Search size={16} className="text-on-surface-variant shrink-0" strokeWidth={2.5} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-[14px] font-black text-on-surface placeholder:text-on-surface-variant placeholder:font-medium outline-none w-full bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm border bg-surface-container-high text-on-surface border-outline-variant self-start sm:self-auto">
          <UserCheck size={14} strokeWidth={3} />
          <span className="text-[13px] font-black">{t.studentsCount(students.length)}</span>
        </div>
      </div>

      {/* Student list grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map(std => {
            const isRemoving = removingUid === std.uid;
            const bands = bandsByUser[std.uid] || [];
            const latestBand = bands.length ? bands[bands.length - 1] : null;
            const trend = bands.slice(-5);
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={std.uid}
                className={`relative overflow-hidden bg-surface-container-low border border-outline-variant rounded-m3-lg p-4 flex items-center gap-3 transition-all shadow-elev-1 hover:shadow-elev-2 ${isRemoving ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {/* SVG pattern overlay */}
                <svg className="absolute inset-0 w-full h-full text-outline-variant opacity-40 z-0 pointer-events-none" fill="currentColor">
                  <pattern id={`dots-${std.uid}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.5" />
                  </pattern>
                  <rect x="0" y="0" width="100%" height="100%" fill={`url(#dots-${std.uid})`} />
                </svg>

                {/* Avatar + name → opens the attempt-history drill-down */}
                <button
                  type="button"
                  onClick={() => setHistoryFor(std)}
                  className="relative z-10 flex flex-1 min-w-0 items-center gap-3 text-left"
                  title={t.historyTitle}
                >
                  <div className="w-12 h-12 rounded-m3-md bg-primary-container text-on-primary-container font-black text-[15px] flex items-center justify-center shrink-0 overflow-hidden shadow-elev-1">
                    {std.photoUrl
                      ? <img src={std.photoUrl} alt="" className="w-full h-full object-cover" />
                      : std.displayName[0]?.toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-on-surface truncate mb-0.5">{std.displayName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-bold text-on-surface-variant truncate">@{std.username}</p>
                      <div className={`flex items-center gap-1 border border-transparent px-1.5 py-0.5 rounded-m3-xs shrink-0 ${bandPill(latestBand)}`}>
                        <Award size={10} strokeWidth={2.5} />
                        <span className="text-[10px] font-black">{latestBand != null ? latestBand.toFixed(1) : '—'}</span>
                      </div>
                      <Sparkline bands={trend} />
                    </div>
                  </div>
                </button>

                {/* Remove — hidden on center-managed groups (manager owns the roster) */}
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(std)}
                    title={t.removeFromGroup}
                    className="m3-interactive relative z-10 w-9 h-9 rounded-m3-md bg-surface-container border border-outline-variant hover:bg-error-container hover:border-transparent text-on-surface-variant hover:text-on-error-container flex items-center justify-center transition-colors shrink-0 active:scale-95"
                  >
                    {isRemoving
                      ? <Loader2 className="animate-spin" size={14} />
                      : <UserMinus size={15} strokeWidth={2.5} />
                    }
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {historyFor && (
        <StudentHistoryModal
          student={historyFor}
          attempts={attempts}
          t={t}
          lang={lang}
          onClose={() => setHistoryFor(null)}
        />
      )}

    </div>
  );
}
