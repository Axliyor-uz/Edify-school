// lib/ExamTeacher.ts
//
// Fills the teacher half of the Milliy sertifikat exam (slots 33–45) from
// `teacher_questions` (the v1 bank — see docs/QUESTIONS.md), while the first 32
// slots keep coming from `questions1` via lib/Examquestions.ts.
//
// Three things this module owns that the questions1 path never had to:
//
//   • images  — a v1 doc may carry a prompt image and per-option images.
//   • blocks  — `shared_options` (one printed A–F pool, several sub-questions)
//               and `multi_part` (a stem with parts a), b), …).
//   • taxonomy— teacher_questions is filed under the question_topics.json
//               taxonomy (subject/topic slugs), NOT the questions1 topicId/
//               chapterId ids. The two are a verified 1:1 mirror, so we bridge
//               by position and hand the RASCH pipeline questions1-shaped ids.
//
// ── The block COUNTING rule (the whole reason blocks are handled here) ───────
//   shared_options → each sub-question is ITS OWN exam slot. A 3-question block
//                    fills 3 slots (it is expanded into 3 flat closed items that
//                    all share the block's pool + diagram).
//   multi_part     → the WHOLE block is ONE exam slot, graded as one question
//                    (every part must be right), rendered as a single card.

import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizeQuestion } from './questionSchema';
import { findSubject } from './questionTopics';
import { padId } from './Mathstructure';
import { expectedAnswerText, isOpenAnswerCorrect } from './Examanswers';
import { isTextType } from '@/types/question';
import type { NormalizedQuestion, NormalizedOption } from '@/types/question';
import type { DifficultyId, DifficultyKey, Lang, LocalizedText, QuestionDoc } from '@/types/Math';
import type { BlueprintSection, ExamPart, ExamQuestion } from '@/types/Exam';

/** How many teacher docs to pull per subject and shuffle. The teacher slots
 *  are drawn from this page (the "read a page and shuffle" strategy — no `rand`
 *  field, no backfill). Bigger = better topic coverage, more reads. */
const POOL_LIMIT = 80;

const TEACHER_COLLECTION = 'teacher_questions';

// ─── taxonomy bridge (question_topics slugs ⇄ questions1 ids) ────────────────

/** questions1 subject id ("1"=Algebra, "2"=Geometriya) → question_topics slug. */
const SUBJECT_SLUG_BY_ID: Record<string, string> = { '1': 'algebra', '2': 'geometriya' };
const SUBJECT_ID_BY_SLUG: Record<string, string> = { algebra: '1', geometriya: '2' };

/**
 * The question_topics topic slug a questions1 chapter maps to. The two
 * taxonomies are the same 29 chapters in the same order (verified), so the
 * chapter's 1-based index is its position in the subject's `topics[]`.
 */
function slugForChapter(topicId: string, chapterId: string): string | null {
  const subjectSlug = SUBJECT_SLUG_BY_ID[topicId];
  const subject = subjectSlug ? findSubject(subjectSlug) : undefined;
  const idx = parseInt(chapterId, 10) - 1;
  return subject?.topics[idx]?.id ?? null;
}

/** The topic slugs a section's chapters accept, and the subject to fetch from. */
export function sectionTaxonomy(section: BlueprintSection): { subjectSlug: string; topicSlugs: Set<string> } {
  const subjectSlug = SUBJECT_SLUG_BY_ID[section.pools[0]?.topicId ?? '1'] ?? 'algebra';
  const topicSlugs = new Set<string>();
  for (const pool of section.pools) {
    const slug = slugForChapter(pool.topicId, pool.chapterId);
    if (slug) topicSlugs.add(slug);
  }
  return { subjectSlug, topicSlugs };
}

/**
 * A teacher doc's taxonomy slugs → the questions1-shaped ids the RASCH pipeline
 * groups on (topicId "1"/"2", chapterId/subtopicId zero-padded), so a teacher
 * item lands in the SAME chapter/subtopic bucket as a questions1 item on the
 * same topic. Falls back to the doc's own ids when the slug is off-taxonomy.
 */
function bankIds(n: NormalizedQuestion): { topicId: string; chapterId: string; subtopicId: string } {
  const topicId = SUBJECT_ID_BY_SLUG[n.subjectId];
  const subject = topicId ? findSubject(n.subjectId) : undefined;
  if (!topicId || !subject) return { topicId: n.topicId, chapterId: '', subtopicId: '' };

  const ci = subject.topics.findIndex((t) => t.id === n.topicId);
  const chapterId = ci >= 0 ? padId(ci + 1) : '';
  const si = ci >= 0 ? subject.topics[ci].subtopics.findIndex((s) => s.id === n.subtopicId) : -1;
  return { topicId, chapterId, subtopicId: si >= 0 ? padId(si + 1) : '' };
}

const DIFF_KEY_BY_ID: Record<number, DifficultyKey> = {
  0: 'easy', 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard', 5: 'hard',
};

const optionsRecord = (opts: NormalizedOption[]): Record<string, LocalizedText> =>
  Object.fromEntries(opts.map((o) => [o.id, o.text]));

const optionImages = (opts: NormalizedOption[]): Record<string, string | null> | undefined => {
  const entries = opts.filter((o) => o.imageUrl).map((o) => [o.id, o.imageUrl] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const asStr = (v: string | string[]): string => (Array.isArray(v) ? v[0] ?? '' : String(v ?? ''));

// ─── normalize → ExamQuestion cores ─────────────────────────────────────────

/** The questions1-shaped base every teacher exam item shares. slotNumber and
 *  the section fields are stamped on by buildExam. */
function baseDoc(n: NormalizedQuestion): QuestionDoc {
  const ids = bankIds(n);
  return {
    id: n.id,
    number: '',
    subjectId: ids.topicId,
    subject: n.subject,
    topicId: ids.topicId,
    topic: n.topic,
    subtopicId: ids.subtopicId,
    subtopic: n.subtopic,
    chapterId: ids.chapterId,
    chapter: n.chapter || n.topic,
    difficultyId: (n.difficultyId as DifficultyId) ?? 2,
    difficulty: DIFF_KEY_BY_ID[n.difficultyId] ?? 'medium',
    question: n.question,
    options: {} as QuestionDoc['options'],
    answer: '' as QuestionDoc['answer'],
    explanation: n.explanation,
    solutions: [],
    tags: n.tags,
    language: n.language,
    ...(typeof n.b === 'number' ? { b: n.b } : {}),
  };
}

/**
 * Where an item sits on the paper. The 45-question mock takes this from the
 * blueprint row it is filling; a teacher-built paper (docs/RASCH_QUIZ.md) derives
 * it per question from the chapter, since it fills no sections.
 */
export interface ExamSlotMeta {
  sectionId: string;
  sectionLabel: Record<Lang, string>;
  testType: BlueprintSection['testType'];
}

const slotMetaOf = (section: BlueprintSection): ExamSlotMeta => ({
  sectionId: section.id,
  sectionLabel: section.label,
  testType: section.testType,
});

/**
 * Turns one normalized teacher doc into the exam item(s) it contributes:
 *   • normal question   → 1 flat item
 *   • shared_options     → 1 GROUPED card, but it occupies N exam slots (one per
 *                          sub-question) — the pool + diagram are shown once and
 *                          each sub-question is scored on its own.
 *   • multi_part         → 1 card, 1 slot (graded all-parts-correct).
 * Returns a single card; `examSlotCount()` says how many slots it fills.
 *
 * Exported as `teacherExamItem` — the teacher quiz builder turns hand-picked
 * `teacher_questions` docs into exam items with the SAME function the mock exam
 * uses, so images, blocks and the taxonomy bridge behave identically on both.
 */
export function toExamItem(n: NormalizedQuestion, meta: ExamSlotMeta): ExamQuestion {
  const base = baseDoc(n);
  const section_ = {
    sectionId: meta.sectionId,
    sectionLabel: meta.sectionLabel,
    testType: meta.testType,
    source: 'teacher' as const,
    slotNumber: 0,
  };
  // Who made it — carried onto the exam item so the runner can show the author
  // even mid-exam. baseDoc's QuestionDoc shape has no room for these.
  const creator = { creatorId: n.creatorId, creatorName: n.creatorName, correctedBy: n.correctedBy };

  if (n.isBlock) {
    const sharedPool = n.optionList;
    const usesSharedPool = sharedPool.length > 0 && n.parts.every((p) => p.optionList === sharedPool);

    const parts: ExamPart[] = n.parts.map((p) => ({
      id: p.id,
      prompt: p.prompt,
      // A shared_options part answers by picking a pool letter — force `mcq`
      // even if the doc mislabels it `open` (the value is a letter, not text).
      qType: usesSharedPool ? 'mcq' : p.type,
      optionKeys: usesSharedPool ? p.optionList.map((o) => o.id) : (isTextType(p.type) ? [] : p.optionList.map((o) => o.id)),
      options: optionsRecord(p.optionList),
      optionImages: optionImages(p.optionList),
      answer: asStr(p.correctAnswer.value),
      acceptedAnswers: p.correctAnswer.acceptedAnswers,
      caseSensitive: p.correctAnswer.caseSensitive,
      explanation: p.explanation,
    }));

    return {
      ...base,
      ...section_,
      ...creator,
      // `shared_options` → the pool is shown ONCE and each sub-question counts as
      // its own question; `multi_part` → one card, one question.
      qType: usesSharedPool ? 'shared_options' : 'multi_part',
      imageUrl: n.imageUrl,
      parts,
      // The shared pool lives at the top level so it can be printed once.
      ...(usesSharedPool
        ? {
            options: optionsRecord(sharedPool),
            optionImages: optionImages(sharedPool),
            optionKeys: sharedPool.map((o) => o.id),
          }
        : {}),
    };
  }

  // Normal question — one flat item, closed or typed by its own type.
  const closed = !isTextType(n.type) && n.optionList.length > 0;
  return {
    ...base,
    ...section_,
    ...creator,
    qType: n.type,
    imageUrl: n.imageUrl,
    ...(closed
      ? {
          options: optionsRecord(n.optionList),
          optionImages: optionImages(n.optionList),
          optionKeys: n.optionList.map((o) => o.id),
          answer: asStr(n.correctAnswer.value) as QuestionDoc['answer'],
        }
      : {
          answer: asStr(n.correctAnswer.value) as QuestionDoc['answer'],
          acceptedAnswers: n.correctAnswer.acceptedAnswers,
          caseSensitive: n.correctAnswer.caseSensitive,
        }),
  };
}

/**
 * How many exam questions this item counts as. A `shared_options` block is worth
 * one per sub-question (the DTM "33-35 testlar" numbering); everything else is
 * one — a `multi_part` block included, since it is graded as a single question.
 */
export function examSlotCount(q: ExamQuestion): number {
  return q.qType === 'shared_options' && q.parts ? q.parts.length : 1;
}

/**
 * The stable ids of the SLOTS one item occupies — one per numbered question on
 * the paper, in slot order.
 *
 * ⚠️ **This is the one place the slot vocabulary is defined.** The same strings
 * are the `ItemResponse.id`s (`toItemResponses`), the keys of
 * `teacher_rasch_results.items`, and what the dynamic marks
 * ([lib/RASCHmarks.ts](RASCHmarks.ts)) aggregate per question across a cohort —
 * three surfaces that must agree exactly or a paper's statistics silently
 * scatter across two key spellings. It is NOT `partKey`: that keys the student's
 * ANSWERS map (`::`) and is a different namespace.
 */
export function examSlotKeys(q: ExamQuestion): string[] {
  if (q.qType === 'shared_options' && q.parts && q.parts.length > 0) {
    return q.parts.map((p) => `${q.id}#${p.id}`);
  }
  return [q.id];
}

/**
 * Points earned out of `examSlotCount(q)`:
 *   • shared_options → the number of sub-questions answered correctly (partial);
 *   • multi_part     → 1 iff every part is right (0 otherwise);
 *   • flat           → 1 iff correct.
 */
export function examScore(q: ExamQuestion, answers: Record<string, string>): number {
  if (q.qType === 'shared_options' && q.parts) {
    return q.parts.filter((p) => isExamPartCorrect(p, answers[partKey(q.id, p.id)])).length;
  }
  return isExamItemCorrect(q, answers) ? 1 : 0;
}

// ─── fetch + fill ────────────────────────────────────────────────────────────

/**
 * A random window of a subject's teacher questions, so two students draw
 * DIFFERENT questions — the same `rand`-threshold sampling questions1 uses.
 * Reads are billed here.
 *
 * Picks a fresh threshold per call and reads the docs whose `rand` sits just
 * above it (wrapping below if that window is thin). Legacy teacher docs written
 * before the `rand` backfill are absent from that index, so if the random query
 * comes back empty the subject falls back to a fixed createdAt page (shuffled) —
 * that path is not per-student, which is exactly what running the backfill fixes.
 *
 * A query failure (e.g. a missing index) must not sink the whole exam — the bank
 * sections (1–32) still load; this subject's teacher slots just come up short.
 */
async function fetchPool(
  subjectSlug: string,
  budget: { reads: number },
): Promise<NormalizedQuestion[]> {
  const bySubject = where('subject.id', '==', subjectSlug);

  try {
    const threshold = Math.random();
    const seen = new Set<string>();
    const docs: NormalizedQuestion[] = [];

    for (const op of ['>=', '<'] as const) {
      if (docs.length >= POOL_LIMIT) break;
      const snap = await getDocs(
        query(
          collection(db, TEACHER_COLLECTION),
          bySubject,
          where('rand', op, threshold),
          orderBy('rand'),
          limit(POOL_LIMIT - docs.length),
        ),
      );
      budget.reads += snap.size;
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        docs.push(normalizeQuestion({ id: d.id, ...d.data() }));
      }
    }

    if (docs.length > 0) return shuffle(docs);

    // No `rand`-bearing docs for this subject — fall back to a createdAt page.
    const legacy = await getDocs(
      query(collection(db, TEACHER_COLLECTION), bySubject, orderBy('createdAt', 'desc'), limit(POOL_LIMIT)),
    );
    budget.reads += legacy.size;
    return shuffle(legacy.docs.map((d) => normalizeQuestion({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error(`[exam] teacher_questions fetch failed for subject "${subjectSlug}"`, err);
    return [];
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A per-build cache so several sections on one subject share a single read. */
export interface TeacherPools {
  bySubject: Map<string, NormalizedQuestion[]>;
  used: Set<string>;
  budget: { reads: number };
}

export function newTeacherPools(): TeacherPools {
  return { bySubject: new Map(), used: new Set(), budget: { reads: 0 } };
}

/**
 * Fills one `source: 'teacher'` section, up to `section.count` exam slots, from
 * the subject's shuffled pool — expanding blocks per the counting rule and
 * never reusing a doc already placed in an earlier section.
 */
export async function buildTeacherSection(
  section: BlueprintSection,
  pools: TeacherPools,
): Promise<ExamQuestion[]> {
  const { subjectSlug, topicSlugs } = sectionTaxonomy(section);

  let pool = pools.bySubject.get(subjectSlug);
  if (!pool) {
    pool = await fetchPool(subjectSlug, pools.budget);
    pools.bySubject.set(subjectSlug, pool);
  }

  const items: ExamQuestion[] = [];
  let slots = 0; // exam questions placed so far (a shared_options card is worth N)
  for (const n of pool) {
    const remaining = section.count - slots;
    if (remaining <= 0) break;
    if (pools.used.has(n.id)) continue;
    if (topicSlugs.size > 0 && !topicSlugs.has(n.topicId)) continue;

    const card = toExamItem(n, slotMetaOf(section));
    const cardSlots = examSlotCount(card);
    // A shared_options block occupies one slot PER sub-question — it is placed
    // whole or not at all, never truncated. If it doesn't fit the slots left,
    // skip it (it stays available for a later section) and keep scanning.
    if (cardSlots > remaining) continue;

    pools.used.add(n.id);
    items.push(card);
    slots += cardSlots;
  }

  return items;
}

// ─── grading + rendering helpers (shared by the page and toItemResponses) ────

const OPTION_KEYS_DEFAULT = ['A', 'B', 'C', 'D'];

/** The option ids to render for a closed item — A–F for a teacher pool, A–D for
 *  a questions1 item. */
export function examOptionKeys(q: ExamQuestion): string[] {
  return q.optionKeys && q.optionKeys.length > 0 ? q.optionKeys : OPTION_KEYS_DEFAULT;
}

export type ExamMode = 'block' | 'open' | 'closed';

/** How to render/grade an item: a block card, a typed input, or option buttons. */
export function examMode(q: ExamQuestion): ExamMode {
  if (q.parts && q.parts.length > 0) return 'block';
  if (q.source === 'teacher') return isTextType(q.qType ?? 'mcq') ? 'open' : 'closed';
  // A questions1 item: the section's test type decides (O = typed).
  return q.testType === 'O' ? 'open' : 'closed';
}

const squashSpace = (s: string) => s.replace(/\s+/g, ' ').trim();
const squashNumeric = (s: string) => squashSpace(s).replace(/,/g, '.').replace(/\s/g, '');

/** Typed-answer match for a teacher open/numeric item (mirrors questionSchema). */
function textMatch(
  given: string | undefined,
  answer: string,
  accepted: string[] = [],
  caseSensitive = false,
  numeric = false,
): boolean {
  const prep = (s: string) => {
    const t = numeric ? squashNumeric(s) : squashSpace(s);
    return caseSensitive ? t : t.toLowerCase();
  };
  const g = prep(given ?? '');
  if (!g) return false;
  return [answer, ...accepted].filter((c) => c.trim() !== '').some((c) => prep(c) === g);
}

/** The answer key for a block part: `answers[`${q.id}::${partId}`]`. */
export const partKey = (questionId: string, partId: string) => `${questionId}::${partId}`;

export function isExamPartCorrect(p: ExamPart, given: string | undefined): boolean {
  if (isTextType(p.qType)) {
    return textMatch(given, p.answer, p.acceptedAnswers, p.caseSensitive, p.qType === 'numeric');
  }
  return !!given && given === p.answer;
}
const partCorrect = isExamPartCorrect;

/** The correct answer to show for one block part — option text, or the literal
 *  typed answer. */
export function examPartExpected(p: ExamPart, lang: Lang): string {
  if (isTextType(p.qType)) return p.answer;
  return p.options[p.answer]?.[lang] || p.options[p.answer]?.uz || p.answer;
}

/** THE grading entry point for an exam item — closed, typed, block, bank or
 *  teacher. A block is correct only when every part is (it counts as one). */
export function isExamItemCorrect(q: ExamQuestion, answers: Record<string, string>): boolean {
  const mode = examMode(q);
  if (mode === 'block') {
    return (q.parts ?? []).every((p) => partCorrect(p, answers[partKey(q.id, p.id)]));
  }
  if (mode === 'open') {
    if (q.source === 'teacher') {
      return textMatch(answers[q.id], q.answer, q.acceptedAnswers, q.caseSensitive, q.qType === 'numeric');
    }
    return isOpenAnswerCorrect(answers[q.id], q); // bank O — graded off the doc
  }
  return !!answers[q.id] && answers[q.id] === q.answer;
}

/** True when the student has put anything down (any part, for a block). */
export function hasExamAnswer(q: ExamQuestion, answers: Record<string, string>): boolean {
  if (q.parts && q.parts.length > 0) {
    return q.parts.some((p) => (answers[partKey(q.id, p.id)] ?? '').trim() !== '');
  }
  return (answers[q.id] ?? '').trim() !== '';
}

/** What goes into ItemResponse.chosen — '' means "unanswered", which the
 *  abandoned-paper guard and the diagnosis both key off. */
export function examChosen(q: ExamQuestion, answers: Record<string, string>): string {
  if (q.parts && q.parts.length > 0) {
    return q.parts.map((p) => answers[partKey(q.id, p.id)] ?? '').filter((v) => v.trim() !== '').join(', ');
  }
  return answers[q.id] ?? '';
}

/** The answer to show on the results screen for a flat item (blocks show per
 *  part in the UI). */
export function examExpectedText(q: ExamQuestion, lang: Lang): string {
  if (examMode(q) === 'open') {
    return q.source === 'teacher' ? q.answer : expectedAnswerText(q, lang);
  }
  const opt = (q.options as Record<string, LocalizedText>)[q.answer];
  return opt?.[lang] || opt?.uz || q.answer;
}
