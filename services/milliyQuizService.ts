// services/milliyQuizService.ts
//
// Every Firestore read and write for the teacher-built **Milliy sertifikat
// subject paper** (biology, chemistry, physics, ona tili; English next). The rules
// and the arithmetic live in lib/MilliyQuiz.ts; this file only talks to the
// database. Contract + traps: docs/MILLIY_QUIZ.md.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { newAccessCode } from '@/lib/RASCHquiz';
import { MILLIY_MAX_BYTES, milliyByteSize, milliySlotCount } from '@/lib/MilliyQuiz';
import { findQuizByCode } from './teacherRaschQuizService';
import type {
  MilliyQuiz,
  MilliyQuizDraft,
  MilliyQuizResult,
  MilliySubjectId,
} from '@/types/MilliyQuiz';
import type { TeacherRaschQuiz } from '@/types/TeacherRaschQuiz';

const QUIZZES = 'milliy_quizzes';
const RESULTS = 'milliy_quiz_results';

/** How many times a colliding code is regenerated before we accept the risk. */
const CODE_ATTEMPTS = 5;

const fromDoc = (id: string, data: Record<string, unknown>): MilliyQuiz => ({
  id,
  subject: 'biologiya',
  title: '',
  description: '',
  teacherId: '',
  teacherName: '',
  accessCode: '',
  questions: [],
  questionCount: 0,
  questionTarget: 30,
  durationMinutes: 90,
  shuffle: false,
  showAnswers: true,
  status: 'draft',
  createdAt: null,
  updatedAt: null,
  ...(data as Partial<MilliyQuiz>),
});

// ─── the access code ─────────────────────────────────────────────────────────

/**
 * A six-digit code no OTHER paper is using — **checked across BOTH collections**.
 *
 * ⚠️ This is the one place the two paper systems have to agree. The student types
 * one code into one box, and `findPaperByCode` searches `milliy_quizzes` and
 * `teacher_rasch_quizzes`; a code that exists in both would resolve to whichever
 * query is consulted first, and one teacher's class would sit another's paper.
 *
 * ⚠️ It is still a check, not a constraint. Two teachers generating the same code
 * in the same instant both pass. Making it airtight needs a
 * `milliy_quiz_codes/{code}` reservation document written in a transaction —
 * deliberately not done yet, and the same limitation
 * `reserveAccessCode` documents.
 */
export async function reserveMilliyCode(): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = newAccessCode();
    const [mine, rasch] = await Promise.all([
      getDocs(query(collection(db, QUIZZES), where('accessCode', '==', code), limit(1))),
      getDocs(query(collection(db, 'teacher_rasch_quizzes'), where('accessCode', '==', code), limit(1))),
    ]);
    if (mine.empty && rasch.empty) return code;
  }
  // Five collisions in a row means something is wrong with the RNG, not that the
  // space is full. Hand back a code rather than blocking a teacher's save.
  return newAccessCode();
}

// ─── teacher: create / read / update / delete ────────────────────────────────

/** Reserves a client-side id so the builder can route before the first write. */
export const newMilliyQuizId = (): string => `ms_${doc(collection(db, QUIZZES)).id}`;

/**
 * Writes the whole paper document. One write, whatever its length.
 *
 * Refuses a payload that would not fit: a Firestore document is capped at 1 MiB,
 * and failing at the moment of saving a hand-picked paper is the worst thing this
 * feature could do to a teacher. `slimMilliyItem` (applied on every add) keeps a
 * normal paper an order of magnitude under the ceiling.
 */
export async function saveMilliyQuiz(id: string, draft: MilliyQuizDraft): Promise<void> {
  const bytes = milliyByteSize(draft.questions);
  if (bytes > MILLIY_MAX_BYTES) {
    throw new Error(`QUIZ_TOO_LARGE:${bytes}`);
  }

  const existing = await getDoc(doc(db, QUIZZES, id));

  await setDoc(
    doc(db, QUIZZES, id),
    {
      ...draft,
      id,
      questionCount: milliySlotCount(draft.questions),
      // ⚠️ serverTimestamp() is never overwritten on an edit — `orderBy createdAt`
      // on the teacher's list depends on it, exactly as the question bank does.
      createdAt: existing.exists() ? existing.data().createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}

/** Flip a paper between draft / published / closed without rewriting the body. */
export async function setMilliyQuizStatus(
  id: string,
  status: MilliyQuiz['status'],
): Promise<void> {
  await updateDoc(doc(db, QUIZZES, id), { status, updatedAt: serverTimestamp() });
}

export async function deleteMilliyQuiz(id: string): Promise<void> {
  await deleteDoc(doc(db, QUIZZES, id));
}

/** One paper by id. Used by the builder's `?id=` deep link. */
export async function getMilliyQuiz(id: string): Promise<MilliyQuiz | null> {
  const snap = await getDoc(doc(db, QUIZZES, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/**
 * The teacher's own papers for ONE subject, newest first.
 *
 * ⚠️ Reads the FULL documents, so ten papers pull ten embedded question arrays
 * for a list that shows only titles — capped at 20 for that reason, exactly as
 * `listMyQuizzes` is. If it ever needs paging, the fix is a summary mirror, not a
 * bigger limit.
 *
 * Needs the composite index `milliy_quizzes (teacherId ASC, subject ASC,
 * createdAt DESC)`.
 */
export async function listMyMilliyQuizzes(
  teacherId: string,
  subject: MilliySubjectId,
  max = 20,
): Promise<MilliyQuiz[]> {
  const snap = await getDocs(
    query(
      collection(db, QUIZZES),
      where('teacherId', '==', teacherId),
      where('subject', '==', subject),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

// ─── student: open by code ───────────────────────────────────────────────────

export type PaperLookupError = 'not_found' | 'closed';

/**
 * What one 6-digit code resolved to.
 *
 * ⚠️ Two shapes, because the two paper systems are genuinely different: a
 * `rasch` paper moves the student's measured maths ability (`RASCH_levels`), a
 * `generic` one is scored on raw counts only. The caller MUST branch — sitting a
 * biology paper through the Rasch save path would write a maths θ from biology
 * answers.
 */
export type PaperLookup =
  | { kind: 'rasch'; quiz: TeacherRaschQuiz }
  | { kind: 'generic'; quiz: MilliyQuiz }
  | { error: PaperLookupError };

/**
 * The published paper carrying this code — from EITHER collection.
 *
 * The student's single code box is the whole reason this function exists: they
 * type six digits and should not have to know which subsystem stores their
 * subject. Both queries are equality-only with `limit`, so this is **at most two
 * document reads** (usually one plus one empty query) for a whole paper.
 *
 * The status filter is applied CLIENT-side after the equality query, so a closed
 * paper is reported as *closed* rather than as a wrong code — a student told
 * "wrong code" retypes it forever.
 */
export async function findPaperByCode(code: string): Promise<PaperLookup> {
  const [mineSnap, rasch] = await Promise.all([
    getDocs(query(collection(db, QUIZZES), where('accessCode', '==', code), limit(2))),
    findQuizByCode(code),
  ]);

  const mine = mineSnap.docs.map((d) => fromDoc(d.id, d.data()));
  const publishedMine = mine.find((q) => q.status === 'published');
  if (publishedMine) return { kind: 'generic', quiz: publishedMine };

  // A live maths paper wins over a CLOSED subject paper: "closed" is only the
  // right answer when nothing published anywhere carries this code.
  if ('quiz' in rasch) return { kind: 'rasch', quiz: rasch.quiz };

  const closedHere = mine.some((q) => q.status === 'closed');
  if (closedHere || rasch.error === 'closed') return { error: 'closed' };
  return { error: 'not_found' };
}

// ─── results ─────────────────────────────────────────────────────────────────

/**
 * One document per student per paper, at a DETERMINISTIC id — so a retake
 * OVERWRITES rather than accumulating. Same rule (and same reason) as
 * `attempts/{uid}_{assignmentId}` and `teacher_rasch_results`: "how did this
 * class do" is a per-student question, and counting documents to answer it goes
 * wrong the moment somebody sits the paper twice.
 *
 * ⚠️ Unlike the maths paper, there is exactly ONE write on submit. A maths
 * sitting also writes the student's Rasch levels; a biology sitting has no
 * ability model to move (see types/MilliyQuiz.ts), so nothing else happens.
 */
export const milliyResultId = (quizId: string, uid: string) => `${quizId}_${uid}`;

export async function saveMilliyResult(result: MilliyQuizResult): Promise<void> {
  await setDoc(doc(db, RESULTS, milliyResultId(result.quizId, result.studentId)), result);
}

/** Has this student already sat this paper? One read; drives the "resit" notice. */
export async function getMyMilliyResult(
  quizId: string,
  uid: string,
): Promise<MilliyQuizResult | null> {
  const snap = await getDoc(doc(db, RESULTS, milliyResultId(quizId, uid)));
  return snap.exists() ? (snap.data() as MilliyQuizResult) : null;
}

/**
 * Every sitting of one paper, for its own teacher.
 *
 * Equality filters only — Firestore serves those from single-field indexes, so
 * the sort is done in memory. ⚠️ `teacherId` is in the query because the read
 * RULE proves ownership off that field: without it the query is not provable and
 * comes back permission-denied rather than empty.
 */
export async function listMilliyResults(
  quizId: string,
  teacherId: string,
): Promise<MilliyQuizResult[]> {
  const snap = await getDocs(
    query(
      collection(db, RESULTS),
      where('quizId', '==', quizId),
      where('teacherId', '==', teacherId),
    ),
  );
  return snap.docs
    .map((d) => d.data() as MilliyQuizResult)
    .sort((a, b) => b.percent - a.percent || a.submittedAt - b.submittedAt);
}

/**
 * Every subject paper THIS student has sat — newest first, for the list under the
 * code box.
 *
 * ⚠️ The `studentId ==` clause is what makes the query PROVABLE against the read
 * rule, exactly as `teacherId ==` is for `listMilliyResults`. Drop it and
 * Firestore answers permission-denied, not "everyone's results".
 *
 * Equality-only, so no composite index is needed and the sort is in memory — an
 * `orderBy submittedAt` beside the filter would demand one.
 */
export async function listMyMilliyResults(uid: string, max = 30): Promise<MilliyQuizResult[]> {
  const snap = await getDocs(
    query(collection(db, RESULTS), where('studentId', '==', uid)),
  );
  return snap.docs
    .map((d) => d.data() as MilliyQuizResult)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, max);
}
