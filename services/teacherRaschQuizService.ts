// services/teacherRaschQuizService.ts
//
// Every Firestore read and write for the teacher-built Rasch paper. The rules
// and the arithmetic live in lib/RASCHquiz.ts; this file only talks to the
// database. Contract + traps: docs/RASCH_QUIZ.md.

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
import {
  QUIZ_MAX_BYTES,
  newAccessCode,
  quizByteSize,
  quizSlotCount,
} from '@/lib/RASCHquiz';
import type {
  RaschQuizDraft,
  RaschQuizItem,
  RaschQuizResult,
  TeacherRaschQuiz,
} from '@/types/TeacherRaschQuiz';

const QUIZZES = 'teacher_rasch_quizzes';
const RESULTS = 'teacher_rasch_results';

/** How many times a colliding code is regenerated before we accept the risk. */
const CODE_ATTEMPTS = 5;

const fromDoc = (id: string, data: Record<string, unknown>): TeacherRaschQuiz => ({
  id,
  title: '',
  description: '',
  teacherId: '',
  teacherName: '',
  accessCode: '',
  questions: [],
  questionCount: 0,
  durationMinutes: 150,
  shuffle: false,
  showAnswers: true,
  status: 'draft',
  createdAt: null,
  updatedAt: null,
  ...(data as Partial<TeacherRaschQuiz>),
});

// ─── the access code ─────────────────────────────────────────────────────────

/**
 * A six-digit code that no OTHER quiz is currently using.
 *
 * `custom_tests.accessCode` has no uniqueness check at all, and it shows: two
 * tests sharing a code means the student's lookup silently opens the wrong one.
 * A million codes make a collision unlikely but not impossible, and one query per
 * attempt is cheap (it returns 0 documents on the happy path, so it is billed as
 * a single empty read).
 *
 * ⚠️ This is a check, not a constraint. Two teachers generating the same code in
 * the same instant both pass; `findQuizByCode` takes the FIRST published match,
 * so the loser's students would open the winner's paper. Making it airtight needs
 * a `rasch_quiz_codes/{code}` reservation document — worth doing if codes are
 * ever handed out at scale, and deliberately not done yet.
 */
export async function reserveAccessCode(): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = newAccessCode();
    const snap = await getDocs(
      query(collection(db, QUIZZES), where('accessCode', '==', code), limit(1)),
    );
    if (snap.empty) return code;
  }
  // Five collisions in a row means something is very wrong with the RNG, not
  // that the space is full. Hand back a code anyway rather than blocking a save.
  return newAccessCode();
}

// ─── teacher: create / read / update / delete ────────────────────────────────

/** Reserves a client-side id so the builder can route before the first write. */
export const newQuizId = (): string => `rq_${doc(collection(db, QUIZZES)).id}`;

/**
 * Writes the whole quiz document. One write, whatever the paper's length.
 *
 * Refuses a payload that would not fit: a Firestore document is capped at 1 MiB,
 * and failing at the moment of saving 45 hand-picked questions is the worst thing
 * this feature could do to a teacher. `slimQuizItem` (applied when a question is
 * added) keeps a normal paper an order of magnitude under the ceiling.
 */
export async function saveQuiz(id: string, draft: RaschQuizDraft): Promise<void> {
  const bytes = quizByteSize(draft.questions);
  if (bytes > QUIZ_MAX_BYTES) {
    throw new Error(`QUIZ_TOO_LARGE:${bytes}`);
  }

  const existing = await getDoc(doc(db, QUIZZES, id));

  await setDoc(
    doc(db, QUIZZES, id),
    {
      ...draft,
      id,
      questionCount: quizSlotCount(draft.questions),
      // serverTimestamp() is never overwritten on an edit — `orderBy createdAt`
      // on the teacher's list depends on it, exactly as the question bank does.
      createdAt: existing.exists() ? existing.data().createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}

/** Flip a paper between draft / published / closed without rewriting the body. */
export async function setQuizStatus(
  id: string,
  status: TeacherRaschQuiz['status'],
): Promise<void> {
  await updateDoc(doc(db, QUIZZES, id), { status, updatedAt: serverTimestamp() });
}

export async function deleteQuiz(id: string): Promise<void> {
  await deleteDoc(doc(db, QUIZZES, id));
}

/** One quiz by id. Used by the builder's `?id=` deep link. */
export async function getQuiz(id: string): Promise<TeacherRaschQuiz | null> {
  const snap = await getDoc(doc(db, QUIZZES, id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/**
 * The teacher's own papers, newest first.
 *
 * ⚠️ Reads the FULL documents, so a teacher with ten 45-question papers pulls
 * ten embedded question arrays for a list that shows only titles. The list is
 * capped at 20 for that reason; if it ever needs paging, the fix is a summary
 * mirror (`teacher_rasch_quizzes_index`), not a bigger limit.
 */
export async function listMyQuizzes(teacherId: string, max = 20): Promise<TeacherRaschQuiz[]> {
  const snap = await getDocs(
    query(
      collection(db, QUIZZES),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

// ─── student: open by code ───────────────────────────────────────────────────

export type QuizLookupError = 'not_found' | 'closed';

/**
 * The published paper carrying this code, or why there isn't one.
 *
 * Two equality filters and a limit — no composite index, and exactly one document
 * read for a whole 45-question paper. The status filter is applied CLIENT-side
 * after a single equality query on the code, so a closed paper can be reported as
 * closed instead of as a wrong code (a student typing a code their teacher has
 * since closed otherwise concludes they typed it wrong and retypes it forever).
 */
export async function findQuizByCode(
  code: string,
): Promise<{ quiz: TeacherRaschQuiz } | { error: QuizLookupError }> {
  const snap = await getDocs(
    query(collection(db, QUIZZES), where('accessCode', '==', code), limit(2)),
  );
  if (snap.empty) return { error: 'not_found' };

  const quizzes = snap.docs.map((d) => fromDoc(d.id, d.data()));
  const published = quizzes.find((q) => q.status === 'published');
  if (published) return { quiz: published };
  return { error: quizzes.some((q) => q.status === 'closed') ? 'closed' : 'not_found' };
}

// ─── results ─────────────────────────────────────────────────────────────────

/**
 * One document per student per quiz, at a DETERMINISTIC id.
 *
 * A retake overwrites rather than accumulating — the same rule
 * `attempts/{uid}_{assignmentId}` follows, and the same reason: "how did this
 * class do" is a per-student question, and counting documents to answer it goes
 * wrong the moment somebody sits the paper twice.
 *
 * This is a SEPARATE write from `saveExamResult`, which is what puts the sitting
 * on the student's own Rasch chart. They are two different facts (what the
 * teacher may see, and what the student's ability model knows) and neither should
 * fail because the other did — so the runner awaits them independently.
 */
export const resultId = (quizId: string, uid: string) => `${quizId}_${uid}`;

export async function saveQuizResult(result: RaschQuizResult): Promise<void> {
  await setDoc(doc(db, RESULTS, resultId(result.quizId, result.studentId)), result);
}

/** Has this student already sat this paper? One read; drives the "resit" notice. */
export async function getMyQuizResult(
  quizId: string,
  uid: string,
): Promise<RaschQuizResult | null> {
  const snap = await getDoc(doc(db, RESULTS, resultId(quizId, uid)));
  return snap.exists() ? (snap.data() as RaschQuizResult) : null;
}

/**
 * Every sitting of one paper, for its own teacher.
 *
 * Equality filters only — Firestore serves those without a composite index, so
 * the sort is done in memory. `teacherId` is in the query because the read RULE
 * proves ownership off that field: without it the query is not provable and comes
 * back permission-denied rather than empty.
 */
export async function listQuizResults(
  quizId: string,
  teacherId: string,
): Promise<RaschQuizResult[]> {
  const snap = await getDocs(
    query(
      collection(db, RESULTS),
      where('quizId', '==', quizId),
      where('teacherId', '==', teacherId),
    ),
  );
  return snap.docs
    .map((d) => d.data() as RaschQuizResult)
    .sort((a, b) => b.percent - a.percent || a.submittedAt - b.submittedAt);
}

/**
 * Every paper THIS student has sat — newest first, for the list on the code page.
 *
 * ⚠️ The `studentId ==` clause is what makes the query PROVABLE against the read
 * rule, exactly as `teacherId ==` is for `listQuizResults`. Drop it and Firestore
 * answers permission-denied, not "everyone's results".
 *
 * Equality-only, so it needs no composite index and the sort is done in memory —
 * `submittedAt` in an `orderBy` beside the filter would demand one. A student's
 * sittings are counted in tens, so `max` is a backstop rather than paging.
 */
export async function listMyQuizResults(uid: string, max = 30): Promise<RaschQuizResult[]> {
  const snap = await getDocs(
    query(collection(db, RESULTS), where('studentId', '==', uid)),
  );
  return snap.docs
    .map((d) => d.data() as RaschQuizResult)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, max);
}

// ─── builder helpers ─────────────────────────────────────────────────────────

/** Ids already on the paper — the pickers grey those rows out. */
export const pickedIds = (items: RaschQuizItem[]): Set<string> =>
  new Set(items.map((q) => q.id));
