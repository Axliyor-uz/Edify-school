'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Headphones, BookOpen, PenTool, Mic, CalendarClock, ChevronDown,
  Trash2, Users, Award, FileText, Plus, RotateCcw,
} from 'lucide-react';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Spinner, EmptyState, ConfirmDialog, Button } from '@/components/ui';
import { deleteAssignment, fetchAssignments } from '@/services/ieltsService';
import type { IeltsAssignment, IeltsSkill } from '@/lib/ielts/types';
import type { IeltsGroup } from '@/lib/ielts/types';
import { IELTS_TYPE_LABELS_LONG as TYPE_LABELS } from '@/lib/ielts/typeLabels';
import { GroupAttempt, effectiveBand, fmtDate, toDateSafe } from './groupData';

const T: Record<string, any> = {
  uz: {
    all: "Barchasi",
    due: "Muddat:",
    noDue: "Muddatsiz",
    submitted: "topshirdi",
    avgBand: "O'rtacha band",
    simulation: "Imtihon",
    practice: "Mashq",
    details: "Tafsilotlar",
    reassign: "Qayta tayinlash",
    perQuestion: "Savollar bo'yicha to'g'ri javoblar",
    worstTypes: "Eng qiyin savol turlari",
    missedBy: (qn: number) => `${qn}-savolni xato qilganlar`,
    noMisses: "Bu savolni hamma to'g'ri yechgan",
    noAttemptData: "Hozircha topshirilgan urinishlar yo'q",
    pendingReviews: (n: number) => `${n} ta ish tekshirishni kutmoqda`,
    empty: "Hozircha topshiriqlar yo'q",
    emptyDesc: "Guruhga birinchi testni tayinlang.",
    assignNow: "Test tayinlash",
    deleteTitle: "Topshiriqni o'chirish",
    deleteDesc: (title: string) => `"${title}" o'chirilsinmi? O'quvchilar natijalari saqlanib qoladi.`,
    deleteConfirm: "O'chirish",
    deleteCancel: "Bekor qilish",
    deleted: "Topshiriq o'chirildi",
    fail: "Xatolik yuz berdi",
    q: "S",
  },
  en: {
    all: "All",
    due: "Due:",
    noDue: "No deadline",
    submitted: "submitted",
    avgBand: "Avg band",
    simulation: "Simulation",
    practice: "Practice",
    details: "Details",
    reassign: "Reassign with same settings",
    perQuestion: "Per-question correct rate",
    worstTypes: "Weakest question types",
    missedBy: (qn: number) => `Students who missed Q${qn}`,
    noMisses: "Everyone got this question right",
    noAttemptData: "No submitted attempts yet",
    pendingReviews: (n: number) => `${n} submissions awaiting review`,
    empty: "No assignments yet",
    emptyDesc: "Assign the first test to this group.",
    assignNow: "Assign a test",
    deleteTitle: "Delete assignment",
    deleteDesc: (title: string) => `Delete "${title}"? Student results are kept.`,
    deleteConfirm: "Delete",
    deleteCancel: "Cancel",
    deleted: "Assignment deleted",
    fail: "An error occurred",
    q: "Q",
  },
  ru: {
    all: "Все",
    due: "Сдать до:",
    noDue: "Без дедлайна",
    submitted: "сдали",
    avgBand: "Средний band",
    simulation: "Экзамен",
    practice: "Практика",
    details: "Детали",
    reassign: "Назначить повторно",
    perQuestion: "Правильные ответы по вопросам",
    worstTypes: "Самые сложные типы вопросов",
    missedBy: (qn: number) => `Ошиблись в вопросе ${qn}`,
    noMisses: "Все ответили на этот вопрос верно",
    noAttemptData: "Пока нет сданных попыток",
    pendingReviews: (n: number) => `${n} работ ждут проверки`,
    empty: "Пока нет заданий",
    emptyDesc: "Назначьте группе первый тест.",
    assignNow: "Назначить тест",
    deleteTitle: "Удалить задание",
    deleteDesc: (title: string) => `Удалить "${title}"? Результаты учеников сохранятся.`,
    deleteConfirm: "Удалить",
    deleteCancel: "Отмена",
    deleted: "Задание удалено",
    fail: "Произошла ошибка",
    q: "В",
  },
};

const SKILL_CONFIG: Record<IeltsSkill, { icon: any; bg: string; color: string }> = {
  reading:   { icon: BookOpen,   bg: 'bg-secondary-container', color: 'text-on-secondary-container' },
  listening: { icon: Headphones, bg: 'bg-primary-container',   color: 'text-on-primary-container' },
  writing:   { icon: PenTool,    bg: 'bg-tertiary-container',  color: 'text-on-tertiary-container' },
  speaking:  { icon: Mic,        bg: 'bg-primary-container',   color: 'text-on-primary-container' },
};

type SkillFilter = 'all' | IeltsSkill;
type AssignmentRow = { id: string } & IeltsAssignment;

const FILTERS: { id: SkillFilter; label: string }[] = [
  { id: 'all', label: '' }, // label filled from dict
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'writing', label: 'Writing' },
  { id: 'speaking', label: 'Speaking' },
];

function pctColor(pct: number) {
  if (pct >= 70) return 'bg-success';
  if (pct >= 40) return 'bg-warning';
  return 'bg-error';
}

interface Props {
  groupId: string;
  group: IeltsGroup;
  attempts: GroupAttempt[];
  refreshKey: number;
  onAssign?: () => void;
  /** "Reassign with same settings" — opens AssignTestModal prefilled from this assignment. */
  onReassign?: (a: IeltsAssignment) => void;
}

export default function IeltsUnifiedFeed({ groupId, group, attempts, refreshKey, onAssign, onReassign }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<SkillFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    fetchAssignments(groupId)
      .then((list) => { if (alive) setAssignments(list as AssignmentRow[]); })
      .catch((e) => console.error(e))
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [groupId, refreshKey]);

  const attemptsByAssignment = useMemo(() => {
    const m: Record<string, GroupAttempt[]> = {};
    for (const a of attempts) {
      if (!a.assignmentId) continue;
      (m[a.assignmentId] ??= []).push(a);
    }
    return m;
  }, [attempts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAssignment(groupId, deleteTarget.id);
      setAssignments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success(t.deleted);
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      toast.error(t.fail);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="py-16 flex justify-center"><Spinner size={28} /></div>;
  }

  if (assignments.length === 0) {
    return (
      <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl flex flex-col items-center gap-3">
        <EmptyState icon={<FileText strokeWidth={2.5} />} title={t.empty} description={t.emptyDesc} />
        {onAssign && (
          <Button variant="filled" onClick={onAssign} icon={<Plus strokeWidth={2.5} />}>
            {t.assignNow}
          </Button>
        )}
      </div>
    );
  }

  const filtered = assignments.filter((a) => filter === 'all' || a.skill === filter);

  return (
    <div className="flex flex-col gap-5">

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t.deleteTitle}
        description={deleteTarget ? t.deleteDesc(deleteTarget.testTitle) : ''}
        confirmText={t.deleteConfirm}
        cancelText={t.deleteCancel}
        danger
        loading={isDeleting}
      />

      {/* Skill filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`m3-interactive whitespace-nowrap px-4 py-2 rounded-m3-md font-black text-[13px] border transition-all active:scale-95 shrink-0 ${
              filter === f.id
                ? 'bg-primary text-on-primary border-transparent shadow-elev-1'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline'
            }`}
          >
            {f.id === 'all' ? t.all : f.label}
          </button>
        ))}
      </div>

      {/* Assignment cards */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((assignment) => {
            const cfg = SKILL_CONFIG[assignment.skill] || SKILL_CONFIG.reading;
            const Icon = cfg.icon;
            const aAttempts = attemptsByAssignment[assignment.id] || [];
            const bands = aAttempts.map(effectiveBand).filter((b): b is number => b != null);
            const avgBand = bands.length ? bands.reduce((s, b) => s + b, 0) / bands.length : null;
            const assignedCount = assignment.assignedTo === 'all'
              ? (group.studentIds?.length || 0)
              : assignment.assignedTo.length;
            const completedCount = assignment.completedBy?.length || 0;
            const dueDate = toDateSafe(assignment.dueAt);
            const isExpanded = expandedId === assignment.id;
            const isRL = assignment.skill === 'reading' || assignment.skill === 'listening';
            const pendingWS = aAttempts.filter((a) => a.reviewStatus === 'pending_review').length;

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                key={assignment.id}
                className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden"
              >
                {/* Card header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-11 h-11 rounded-m3-md flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-[15px] font-black text-on-surface truncate">{assignment.testTitle}</h4>
                        {isRL && (
                          <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-m3-xs bg-surface-container-high text-on-surface-variant border border-outline-variant uppercase tracking-wide">
                            {assignment.mode === 'practice' ? t.practice : t.simulation}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] font-bold text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <CalendarClock size={11} strokeWidth={2.5} />
                          {dueDate ? <>{t.due} <span className="text-on-surface">{fmtDate(dueDate, lang, true)}</span></> : t.noDue}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={11} strokeWidth={2.5} />
                          {completedCount}/{assignedCount} {t.submitted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {avgBand != null && (
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-m3-sm bg-tertiary-container text-on-tertiary-container text-[12px] font-black">
                        <Award size={12} strokeWidth={2.5} />
                        {avgBand.toFixed(1)}
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                      className="m3-interactive flex items-center gap-1 px-3 py-2 bg-surface-container-high hover:bg-state-hover text-on-surface rounded-m3-md font-black text-[12px] transition-colors"
                    >
                      {t.details}
                      <ChevronDown size={13} strokeWidth={3} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {onReassign && (
                      <button
                        onClick={() => onReassign(assignment)}
                        title={t.reassign}
                        className="m3-interactive w-9 h-9 rounded-m3-md bg-surface-container border border-outline-variant hover:bg-primary-container hover:border-transparent text-on-surface-variant hover:text-on-primary-container flex items-center justify-center transition-colors"
                      >
                        <RotateCcw size={14} strokeWidth={2.5} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(assignment)}
                      className="m3-interactive w-9 h-9 rounded-m3-md bg-surface-container border border-outline-variant hover:bg-error-container hover:border-transparent text-on-surface-variant hover:text-on-error-container flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Expanded analytics */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-outline-variant px-4 py-4 flex flex-col gap-5 bg-surface-container-lowest">
                        {aAttempts.length === 0 ? (
                          <p className="text-[13px] font-bold text-on-surface-variant py-2">{t.noAttemptData}</p>
                        ) : isRL ? (
                          <AssignmentAnalytics attempts={aAttempts} t={t} />
                        ) : (
                          <p className="text-[13px] font-bold text-on-surface-variant py-1">
                            {pendingWS > 0 ? t.pendingReviews(pendingWS) : `${t.avgBand}: ${avgBand != null ? avgBand.toFixed(1) : '—'}`}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
            <p className="text-[14px] font-bold text-on-surface-variant">{t.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Per-question bars + worst types (reading/listening) ── */
function AssignmentAnalytics({ attempts, t }: { attempts: GroupAttempt[]; t: any }) {
  const router = useRouter();
  const [selectedQn, setSelectedQn] = useState<number | null>(null);
  const { perQuestion, worstTypes } = useMemo(() => {
    const qAgg: Record<string, { correct: number; total: number }> = {};
    const typeAgg: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      for (const [qn, r] of Object.entries(a.perQuestion || {})) {
        const q = (qAgg[qn] ??= { correct: 0, total: 0 });
        q.total += 1;
        if (r.correct) q.correct += 1;
      }
      for (const [type, s] of Object.entries(a.typeStats || {})) {
        const ta = (typeAgg[type] ??= { correct: 0, total: 0 });
        ta.correct += s.correct;
        ta.total += s.total;
      }
    }
    const perQuestion = Object.entries(qAgg)
      .map(([qn, s]) => ({ qn: Number(qn), pct: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
      .sort((a, b) => a.qn - b.qn);
    const worstTypes = Object.entries(typeAgg)
      .filter(([, s]) => s.total > 0)
      .map(([type, s]) => ({ type, pct: Math.round((s.correct / s.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
    return { perQuestion, worstTypes };
  }, [attempts]);

  return (
    <>
      {perQuestion.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2.5">{t.perQuestion}</p>
          <div className="flex items-end gap-[3px] flex-wrap">
            {perQuestion.map(({ qn, pct }) => (
              <button
                key={qn}
                type="button"
                onClick={() => setSelectedQn(selectedQn === qn ? null : qn)}
                className={`flex flex-col items-center gap-0.5 rounded-sm ${selectedQn === qn ? 'bg-state-hover' : ''}`}
                title={`${t.q}${qn} — ${pct}%`}
              >
                <div className="w-[9px] h-12 bg-surface-container rounded-sm overflow-hidden flex flex-col justify-end">
                  <div className={`w-full rounded-sm ${pctColor(pct)}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                </div>
                <span className="text-[8px] font-bold text-on-surface-variant leading-none">{qn}</span>
              </button>
            ))}
          </div>

          {/* Chart → action: who missed this question, one click from their full attempt */}
          {selectedQn != null && (() => {
            const missed = attempts.filter(a => {
              const r = a.perQuestion?.[String(selectedQn)];
              return r != null && !r.correct;
            });
            return (
              <div className="mt-3 bg-surface-container rounded-m3-md p-3">
                <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2">
                  {t.missedBy(selectedQn)}
                </p>
                {missed.length === 0 ? (
                  <p className="text-[12.5px] font-bold text-on-surface-variant">{t.noMisses}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {missed.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => router.push(`/teacher/ielts/review/${a.id}`)}
                        className="px-2.5 py-1.5 rounded-m3-sm bg-surface-container-lowest border border-outline-variant text-[12px] font-black text-on-surface hover:border-primary transition-colors"
                      >
                        {a.userName || '—'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {worstTypes.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2.5">{t.worstTypes}</p>
          <div className="flex flex-col gap-2">
            {worstTypes.map(({ type, pct }) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-on-surface w-40 sm:w-48 truncate shrink-0">
                  {TYPE_LABELS[type] || type}
                </span>
                <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pctColor(pct)}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
                <span className="text-[12px] font-black text-on-surface-variant w-9 text-right shrink-0">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
