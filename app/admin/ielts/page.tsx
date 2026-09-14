'use client';

// Admin IELTS platform dataset manager:
//  • per-skill catalog with admin-controlled ORDER (catalogOrder) and per-audience
//    VISIBILITY (hiddenFromStudents / hiddenFromTeachers) — both mirrored onto the test
//    doc and its ielts_test_meta doc by services/ieltsService.ts;
//  • JSON import for ALL FOUR skills, validated by lib/ielts/importValidation.ts
//    (errors block the write and point at the exact JSON path; warnings never block);
//  • promotion of teacher tests + the reused W/S authoring forms.
// Admin writes bypass rules via the super_admin god-mode wildcard.
//
// Authoring format + ready-made papers: data/ielts practise/ (see its README).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  BookOpen, Headphones, PenLine, Mic, Plus, FileJson, Upload, Trash2,
  Pencil, ArrowUpToLine, Search, AlertTriangle, CheckCircle2, X, Loader2,
  ArrowUp, ArrowDown, Eye, EyeOff, GraduationCap, Users, Info, RotateCcw, Save,
} from 'lucide-react';
import {
  deleteIeltsTest, fetchPlatformTests, promoteTestToPlatform, saveIeltsTest,
  saveSpeakingTest, savePlatformTestOrder, saveWritingTest, setPlatformTestVisibility,
} from '@/services/ieltsService';
import { validateIeltsImport, type ImportIssue, type ImportValidationResult } from '@/lib/ielts/importValidation';
import type { IeltsListeningTest, IeltsReadingTest, IeltsSkill, IeltsSpeakingTest, IeltsWritingTest } from '@/lib/ielts/types';
import AdminLangProvider from './_components/AdminLangProvider';
import WritingForm from '@/app/teacher/ielts/writing/_components/WritingForm';
import SpeakingForm from '@/app/teacher/ielts/speaking/_components/SpeakingForm';

const SKILLS: { key: IeltsSkill; label: string; icon: typeof BookOpen }[] = [
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'listening', label: 'Listening', icon: Headphones },
  { key: 'writing', label: 'Writing', icon: PenLine },
  { key: 'speaking', label: 'Speaking', icon: Mic },
];

const COLLECTIONS: Record<IeltsSkill, string> = {
  reading: 'ielts_reading_tests',
  listening: 'ielts_listening_tests',
  writing: 'ielts_writing_tests',
  speaking: 'ielts_speaking_tests',
};

type TestRow = { id: string } & Record<string, any>;

const JSON_SAMPLES: Record<IeltsSkill, string> = {
  reading: `{
  "module": "reading",
  "test_title": "Academic Reading — Water Clocks",
  "test_category": "academic",
  "total_time_minutes": 60,
  "passages": [
    {
      "title": "Passage title",
      "blocks": [{ "label": "A", "content": "Paragraph text…" }],
      "questions": [
        {
          "type": "true_false_not_given",
          "instructions": "Do the following statements agree with the information…?",
          "questions": [
            { "question_number": 1, "statement": "Statement 1",
              "correct_answer": "TRUE", "passage_reference": "evidence sentence" }
          ]
        }
      ]
    }
  ]
}`,
  listening: `{
  "module": "listening",
  "test_title": "Listening Practice 1",
  "total_time_minutes": 32,
  "parts": [
    {
      "audio_url": "https://…/part1.mp3",
      "transcript": "optional",
      "questions": [
        {
          "type": "short_answer",
          "instructions": "Answer the questions. NO MORE THAN TWO WORDS.",
          "word_limit": 2,
          "questions": [
            { "question_number": 1, "question_text": "What is the caller's surname?",
              "correct_answer": ["Whitfield"] }
          ]
        }
      ]
    }
  ]
}`,
  writing: `{
  "module": "writing",
  "test_title": "Writing Practice 1",
  "test_category": "academic",
  "total_time_minutes": 60,
  "task1": {
    "prompt": "The chart below shows… Summarise the information by selecting and reporting the main features.",
    "imageUrl": "https://…/chart.png",
    "modelAnswer": "optional band-9 sample"
  },
  "task2": {
    "prompt": "Some people believe that… Discuss both these views and give your own opinion.",
    "modelAnswer": "optional band-9 sample"
  }
}`,
  speaking: `{
  "module": "speaking",
  "test_title": "Speaking — Hobbies & Free Time",
  "total_time_minutes": 14,
  "part1Questions": ["Do you work or study?", "What do you do in your free time?"],
  "part2CueCard": {
    "topic": "Describe a hobby you enjoy.",
    "bullets": ["what it is", "when you started", "why you enjoy it"]
  },
  "part3Questions": ["Why do people need hobbies?", "Have hobbies changed over time?"]
}`,
};

export default function AdminIeltsPage() {
  const [skill, setSkill] = useState<IeltsSkill>('reading');
  const [platformTests, setPlatformTests] = useState<TestRow[]>([]);
  const [teacherTests, setTeacherTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [wsForm, setWsForm] = useState<{ open: boolean; initial: TestRow | null }>({ open: false, initial: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const reload = useCallback(async (s: IeltsSkill) => {
    setLoading(true);
    setOrderDirty(false);
    try {
      const [platform, all] = await Promise.all([
        // 'all' → the admin sees hidden entries too (that is the point of this page).
        fetchPlatformTests(s, { audience: 'all' }),
        getDocs(collection(db, COLLECTIONS[s])),
      ]);
      setPlatformTests(platform as TestRow[]);
      setTeacherTests(all.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t: TestRow) => t.source !== 'platform' && t.teacherId));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(skill); }, [skill, reload]);

  const filteredTeacher = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teacherTests;
    return teacherTests.filter((t) =>
      String(t.test_title || '').toLowerCase().includes(q) || String(t.teacherId || '').includes(q));
  }, [teacherTests, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this platform test permanently?')) return;
    setBusyId(id);
    try {
      await deleteIeltsTest(skill, id);
      setPlatformTests((p) => p.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const handlePromote = async (id: string) => {
    setBusyId(id);
    try {
      await promoteTestToPlatform(skill as never, id);
      toast.success('Promoted to platform dataset');
      reload(skill);
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  // --- ordering: reorder locally, persist once (one batch, 2 writes per test) ---
  const move = (index: number, delta: number) => {
    setPlatformTests((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await savePlatformTestOrder(skill, platformTests.map((t) => t.id));
      setPlatformTests((prev) => prev.map((t, i) => ({ ...t, catalogOrder: i })));
      setOrderDirty(false);
      toast.success('Order saved — teachers and students see this order now');
    } catch (e: any) { toast.error(e.message); } finally { setSavingOrder(false); }
  };

  const toggleVisibility = async (t: TestRow, key: 'hiddenFromStudents' | 'hiddenFromTeachers') => {
    const next = t[key] !== true;
    setBusyId(t.id);
    try {
      await setPlatformTestVisibility(skill, t.id, { [key]: next });
      setPlatformTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, [key]: next } : x)));
      toast.success(next
        ? `Hidden from ${key === 'hiddenFromStudents' ? 'students' : 'teachers'}`
        : `Visible to ${key === 'hiddenFromStudents' ? 'students' : 'teachers'}`);
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const editHref = (id: string) =>
    skill === 'reading' ? `/admin/ielts/reading/${id}`
      : skill === 'listening' ? `/admin/ielts/listening/${id}` : null;

  const meta = (t: TestRow) => {
    if (skill === 'reading') return `${t.passages?.length || 0} passages · ${t.total_questions || 0} Q · ${t.total_time_minutes || 60} min`;
    if (skill === 'listening') return `${t.parts?.length || 0} parts · ${t.total_questions || 0} Q · ${t.total_time_minutes || 32} min`;
    if (skill === 'writing') return 'Task 1 + Task 2';
    return `${(t.part1Questions?.length || 0) + (t.part3Questions?.length || 0) + 1} prompts`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">IELTS Platform Dataset</h1>
          <p className="text-sm text-slate-500">Ready-made practice tests available to every teacher and student.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
            <FileJson size={16} /> Import JSON
          </button>
          {(skill === 'reading' || skill === 'listening') && (
            <Link href={`/admin/ielts/${skill}/new`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700">
              <Plus size={16} /> New test
            </Link>
          )}
          {(skill === 'writing' || skill === 'speaking') && (
            <button onClick={() => setWsForm({ open: true, initial: null })}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-700">
              <Plus size={16} /> New {skill} set
            </button>
          )}
        </div>
      </div>

      {/* skill tabs */}
      <div className="flex gap-1 overflow-x-auto hide-scrollbar">
        {SKILLS.map((s) => (
          <button key={s.key} onClick={() => { setSkill(s.key); setWsForm({ open: false, initial: null }); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              skill === s.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
            <s.icon size={16} /> {s.label}
          </button>
        ))}
      </div>

      {/* inline W/S form */}
      {wsForm.open && (skill === 'writing' || skill === 'speaking') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <AdminLangProvider>
            {skill === 'writing' ? (
              <WritingForm asPlatform initial={wsForm.initial}
                onSaved={() => { setWsForm({ open: false, initial: null }); reload(skill); }}
                onCancel={() => setWsForm({ open: false, initial: null })} />
            ) : (
              <SpeakingForm asPlatform initial={wsForm.initial}
                onSaved={() => { setWsForm({ open: false, initial: null }); reload(skill); }}
                onCancel={() => setWsForm({ open: false, initial: null })} />
            )}
          </AdminLangProvider>
        </div>
      )}

      {/* platform catalog — order + visibility */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-900 text-sm">Platform catalog ({platformTests.length})</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Top to bottom = the order teachers and students see.
          </span>
          {orderDirty && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => reload(skill)} disabled={savingOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">
                <RotateCcw size={13} /> Reset
              </button>
              <button onClick={saveOrder} disabled={savingOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">
                {savingOrder ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save order
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : platformTests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No platform {skill} tests yet — create, import, or promote one below.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {platformTests.map((t, i) => {
              const hiddenS = t.hiddenFromStudents === true;
              const hiddenT = t.hiddenFromTeachers === true;
              return (
                <li key={t.id}
                  className={`px-3 py-3 flex flex-wrap items-center gap-3 ${hiddenS && hiddenT ? 'bg-slate-50/70' : ''}`}>
                  {/* order controls */}
                  <div className="flex items-center gap-1">
                    <span className="w-7 text-center text-[11px] font-black text-slate-400 tabular-nums">#{i + 1}</span>
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent"
                        title="Move up"><ArrowUp size={14} /></button>
                      <button onClick={() => move(i, 1)} disabled={i === platformTests.length - 1}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent"
                        title="Move down"><ArrowDown size={14} /></button>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className={`font-bold text-sm flex flex-wrap items-center gap-2 ${hiddenS && hiddenT ? 'text-slate-400' : 'text-slate-900'}`}>
                      {t.test_title || t.id}
                      {(skill === 'reading' || skill === 'listening') && !t.answers_split && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          <AlertTriangle size={11} /> legacy (answers inline)
                        </span>
                      )}
                      {hiddenS && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          <EyeOff size={11} /> students
                        </span>
                      )}
                      {hiddenT && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          <EyeOff size={11} /> teachers
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{meta(t)}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleVisibility(t, 'hiddenFromStudents')} disabled={busyId === t.id}
                      title={hiddenS ? 'Hidden from students — click to show' : 'Visible to students — click to hide'}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        hiddenS ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
                      <Users size={13} />{hiddenS ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => toggleVisibility(t, 'hiddenFromTeachers')} disabled={busyId === t.id}
                      title={hiddenT ? 'Hidden from teachers — click to show' : 'Visible to teachers — click to hide'}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        hiddenT ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}>
                      <GraduationCap size={13} />{hiddenT ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    {editHref(t.id) ? (
                      <Link href={editHref(t.id)!} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil size={15} />
                      </Link>
                    ) : (
                      <button onClick={() => setWsForm({ open: true, initial: t })}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit"><Pencil size={15} /></button>
                    )}
                    <button onClick={() => handleDelete(t.id)} disabled={busyId === t.id}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                      {busyId === t.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2 text-[11px] text-slate-500">
          <Info size={12} className="shrink-0" />
          <span>
            <Users size={11} className="inline mb-0.5" /> = student Practice Library ·{' '}
            <GraduationCap size={11} className="inline mb-0.5" /> = teacher library + assign picker.
            Hiding never touches attempts already taken.
          </span>
        </div>
      </section>

      {/* promote teacher tests */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-900 text-sm">Teacher tests — promote to dataset</span>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title / teacher uid"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>
        {filteredTeacher.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No teacher-authored {skill} tests found.</div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredTeacher.map((t) => (
              <li key={t.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-slate-900 text-sm">{t.test_title || t.id}</div>
                  <div className="text-xs text-slate-500">{meta(t)} · teacher {String(t.teacherId).slice(0, 8)}…</div>
                </div>
                <button onClick={() => handlePromote(t.id)} disabled={busyId === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">
                  {busyId === t.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpToLine size={13} />} Promote
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {importOpen && (
        <ImportJsonDialog skill={skill}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); reload(skill); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import dialog — all four skills, validated by lib/ielts/importValidation.ts
// ---------------------------------------------------------------------------

function IssueList({ issues, tone }: { issues: ImportIssue[]; tone: 'error' | 'warn' }) {
  const isErr = tone === 'error';
  return (
    <div className={`rounded-lg border p-3 space-y-2 max-h-60 overflow-y-auto ${
      isErr ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className={`text-xs font-black flex items-center gap-1.5 ${isErr ? 'text-rose-800' : 'text-amber-800'}`}>
        <AlertTriangle size={13} />
        {isErr ? `${issues.length} error${issues.length === 1 ? '' : 's'} — import blocked`
          : `${issues.length} warning${issues.length === 1 ? '' : 's'} — import allowed, but check these`}
      </div>
      {issues.map((e, i) => (
        <div key={i} className={`text-xs leading-relaxed ${isErr ? 'text-rose-700' : 'text-amber-800'}`}>
          {e.label && <div className="font-bold">{e.label}</div>}
          <div>
            <code className={`font-mono text-[11px] px-1 py-0.5 rounded ${isErr ? 'bg-rose-100' : 'bg-amber-100'}`}>{e.path}</code>
            {' '}{e.message}
          </div>
          {e.hint && <div className="opacity-80 italic">↳ {e.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function ImportJsonDialog({ skill, onClose, onImported }: {
  skill: IeltsSkill; onClose: () => void; onImported: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const reset = () => { setResult(null); setParseError(null); };

  const validate = () => {
    reset();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      // Point at the offending character — JSON.parse gives a position on most engines.
      const pos = /position (\d+)/.exec(String(e.message))?.[1];
      const line = pos ? raw.slice(0, Number(pos)).split('\n').length : null;
      setParseError(`Invalid JSON: ${e.message}${line ? ` (around line ${line})` : ''}`);
      return;
    }
    setResult(validateIeltsImport(parsed, { expectSkill: skill }));
  };

  const doImport = async () => {
    if (!result?.ok || !result.test) return;
    setSaving(true);
    try {
      const test = result.test;
      if (test.module === 'reading' || test.module === 'listening') {
        await saveIeltsTest(test as IeltsReadingTest | IeltsListeningTest, { asPlatform: true });
      } else if (test.module === 'writing') {
        await saveWritingTest(test as IeltsWritingTest, { asPlatform: true });
      } else {
        await saveSpeakingTest(test as IeltsSpeakingTest, { asPlatform: true });
      }
      toast.success(`Imported "${test.test_title}"`);
      onImported();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const summary = result?.ok ? result.summary : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900">Import {skill} test from JSON</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500">
          The paper is checked against the full structure contract before anything is written —
          per-type answer shapes, gap-token alignment, question numbering and option references.
          The authoring spec (hand it to an LLM to generate papers) lives in{' '}
          <code className="font-mono bg-slate-100 px-1 rounded">data/ielts practise/</code>.
        </p>
        <button onClick={() => setShowSample((s) => !s)} className="text-xs font-bold text-indigo-600 hover:underline">
          {showSample ? 'Hide' : 'Show'} minimal {skill} skeleton
        </button>
        {showSample && (
          <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre">{JSON_SAMPLES[skill]}</pre>
        )}
        <textarea value={raw} onChange={(e) => { setRaw(e.target.value); reset(); }}
          placeholder={`Paste the ${skill} test JSON here…`} spellCheck={false}
          className="w-full h-56 font-mono text-xs border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200" />

        {parseError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />{parseError}
          </div>
        )}
        {result && result.errors.length > 0 && <IssueList issues={result.errors} tone="error" />}
        {result && result.warnings.length > 0 && <IssueList issues={result.warnings} tone="warn" />}

        {summary && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold"><CheckCircle2 size={13} /> Valid — ready to import</div>
            <div>
              {summary.title} · {summary.module}
              {summary.category ? ` (${summary.category})` : ''} · {summary.sections} section(s) ·{' '}
              {summary.questions} question(s) · {summary.timeMinutes} min
            </div>
            <div className="text-emerald-700 font-mono text-[11px]">id: {summary.testId}</div>
            {Object.keys(summary.typeBreakdown).length > 0 && (
              <div className="text-emerald-700">
                {Object.entries(summary.typeBreakdown).map(([k, v]) => `${v} × ${k}`).join(', ')}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={validate} disabled={!raw.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            Validate
          </button>
          <button onClick={doImport} disabled={!result?.ok || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Import to dataset
          </button>
        </div>
      </div>
    </div>
  );
}
