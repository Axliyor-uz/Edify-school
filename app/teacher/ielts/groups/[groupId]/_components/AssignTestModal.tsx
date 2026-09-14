'use client';

import { useEffect, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  X, BookOpen, Headphones, PenTool, Mic, ChevronLeft, ChevronRight,
  Clock, ListChecks, Send, FileQuestion, Check,
} from 'lucide-react';
import { Button, IconButton, Spinner } from '@/components/ui';
import { createAssignment, fetchPlatformTests, fetchTeacherTests } from '@/services/ieltsService';
import { fetchUsersLite } from '@/services/userLookup';
import type { IeltsGroup } from '@/lib/ielts/types';
import type { IeltsMode, IeltsResultsVisibility, IeltsSkill } from '@/lib/ielts/types';

const T: Record<string, any> = {
  uz: {
    title: "Test tayinlash",
    myTests: "Mening testlarim",
    platform: "Platforma",
    noTests: "Bu bo'limda testlar yo'q",
    questions: (n: number) => `${n} savol`,
    minutes: (n: number) => `${n} daqiqa`,
    untitled: "Nomsiz test",
    optionsTitle: "Sozlamalar",
    mode: "Rejim",
    simulation: "Imtihon (simulation)",
    practice: "Mashq (practice)",
    openAt: "Ochilish vaqti (ixtiyoriy)",
    dueAt: "Muddat (ixtiyoriy)",
    attempts: "Urinishlar soni",
    visibility: "Natijalar ko'rinishi",
    visAlways: "Darhol",
    visAfterDue: "Muddatdan keyin",
    visNever: "Ko'rinmaydi",
    assignTo: "Kimga",
    allStudents: "Barcha o'quvchilar",
    selectStudents: "Tanlash",
    selectedCount: (n: number) => `${n} ta tanlandi`,
    noStudentsInGroup: "Guruhda o'quvchi yo'q",
    assignBtn: "Tayinlash",
    back: "Orqaga",
    created: "Topshiriq tayinlandi!",
    fail: "Xatolik yuz berdi",
    loadFail: "Testlarni yuklab bo'lmadi",
    unknown: "Noma'lum",
    dueBeforeOpen: "Muddat ochilish vaqtidan keyin bo'lishi kerak",
  },
  en: {
    title: "Assign a test",
    myTests: "My tests",
    platform: "Platform",
    noTests: "No tests in this section",
    questions: (n: number) => `${n} questions`,
    minutes: (n: number) => `${n} min`,
    untitled: "Untitled test",
    optionsTitle: "Options",
    mode: "Mode",
    simulation: "Simulation",
    practice: "Practice",
    openAt: "Opens at (optional)",
    dueAt: "Due at (optional)",
    attempts: "Allowed attempts",
    visibility: "Results visibility",
    visAlways: "Always",
    visAfterDue: "After due date",
    visNever: "Never",
    assignTo: "Assign to",
    allStudents: "All students",
    selectStudents: "Select",
    selectedCount: (n: number) => `${n} selected`,
    noStudentsInGroup: "No students in the group",
    assignBtn: "Assign",
    back: "Back",
    created: "Assignment created!",
    fail: "An error occurred",
    loadFail: "Failed to load tests",
    unknown: "Unknown",
    dueBeforeOpen: "Due date must be after the open date",
  },
  ru: {
    title: "Назначить тест",
    myTests: "Мои тесты",
    platform: "Платформа",
    noTests: "В этом разделе нет тестов",
    questions: (n: number) => `${n} вопросов`,
    minutes: (n: number) => `${n} мин`,
    untitled: "Без названия",
    optionsTitle: "Настройки",
    mode: "Режим",
    simulation: "Экзамен (simulation)",
    practice: "Практика (practice)",
    openAt: "Открытие (необязательно)",
    dueAt: "Дедлайн (необязательно)",
    attempts: "Число попыток",
    visibility: "Видимость результатов",
    visAlways: "Сразу",
    visAfterDue: "После дедлайна",
    visNever: "Никогда",
    assignTo: "Кому",
    allStudents: "Все ученики",
    selectStudents: "Выбрать",
    selectedCount: (n: number) => `выбрано: ${n}`,
    noStudentsInGroup: "В группе нет учеников",
    assignBtn: "Назначить",
    back: "Назад",
    created: "Задание назначено!",
    fail: "Произошла ошибка",
    loadFail: "Не удалось загрузить тесты",
    unknown: "Неизвестно",
    dueBeforeOpen: "Дедлайн должен быть позже открытия",
  },
};

const SKILLS: { id: IeltsSkill; label: string; icon: any }[] = [
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'listening', label: 'Listening', icon: Headphones },
  { id: 'writing', label: 'Writing', icon: PenTool },
  { id: 'speaking', label: 'Speaking', icon: Mic },
];

interface TestListItem {
  id: string;
  test_title?: string;
  total_questions?: number;
  total_time_minutes?: number;
}

interface RosterEntry {
  uid: string;
  displayName: string;
}

/** "Reassign with same settings" — pre-selects the test and settings, jumping straight to options. */
export interface AssignPrefill {
  skill: IeltsSkill;
  test: { id: string; test_title?: string; total_questions?: number; total_time_minutes?: number };
  mode: IeltsMode;
  allowedAttempts: number;
  resultsVisibility: IeltsResultsVisibility;
}

interface Props {
  groupId: string;
  group: IeltsGroup;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  prefill?: AssignPrefill | null;
}

// Last-used assignment settings (per browser) — new assignments start from these.
const DEFAULTS_KEY = 'ielts_assign_defaults';
interface AssignDefaults { mode: IeltsMode; allowedAttempts: string; visibility: IeltsResultsVisibility }
function loadDefaults(): AssignDefaults | null {
  try { return JSON.parse(localStorage.getItem(DEFAULTS_KEY) || 'null'); } catch { return null; }
}
function saveDefaults(d: AssignDefaults) {
  try { localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d)); } catch { /* private mode */ }
}

const inputCls =
  "w-full px-3 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] font-bold text-on-surface outline-none focus:border-primary transition-colors";

const labelCls = "text-[11px] font-black text-on-surface-variant uppercase tracking-wider";

export default function AssignTestModal({ groupId, group, isOpen, onClose, onCreated, prefill }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [step, setStep] = useState<'pick' | 'options'>('pick');
  const [skill, setSkill] = useState<IeltsSkill>('reading');
  const [source, setSource] = useState<'mine' | 'platform'>('mine');
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestListItem | null>(null);
  const cacheRef = useRef<Record<string, TestListItem[]>>({});

  // Options
  const [mode, setMode] = useState<IeltsMode>('simulation');
  const [openAt, setOpenAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowedAttempts, setAllowedAttempts] = useState('1');
  const [visibility, setVisibility] = useState<IeltsResultsVisibility>('always');
  const [assignMode, setAssignMode] = useState<'all' | 'select'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isWS = skill === 'writing' || skill === 'speaking';
  const studentIds = group.studentIds || [];

  // On open: apply the reassign prefill (jump straight to options), else last-used defaults.
  useEffect(() => {
    if (!isOpen) return;
    if (prefill) {
      setSkill(prefill.skill);
      setSelectedTest(prefill.test as TestListItem);
      setMode(prefill.mode);
      setAllowedAttempts(String(prefill.allowedAttempts || 1));
      setVisibility(prefill.resultsVisibility);
      setStep('options');
    } else {
      const d = loadDefaults();
      if (d) {
        setMode(d.mode === 'practice' ? 'practice' : 'simulation');
        setAllowedAttempts(d.allowedAttempts || '1');
        setVisibility(['always', 'after_due', 'never'].includes(d.visibility) ? d.visibility : 'always');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill]);

  // Load tests for the active skill/source (cached per modal lifetime)
  useEffect(() => {
    if (!isOpen || !user) return;
    const key = `${skill}:${source}`;
    const cached = cacheRef.current[key];
    if (cached) { setTests(cached); return; }
    let alive = true;
    setLoadingTests(true);
    setTests([]);
    // Platform side: audience 'teacher' drops admin-hidden papers and keeps the catalog order.
    const load = source === 'mine'
      ? fetchTeacherTests(skill, user.uid)
      : fetchPlatformTests(skill, { audience: 'teacher' });
    load
      .then((list) => {
        if (!alive) return;
        const items = list as unknown as TestListItem[];
        cacheRef.current[key] = items;
        setTests(items);
      })
      .catch((e) => { console.error(e); if (alive) toast.error(t.loadFail); })
      .finally(() => { if (alive) setLoadingTests(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, skill, source, user]);

  // Resolve student names lazily, only when the teacher chooses "select"
  // (batched 'in' queries + shared cache — services/userLookup).
  useEffect(() => {
    if (!isOpen || assignMode !== 'select' || rosterLoaded || rosterLoading) return;
    let alive = true;
    setRosterLoading(true);
    fetchUsersLite(studentIds)
      .then((profiles) => {
        if (!alive) return;
        setRoster(studentIds.map((uid) => ({
          uid, displayName: profiles[uid]?.displayName || t.unknown,
        })));
        setRosterLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setRoster(studentIds.map((uid) => ({ uid, displayName: t.unknown })));
        setRosterLoaded(true);
      })
      .finally(() => { if (alive) setRosterLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, assignMode, rosterLoaded, rosterLoading, studentIds]);

  const resetAll = () => {
    setStep('pick'); setSelectedTest(null);
    setMode('simulation'); setOpenAt(''); setDueAt('');
    setAllowedAttempts('1'); setVisibility('always');
    setAssignMode('all'); setSelectedIds([]);
  };

  const handleClose = () => { if (!isSaving) { resetAll(); onClose(); } };

  const pickTest = (test: TestListItem) => {
    setSelectedTest(test);
    setStep('options');
  };

  const toggleStudent = (uid: string) => {
    setSelectedIds((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]);
  };

  const datesInvalid = !!openAt && !!dueAt && new Date(dueAt) <= new Date(openAt);
  const canSubmit = !!selectedTest && !datesInvalid && (assignMode === 'all' || selectedIds.length > 0);

  const handleCreate = async () => {
    if (!user || !selectedTest || !canSubmit) return;
    setIsSaving(true);
    try {
      await createAssignment(groupId, {
        testId: selectedTest.id,
        skill,
        testTitle: selectedTest.test_title || t.untitled,
        questionCount: Number(selectedTest.total_questions) || 0,
        totalTimeMinutes: Number(selectedTest.total_time_minutes) || 0,
        mode: isWS ? 'simulation' : mode,
        openAt: openAt ? Timestamp.fromDate(new Date(openAt)) : null,
        dueAt: dueAt ? Timestamp.fromDate(new Date(dueAt)) : null,
        allowedAttempts: Math.max(1, Math.floor(Number(allowedAttempts) || 1)),
        resultsVisibility: visibility,
        assignedTo: assignMode === 'all' ? 'all' : selectedIds,
        teacherId: user.uid,
      });
      saveDefaults({
        mode: isWS ? 'simulation' : mode,
        allowedAttempts: String(Math.max(1, Math.floor(Number(allowedAttempts) || 1))),
        visibility,
      });
      toast.success(t.created);
      onCreated?.();
      resetAll();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(t.fail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-scrim"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-surface-container-low w-full sm:max-w-md rounded-t-[2rem] sm:rounded-m3-xl overflow-hidden z-10 flex flex-col shadow-elev-3 max-h-[88dvh]"
          >
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mt-3 sm:hidden shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {step === 'options' && (
                  <button
                    onClick={() => setStep('pick')}
                    className="m3-interactive w-7 h-7 rounded-m3-sm bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                  >
                    <ChevronLeft size={15} strokeWidth={2.5} />
                  </button>
                )}
                <h2 className="text-[17px] font-black text-on-surface tracking-tight truncate">
                  {step === 'pick' ? t.title : t.optionsTitle}
                </h2>
              </div>
              <IconButton aria-label="Yopish" size="sm" onClick={handleClose} className="shrink-0">
                <X strokeWidth={2.5} />
              </IconButton>
            </div>

            <div className="overflow-y-auto custom-scrollbar px-5 pb-5 flex flex-col gap-4">

              {step === 'pick' && (
                <>
                  {/* Skill tabs */}
                  <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1">
                    {SKILLS.map((s) => {
                      const active = skill === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSkill(s.id); setSelectedTest(null); }}
                          className={`m3-interactive whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-m3-md font-black text-[12px] border transition-all shrink-0 active:scale-95 ${
                            active
                              ? 'bg-primary text-on-primary border-transparent shadow-elev-1'
                              : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline'
                          }`}
                        >
                          <s.icon size={13} strokeWidth={2.5} />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Source toggle */}
                  <div className="flex bg-surface-container rounded-m3-md p-1 gap-1">
                    {(['mine', 'platform'] as const).map((src) => (
                      <button
                        key={src}
                        onClick={() => setSource(src)}
                        className={`flex-1 py-2 rounded-m3-sm text-[12px] font-black transition-colors ${
                          source === src
                            ? 'bg-surface-container-lowest text-on-surface shadow-elev-1'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {src === 'mine' ? t.myTests : t.platform}
                      </button>
                    ))}
                  </div>

                  {/* Test list */}
                  {loadingTests ? (
                    <div className="py-10 flex justify-center"><Spinner size={24} /></div>
                  ) : tests.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-2 text-center bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-m3-lg">
                      <FileQuestion size={22} className="text-on-surface-variant" strokeWidth={2} />
                      <p className="text-[13px] font-bold text-on-surface-variant px-4">{t.noTests}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {tests.map((test) => (
                        <button
                          key={test.id}
                          onClick={() => pickTest(test)}
                          className="m3-interactive w-full flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant hover:border-primary rounded-m3-md text-left transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-black text-on-surface truncate">
                              {test.test_title || t.untitled}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-on-surface-variant">
                              {Number(test.total_questions) > 0 && (
                                <span className="flex items-center gap-1">
                                  <ListChecks size={11} strokeWidth={2.5} />{t.questions(Number(test.total_questions))}
                                </span>
                              )}
                              {Number(test.total_time_minutes) > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} strokeWidth={2.5} />{t.minutes(Number(test.total_time_minutes))}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={16} strokeWidth={2.5} className="text-on-surface-variant group-hover:text-primary shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {step === 'options' && selectedTest && (
                <>
                  {/* Chosen test summary */}
                  <div className="flex items-center gap-3 p-3 bg-primary-container rounded-m3-md">
                    <div className="w-9 h-9 rounded-m3-sm bg-surface-container-lowest flex items-center justify-center text-primary shrink-0">
                      {(() => { const S = SKILLS.find((s) => s.id === skill)!; return <S.icon size={16} strokeWidth={2.5} />; })()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-on-primary-container truncate">{selectedTest.test_title || t.untitled}</p>
                      <p className="text-[11px] font-bold text-on-primary-container opacity-80 capitalize">{skill}</p>
                    </div>
                  </div>

                  {/* Mode (hidden for writing/speaking) */}
                  {!isWS && (
                    <div className="flex flex-col gap-1.5">
                      <span className={labelCls}>{t.mode}</span>
                      <div className="flex bg-surface-container rounded-m3-md p-1 gap-1">
                        {(['simulation', 'practice'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex-1 py-2 rounded-m3-sm text-[12px] font-black transition-colors ${
                              mode === m
                                ? 'bg-surface-container-lowest text-on-surface shadow-elev-1'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {m === 'simulation' ? t.simulation : t.practice}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className={labelCls}>{t.openAt}</span>
                      <input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className={labelCls}>{t.dueAt}</span>
                      <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {datesInvalid && (
                    <p className="text-[11px] font-bold text-error -mt-2">{t.dueBeforeOpen}</p>
                  )}

                  {/* Attempts + visibility */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className={labelCls}>{t.attempts}</span>
                      <input
                        type="number" min={1} max={20} value={allowedAttempts}
                        onChange={(e) => setAllowedAttempts(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className={labelCls}>{t.visibility}</span>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as IeltsResultsVisibility)}
                        className={`${inputCls} cursor-pointer appearance-none`}
                      >
                        <option value="always">{t.visAlways}</option>
                        <option value="after_due">{t.visAfterDue}</option>
                        <option value="never">{t.visNever}</option>
                      </select>
                    </div>
                  </div>

                  {/* Assign to */}
                  <div className="flex flex-col gap-1.5">
                    <span className={labelCls}>{t.assignTo}</span>
                    <div className="flex bg-surface-container rounded-m3-md p-1 gap-1">
                      <button
                        onClick={() => setAssignMode('all')}
                        className={`flex-1 py-2 rounded-m3-sm text-[12px] font-black transition-colors ${
                          assignMode === 'all'
                            ? 'bg-surface-container-lowest text-on-surface shadow-elev-1'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {t.allStudents}
                      </button>
                      <button
                        onClick={() => setAssignMode('select')}
                        className={`flex-1 py-2 rounded-m3-sm text-[12px] font-black transition-colors ${
                          assignMode === 'select'
                            ? 'bg-surface-container-lowest text-on-surface shadow-elev-1'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {t.selectStudents}{assignMode === 'select' && selectedIds.length > 0 ? ` · ${selectedIds.length}` : ''}
                      </button>
                    </div>

                    {assignMode === 'select' && (
                      rosterLoading ? (
                        <div className="py-5 flex justify-center"><Spinner size={20} /></div>
                      ) : studentIds.length === 0 ? (
                        <p className="text-[12px] font-bold text-on-surface-variant py-2">{t.noStudentsInGroup}</p>
                      ) : (
                        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto custom-scrollbar border border-outline-variant rounded-m3-md p-1.5 bg-surface-container-lowest">
                          {roster.map((s) => {
                            const checked = selectedIds.includes(s.uid);
                            return (
                              <button
                                key={s.uid}
                                onClick={() => toggleStudent(s.uid)}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-m3-sm text-left transition-colors ${
                                  checked ? 'bg-primary-container' : 'hover:bg-state-hover'
                                }`}
                              >
                                <span className={`w-[18px] h-[18px] rounded-m3-xs border flex items-center justify-center shrink-0 transition-colors ${
                                  checked ? 'bg-primary border-primary text-on-primary' : 'border-outline bg-surface-container-lowest text-transparent'
                                }`}>
                                  <Check size={12} strokeWidth={3.5} />
                                </span>
                                <span className={`text-[13px] font-bold truncate ${checked ? 'text-on-primary-container' : 'text-on-surface'}`}>
                                  {s.displayName}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}
                    {assignMode === 'select' && rosterLoaded && (
                      <p className="text-[11px] font-bold text-on-surface-variant">{t.selectedCount(selectedIds.length)}</p>
                    )}
                  </div>

                  <Button
                    variant="filled"
                    size="lg"
                    onClick={handleCreate}
                    disabled={!canSubmit}
                    loading={isSaving}
                    icon={<Send strokeWidth={2.5} />}
                    className="w-full mt-1"
                  >
                    {t.assignBtn}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
